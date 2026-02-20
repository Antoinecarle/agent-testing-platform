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
const { spawn } = require('child_process');
const db = require('./db');
const { generateWorkspaceContext, syncSkillsToHome } = require('./workspace');
const { ensureUserHome, getUserHomePath } = require('./user-home');
const permissionHandler = require('./lib/permission-handler');

// ── Agent Environment Isolation ──────────────────────────────────────────────
// SECURITY: Agent terminals must NEVER inherit platform secrets.
// Only whitelisted env vars are passed to agent processes.
const AGENT_SAFE_ENV_KEYS = [
  // Shell essentials
  'TERM', 'COLORTERM', 'LANG', 'LC_ALL', 'LC_CTYPE', 'LANGUAGE',
  'SHELL', 'EDITOR', 'VISUAL', 'PAGER', 'LESS', 'TZ',
  // System
  'HOSTNAME', 'TMPDIR',
  // Node.js runtime (non-secret)
  'NODE_ENV', 'NODE_PATH', 'NODE_OPTIONS',
  // Railway detection (non-secret — agents may need to know the environment)
  'RAILWAY_ENVIRONMENT',
  // Nix store paths (needed for binaries on Railway)
  'NIX_PROFILES', 'NIX_SSL_CERT_FILE', 'SSL_CERT_FILE', 'CURL_CA_BUNDLE',
  'GIT_SSL_CAINFO',
];

/**
 * Build a sanitized env object for agent terminal processes.
 * Only includes whitelisted keys + explicit overrides.
 * NEVER includes secrets like API keys, DB credentials, JWT secrets, etc.
 */
function buildAgentEnv(overrides = {}) {
  const safe = {};
  for (const key of AGENT_SAFE_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      safe[key] = process.env[key];
    }
  }
  return { ...safe, ...overrides };
}

/**
 * Generate a scoped session token for the agent proxy API.
 * This token grants access ONLY to the proxy endpoints, NOT to the platform API.
 */
function generateAgentSessionToken(sessionId, projectId, userId) {
  return jwt.sign(
    {
      type: 'agent_session',
      sessionId,
      projectId: projectId || '',
      userId: userId || '',
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h', issuer: 'guru-agent-proxy' }
  );
}

// Lazy-load watcher to avoid circular deps
let _watcher = null;
function getWatcher() {
  if (!_watcher) { try { _watcher = require('./watcher'); } catch (_) {} }
  return _watcher;
}

const PTY_AVAILABLE = !!pty;

const BUFFER_INTERVAL_MS = 8;
const BUFFER_FLUSH_SIZE = 32768;
const MAX_SCROLLBACK = 50 * 1024;
const MAX_SESSIONS = 15;
const IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

// Detect environment: use claude-user on VPS, current user on Railway
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const TERMINAL_UID = IS_RAILWAY ? process.getuid() : 1001;
const TERMINAL_GID = IS_RAILWAY ? process.getgid() : 1001;

// Resolve global npm bin path for Railway (claude CLI installed globally)
let NPM_GLOBAL_BIN = '';
if (IS_RAILWAY) {
  try {
    const { execSync } = require('child_process');
    NPM_GLOBAL_BIN = execSync('npm prefix -g', { timeout: 5000 }).toString().trim() + '/bin';
  } catch (_) {
    NPM_GLOBAL_BIN = '/usr/local/bin';
  }
}

// Resolve Claude CLI binary path (reuse from index.js pattern)
let CLAUDE_BIN_PATH = 'claude';
try {
  const { execSync } = require('child_process');
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '.bin', 'claude'),
  ];
  try {
    const globalPrefix = execSync('npm prefix -g', { timeout: 5000 }).toString().trim();
    candidates.unshift(path.join(globalPrefix, 'bin', 'claude'));
  } catch (_) {}
  candidates.push('/usr/local/bin/claude', '/usr/bin/claude', '/root/.local/bin/claude');
  for (const p of candidates) {
    if (fs.existsSync(p)) { CLAUDE_BIN_PATH = p; break; }
  }
} catch (_) {}

