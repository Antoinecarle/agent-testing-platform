const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { generateWorkspaceContext, readBranchContext } = require('./workspace');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;

// Track file hashes to detect real changes
const fileHashes = new Map();
// Track active watchers per project
const watchers = new Map();
// Debounce timers per project
const debounceTimers = new Map();
// Polling interval ref
let pollTimer = null;
// Poll interval: 5s on Railway (fs.watch unreliable), 10s locally as fallback
const POLL_INTERVAL_MS = IS_RAILWAY ? 5000 : 10000;

// Socket.IO server ref (set during init)
let ioRef = null;

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Scan a workspace directory and find ALL .html files (root + subdirs)
 * Returns array of { path, name, subdir, mtime }
 */
function scanWorkspaceHtmlFiles(wsDir) {
  if (!fs.existsSync(wsDir)) return [];

  const candidates = [];

  try {
    // Root-level HTML files
    const rootFiles = fs.readdirSync(wsDir)
      .filter(f => f.endsWith('.html') && !f.startsWith('.'));
    for (const f of rootFiles) {
      const fp = path.join(wsDir, f);
      try {
        candidates.push({ path: fp, name: f, subdir: null, mtime: fs.statSync(fp).mtimeMs });
      } catch (_) {}
    }

    // Subdirectory HTML files (version-1/index.html, etc.)
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subDir = path.join(wsDir, entry.name);
      try {
        const subFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.html') && !f.startsWith('.'));
        for (const f of subFiles) {
          const fp = path.join(subDir, f);
          try {
            candidates.push({ path: fp, name: f, subdir: entry.name, mtime: fs.statSync(fp).mtimeMs });
          } catch (_) {}
        }
      } catch (_) {}
    }
  } catch (_) {}

  return candidates;
}

/**
 * Find ALL html files in subdirectories (for multi-version parallel imports)
 */
