require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const { requestLogger, createLogger } = require('./lib/logger');
const log = createLogger('server');
const { router: authRouter, verifyToken } = require('./auth');
const { authLimiter, apiLimiter, heavyLimiter } = require('./middleware/rate-limit');
const { auditMiddleware, ensureAuditTable } = require('./middleware/audit');
const { validate, orchestratorSchema } = require('./middleware/validate');
const agentsRoutes = require('./routes/agents');
const categoriesRoutes = require('./routes/categories');
const projectsRoutes = require('./routes/projects');
const iterationsRoutes = require('./routes/iterations');
const previewRoutes = require('./routes/preview');
const seedRoutes = require('./routes/seed');
const terminalTabsRoutes = require('./routes/terminal-tabs');
const { setupTerminal, initSessions } = require('./terminal');
const { isClaudeAuthenticated, ensureUserHome, getUserHomePath, migrateSystemCredentials } = require('./user-home');

let watcher;
try {
  watcher = require('./watcher');
} catch (err) {
  console.warn('[Server] Watcher module failed to load:', err.message);
}

// Import db to trigger schema creation + seed admin
const db = require('./db');

// Resolve claude binary path (global npm bin or node_modules/.bin)
const { execSync } = require('child_process');
function findClaudeBin() {
  const candidates = [
    path.join(__dirname, '..', 'node_modules', '.bin', 'claude'),
  ];
  try {
    const globalPrefix = execSync('npm prefix -g', { timeout: 5000 }).toString().trim();
    candidates.unshift(path.join(globalPrefix, 'bin', 'claude'));
  } catch (_) {}
  candidates.push('/usr/local/bin/claude', '/usr/bin/claude');
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'claude';
}
const CLAUDE_BIN = findClaudeBin();
console.log(`[Orchestrator] Claude binary: ${CLAUDE_BIN}`);

