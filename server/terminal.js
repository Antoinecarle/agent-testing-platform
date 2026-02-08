let pty;
try {
  pty = require('node-pty');
} catch (_) {
  console.warn('[Terminal] node-pty not available — terminal features disabled');
}
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { generateWorkspaceContext } = require('./workspace');

const PTY_AVAILABLE = !!pty;

const BUFFER_INTERVAL_MS = 8;
const BUFFER_FLUSH_SIZE = 32768;
const MAX_SCROLLBACK = 50 * 1024;
const MAX_SESSIONS = 15;
const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Run terminals as non-root user
const TERMINAL_UID = 1001;
const TERMINAL_GID = 1001;

const sessions = new Map();

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

function appendScrollback(session, data) {
  session.scrollback += data;
  if (session.scrollback.length > MAX_SCROLLBACK) {
    session.scrollback = session.scrollback.slice(-MAX_SCROLLBACK);
  }
}

function getWorkspacePath(projectId) {
  if (!projectId) return '/home/claude-user';
  const wsDir = path.join(__dirname, '..', 'data', 'workspaces', projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
  // Ensure claude-user can write to it
  try { fs.chownSync(wsDir, 1001, 1001); } catch (_) {}
  // Generate/refresh CLAUDE.md with project context
  try { generateWorkspaceContext(projectId); } catch (_) {}
  return wsDir;
}

function createSession(cols, rows, name, projectId, cwd) {
  if (!PTY_AVAILABLE) return null;
  if (sessions.size >= MAX_SESSIONS) return null;

  const id = generateId();
  const shell = process.env.SHELL || '/bin/bash';
  const userHome = '/home/claude-user';
  const startCwd = cwd || getWorkspacePath(projectId) || userHome;

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: cols || 120,
    rows: rows || 30,
    cwd: startCwd,
    uid: TERMINAL_UID,
    gid: TERMINAL_GID,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: process.env.LANG || 'en_US.UTF-8',
      HOME: userHome,
      USER: 'claude-user',
      LOGNAME: 'claude-user',
      PATH: `/home/claude-user/.local/bin:${process.env.PATH}`,
    },
  });

  const sessionTitle = name || `Terminal ${sessions.size + 1}`;

  const session = {
    id,
    pty: term,
    scrollback: '',
    createdAt: Date.now(),
    lastActivity: Date.now(),
    cols: cols || 120,
    rows: rows || 30,
    title: sessionTitle,
    projectId: projectId || '',
    clients: new Set(),
    outputBuffer: '',
    flushTimer: null,
    exited: false,
  };

  function flushOutput() {
    if (session.outputBuffer.length > 0) {
      const data = session.outputBuffer;
      session.outputBuffer = '';
      appendScrollback(session, data);
      for (const client of session.clients) {
        client.emit('output', data);
      }
    }
    session.flushTimer = null;
  }

  term.onData((data) => {
    session.lastActivity = Date.now();
    session.outputBuffer += data;

    if (session.outputBuffer.length >= BUFFER_FLUSH_SIZE) {
      if (session.flushTimer) { clearTimeout(session.flushTimer); session.flushTimer = null; }
      flushOutput();
    } else if (!session.flushTimer) {
      session.flushTimer = setTimeout(flushOutput, BUFFER_INTERVAL_MS);
    }
  });

  term.onExit(() => {
    if (session.flushTimer) clearTimeout(session.flushTimer);
    if (session.outputBuffer.length > 0) {
      const data = session.outputBuffer;
      session.outputBuffer = '';
      appendScrollback(session, data);
      for (const client of session.clients) { client.emit('output', data); }
    }
    session.exited = true;
    const exitMsg = '\r\n\x1b[31m[Process exited]\x1b[0m\r\n';
    appendScrollback(session, exitMsg);
    for (const client of session.clients) {
      client.emit('output', exitMsg);
      client.emit('session-exited', { id: session.id });
    }
  });

  sessions.set(id, session);
  db.insertSession(id, sessionTitle, session.createdAt, projectId || '', startCwd, shell);
  return session;
}

function destroySession(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.flushTimer) clearTimeout(session.flushTimer);
  if (!session.exited) { try { session.pty.kill(); } catch (_) {} }
  sessions.delete(id);
  db.removeSession(id);
}

function attachSocket(session, socket) { session.clients.add(socket); }
function detachSocket(session, socket) { session.clients.delete(socket); }

