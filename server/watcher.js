const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { generateWorkspaceContext, readBranchContext } = require('./workspace');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');

// Track file hashes to detect real changes
const fileHashes = new Map();
// Track active watchers per project
const watchers = new Map();
// Debounce timers per project
const debounceTimers = new Map();

// Socket.IO server ref (set during init)
let ioRef = null;

function hashContent(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Find the most recently modified .html file in a workspace (root + subdirs)
 */
function findLatestHtml(wsDir) {
  if (!fs.existsSync(wsDir)) return null;

  const candidates = [];

  // Root-level HTML files
  const rootFiles = fs.readdirSync(wsDir)
    .filter(f => f.endsWith('.html') && !f.startsWith('.'));
  for (const f of rootFiles) {
    const fp = path.join(wsDir, f);
    candidates.push({ path: fp, name: f, subdir: null, mtime: fs.statSync(fp).mtimeMs });
  }

  // Subdirectory HTML files (version-1/index.html, etc.)
  const entries = fs.readdirSync(wsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const subDir = path.join(wsDir, entry.name);
    const subFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.html') && !f.startsWith('.'));
    for (const f of subFiles) {
      const fp = path.join(subDir, f);
      candidates.push({ path: fp, name: f, subdir: entry.name, mtime: fs.statSync(fp).mtimeMs });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.mtime - a.mtime);

  // Prefer root index.html if recently modified
  const rootIndex = candidates.find(c => c.name === 'index.html' && !c.subdir);
  if (rootIndex && (candidates[0].mtime - rootIndex.mtime) < 5000) {
    return rootIndex.path;
  }
  return candidates[0].path;
}

/**
 * Find ALL html files in subdirectories (for multi-version parallel imports)
 */
function findAllSubdirHtmls(wsDir) {
  if (!fs.existsSync(wsDir)) return [];

  const results = [];
  const entries = fs.readdirSync(wsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const subDir = path.join(wsDir, entry.name);
    const indexPath = path.join(subDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      results.push({ subdir: entry.name, path: indexPath });
    } else {
      // Check for any .html file
      const htmlFiles = fs.readdirSync(subDir).filter(f => f.endsWith('.html'));
      if (htmlFiles.length > 0) {
        results.push({ subdir: entry.name, path: path.join(subDir, htmlFiles[0]) });
      }
    }
  }
  return results;
}

/**
 * Import a single HTML file as an iteration
 * @param {string} projectId
 * @param {string} htmlPath - absolute path to HTML file
 * @param {string|null} titleOverride - custom title
 * @param {string|null|undefined} parentIdOverride - explicit parent (null=root, undefined=auto-detect)
 */
function importSingleHtml(projectId, htmlPath, titleOverride, parentIdOverride) {
  const content = fs.readFileSync(htmlPath, 'utf-8');
  if (!content || content.trim().length < 50) return null;

  const hash = hashContent(content);
  const hashKey = `${projectId}:${htmlPath}`;
  if (fileHashes.get(hashKey) === hash) return null;
  fileHashes.set(hashKey, hash);

  const project = db.getProject(projectId);
  if (!project) return null;

  const agentName = project.agent_name || 'unknown';
  const id = crypto.randomUUID();
  const version = db.getNextVersion(projectId);

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
      const iterations = db.getIterationsByProject(projectId);
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

  const title = titleOverride || `V${version}`;
  db.createIteration(id, projectId, agentName, version, title, '', parentId, filePath, '', 'completed', {});

  const count = db.countIterations(projectId);
  db.updateProjectIterationCount(projectId, count);

  console.log(`[Watcher] Imported iteration ${title} (parent: ${parentId || 'ROOT'}) for project ${project.name} (${id})`);

  if (ioRef) {
    ioRef.emit('iteration-created', {
      projectId,
      iteration: db.getIteration(id),
    });
  }

  return id;
}

/**
 * Import from workspace into iterations.
 * Subdirectory-based versions (version-1/, version-2/) are treated as parallel roots.
 * Root-level index.html is chained to the latest iteration.
 */
function importIteration(projectId) {
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
      const content = fs.readFileSync(item.path, 'utf-8');
      const hash = hashContent(content);
      if (fileHashes.get(hashKey) !== hash) {
        const vMatch = item.subdir.match(/(?:version-?|v)(\d+)/i);
        const title = vMatch ? `V${vMatch[1]}` : item.subdir;
        // Parallel batch → force root (null), single → auto-detect (undefined)
        const parentOverride = isParallelBatch ? null : undefined;
        const result = importSingleHtml(projectId, item.path, title, parentOverride);
        if (result) imported = result;
      }
    }
  }

  // Then: check root-level HTML files (auto-detect parent)
  const htmlPath = findLatestHtml(wsDir);
  if (htmlPath) {
    const relPath = path.relative(wsDir, htmlPath);
    if (!relPath.includes(path.sep)) {
      const result = importSingleHtml(projectId, htmlPath, null, undefined);
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
  debounceTimers.set(projectId, setTimeout(() => {
    debounceTimers.delete(projectId);
    try {
      importIteration(projectId);
    } catch (err) {
      console.error(`[Watcher] Import error for ${projectId}:`, err.message);
    }
  }, 2000));
}

/**
 * Start watching a project workspace (root + subdirectories)
 */
function watchProject(projectId) {
  if (watchers.has(projectId)) return; // Already watching

  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  // Initialize hashes from existing files (root + subdirs)
  const allSubdirs = findAllSubdirHtmls(wsDir);
  for (const item of allSubdirs) {
    try {
      const content = fs.readFileSync(item.path, 'utf-8');
      fileHashes.set(`${projectId}:${item.path}`, hashContent(content));
    } catch (_) {}
  }
  const latestHtml = findLatestHtml(wsDir);
  if (latestHtml) {
    try {
      const content = fs.readFileSync(latestHtml, 'utf-8');
      fileHashes.set(`${projectId}:${latestHtml}`, hashContent(content));
    } catch (_) {}
  }

  const projectWatchers = [];

  try {
    // Watch root directory
    const rootWatcher = fs.watch(wsDir, (eventType, filename) => {
      if (!filename || filename.startsWith('.')) return;

      // If a new directory was created, watch it too
      if (eventType === 'rename') {
        const fullPath = path.join(wsDir, filename);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
          watchSubdir(projectId, fullPath, projectWatchers);
        }
      }

      if (filename.endsWith('.html')) {
        triggerImport(projectId);
      }
    });
    projectWatchers.push(rootWatcher);

    // Watch existing subdirectories
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        watchSubdir(projectId, path.join(wsDir, entry.name), projectWatchers);
      }
    }

    watchers.set(projectId, projectWatchers);
  } catch (err) {
    console.error(`[Watcher] Failed to watch ${projectId}:`, err.message);
  }
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
 * Initialize watchers for all existing projects
 */
function initWatchers(io) {
  ioRef = io;

  // Watch all projects that have workspaces
  if (fs.existsSync(WORKSPACES_DIR)) {
    const dirs = fs.readdirSync(WORKSPACES_DIR).filter(d =>
      fs.statSync(path.join(WORKSPACES_DIR, d)).isDirectory()
    );
    for (const dir of dirs) {
      watchProject(dir);
    }
  }

  // Also watch all active projects (creates workspace if needed)
  const projects = db.getAllProjects();
  for (const project of projects) {
    watchProject(project.id);
  }

  console.log(`[Watcher] Monitoring ${watchers.size} project workspaces`);
}

/**
 * Manually trigger import for a project (API use)
 */
function manualImport(projectId) {
  // Reset hash to force import
  fileHashes.delete(projectId);
  return importIteration(projectId);
}

module.exports = {
  initWatchers,
  watchProject,
  unwatchProject,
  importIteration,
  manualImport,
};