const sessions = new Map();
const chatProcesses = new Map(); // Track active chat processes per socket

// Tool categorization helpers for enriched stream events
function serverCategorizeTool(name) {
  if (!name) return 'tool';
  const n = name.toLowerCase();
  if (n === 'read') return 'file_read';
  if (n === 'write') return 'file_write';
  if (n === 'edit') return 'file_edit';
  if (n === 'bash') return 'command';
  if (n === 'glob' || n === 'grep') return 'search';
  if (n === 'task') return 'subagent';
  if (n === 'webfetch' || n === 'websearch') return 'web';
  if (n.startsWith('mcp__')) return 'mcp';
  return 'tool';
}

function serverSummarizeTool(name, input) {
  if (!input) return '';
  const n = (name || '').toLowerCase();
  if (n === 'read') return input.file_path || '';
  if (n === 'write') return input.file_path || '';
  if (n === 'edit') return input.file_path || '';
  if (n === 'bash') return (input.command || '').substring(0, 120);
  if (n === 'glob') return input.pattern || '';
  if (n === 'grep') return input.pattern || '';
  if (n === 'task') return input.description || (input.prompt || '').substring(0, 120);
  if (n.startsWith('mcp__')) return n.split('__').slice(1).join('/');
  return '';
}

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
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const defaultHome = IS_RAILWAY ? (process.env.HOME || '/app') : '/home/claude-user';
  if (!projectId) return defaultHome;
  const wsDir = path.join(dataDir, 'workspaces', projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
  // Ensure user can write to it
  if (!IS_RAILWAY) {
    try { fs.chownSync(wsDir, TERMINAL_UID, TERMINAL_GID); } catch (_) {}
  }
  // Ensure workspace has a .git so Claude CLI recognizes it as project root
  // This allows /agents and /skills commands to find .claude/agents/ and .claude/skills/
  const gitDir = path.join(wsDir, '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      const { execSync } = require('child_process');
      execSync('git init', { cwd: wsDir, timeout: 5000, stdio: 'ignore' });
      console.log(`[Terminal] Initialized git in workspace ${projectId}`);
    } catch (_) {}
  }
  // Generate/refresh CLAUDE.md with project context (async, fire & forget but log errors)
  generateWorkspaceContext(projectId).catch(err => {
    console.error(`[Terminal] Failed to generate workspace context for ${projectId}:`, err.message);
  });
  return wsDir;
}

// Sync agent skills to user's HOME ~/.claude/skills/ so Claude CLI /skills finds them
async function syncSkillsToUserHome(projectId, userId) {
  if (!projectId || !userId) return;
  try {
    const project = await db.getProject(projectId);
    if (!project || !project.agent_name) return;
    await syncSkillsToHome(project.agent_name, getUserHomePath(userId));
  } catch (err) {
    console.error(`[Terminal] Failed to sync skills to user home:`, err.message);
  }
}

