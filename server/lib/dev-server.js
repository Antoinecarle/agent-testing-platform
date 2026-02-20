/**
 * Dev Server Manager
 *
 * Manages Node.js dev server processes for projects.
 * Each project gets a unique port (5100 + hash).
 * Handles npm install + npm run dev lifecycle.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./logger');
const log = createLogger('dev-server');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

// Active dev server processes: projectId -> { proc, port, status, logs[] }
const devServers = new Map();

// Port range: 5100-5999
const PORT_BASE = 5100;
const PORT_MAX = 5999;

function getPort(projectId) {
  // Deterministic port from project ID hash
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = ((hash << 5) - hash + projectId.charCodeAt(i)) | 0;
  }
  return PORT_BASE + (Math.abs(hash) % (PORT_MAX - PORT_BASE));
}

function getWorkspaceDir(projectId) {
  return path.join(DATA_DIR, 'workspaces', projectId);
}

function detectStartCommand(workspaceDir) {
  const pkgPath = path.join(workspaceDir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const scripts = pkg.scripts || {};

    // Priority: dev > start > preview
    if (scripts.dev) return 'npm run dev';
    if (scripts.start) return 'npm start';
    if (scripts.preview) return 'npm run preview';
    return null;
  } catch {
    return null;
  }
}

function isNodeProject(projectId) {
  const dir = getWorkspaceDir(projectId);
  return fs.existsSync(path.join(dir, 'package.json'));
}

/**
 * Start a dev server for a project
 * Returns { port, status } or throws
 */
async function startDevServer(projectId, { onLog, onStatusChange } = {}) {
  const existing = devServers.get(projectId);
  if (existing && existing.status === 'running') {
    return { port: existing.port, status: 'running', pid: existing.proc?.pid };
  }

  const workspaceDir = getWorkspaceDir(projectId);
  if (!fs.existsSync(workspaceDir)) {
    throw new Error('Workspace directory not found');
  }

  const port = getPort(projectId);
  const startCmd = detectStartCommand(workspaceDir);
  if (!startCmd) {
    throw new Error('No start script found in package.json');
  }

  const logBuffer = [];
  const pushLog = (text, type = 'stdout') => {
    const entry = { text, type, time: Date.now() };
    logBuffer.push(entry);
    if (logBuffer.length > 500) logBuffer.shift();
    if (onLog) onLog(entry);
  };

  const updateStatus = (status) => {
    const server = devServers.get(projectId);
    if (server) server.status = status;
    if (onStatusChange) onStatusChange(status);
  };

  // Check if npm install is needed
  const needsInstall = !fs.existsSync(path.join(workspaceDir, 'node_modules'));

  if (needsInstall) {
    updateStatus('installing');
    pushLog('Running npm install...', 'system');

    await new Promise((resolve, reject) => {
      const install = spawn('npm', ['install'], {
        cwd: workspaceDir,
        env: { ...process.env, PORT: String(port) },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      install.stdout.on('data', (d) => pushLog(d.toString(), 'stdout'));
      install.stderr.on('data', (d) => pushLog(d.toString(), 'stderr'));

      install.on('close', (code) => {
        if (code === 0) {
          pushLog('npm install completed.', 'system');
          resolve();
        } else {
          pushLog(`npm install failed (code ${code})`, 'error');
          reject(new Error(`npm install failed with code ${code}`));
        }
      });

      install.on('error', (err) => reject(err));
    });
  }

  // Start dev server
  updateStatus('starting');
  pushLog(`Starting: PORT=${port} ${startCmd}`, 'system');

  const [cmd, ...args] = startCmd.split(' ');
  const proc = spawn(cmd, args, {
    cwd: workspaceDir,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '0.0.0.0',
      // Vite-specific
      VITE_PORT: String(port),
      // Next.js specific
      NEXT_PORT: String(port),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true,
  });

  const serverInfo = {
    proc,
    port,
    status: 'starting',
    logs: logBuffer,
    startedAt: Date.now(),
    startCmd,
  };
  devServers.set(projectId, serverInfo);

  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    pushLog(text, 'stdout');
    // Detect when server is ready (common patterns)
    if (text.includes('ready') || text.includes('started') || text.includes('listening') ||
        text.includes('Local:') || text.includes(`localhost:${port}`) || text.includes(`0.0.0.0:${port}`)) {
      serverInfo.status = 'running';
      updateStatus('running');
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    pushLog(text, 'stderr');
    // Some frameworks log the "ready" message to stderr
    if (text.includes('ready') || text.includes('started') || text.includes('listening') ||
        text.includes('Local:') || text.includes(`localhost:${port}`)) {
      serverInfo.status = 'running';
      updateStatus('running');
    }
  });

  proc.on('close', (code) => {
    pushLog(`Dev server exited (code ${code})`, 'system');
    serverInfo.status = 'stopped';
    serverInfo.proc = null;
    updateStatus('stopped');
  });

  proc.on('error', (err) => {
    pushLog(`Dev server error: ${err.message}`, 'error');
    serverInfo.status = 'error';
    updateStatus('error');
  });

  // Auto-set running after timeout if no detection
  setTimeout(() => {
    if (serverInfo.status === 'starting') {
      serverInfo.status = 'running';
      updateStatus('running');
    }
  }, 15000);

  log.info(`Dev server started for ${projectId} on port ${port}, cmd: ${startCmd}`);
  return { port, status: 'starting', pid: proc.pid };
}

function stopDevServer(projectId) {
  const server = devServers.get(projectId);
  if (!server) return false;

  if (server.proc) {
    try {
      server.proc.kill('SIGTERM');
      setTimeout(() => {
        try { server.proc?.kill('SIGKILL'); } catch (_) {}
      }, 5000);
    } catch (_) {}
  }

  devServers.delete(projectId);
  log.info(`Dev server stopped for ${projectId}`);
  return true;
}

function getDevServerStatus(projectId) {
  const server = devServers.get(projectId);
  if (!server) return { status: 'stopped', port: getPort(projectId) };

  return {
    status: server.status,
    port: server.port,
    pid: server.proc?.pid || null,
    startedAt: server.startedAt,
    startCmd: server.startCmd,
    recentLogs: server.logs.slice(-50),
  };
}

function getDevServerPort(projectId) {
  const server = devServers.get(projectId);
  if (server && (server.status === 'running' || server.status === 'starting')) {
    return server.port;
  }
  return null;
}

module.exports = {
  startDevServer,
  stopDevServer,
  getDevServerStatus,
  getDevServerPort,
  getPort,
  isNodeProject,
  detectStartCommand,
};
