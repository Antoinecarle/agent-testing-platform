const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');
const { generateWorkspaceContext, readBranchContext } = require('./workspace');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;

// Track file hashes to detect real changes (keyed by `${projectId}:${filePath}`)
const fileHashes = new Map();
// Track content hashes of already-imported iterations (keyed by `${projectId}:${contentHash}`)
// This prevents duplicates even after deploy/restart or if fileHashes is cleared
const knownContentHashes = new Set();
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

// ==================== ACTIVE ITERATION TRACKING ====================
// Each project+source has at most ONE "active" iteration that gets UPDATED in place
// when the workspace file changes. A new iteration is only created when:
//   1. No active iteration exists for that source (first time)
//   2. User explicitly creates a new version (via API: createNewVersion)
//   3. Branch context changes
//
// Key: `${projectId}` for root files, `${projectId}:${subdir}` for subdirectory files
// Value: { iterationId }
const activeIterations = new Map();

// Change log: tracks modifications per project for progress visibility
// Key: projectId → [ { timestamp, type, message } ]
const changeLogs = new Map();

function logChange(projectId, type, message) {
  if (!changeLogs.has(projectId)) changeLogs.set(projectId, []);
  const logs = changeLogs.get(projectId);
  const entry = { timestamp: Date.now(), type, message };
  logs.push(entry);
  // Keep max 200 entries per project
  if (logs.length > 200) logs.splice(0, logs.length - 200);
  console.log(`[Watcher:${type}] ${message} (project: ${projectId.slice(0, 8)})`);
  // Emit real-time log event
  if (ioRef) {
    ioRef.emit('watcher-log', { projectId, ...entry });
  }
}

function getChangeLogs(projectId, limit = 50) {
  const logs = changeLogs.get(projectId) || [];
  return logs.slice(-limit);
}

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
 * Update an existing iteration's HTML content in place.
 * Returns true if updated, false if iteration not found.
 */
async function updateIterationHtml(iterationId, content, projectId) {
  try {
    const iteration = await db.getIteration(iterationId);
    if (!iteration || !iteration.file_path) return false;

    const htmlPath = path.join(ITERATIONS_DIR, iteration.file_path);
    const htmlDir = path.dirname(htmlPath);
    if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
    fs.writeFileSync(htmlPath, content);

    // Update content hash
    const hash = hashContent(content);
    knownContentHashes.add(`${projectId}:${hash}`);

    logChange(projectId, 'update', `Updated iteration ${iteration.title || 'V' + iteration.version} in place`);

    // Emit iteration-updated for live preview refresh (NOT iteration-created)
    if (ioRef) {
      ioRef.emit('iteration-updated', {
        projectId,
        iterationId,
        iteration: await db.getIteration(iterationId),
        timestamp: Date.now(),
      });
    }

    return true;
  } catch (err) {
    console.error(`[Watcher] Failed to update iteration ${iterationId}:`, err.message);
    return false;
  }
}

/**
 * Create a brand new iteration from HTML content.
 * Used only when there's no active iteration or explicit new version requested.
 */