function createSession(cols, rows, name, projectId, cwd, userId) {
  if (!PTY_AVAILABLE) return null;
  if (sessions.size >= MAX_SESSIONS) return null;

  const id = generateId();
  const shell = process.env.SHELL || '/bin/bash';

  // Per-user HOME: if userId is provided, use their dedicated home directory
  let userHome;
  let userName;
  if (userId) {
    ensureUserHome(userId);
    userHome = getUserHomePath(userId);
    userName = IS_RAILWAY ? 'root' : 'claude-user';
    // Sync agent skills to user HOME so Claude CLI /skills finds them
    syncSkillsToUserHome(projectId, userId);
  } else {
    userHome = IS_RAILWAY ? (process.env.HOME || '/app') : '/home/claude-user';
    userName = IS_RAILWAY ? 'root' : 'claude-user';
  }

  const startCwd = cwd || getWorkspacePath(projectId) || userHome;

  if (IS_RAILWAY) {
    console.log(`[Terminal] Session ${id}: HOME=${userHome} CWD=${startCwd} USER=${userName} userId=${userId || 'none'}`);
  }

  // Generate scoped token for agent proxy API access
  const agentToken = generateAgentSessionToken(id, projectId, userId);
  const PORT = process.env.PORT || 4000;

  const spawnOpts = {
    name: 'xterm-256color',
    cols: cols || 120,
    rows: rows || 30,
    cwd: startCwd,
    env: buildAgentEnv({
      // Shell display
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      LANG: process.env.LANG || 'en_US.UTF-8',
      // User identity
      HOME: userHome,
      USER: userName,
      LOGNAME: userName,
      // PATH — include npm global bin for Claude CLI, but NOT platform node_modules
      PATH: IS_RAILWAY
        ? `${NPM_GLOBAL_BIN}:/app/node_modules/.bin:${process.env.PATH}`
        : `/home/claude-user/.local/bin:${process.env.PATH}`,
      // Agent Proxy — agents use this instead of raw API keys
      AGENT_PROXY_URL: `http://localhost:${PORT}/api/agent-proxy`,
      AGENT_SESSION_TOKEN: agentToken,
      // Project context (non-secret)
      GURU_PROJECT_ID: projectId || '',
    }),
  };

  // Only set uid/gid on VPS (Railway runs as current user)
  if (!IS_RAILWAY) {
    spawnOpts.uid = TERMINAL_UID;
    spawnOpts.gid = TERMINAL_GID;
  }

  const term = pty.spawn(shell, [], spawnOpts);

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
    userId: userId || '',
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

    // Scan workspace for new HTML files when terminal exits (agent finished)
    if (session.projectId) {
      const watcher = getWatcher();
      if (watcher && watcher.scanProject) {
        // Small delay to let filesystem settle
        setTimeout(() => {
          console.log(`[Terminal] Session ${session.id} exited, scanning project ${session.projectId} for new iterations`);
          watcher.scanProject(session.projectId);
        }, 1500);
      }
    }
  });

  sessions.set(id, session);
  db.insertSession(id, sessionTitle, session.createdAt, projectId || '', startCwd, shell).catch(err => console.error('[Terminal] DB insert error:', err.message));
  return session;
}

function destroySession(id) {
  const session = sessions.get(id);
  if (!session) return;
  if (session.flushTimer) clearTimeout(session.flushTimer);
  if (!session.exited) { try { session.pty.kill(); } catch (_) {} }
  sessions.delete(id);
  db.removeSession(id).catch(err => console.error('[Terminal] DB remove error:', err.message));
}

function attachSocket(session, socket) { session.clients.add(socket); }
function detachSocket(session, socket) { session.clients.delete(socket); }