function getSessionInfo(session) {
  return {
    id: session.id,
    title: session.title,
    projectId: session.projectId,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    cols: session.cols,
    rows: session.rows,
    exited: session.exited,
  };
}

function listSessions() {
  const list = [];
  for (const session of sessions.values()) {
    list.push(getSessionInfo(session));
  }
  return list;
}

function renameSession(id, title) {
  const session = sessions.get(id);
  if (!session) return null;
  session.title = title || session.title;
  db.renameSession(id, session.title);
  return getSessionInfo(session);
}

function cleanupIdleSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.clients.size > 0) continue;
    if (session.exited || (now - session.lastActivity > IDLE_TIMEOUT_MS)) {
      destroySession(id);
    }
  }
}

function initSessions() {
  db.removeAllSessions();
}

let cleanupTimer = null;

function setupTerminal(io) {
  const termNamespace = io.of('/terminal');

  termNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanupIdleSessions, CLEANUP_INTERVAL_MS);
    cleanupTimer.unref?.();
  }

  termNamespace.on('connection', (socket) => {
    let currentSessionId = null;

    socket.on('list-sessions', (callback) => {
      if (typeof callback === 'function') callback(listSessions());
    });

    socket.on('create-session', ({ cols, rows, projectId, cwd } = {}, callback) => {
      if (!PTY_AVAILABLE) {
        if (typeof callback === 'function') callback({ error: 'Terminal not available in this environment' });
        return;
      }
      const session = createSession(cols, rows, null, projectId, cwd);
      if (!session) {
        if (typeof callback === 'function') callback({ error: 'Max sessions reached (limit: ' + MAX_SESSIONS + ')' });
        return;
      }
      if (typeof callback === 'function') callback(getSessionInfo(session));
    });

    socket.on('attach-session', ({ id, cols, rows, replay } = {}, callback) => {
      const session = sessions.get(id);
      if (!session) {
        if (typeof callback === 'function') callback({ error: 'Session not found' });
        return;
      }

      if (currentSessionId && currentSessionId !== id) {
        const prev = sessions.get(currentSessionId);
        if (prev) detachSocket(prev, socket);
      }

      currentSessionId = id;
      attachSocket(session, socket);

      if (cols > 0 && rows > 0 && !session.exited) {
        try { session.pty.resize(cols, rows); session.cols = cols; session.rows = rows; } catch (_) {}
      }

      if (replay !== false && session.scrollback.length > 0) {
        socket.emit('output', session.scrollback);
      }

      if (typeof callback === 'function') callback(getSessionInfo(session));
    });

    socket.on('detach-session', (callback) => {
      if (currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) detachSocket(session, socket);
      }
      currentSessionId = null;
      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('kill-session', ({ id } = {}, callback) => {
      if (currentSessionId === id) currentSessionId = null;
      destroySession(id);
      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('rename-session', ({ id, title } = {}, callback) => {
      const result = renameSession(id, title);
      if (!result) {
        if (typeof callback === 'function') callback({ error: 'Session not found' });
        return;
      }
      if (typeof callback === 'function') callback(result);
    });

    socket.on('input', (data) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session || session.exited) return;
      session.lastActivity = Date.now();
      try { session.pty.write(data); } catch (_) {}
    });

    socket.on('resize', ({ cols, rows }) => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session || session.exited) return;
      if (cols > 0 && rows > 0) {
        try { session.pty.resize(cols, rows); session.cols = cols; session.rows = rows; } catch (_) {}
      }
    });

    socket.on('disconnect', () => {
      if (currentSessionId) {
        const session = sessions.get(currentSessionId);
        if (session) detachSocket(session, socket);
      }
      currentSessionId = null;
    });
  });
}

function listProjectSessions(projectId) {
  const list = [];
  for (const session of sessions.values()) {
    if (session.projectId === projectId) list.push(getSessionInfo(session));
  }
  return list;
}

function isSessionAlive(id) {
  const session = sessions.get(id);
  return session && !session.exited;
}

module.exports = {
  setupTerminal,
  initSessions,
  listSessions,
  listProjectSessions,
  createSession,
  destroySession,
  renameSession,
  isSessionAlive,
  getWorkspacePath,
  getSessionInfo: (id) => { const s = sessions.get(id); return s ? getSessionInfo(s) : null; },
  getSession: (id) => sessions.get(id),
};