function findAllSubdirHtmls(wsDir) {
  if (!fs.existsSync(wsDir)) return [];

  const results = [];
  try {
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const subDir = path.join(wsDir, entry.name);
      const indexPath = path.join(subDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        results.push({ subdir: entry.name, path: indexPath });
      } else {
        // Check for any .html file
        try {
          const htmlFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.html'));
          if (htmlFiles.length > 0) {
            results.push({ subdir: entry.name, path: path.join(subDir, htmlFiles[0]) });
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return results;
}

/**
 * Import a single HTML file as an iteration
 * @param {string} projectId
 * @param {string} htmlPath - absolute path to HTML file
 * @param {string|null} titleOverride - custom title (null = auto V{n})
 * @param {string|null|undefined} parentIdOverride - explicit parent (null=root, undefined=auto-detect)
 */
async function importSingleHtml(projectId, htmlPath, titleOverride, parentIdOverride) {
  let content;
  try {
    content = fs.readFileSync(htmlPath, 'utf-8');
  } catch (err) {
    console.error(`[Watcher] Cannot read ${htmlPath}:`, err.message);
    return null;
  }
  if (!content || content.trim().length < 50) return null;

  const hash = hashContent(content);
  const hashKey = `${projectId}:${htmlPath}`;
  const previousHash = fileHashes.get(hashKey);
  if (previousHash === hash) return null;
  fileHashes.set(hashKey, hash);

  try {
    const project = await db.getProject(projectId);
    if (!project) return null;

    const agentName = project.agent_name || 'unknown';
    const id = crypto.randomUUID();
    const version = await db.getNextVersion(projectId);

    // Determine parent
    let parentId;
    if (parentIdOverride !== undefined) {
      // Explicit override (null = root, string = specific parent)
      parentId = parentIdOverride;
    } else {
      // Read branch context
      const branchCtx = readBranchContext(projectId);
      if (branchCtx) {
        parentId = branchCtx.parentId;
        const ctxPath = path.join(WORKSPACES_DIR, projectId, '.branch-context.json');
        try { fs.unlinkSync(ctxPath); } catch (_) {}
      } else {
        // Default: chain to latest
        const iterations = await db.getIterationsByProject(projectId);
        parentId = iterations.length > 0 ? iterations[iterations.length - 1].id : null;
      }
    }

    // Copy HTML to iterations directory
    const projectIterDir = path.join(ITERATIONS_DIR, projectId);
    if (!fs.existsSync(projectIterDir)) fs.mkdirSync(projectIterDir, { recursive: true });

    const iterDir = path.join(projectIterDir, id);
    fs.mkdirSync(iterDir, { recursive: true });
    fs.writeFileSync(path.join(iterDir, 'index.html'), content);
    const filePath = `${projectId}/${id}/index.html`;

    // Use auto-versioning V{n} as default, only override if a real title was provided
    const title = titleOverride || `V${version}`;
    await db.createIteration(id, projectId, agentName, version, title, '', parentId, filePath, '', 'completed', {});

    const count = await db.countIterations(projectId);
    await db.updateProjectIterationCount(projectId, count);

    console.log(`[Watcher] Imported iteration ${title} (parent: ${parentId || 'ROOT'}) for project ${project.name} (${id})`);

    if (ioRef) {
      ioRef.emit('iteration-created', {
        projectId,
        iteration: await db.getIteration(id),
      });
    }

    return id;
  } catch (err) {
    // Rollback hash so the file will be retried on next poll
    if (previousHash !== undefined) {
      fileHashes.set(hashKey, previousHash);
    } else {
      fileHashes.delete(hashKey);
    }
    console.error(`[Watcher] DB error importing ${htmlPath} for project ${projectId}:`, err.message);
    return null;
  }
}

/**
 * Import from workspace into iterations.
 * Subdirectory-based versions (version-1/, version-2/) are treated as parallel roots.
 * Root-level HTML files are chained to the latest iteration.
 */
async function importIteration(projectId) {
  const wsDir = path.join(WORKSPACES_DIR, projectId);
  let imported = null;

  // First: check for subdirectory-based versions that haven't been imported yet
  const subdirHtmls = findAllSubdirHtmls(wsDir);
  if (subdirHtmls.length > 0) {
    subdirHtmls.sort((a, b) => a.subdir.localeCompare(b.subdir, undefined, { numeric: true }));

    // Count how many NEW subdirs need importing
    const newItems = subdirHtmls.filter(item => {
      const hashKey = `${projectId}:${item.path}`;
      try {
        const content = fs.readFileSync(item.path, 'utf-8');
        return fileHashes.get(hashKey) !== hashContent(content);
      } catch (_) { return false; }
    });

    // If multiple new subdirs at once → they are parallel versions (all roots)
    // If single new subdir → chain to latest (normal iteration)
    const isParallelBatch = newItems.length > 1;

    for (const item of subdirHtmls) {
      const hashKey = `${projectId}:${item.path}`;
      let content;
      try { content = fs.readFileSync(item.path, 'utf-8'); } catch (_) { continue; }
      const hash = hashContent(content);
      if (fileHashes.get(hashKey) !== hash) {
        const vMatch = item.subdir.match(/(?:version-?|v)(\d+)/i);
        const title = vMatch ? `V${vMatch[1]}` : item.subdir;
        // Parallel batch → force root (null), single → auto-detect (undefined)
        const parentOverride = isParallelBatch ? null : undefined;
        const result = await importSingleHtml(projectId, item.path, title, parentOverride);
        if (result) imported = result;
      }
    }
  }

  // Then: check ALL root-level HTML files
  if (fs.existsSync(wsDir)) {
    let rootHtmlFiles;
    try {
      rootHtmlFiles = fs.readdirSync(wsDir)
        .filter(f => f.endsWith('.html') && !f.startsWith('.'))
        .sort((a, b) => {
          try {
            return fs.statSync(path.join(wsDir, a)).mtimeMs - fs.statSync(path.join(wsDir, b)).mtimeMs;
          } catch (_) { return 0; }
        });
    } catch (_) { rootHtmlFiles = []; }

    const isParallelRootBatch = rootHtmlFiles.filter(f => {
      const fp = path.join(wsDir, f);
      const hashKey = `${projectId}:${fp}`;
      try {
        const content = fs.readFileSync(fp, 'utf-8');
        return fileHashes.get(hashKey) !== hashContent(content);
      } catch (_) { return false; }
    }).length > 1;

    for (const f of rootHtmlFiles) {
      const fp = path.join(wsDir, f);
      const baseName = f.replace(/\.html$/, '');

      // Derive title: index.html → null (auto V{n}), version-1.html → V1, other.html → other
      let title = null; // null = auto V{n}
      if (baseName !== 'index') {
        const vMatch = baseName.match(/(?:version-?|v)(\d+)/i);
        title = vMatch ? `V${vMatch[1]}` : baseName;
      }

      const parentOverride = isParallelRootBatch ? null : undefined;
      const result = await importSingleHtml(projectId, fp, title, parentOverride);
      if (result) imported = result;
    }
  }

  // Refresh CLAUDE.md once after all imports
  if (imported) {
    try { generateWorkspaceContext(projectId); } catch (_) {}
  }

  return imported;
}

/**
 * Debounced trigger for import
 */
function triggerImport(projectId) {
  if (debounceTimers.has(projectId)) {
    clearTimeout(debounceTimers.get(projectId));
  }
  debounceTimers.set(projectId, setTimeout(async () => {
    debounceTimers.delete(projectId);
    try {
      await importIteration(projectId);
    } catch (err) {
      console.error(`[Watcher] Import error for ${projectId}:`, err.message);
    }
  }, 2000));
}

/**
 * Poll all watched workspaces for new/changed HTML files
 * This is the reliable fallback when fs.watch doesn't fire (Railway, Docker, NFS, etc.)
 */
async function pollAllWorkspaces() {
  for (const projectId of watchers.keys()) {
    try {
      await importIteration(projectId);
    } catch (err) {
      console.error(`[Watcher/Poll] Error scanning ${projectId}:`, err.message);
    }
  }
}

/**
 * Start watching a project workspace (fs.watch + polling fallback)
 */
function watchProject(projectId) {
  if (watchers.has(projectId)) return; // Already watching

  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  // Initialize hashes from existing files (so we don't re-import old files)
  const allFiles = scanWorkspaceHtmlFiles(wsDir);
  for (const item of allFiles) {
    try {
      const content = fs.readFileSync(item.path, 'utf-8');
      fileHashes.set(`${projectId}:${item.path}`, hashContent(content));
    } catch (_) {}
  }

  const projectWatchers = [];

  try {
    // Watch root directory (best-effort — may not work on Railway)
    const rootWatcher = fs.watch(wsDir, (eventType, filename) => {
      if (!filename || filename.startsWith('.')) return;

      // If a new directory was created, watch it too
      if (eventType === 'rename') {
        const fullPath = path.join(wsDir, filename);
        try {
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            watchSubdir(projectId, fullPath, projectWatchers);
          }
        } catch (_) {}
      }

      if (filename.endsWith('.html')) {
        triggerImport(projectId);
      }
    });
    projectWatchers.push(rootWatcher);

    // Watch existing subdirectories
    try {
      const entries = fs.readdirSync(wsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          watchSubdir(projectId, path.join(wsDir, entry.name), projectWatchers);
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn(`[Watcher] fs.watch failed for ${projectId} (using polling only):`, err.message);
  }

  watchers.set(projectId, projectWatchers);
}

/**
 * Watch a subdirectory within a workspace
 */
function watchSubdir(projectId, dirPath, watchersList) {
  try {
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      if (!filename || !filename.endsWith('.html') || filename.startsWith('.')) return;
      triggerImport(projectId);
    });
    watchersList.push(watcher);
  } catch (_) {}
}

/**
 * Stop watching a project
 */
function unwatchProject(projectId) {
  const projectWatchers = watchers.get(projectId);
  if (projectWatchers) {
    if (Array.isArray(projectWatchers)) {
      for (const w of projectWatchers) { try { w.close(); } catch (_) {} }
    } else {
      try { projectWatchers.close(); } catch (_) {}
    }
    watchers.delete(projectId);
  }
  if (debounceTimers.has(projectId)) {
    clearTimeout(debounceTimers.get(projectId));
    debounceTimers.delete(projectId);
  }
}

/**
 * Initialize watchers for all existing projects + start polling
 */
async function initWatchers(io) {
  ioRef = io;

  // Watch all projects that have workspaces
  if (fs.existsSync(WORKSPACES_DIR)) {
    try {
      const dirs = fs.readdirSync(WORKSPACES_DIR).filter(d => {
        try { return fs.statSync(path.join(WORKSPACES_DIR, d)).isDirectory(); }
        catch (_) { return false; }
      });
      for (const dir of dirs) {
        watchProject(dir);
      }
    } catch (_) {}
  }

  // Also watch all active projects (creates workspace if needed)
  const projects = await db.getAllProjects();
  for (const project of projects) {
    watchProject(project.id);
  }

  // Start polling as reliable fallback
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(pollAllWorkspaces, POLL_INTERVAL_MS);
  if (pollTimer.unref) pollTimer.unref();

  console.log(`[Watcher] Monitoring ${watchers.size} project workspaces (polling every ${POLL_INTERVAL_MS / 1000}s)`);
}

/**
 * Manually trigger import for a project (API use)
 */
async function manualImport(projectId) {
  // Reset all hashes for this project to force re-import
  for (const key of fileHashes.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      fileHashes.delete(key);
    }
  }
  return await importIteration(projectId);
}

/**
 * Scan a specific project NOW (called when terminal exits, agent finishes, etc.)
 * Unlike manualImport, this doesn't clear hashes — it just checks for new/changed files.
 */
async function scanProject(projectId) {
  try {
    // Ensure we're watching this project
    if (!watchers.has(projectId)) {
      watchProject(projectId);
    }
    return await importIteration(projectId);
  } catch (err) {
    console.error(`[Watcher] Scan error for ${projectId}:`, err.message);
    return null;
  }
}

module.exports = {
  initWatchers,
  watchProject,
  unwatchProject,
  importIteration,
  manualImport,
  scanProject,
};
