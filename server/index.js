require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { router: authRouter, verifyToken } = require('./auth');
const agentsRoutes = require('./routes/agents');
const categoriesRoutes = require('./routes/categories');
const projectsRoutes = require('./routes/projects');
const iterationsRoutes = require('./routes/iterations');
const previewRoutes = require('./routes/preview');
const seedRoutes = require('./routes/seed');
const terminalTabsRoutes = require('./routes/terminal-tabs');
const { setupTerminal, initSessions } = require('./terminal');
const { isClaudeAuthenticated, ensureUserHome, getUserHomePath } = require('./user-home');

let watcher;
try {
  watcher = require('./watcher');
} catch (err) {
  console.warn('[Server] Watcher module failed to load:', err.message);
}

// Import db to trigger schema creation + seed admin
const db = require('./db');
db.seedAdmin();

// Ensure admin user has a home directory
const adminEmail = process.env.EMAIL || 'admin@vps.local';
const adminUser = db.getUserByEmail(adminEmail);
if (adminUser) {
  ensureUserHome(adminUser.id);
}

// Clean slate for terminal sessions on startup
initSessions();

// Sync agents from filesystem
agentsRoutes.ensureSynced();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Auth routes (no token required)
app.use('/api/auth', authRouter);

// Protected API routes
app.use('/api/agents', verifyToken, agentsRoutes);
app.use('/api/categories', verifyToken, categoriesRoutes);
app.use('/api/projects', verifyToken, projectsRoutes);
app.use('/api/iterations', verifyToken, iterationsRoutes);
app.use('/api/seed', verifyToken, seedRoutes);
app.use('/api/terminal-tabs', verifyToken, terminalTabsRoutes);

// Preview route (no auth for iframe embedding)
app.use('/api/preview', previewRoutes);

// Claude CLI status check
const { execSync } = require('child_process');
app.get('/api/claude-status', verifyToken, (req, res) => {
  try {
    const version = execSync('claude --version 2>/dev/null', { timeout: 5000 }).toString().trim();
    res.json({ installed: true, version });
  } catch (_) {
    res.json({ installed: false, version: null });
  }
});

// --- Claude Auth Endpoints ---

// GET /api/claude-auth/status — check if current user's Claude is connected
app.get('/api/claude-auth/status', verifyToken, (req, res) => {
  try {
    const userId = req.user.userId;
    const connected = isClaudeAuthenticated(userId);
    const user = db.getUserById(userId);
    res.json({
      connected,
      subscription: user?.claude_subscription || '',
      connectedAt: user?.claude_connected_at || null,
    });
  } catch (err) {
    console.error('[ClaudeAuth] Status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/claude-auth/verify — re-check after user runs OAuth in terminal
app.post('/api/claude-auth/verify', verifyToken, (req, res) => {
  try {
    const userId = req.user.userId;
    ensureUserHome(userId);
    const connected = isClaudeAuthenticated(userId);

    // Update DB with connection status
    const homeDir = getUserHomePath(userId);
    db.updateUserClaudeStatus(userId, connected, connected ? 'active' : '', homeDir);

    res.json({ connected });
  } catch (err) {
    console.error('[ClaudeAuth] Verify error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/user/me — get current user info
app.get('/api/user/me', verifyToken, (req, res) => {
  try {
    const user = db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const claudeConnected = isClaudeAuthenticated(user.id);
    res.json({
      id: user.id,
      email: user.email,
      displayName: user.display_name || '',
      role: user.role,
      claudeConnected,
      claudeSubscription: user.claude_subscription || '',
      claudeConnectedAt: user.claude_connected_at || null,
    });
  } catch (err) {
    console.error('[User] Me error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// --- Orchestrator Endpoint ---

// POST /api/orchestrator/command — runs claude -p with system orchestrator HOME
app.post('/api/orchestrator/command', verifyToken, (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt required' });

    // Use admin's HOME for system orchestrator (or a dedicated orchestrator home)
    const adminUser = db.getUserByEmail(process.env.EMAIL || 'admin@vps.local');
    const orchestratorHome = adminUser ? getUserHomePath(adminUser.id) : (process.env.HOME || '/root');

    const result = execSync(`HOME="${orchestratorHome}" claude -p '${prompt.replace(/'/g, "'\\''")}'`, {
      timeout: 120000,
      env: { ...process.env, HOME: orchestratorHome },
      maxBuffer: 1024 * 1024,
    }).toString().trim();

    res.json({ response: result });
  } catch (err) {
    console.error('[Orchestrator] Error:', err.message);
    res.status(500).json({ error: err.stderr?.toString() || err.message || 'Orchestrator error' });
  }
});

// Serve static frontend
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Setup terminal WebSocket
setupTerminal(io);

// Start file watchers for auto-importing iterations
if (watcher) {
  watcher.initWatchers(io);
}

const PORT = process.env.PORT || 4000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Agent Testing Platform running on http://0.0.0.0:${PORT}`);
});