(async () => {
  // Seed admin and ensure home directory
  await db.seedAdmin();

  // Ensure admin user has a home directory + migrate existing Claude credentials
  const adminEmail = process.env.EMAIL || 'admin@vps.local';
  const adminUser = await db.getUserByEmail(adminEmail);
  if (adminUser) {
    ensureUserHome(adminUser.id);
    migrateSystemCredentials(adminUser.id);
  }

  // Clean slate for terminal sessions on startup
  initSessions();

  // Sync agents from filesystem + restore custom agents from DB to filesystem + user homes
  agentsRoutes.ensureSynced();
  agentsRoutes.syncCustomAgentsFromDB().then(async (n) => {
    if (n > 0) console.log(`[Startup] Restored ${n} custom agents from DB to filesystem`);

    // Fix legacy personal agents: update category, fix front matter format for Claude CLI
    try {
      const { data: personalAgents } = await db.supabase.from('agents')
        .select('name, full_prompt, category, model, permission_mode')
        .like('description', 'Personal % agent with % skills');
      if (personalAgents && personalAgents.length > 0) {
        const CUSTOM_DIR = path.join(DATA_DIR, 'custom-agents');
        let patched = 0;
        for (const agent of personalAgents) {
          if (agent.category !== 'persona') {
            await db.supabase.from('agents').update({ category: 'persona' }).eq('name', agent.name);
          }
          // Fix .md front matter to match Claude CLI expected format
          const mdPath = path.join(CUSTOM_DIR, `${agent.name}.md`);
          if (fs.existsSync(mdPath)) {
            let content = fs.readFileSync(mdPath, 'utf-8');
            let needsPatch = false;
            // Fix missing name field
            if (content.match(/^---\n/) && !content.includes('\nname:')) {
              content = content.replace(/^---\n/, `---\nname: ${agent.name}\n`);
              needsPatch = true;
            }
            // Fix max_turns -> maxTurns
            if (content.includes('\nmax_turns:')) {
              content = content.replace(/\nmax_turns:/g, '\nmaxTurns:');
              needsPatch = true;
            }
            // Fix permission_mode -> permissionMode
            if (content.includes('\npermission_mode:')) {
              content = content.replace(/\npermission_mode:/g, '\npermissionMode:');
              needsPatch = true;
            }
            // Fix tools: [X,Y,Z] -> tools: X, Y, Z
            const toolsBracketMatch = content.match(/\ntools: \[([^\]]+)\]/);
            if (toolsBracketMatch) {
              const toolsFormatted = toolsBracketMatch[1].split(',').map(t => t.trim()).join(', ');
              content = content.replace(/\ntools: \[[^\]]+\]/, `\ntools: ${toolsFormatted}`);
              needsPatch = true;
            }
            // Fix missing category
            if (!content.includes('\ncategory:')) {
              content = content.replace(/^(---\n)/, '$1category: persona\n');
              needsPatch = true;
            }
            if (needsPatch) {
              fs.writeFileSync(mdPath, content, 'utf-8');
              // Also update DB full_prompt so future syncs don't revert the fix
              await db.supabase.from('agents').update({ full_prompt: content }).eq('name', agent.name);
              patched++;
            }
          }
        }
        if (patched > 0) {
          console.log(`[Startup] Patched ${patched} persona agent .md files + DB (front matter format fix)`);
          // Re-copy fixed files to user homes
          const { USERS_DIR } = require('./user-home');
          if (fs.existsSync(USERS_DIR)) {
            const userDirs = fs.readdirSync(USERS_DIR).filter(d => {
              try { return fs.statSync(path.join(USERS_DIR, d)).isDirectory(); } catch (_) { return false; }
            });
            for (const userId of userDirs) {
              const userAgentsDir = path.join(USERS_DIR, userId, '.claude', 'agents');
              if (fs.existsSync(userAgentsDir)) {
                for (const agent of personalAgents) {
                  const src = path.join(CUSTOM_DIR, `${agent.name}.md`);
                  const dest = path.join(userAgentsDir, `${agent.name}.md`);
                  if (fs.existsSync(src)) {
                    try { fs.copyFileSync(src, dest); } catch (_) {}
                  }
                }
              }
            }
            console.log(`[Startup] Propagated fixed agents to ${userDirs.length} user home(s)`);
          }
        }
      }
    } catch (err) {
      console.warn('[Startup] Persona agent migration:', err.message);
    }
  }).catch(err => console.error('[Startup] Custom agent sync failed:', err.message));

  // Sync skills: create files on disk for skills that only have a prompt in DB
  const skillStorage = require('./skill-storage');
  skillStorage.ensureSkillFiles().catch(err => {
    console.error('[Startup] Skill file sync failed:', err.message);
  });

  const app = express();
  const server = http.createServer(app);

  // CORS: lock to specific domains (Railway + localhost dev)
  const ALLOWED_ORIGINS = [
    process.env.CORS_ORIGIN, // Custom override via env var
    'https://guru-api-production.up.railway.app',
    'http://localhost:4000',
    'http://localhost:5173', // Vite dev server
  ].filter(Boolean);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  };

  const io = new Server(server, { cors: corsOptions });

  // Security headers
  app.use(helmet({
    contentSecurityPolicy: false, // Disabled for iframe previews — can be tightened later
    crossOriginEmbedderPolicy: false,
  }));
  app.use(cors(corsOptions));

  // Stripe webhook must receive raw body (before JSON parser)
  const billingRoutes = require('./routes/billing');
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), billingRoutes.stripeWebhookHandler);

  app.use(express.json({ limit: '5mb' }));

  // Structured request logging
  app.use(requestLogger());

  // Global rate limiting
  app.use('/api/', apiLimiter);

  // Audit trail for write operations
  app.use('/api/', auditMiddleware);

  // Ensure audit table exists
  ensureAuditTable();

  // Auth routes (no token required, rate limited)
  app.use('/api/auth', authLimiter, authRouter);

  // No-auth endpoints (must be BEFORE protected /api/projects routes)
  // Save iteration — used by workspace agents via CLI (no token)
  app.post('/api/projects/:projectId/save-iteration', async (req, res) => {
    try {
      if (!watcher) {
        return res.status(503).json({ ok: false, error: 'Watcher not available' });
      }

      const { projectId } = req.params;
      const project = await db.getProject(projectId);
      if (!project) {
        return res.status(404).json({ ok: false, error: 'Project not found' });
      }

      // Ensure watcher is watching this project
      watcher.watchProject(projectId);

      // Import new/changed files (do NOT use manualImport — it clears hashes and causes duplicates)
      let iterationId = await watcher.importIteration(projectId);

      if (iterationId) {
        res.status(201).json({ ok: true, saved: true, iterationId });
      } else {
        res.json({ ok: true, saved: false, message: 'No new or changed HTML files found in workspace' });
      }
    } catch (err) {
      console.error('[SaveIteration] Error:', err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Protected API routes
  app.use('/api/agents', verifyToken, agentsRoutes);
  app.use('/api/categories', verifyToken, categoriesRoutes);
  app.use('/api/projects', verifyToken, projectsRoutes);
  app.use('/api/iterations', verifyToken, iterationsRoutes);
  app.use('/api/seed', verifyToken, seedRoutes);
  app.use('/api/terminal-tabs', verifyToken, terminalTabsRoutes);

  const organizationsRoutes = require('./routes/organizations');
  app.use('/api/organizations', verifyToken, organizationsRoutes);

  app.use('/api/billing', verifyToken, billingRoutes);

  const settingsRoutes = require('./routes/settings');
  app.use('/api/settings', verifyToken, settingsRoutes);

  const onboardingRoutes = require('./routes/onboarding');
  app.use('/api/onboarding', verifyToken, onboardingRoutes);

  const marketplaceRoutes = require('./routes/marketplace');
  app.use('/api/marketplace', verifyToken, marketplaceRoutes);

  const agentTeamsRoutes = require('./routes/agent-teams');
  app.use('/api/agent-teams', verifyToken, agentTeamsRoutes);

  const teamRunsRoutes = require('./routes/team-runs');
  app.use('/api/agent-teams', verifyToken, teamRunsRoutes);

  const agentCreatorRoutes = require('./routes/agent-creator');
  app.use('/api/agent-creator', verifyToken, agentCreatorRoutes);

  const skillsRoutes = require('./routes/skills');
  app.use('/api/skills', verifyToken, skillsRoutes);

  const skillCreatorRoutes = require('./routes/skill-creator');
  app.use('/api/skill-creator', verifyToken, skillCreatorRoutes);

  const knowledgeRoutes = require('./routes/knowledge');
  app.use('/api/knowledge', verifyToken, knowledgeRoutes);

  const agentChatRoutes = require('./routes/agent-chat');
  app.use('/api/agent-chat', verifyToken, agentChatRoutes);

  const filesRoutes = require('./routes/files');
  app.use('/api/projects', verifyToken, filesRoutes);

  const personaboardingRoutes = require('./routes/personaboarding');
  // LinkedIn OAuth routes must be accessible without auth (callback comes from LinkedIn, not the user)
  const personaboardingAuth = (req, res, next) => {
    if (req.path.startsWith('/linkedin/auth') || req.path.startsWith('/linkedin/callback')) {
      return next();
    }
    return verifyToken(req, res, next);
  };
  app.use('/api/personaboarding', personaboardingAuth, personaboardingRoutes);

  // Serve uploaded files for agent creator
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  app.use('/uploads/agent-creator', express.static(path.join(DATA_DIR, 'agent-creator-uploads')));

  // Agent deployment routes (deploy agents as MCP servers)
  const agentDeployRoutes = require('./routes/agent-deploy');
  app.use('/api/agent-deploy', verifyToken, agentDeployRoutes);

  // MCP public routes (landing pages + API endpoints — no auth for landing, API key for endpoints)
  const mcpPublicRoutes = require('./routes/mcp-public');
  app.use('/mcp', mcpPublicRoutes);

  // Preview route (no auth for iframe embedding)
  app.use('/api/preview', previewRoutes);

  // --- Session Management Endpoints ---

  // GET /api/sessions — list all active terminal sessions
  app.get('/api/sessions', verifyToken, async (req, res) => {
    try {
      const { listSessions } = require('./terminal');
      const sessions = listSessions();
      // Enrich with project name
      const enriched = [];
      for (const s of sessions) {
        let projectName = null;
        if (s.projectId) {
          const project = await db.getProject(s.projectId);
          projectName = project ? project.name : null;
        }
        enriched.push({ ...s, projectName });
      }
      res.json(enriched);
    } catch (err) {
      console.error('[Sessions] List error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/sessions/all — kill ALL sessions
  app.delete('/api/sessions/all', verifyToken, (req, res) => {
    try {
      const { listSessions, destroySession } = require('./terminal');
      const sessions = listSessions();
      let killed = 0;
      for (const s of sessions) {
        try { destroySession(s.id); killed++; } catch (_) {}
      }
      console.log(`[Sessions] Killed ${killed} sessions`);
      res.json({ ok: true, killed });
    } catch (err) {
      console.error('[Sessions] Kill all error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /api/sessions/:id — kill a specific session
  app.delete('/api/sessions/:id', verifyToken, (req, res) => {
    try {
      const { destroySession, getSession } = require('./terminal');
      const session = getSession(req.params.id);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      destroySession(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      console.error('[Sessions] Kill error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Scan workspace for new iterations (manual trigger)
  app.post('/api/projects/:projectId/scan', verifyToken, async (req, res) => {
    try {
      if (!watcher || !watcher.scanProject) {
        return res.status(503).json({ error: 'Watcher not available' });
      }
      const result = await watcher.scanProject(req.params.projectId);
      res.json({ imported: !!result, iterationId: result || null });
    } catch (err) {
      console.error('[Scan] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Get skills for a project's agent
  app.get('/api/projects/:projectId/skills', verifyToken, async (req, res) => {
    try {
      const project = await db.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      if (!project.agent_name) return res.json([]);
      const skills = await db.getAgentSkills(project.agent_name);
      res.json(skills || []);
    } catch (err) {
      console.error('[ProjectSkills] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Workspace CLAUDE.md diagnostic — check what skills are injected
  app.get('/api/projects/:projectId/workspace-context', verifyToken, async (req, res) => {
    try {
      const { getSkillContext } = require('./workspace');
      const project = await db.getProject(req.params.projectId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const agentName = project.agent_name || '';
      const skillContext = agentName ? await getSkillContext(agentName) : '';
      const wsDir = path.join(DATA_DIR, 'workspaces', req.params.projectId);
      const claudeMdPath = path.join(wsDir, 'CLAUDE.md');
      const claudeMdExists = fs.existsSync(claudeMdPath);
      const claudeMdSize = claudeMdExists ? fs.statSync(claudeMdPath).size : 0;
      const hasSkillSection = claudeMdExists ? fs.readFileSync(claudeMdPath, 'utf-8').includes('## Assigned Skills') : false;
      res.json({
        agentName,
        skillContextLength: skillContext.length,
        skillContextPreview: skillContext.substring(0, 500),
        claudeMdExists,
        claudeMdSize,
        hasSkillSection,
      });
    } catch (err) {
      console.error('[WorkspaceContext] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Force regenerate workspace CLAUDE.md (useful when skills change)
  app.post('/api/projects/:projectId/refresh-workspace', verifyToken, async (req, res) => {
    try {
      const { generateWorkspaceContext } = require('./workspace');
      const claudeMdPath = await generateWorkspaceContext(req.params.projectId);
      if (!claudeMdPath) return res.status(404).json({ error: 'Project not found' });
      const size = fs.statSync(claudeMdPath).size;
      const hasSkills = fs.readFileSync(claudeMdPath, 'utf-8').includes('## Assigned Skills');
      res.json({ ok: true, claudeMdPath, size, hasSkills });
    } catch (err) {
      console.error('[RefreshWorkspace] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // Claude CLI status check
  app.get('/api/claude-status', verifyToken, (req, res) => {
    try {
      const version = execSync(`"${CLAUDE_BIN}" --version 2>/dev/null`, { timeout: 5000 }).toString().trim();
      res.json({ installed: true, version });
    } catch (_) {
      res.json({ installed: false, version: null });
    }
  });

  // --- Claude Auth Endpoints ---

  // GET /api/claude-auth/status — check if current user's Claude is connected
  app.get('/api/claude-auth/status', verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      const connected = isClaudeAuthenticated(userId);
      const user = await db.getUserById(userId);
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
  app.post('/api/claude-auth/verify', verifyToken, async (req, res) => {
    try {
      const userId = req.user.userId;
      ensureUserHome(userId);
      const connected = isClaudeAuthenticated(userId);

      // Update DB with connection status
      const homeDir = getUserHomePath(userId);
      await db.updateUserClaudeStatus(userId, connected, connected ? 'active' : '', homeDir);

      res.json({ connected });
    } catch (err) {
      console.error('[ClaudeAuth] Verify error:', err.message);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // GET /api/user/me — get current user info
  app.get('/api/user/me', verifyToken, async (req, res) => {
    try {
      const user = await db.getUserById(req.user.userId);
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
  app.post('/api/orchestrator/command', verifyToken, heavyLimiter, validate(orchestratorSchema), async (req, res) => {
    try {
      const { prompt } = req.body;

      // Use admin's HOME for system orchestrator (or a dedicated orchestrator home)
      const adminUser = await db.getUserByEmail(process.env.EMAIL || 'admin@vps.local');
      const orchestratorHome = adminUser ? getUserHomePath(adminUser.id) : (process.env.HOME || '/root');

      // Use execFile instead of execSync to prevent shell injection
      const { execFileSync } = require('child_process');
      const result = execFileSync(CLAUDE_BIN, ['-p', prompt], {
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

  // ===================== API DOCS =====================

  const swaggerUi = require('swagger-ui-express');
  const openApiSpec = require('./openapi.json');
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'GURU API Documentation',
  }));

  // ===================== HEALTH & MONITORING =====================

  const startTime = Date.now();

  // GET /health — basic liveness check (no auth)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
    });
  });

  // GET /ready — readiness check with DB connectivity (no auth)
  app.get('/ready', async (req, res) => {
    try {
      const { data, error } = await db.supabase.from('users').select('id').limit(1);
      if (error) throw error;
      res.json({
        status: 'ready',
        database: 'connected',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        memory: {
          rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
          heap_used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          heap_total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        },
      });
    } catch (err) {
      res.status(503).json({
        status: 'not_ready',
        database: 'disconnected',
        error: err.message,
      });
    }
  });

  // GET /metrics — basic Prometheus-compatible metrics (no auth)
  app.get('/metrics', (req, res) => {
    const mem = process.memoryUsage();
    const uptimeS = Math.floor((Date.now() - startTime) / 1000);
    res.set('Content-Type', 'text/plain');
    res.send([
      `# HELP process_uptime_seconds Process uptime in seconds`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${uptimeS}`,
      `# HELP process_resident_memory_bytes Resident memory size in bytes`,
      `# TYPE process_resident_memory_bytes gauge`,
      `process_resident_memory_bytes ${mem.rss}`,
      `# HELP process_heap_bytes Heap memory in bytes`,
      `# TYPE process_heap_bytes gauge`,
      `process_heap_bytes{type="used"} ${mem.heapUsed}`,
      `process_heap_bytes{type="total"} ${mem.heapTotal}`,
      `# HELP nodejs_version Node.js version info`,
      `# TYPE nodejs_version gauge`,
      `nodejs_version{version="${process.version}"} 1`,
    ].join('\n') + '\n');
  });

  // Serve static frontend
  const distPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  // Setup terminal WebSocket
  setupTerminal(io);

  // Setup knowledge base bulk import WebSocket
  knowledgeRoutes.initKnowledgeSocket(io);

  // Start file watchers for auto-importing iterations
  if (watcher) {
    watcher.initWatchers(io);
  }

  const PORT = process.env.PORT || 4000;

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Agent Testing Platform running on http://0.0.0.0:${PORT}`);
  });
})();