async function createNewIteration(projectId, content, titleOverride, parentIdOverride) {
  const hash = hashContent(content);

  // Content-based dedup
  const contentKey = `${projectId}:${hash}`;
  if (knownContentHashes.has(contentKey)) return null;

  try {
    const project = await db.getProject(projectId);
    if (!project) return null;

    const agentName = project.agent_name || 'unknown';
    const id = crypto.randomUUID();
    const version = await db.getNextVersion(projectId);

    // Determine parent
    let parentId;
    if (parentIdOverride !== undefined) {
      parentId = parentIdOverride;
    } else {
      const branchCtx = readBranchContext(projectId);
      if (branchCtx) {
        parentId = branchCtx.parentId;
        // Don't clear branch context here — it persists for the session
      } else {
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

    const title = titleOverride || `V${version}`;
    await db.createIteration(id, projectId, agentName, version, title, '', parentId, filePath, '', 'completed', {}, content);

    const count = await db.countIterations(projectId);
    await db.updateProjectIterationCount(projectId, count);

    knownContentHashes.add(contentKey);

    logChange(projectId, 'create', `Created iteration ${title} (parent: ${parentId || 'ROOT'})`);

    if (ioRef) {
      ioRef.emit('iteration-created', {
        projectId,
        iteration: await db.getIteration(id),
      });
    }

    return id;
  } catch (err) {
    console.error(`[Watcher] DB error creating iteration for project ${projectId}:`, err.message);
    return null;
  }
}

/**
 * Handle a root-level HTML file change.
 * Uses the "active iteration" pattern: updates in place, only creates new when needed.
 */
async function handleRootHtmlChange(projectId, htmlPath) {
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
  if (previousHash === hash) return null; // No actual change

  fileHashes.set(hashKey, hash);

  // Check if we have an active iteration for this project
  const active = activeIterations.get(projectId);
  if (active) {
    // UPDATE existing iteration in place
    const updated = await updateIterationHtml(active.iterationId, content, projectId);
    if (updated) {
      return active.iterationId;
    }
    // If update failed (iteration deleted?), fall through to create new
    activeIterations.delete(projectId);
  }

  // No active iteration — create a new one
  const newId = await createNewIteration(projectId, content, null, undefined);
  if (newId) {
    activeIterations.set(projectId, { iterationId: newId });
  }
  return newId;
}

/**
 * Handle a subdirectory-based HTML file (version-1/index.html).
 * Uses the same "active iteration" pattern as root files:
 * updates the existing iteration in place, only creates new on first encounter.
 */
async function handleSubdirHtmlChange(projectId, htmlPath, title, parentIdOverride, subdir) {
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

  // Use per-subdir active iteration key
  const activeKey = `${projectId}:${subdir}`;
  const active = activeIterations.get(activeKey);
  if (active) {
    // UPDATE existing iteration in place
    const updated = await updateIterationHtml(active.iterationId, content, projectId);
    if (updated) {
      return active.iterationId;
    }
    // If update failed (iteration deleted?), fall through to create new
    activeIterations.delete(activeKey);
  }

  // No active iteration for this subdir — create a new one
  const newId = await createNewIteration(projectId, content, title, parentIdOverride);
  if (newId) {
    activeIterations.set(activeKey, { iterationId: newId });
  }
  return newId;
}

/**
 * Import from workspace into iterations.
 * Both root-level files and subdirectory files use active-iteration pattern (update in place).
 * A new iteration is only created on first encounter of a file/subdir.
 */
async function importIteration(projectId) {
  const wsDir = path.join(WORKSPACES_DIR, projectId);
  let imported = null;
  // Track if any active iteration existed before (root or subdir)
  const hadActiveIterBefore = activeIterations.has(projectId) ||
    [...activeIterations.keys()].some(k => k.startsWith(`${projectId}:`));

  // First: check for subdirectory-based versions
  const subdirHtmls = findAllSubdirHtmls(wsDir);
  if (subdirHtmls.length > 0) {
    subdirHtmls.sort((a, b) => a.subdir.localeCompare(b.subdir, undefined, { numeric: true }));

    const newItems = subdirHtmls.filter(item => {
      const hashKey = `${projectId}:${item.path}`;
      try {
        const content = fs.readFileSync(item.path, 'utf-8');
        return fileHashes.get(hashKey) !== hashContent(content);
      } catch (_) { return false; }
    });

    const isParallelBatch = newItems.length > 1;

    for (const item of subdirHtmls) {
      const hashKey = `${projectId}:${item.path}`;
      let content;
      try { content = fs.readFileSync(item.path, 'utf-8'); } catch (_) { continue; }
      const hash = hashContent(content);
      if (fileHashes.get(hashKey) !== hash) {
        const vMatch = item.subdir.match(/(?:version-?|v)(\d+)/i);
        const title = vMatch ? `V${vMatch[1]}` : item.subdir;
        const parentOverride = isParallelBatch ? null : undefined;
        const result = await handleSubdirHtmlChange(projectId, item.path, title, parentOverride, item.subdir);
        if (result) imported = result;
      }
    }
  }

  // Then: check root-level HTML files (use active-iteration pattern)
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

    for (const f of rootHtmlFiles) {
      const fp = path.join(wsDir, f);
      const result = await handleRootHtmlChange(projectId, fp);
      if (result) imported = result;
    }
  }

  // Refresh CLAUDE.md when a NEW iteration was created (not just updated)
  // If we didn't have an active iteration before but do now, it means a new one was created
  if (imported && !hadActiveIterBefore && activeIterations.has(projectId)) {
    try { await generateWorkspaceContext(projectId); } catch (_) {}
  }

  return imported;
}

// How long the file must be stable (unchanged) before we import
const STABILITY_DELAY_MS = 3000; // 3 seconds — fast since we update in place now

/**
 * Debounced trigger for import with stability check.
 * Only imports when the HTML file hasn't changed for STABILITY_DELAY_MS.
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
  }, STABILITY_DELAY_MS));
}

/**
 * Poll all watched workspaces for new/changed HTML files.
 */
async function pollAllWorkspaces() {
  for (const projectId of watchers.keys()) {
    try {
      const wsDir = path.join(WORKSPACES_DIR, projectId);
      const htmlFiles = scanWorkspaceHtmlFiles(wsDir);
      let hasChanges = false;
      for (const item of htmlFiles) {
        try {
          const content = fs.readFileSync(item.path, 'utf-8');
          const hash = hashContent(content);
          const hashKey = `${projectId}:${item.path}`;
          if (fileHashes.get(hashKey) !== hash) {
            hasChanges = true;
            break;
          }
        } catch (_) {}
      }
      if (hasChanges) {
        triggerImport(projectId);
      }
    } catch (err) {
      console.error(`[Watcher/Poll] Error scanning ${projectId}:`, err.message);
    }
  }
}

// Directories to skip when watching for file changes
const SKIP_WATCH_DIRS = new Set([
  'node_modules', '.git', '.claude', '.next', '.nuxt', 'dist', 'build',
  '.cache', '.parcel-cache', '.turbo', '__pycache__', '.venv', 'venv',
]);

// Debounce file change events per project (avoid flooding during rapid edits)
const fileChangeTimers = new Map();
const FILE_CHANGE_DEBOUNCE_MS = 500;

/**
 * Emit a file-changed Socket.IO event for real-time file explorer updates (debounced per file)
 */
function emitFileChange(projectId, filePath, changeType) {
  if (!ioRef) return;
  const key = `${projectId}:${filePath}`;
  if (fileChangeTimers.has(key)) {
    clearTimeout(fileChangeTimers.get(key));
  }
  fileChangeTimers.set(key, setTimeout(() => {
    fileChangeTimers.delete(key);
    ioRef.emit('file-changed', {
      projectId,
      path: filePath,
      changeType,
      timestamp: Date.now(),
    });
  }, FILE_CHANGE_DEBOUNCE_MS));
}

/**
 * Start watching a project workspace (fs.watch + polling fallback)
 */
function watchProject(projectId) {
  if (watchers.has(projectId)) return; // Already watching

  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  // Initialize hashes from existing workspace files (so we don't re-import old files)
  const allFiles = scanWorkspaceHtmlFiles(wsDir);
  for (const item of allFiles) {
    try {
      const content = fs.readFileSync(item.path, 'utf-8');
      const hash = hashContent(content);
      fileHashes.set(`${projectId}:${item.path}`, hash);
      knownContentHashes.add(`${projectId}:${hash}`);
    } catch (_) {}
  }

  // Also load content hashes from already-stored iterations (survives deploys)
  const projectIterDir = path.join(ITERATIONS_DIR, projectId);
  if (fs.existsSync(projectIterDir)) {
    try {
      const iterDirs = fs.readdirSync(projectIterDir, { withFileTypes: true });
      for (const entry of iterDirs) {
        if (!entry.isDirectory()) continue;
        const htmlPath = path.join(projectIterDir, entry.name, 'index.html');
        try {
          const content = fs.readFileSync(htmlPath, 'utf-8');
          knownContentHashes.add(`${projectId}:${hashContent(content)}`);
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Restore active iteration from DB: the latest iteration is the "active" one
  // (so after restarts, we continue updating the last iteration instead of creating new)
  _restoreActiveIteration(projectId);

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
            if (!SKIP_WATCH_DIRS.has(filename)) {
              watchSubdir(projectId, fullPath, projectWatchers);
            }
          }
        } catch (_) {}
      }

      // Emit real-time file change event for ALL files
      const fullPath = path.join(wsDir, filename);
      const exists = fs.existsSync(fullPath);
      emitFileChange(projectId, filename, exists ? (eventType === 'rename' ? 'created' : 'modified') : 'deleted');

      // Trigger import for .html files OR new directories (which may contain .html files)
      if (filename.endsWith('.html')) {
        triggerImport(projectId);
      } else if (eventType === 'rename' && exists) {
        try {
          if (fs.statSync(fullPath).isDirectory()) {
            triggerImport(projectId);
          }
        } catch (_) {}
      }
    });
    projectWatchers.push(rootWatcher);

    // Watch existing subdirectories
    try {
      const entries = fs.readdirSync(wsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && !SKIP_WATCH_DIRS.has(entry.name)) {
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
 * Restore active iterations from DB on startup.
 * Sets the latest iteration as the root active, and also restores
 * subdir-based active iterations by matching titles to subdirectories.
 */
async function _restoreActiveIteration(projectId) {
  try {
    const iterations = await db.getIterationsByProject(projectId);
    if (iterations.length === 0) return;

    // Set the latest iteration as root active
    const latest = iterations[iterations.length - 1];
    activeIterations.set(projectId, { iterationId: latest.id });

    // Also restore subdir active iterations by matching title patterns (V1→version-1, etc.)
    // and scanning workspace for existing subdirectories
    const wsDir = path.join(WORKSPACES_DIR, projectId);
    if (fs.existsSync(wsDir)) {
      try {
        const entries = fs.readdirSync(wsDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
          const vMatch = entry.name.match(/(?:version-?|v)(\d+)/i);
          if (!vMatch) continue;
          const title = `V${vMatch[1]}`;
          // Find the latest iteration with this title
          const matching = iterations.filter(i => i.title === title);
          if (matching.length > 0) {
            const latestMatch = matching[matching.length - 1];
            activeIterations.set(`${projectId}:${entry.name}`, { iterationId: latestMatch.id });
          }
        }
      } catch (_) {}
    }
  } catch (_) {}
}

/**
 * Watch a subdirectory within a workspace
 */
function watchSubdir(projectId, dirPath, watchersList) {
  try {
    const wsDir = path.join(WORKSPACES_DIR, projectId);
    const watcher = fs.watch(dirPath, (eventType, filename) => {
      if (!filename || filename.startsWith('.')) return;

      // Emit real-time file change event for ALL files
      const relativePath = path.relative(wsDir, path.join(dirPath, filename));
      const fullPath = path.join(dirPath, filename);
      const exists = fs.existsSync(fullPath);
      emitFileChange(projectId, relativePath, exists ? (eventType === 'rename' ? 'created' : 'modified') : 'deleted');

      if (filename.endsWith('.html')) {
        triggerImport(projectId);
      }
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
 * Clear all active iterations for a project (root + all subdirs).
 */
function _clearAllActiveIterations(projectId) {
  activeIterations.delete(projectId);
  for (const key of activeIterations.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      activeIterations.delete(key);
    }
  }
}

/**
 * Manually trigger import for a project (API use)
 * Clears BOTH file-path hashes and content hashes so ALL workspace files
 * get re-imported as new iterations regardless of dedup.
 */
async function manualImport(projectId) {
  // Clear file hashes
  for (const key of fileHashes.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      fileHashes.delete(key);
    }
  }
  // Clear content hashes so dedup doesn't block
  for (const key of knownContentHashes.keys()) {
    if (key.startsWith(`${projectId}:`)) {
      knownContentHashes.delete(key);
    }
  }
  // Clear all active iterations so new ones get created
  _clearAllActiveIterations(projectId);
  return await importIteration(projectId);
}

/**
 * Scan a specific project NOW (called when terminal exits, agent finishes, etc.)
 */
async function scanProject(projectId) {
  try {
    if (!watchers.has(projectId)) {
      watchProject(projectId);
    }
    return await importIteration(projectId);
  } catch (err) {
    console.error(`[Watcher] Scan error for ${projectId}:`, err.message);
    return null;
  }
}

/**
 * Explicitly create a new version for a project.
 * Clears the active iteration so the next file change creates a fresh iteration.
 * Called from the API when user clicks "New Version".
 */
async function createNewVersion(projectId) {
  // Clear all active iterations → import will create new ones
  _clearAllActiveIterations(projectId);
  logChange(projectId, 'snapshot', 'Snapshot created — next edit will start a new version');

  // If there are already HTML files in the workspace, import them now
  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) return null;

  // Scan ALL html files: root + subdirectories
  const allHtmlFiles = scanWorkspaceHtmlFiles(wsDir);
  if (allHtmlFiles.length === 0) return null;

  // Clear ALL hashes (file + content) so everything gets re-imported
  for (const item of allHtmlFiles) {
    fileHashes.delete(`${projectId}:${item.path}`);
    try {
      const content = fs.readFileSync(item.path, 'utf-8');
      knownContentHashes.delete(`${projectId}:${hashContent(content)}`);
    } catch (_) {}
  }

  const result = await importIteration(projectId);

  // IMPORTANT: Clear all active iterations AGAIN after the snapshot import.
  // The snapshot should be frozen — the next edit should create a NEW iteration.
  _clearAllActiveIterations(projectId);

  // Refresh workspace CLAUDE.md after new version
  if (result) {
    try { await generateWorkspaceContext(projectId); } catch (_) {}
  }

  return result;
}

/**
 * Reset active iteration for a project (e.g., when branch context changes).
 * Next file change will create a new iteration.
 */
function resetActiveIteration(projectId) {
  _clearAllActiveIterations(projectId);
  logChange(projectId, 'reset', 'Active iteration reset — next edit creates new version');
}

/**
 * Get the current active iteration ID for a project
 */
function getActiveIterationId(projectId) {
  const active = activeIterations.get(projectId);
  return active ? active.iterationId : null;
}

module.exports = {
  initWatchers,
  watchProject,
  unwatchProject,
  importIteration,
  manualImport,
  scanProject,
  createNewVersion,
  resetActiveIteration,
  getActiveIterationId,
  getChangeLogs,
};