function getSessionInfo(session) {
  return {
    id: session.id,
    title: session.title,
    projectId: session.projectId,
    userId: session.userId,
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
  db.renameSession(id, session.title).catch(err => console.error('[Terminal] DB rename error:', err.message));
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

async function initSessions() {
  await db.removeAllSessions();
}

let cleanupTimer = null;

function setupTerminal(io) {
  const termNamespace = io.of('/terminal');

  termNamespace.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Store userId on socket for per-user HOME
      socket.userId = decoded.userId;
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
      // Pass userId from socket auth for per-user HOME
      const session = createSession(cols, rows, null, projectId, cwd, socket.userId);
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

    // ── Activity Log Streaming ──────────────────────────────────────────────
    let activityCleanup = null;

    socket.on('watch-activity', ({ projectId } = {}, callback) => {
      if (!projectId || !socket.userId) {
        if (typeof callback === 'function') callback({ error: 'Missing projectId' });
        return;
      }

      // Clean up previous watcher
      if (activityCleanup) { activityCleanup(); activityCleanup = null; }

      try {
        const { watchSessionFile, getLatestSession, listSessionFiles } = require('./lib/session-parser');
        const userHome = getUserHomePath(socket.userId);
        const workspacePath = getWorkspacePath(projectId) || path.join(
          (process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
          'workspaces', projectId
        );

        const latest = getLatestSession(userHome, workspacePath);
        if (!latest) {
          if (typeof callback === 'function') callback({ sessionId: null, message: 'No session logs found' });
          return;
        }

        activityCleanup = watchSessionFile(latest.filePath, (newEvents) => {
          socket.emit('activity-events', newEvents);
        });

        if (typeof callback === 'function') callback({ sessionId: latest.sessionId, watching: true });
      } catch (err) {
        console.error('[Terminal] watch-activity error:', err.message);
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('stop-watch-activity', (callback) => {
      if (activityCleanup) { activityCleanup(); activityCleanup = null; }
      if (typeof callback === 'function') callback({ ok: true });
    });

    // ── Chat with Claude (streaming) ────────────────────────────────────────
    // Track the current chatId for permission handling
    let currentChatId = null;

    /**
     * Enrich a user message based on project/agent context.
     * Two modes:
     * 1. Orchestra: remind orchestrator to DELEGATE, not do it themselves
     * 2. Solo agent: remind to use their FULL specialization
     * @param {string} message - The user's original message
     * @param {object} project - The project record from DB
     * @param {object} agent - The agent record from DB (or null)
     * @returns {string} The enriched message
     */
    function enrichChatMessage(message, project, agent) {
      if (!project) return message;

      // Don't enrich long detailed messages (user knows what they want)
      if (message.length > 200) return message;

      // Don't enrich non-creative / technical messages
      const nonCreativePatterns = /^(fix|debug|error|bug|why|how|what|where|show|list|delete|remove|install|run|npm|git|curl|cat |ls |cd |explain|help)/i;
      if (nonCreativePatterns.test(message.trim())) return message;

      // Orchestra mode: force delegation
      if (project.mode === 'orchestra' && project.team_id) {
        return `[ORCHESTRATOR REMINDER: You are the orchestrator. You MUST delegate this task to your team member agents using the Task tool. Do NOT write the output yourself. Break the request into sub-tasks, delegate to workers, and send results to reviewers if available. Report back what your team produced.]

USER REQUEST: ${message}`;
      }

      // Solo agent with specialization: force full use of their prompt
      if (agent?.full_prompt && agent.full_prompt.length > 500) {
        return `[AGENT REMINDER: You are ${agent.name}, a specialized agent. For this request, apply your FULL specialization from your Agent Instructions. Do not produce generic output — use your specific techniques, patterns, and design system as described in your prompt.]

USER REQUEST: ${message}`;
      }

      return message;
    }

    socket.on('chat-send', async ({ projectId, message, sessionResume, useContinue } = {}, callback) => {
      if (!projectId || !message || !socket.userId) {
        if (typeof callback === 'function') callback({ error: 'Missing projectId or message' });
        return;
      }

      // Kill any existing chat process for this socket
      const existing = chatProcesses.get(socket.id);
      if (existing) {
        try { existing.kill('SIGTERM'); } catch (_) {}
        chatProcesses.delete(socket.id);
      }
      try {
        const userHome = getUserHomePath(socket.userId);
        ensureUserHome(socket.userId);
        const cwd = getWorkspacePath(projectId) || path.join(
          (process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
          'workspaces', projectId
        );

        // Ensure workspace context (CLAUDE.md + .mcp.json) is generated BEFORE chat
        try {
          await generateWorkspaceContext(projectId);
          console.log('[Chat] Workspace context generated for', projectId);
        } catch (err) {
          console.warn('[Chat] Workspace context generation failed:', err.message);
        }

        // Generate unique chatId for tracking
        const chatId = `chat_${generateId()}_${Date.now()}`;
        currentChatId = chatId;

        const args = ['-p', '--output-format', 'stream-json', '--verbose'];

        // Auto-approve permissions via MCP proxy (can't use --dangerously-skip-permissions as root)
        const autoApproveServer = path.join(__dirname, 'mcp-auto-approve.js');

        // Merge workspace .mcp.json (agent tools bridge) with auto-approve permission server
        let workspaceMcpServers = {};
        const workspaceMcpPath = path.join(cwd, '.mcp.json');
        if (fs.existsSync(workspaceMcpPath)) {
          try {
            const wsMcp = JSON.parse(fs.readFileSync(workspaceMcpPath, 'utf8'));
            workspaceMcpServers = wsMcp.mcpServers || {};
            // Remove the interactive permission server — chat uses auto-approve instead
            delete workspaceMcpServers['guru-permission'];
            console.log('[Chat] Merged workspace MCP servers:', Object.keys(workspaceMcpServers).join(', '));
          } catch (err) {
            console.warn('[Chat] Failed to read workspace .mcp.json:', err.message);
          }
        }

        const mcpConfig = {
          mcpServers: {
            ...workspaceMcpServers,
            'guru-permissions': {
              command: 'node',
              args: [autoApproveServer],
            },
          },
        };
        const mcpConfigJson = JSON.stringify(mcpConfig);
        args.push('--permission-prompt-tool', 'mcp__guru-permissions__permission_prompt');
        args.push('--mcp-config', mcpConfigJson);

        if (sessionResume) {
          args.push('--resume', sessionResume);
        } else if (useContinue) {
          args.push('--continue');
        }

        // Enrich messages based on project context (orchestra delegation / agent specialization)
        let finalMessage = message;
        try {
          const project = await db.getProject(projectId);
          const agent = project?.agent_name ? await db.getAgent(project.agent_name) : null;
          finalMessage = enrichChatMessage(message, project, agent);
          if (finalMessage !== message) {
            const mode = project?.mode === 'orchestra' ? 'orchestra-delegation' : 'agent-specialization';
            console.log(`[Chat] Message enriched (${mode}):`, project.agent_name);
          }
        } catch (err) {
          console.warn('[Chat] Message enrichment skipped:', err.message);
        }
        args.push(finalMessage);

        // Generate scoped agent session token for chat process
        const chatSessionId = generateId();
        const chatAgentToken = generateAgentSessionToken(chatSessionId, projectId, socket.userId);
        const chatPORT = process.env.PORT || 4000;

        console.log('[Chat] Spawning:', CLAUDE_BIN_PATH, args.slice(0, 6).join(' '), '...');
        console.log('[Chat] CWD:', cwd, '| HOME:', userHome, '| chatId:', chatId);
        console.log('[Chat] Resume:', sessionResume || 'none', '| Continue:', !!useContinue);
        console.log('[Chat] Auto-approve via MCP proxy');

        const chatProc = spawn(CLAUDE_BIN_PATH, args, {
          cwd,
          env: buildAgentEnv({
            TERM: 'xterm-256color',
            HOME: userHome,
            USER: IS_RAILWAY ? 'root' : 'claude-user',
            PATH: IS_RAILWAY
              ? `${NPM_GLOBAL_BIN}:/app/node_modules/.bin:${process.env.PATH}`
              : `/home/claude-user/.local/bin:${process.env.PATH}`,
            // Agent Proxy
            AGENT_PROXY_URL: `http://localhost:${chatPORT}/api/agent-proxy`,
            AGENT_SESSION_TOKEN: chatAgentToken,
            GURU_PROJECT_ID: projectId || '',
          }),
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        console.log('[Chat] Process spawned, pid:', chatProc.pid);
        // Close stdin so Claude CLI knows no more input is coming
        if (chatProc.stdin) {
          try { chatProc.stdin.end(); } catch (_) {}
        }
        chatProcesses.set(socket.id, chatProc);
        let sessionId = null;
        let buffer = '';

        chatProc.stdout.on('data', (chunk) => {
          const text = chunk.toString();
          console.log('[Chat] stdout:', text.substring(0, 200));
          buffer += text;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              // Extract session ID from result messages
              if (parsed.session_id) sessionId = parsed.session_id;

              // Enrich all tool events with metadata for frontend
              if (parsed.type === 'assistant' && parsed.message?.content) {
                const toolMetas = [];
                for (const block of parsed.message.content) {
                  if (block.type === 'tool_use') {
                    block._guruToolMeta = {
                      category: serverCategorizeTool(block.name),
                      summary: serverSummarizeTool(block.name, block.input),
                      startedAt: Date.now(),
                    };
                    toolMetas.push(block._guruToolMeta);
                    // Special enrichment for sub-agent Task calls
                    if (block.name?.toLowerCase() === 'task') {
                      parsed._guruSubagent = {
                        type: block.input?.subagent_type || 'general-purpose',
                        name: block.input?.name || block.input?.description || 'Sub-agent',
                        description: block.input?.description || '',
                        prompt: block.input?.prompt || '',
                        model: block.input?.model || '',
                        toolUseId: block.id,
                      };
                    }
                  }
                }
                if (toolMetas.length > 0) parsed._guruToolMetas = toolMetas;
              }

              socket.emit('chat-stream', parsed);
            } catch {
              socket.emit('chat-stream', { type: 'raw', text: line });
            }
          }
        });

        chatProc.stderr.on('data', (chunk) => {
          const errText = chunk.toString();
          console.log('[Chat] stderr:', errText.substring(0, 300));
          // Don't forward MCP permission server logs as errors to the UI
          if (!errText.includes('[mcp-permission]')) {
            socket.emit('chat-stream', { type: 'error', text: errText });
          }
        });

        chatProc.on('close', (code) => {
          console.log('[Chat] Process closed, code:', code);
          chatProcesses.delete(socket.id);
          if (currentChatId === chatId) currentChatId = null;
          // Flush remaining buffer
          if (buffer.trim()) {
            try {
              socket.emit('chat-stream', JSON.parse(buffer));
            } catch {
              socket.emit('chat-stream', { type: 'raw', text: buffer });
            }
          }
          socket.emit('chat-done', { code, sessionId });
        });

        chatProc.on('error', (err) => {
          console.error('[Chat] Process error:', err.message);
          chatProcesses.delete(socket.id);
          if (currentChatId === chatId) currentChatId = null;
          socket.emit('chat-done', { error: err.message });
        });

        // Startup timeout: if no output after 30s, likely auth issue or hung process
        let gotOutput = false;
        const startupTimer = setTimeout(() => {
          if (!gotOutput && chatProcesses.has(socket.id)) {
            console.warn('[Chat] No output after 30s, killing process');
            try { chatProc.kill('SIGTERM'); } catch (_) {}
            socket.emit('chat-stream', { type: 'error', text: 'Claude CLI did not respond. Check authentication or try from the terminal.' });
            socket.emit('chat-done', { error: 'timeout', sessionId: null });
            chatProcesses.delete(socket.id);
          }
        }, 30000);

        chatProc.stdout.prependOnceListener('data', () => {
          gotOutput = true;
          clearTimeout(startupTimer);
        });

        // Emit chatId to frontend so it can send permission responses
        if (typeof callback === 'function') callback({ ok: true, chatId });
      } catch (err) {
        console.error('[Terminal] chat-send error:', err.message);
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    // ── Permission response from frontend ────────────────────────────────────
    socket.on('chat-permission-response', ({ chatId, requestId, approved, updatedInput } = {}, callback) => {
      const cid = chatId || currentChatId;
      if (!cid || !requestId) {
        if (typeof callback === 'function') callback({ error: 'Missing chatId or requestId' });
        return;
      }
      const success = permissionHandler.handlePermissionResponse(cid, requestId, approved, updatedInput);
      if (typeof callback === 'function') callback({ ok: success });
    });

    socket.on('chat-cancel', (callback) => {
      const proc = chatProcesses.get(socket.id);
      if (proc) {
        try { proc.kill('SIGTERM'); } catch (_) {}
        chatProcesses.delete(socket.id);
      }
      currentChatId = null;
      if (typeof callback === 'function') callback({ ok: true });
    });

    socket.on('disconnect', () => {
      if (activityCleanup) { activityCleanup(); activityCleanup = null; }
      currentChatId = null;
      // Kill any running chat process
      const chatProc = chatProcesses.get(socket.id);
      if (chatProc) {
        try { chatProc.kill('SIGTERM'); } catch (_) {}
        chatProcesses.delete(socket.id);
      }
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
