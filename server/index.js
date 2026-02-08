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

let watcher;
try {
  watcher = require('./watcher');
} catch (err) {
  console.warn('[Server] Watcher module failed to load:', err.message);
}

// Import db to trigger schema creation + seed admin
const db = require('./db');
db.seedAdmin();

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
