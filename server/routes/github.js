const express = require('express');
const crypto = require('crypto');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { ensureUserHome, isClaudeAuthenticated } = require('../user-home');
const { seedWelcomeProject } = require('../lib/welcome-seed');
const { createLogger } = require('../lib/logger');
const log = createLogger('github');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

const router = express.Router();

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

// GET /api/auth/github — redirect to GitHub OAuth
router.get('/auth', (req, res) => {
  if (!GITHUB_CLIENT_ID) {
    return res.status(503).json({ error: 'GitHub OAuth not configured' });
  }

  // state encodes the action (login vs connect) + CSRF token
  const action = req.query.action || 'login'; // 'login' or 'connect'
  const userId = req.query.userId || ''; // for 'connect' action
  const csrfToken = crypto.randomBytes(16).toString('hex');

  const state = Buffer.from(JSON.stringify({ action, userId, csrf: csrfToken })).toString('base64url');

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${getBaseUrl(req)}/api/github/callback`,
    scope: 'user:email repo',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GET /api/github/callback — handle OAuth callback
router.get('/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return redirectWithError(res, 'No authorization code received');
    }

    // Decode state
    let stateData = { action: 'login', userId: '' };
    if (state) {
      try {
        stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      } catch (_) {}
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      log.error('GitHub token exchange failed:', tokenData.error_description);
      return redirectWithError(res, tokenData.error_description || 'OAuth failed');
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user info
    const ghUser = await fetchGitHubUser(accessToken);
    if (!ghUser || !ghUser.id) {
      return redirectWithError(res, 'Could not fetch GitHub user info');
    }

    // Get primary email from GitHub
    const ghEmail = await fetchGitHubEmail(accessToken);

    if (stateData.action === 'connect' && stateData.userId) {
      // Connect GitHub to existing account
      return await handleConnect(res, stateData.userId, ghUser, accessToken);
    }

    // Login/Register flow
    return await handleLoginOrRegister(res, ghUser, ghEmail, accessToken);

  } catch (err) {
    log.error('GitHub callback error:', err.message);
    return redirectWithError(res, 'Authentication failed');
  }
});

// Handle login or register via GitHub
async function handleLoginOrRegister(res, ghUser, ghEmail, accessToken) {
  // Check if user already exists with this GitHub ID
  let user = await db.getUserByGithubId(String(ghUser.id));

  if (user) {
    // Existing user — update token and login
    await db.updateUserGithub(user.id, {
      github_access_token: accessToken,
      github_username: ghUser.login,
      github_avatar_url: ghUser.avatar_url,
    });

    const payload = { userId: user.id, email: user.email, role: user.role };
    const { accessToken: jwtToken, refreshToken } = generateTokens(payload);

    return redirectWithAuth(res, {
      token: jwtToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      displayName: user.display_name || ghUser.name || ghUser.login,
      role: user.role,
      claudeConnected: isClaudeAuthenticated(user.id),
    });
  }

  // Check if user exists with same email
  const email = ghEmail || `${ghUser.login}@github.noreply.com`;
  user = await db.getUserByEmail(email);

  if (user) {
    // Link GitHub to existing email-based account
    await db.updateUserGithub(user.id, {
      github_id: String(ghUser.id),
      github_username: ghUser.login,
      github_access_token: accessToken,
      github_avatar_url: ghUser.avatar_url,
    });

    const payload = { userId: user.id, email: user.email, role: user.role };
    const { accessToken: jwtToken, refreshToken } = generateTokens(payload);

    return redirectWithAuth(res, {
      token: jwtToken,
      refreshToken,
      userId: user.id,
      email: user.email,
      displayName: user.display_name || ghUser.name || ghUser.login,
      role: user.role,
      claudeConnected: isClaudeAuthenticated(user.id),
    });
  }

  // New user — register
  const id = crypto.randomUUID();
  const homeDir = path.join(DATA_DIR, 'users', id);
  const displayName = ghUser.name || ghUser.login;

  await db.createUser(id, email, null, 'user', displayName, homeDir);
  await db.updateUserGithub(id, {
    github_id: String(ghUser.id),
    github_username: ghUser.login,
    github_access_token: accessToken,
    github_avatar_url: ghUser.avatar_url,
  });

  // Update avatar_url on profile too
  await db.updateUserProfile(id, { avatar_url: ghUser.avatar_url });

  ensureUserHome(id);
  seedWelcomeProject(id).catch(err => log.error('Welcome seed failed:', err.message));

  const payload = { userId: id, email, role: 'user' };
  const { accessToken: jwtToken, refreshToken } = generateTokens(payload);

  return redirectWithAuth(res, {
    token: jwtToken,
    refreshToken,
    userId: id,
    email,
    displayName,
    role: 'user',
    claudeConnected: false,
    isNewUser: true,
  });
}

// Handle connecting GitHub to existing account
async function handleConnect(res, userId, ghUser, accessToken) {
  // Check if this GitHub account is already linked to another user
  const existing = await db.getUserByGithubId(String(ghUser.id));
  if (existing && existing.id !== userId) {
    return redirectWithError(res, 'This GitHub account is already linked to another user', '/settings?tab=connections');
  }

  await db.updateUserGithub(userId, {
    github_id: String(ghUser.id),
    github_username: ghUser.login,
    github_access_token: accessToken,
    github_avatar_url: ghUser.avatar_url,
  });

  // Redirect back to settings
  return res.redirect('/settings?tab=connections&github=connected');
}

// Disconnect GitHub from account (requires auth — mounted under verifyToken)
router.post('/disconnect', async (req, res) => {
  try {
    await db.clearUserGithub(req.user.userId);
    res.json({ ok: true });
  } catch (err) {
    log.error('GitHub disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect GitHub' });
  }
});

// GET /api/github/status — get GitHub connection status for current user
router.get('/status', async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      connected: !!user.github_id,
      username: user.github_username || null,
      avatar_url: user.github_avatar_url || null,
    });
  } catch (err) {
    log.error('GitHub status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/github/repos — list user's GitHub repos
router.get('/repos', async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user || !user.github_access_token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 30;

    const ghRes = await fetch(`https://api.github.com/user/repos?sort=updated&per_page=${perPage}&page=${page}&type=all`, {
      headers: {
        Authorization: `Bearer ${user.github_access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!ghRes.ok) {
      const err = await ghRes.json().catch(() => ({}));
      return res.status(ghRes.status).json({ error: err.message || 'GitHub API error' });
    }

    const repos = await ghRes.json();
    res.json(repos.map(r => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      html_url: r.html_url,
      description: r.description,
      private: r.private,
      default_branch: r.default_branch,
      updated_at: r.updated_at,
      language: r.language,
    })));
  } catch (err) {
    log.error('GitHub repos error:', err.message);
    res.status(500).json({ error: 'Failed to fetch repos' });
  }
});

// POST /api/github/deploy/:projectId — deploy project to a new GitHub repo
router.post('/deploy/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { repoName, isPrivate, description } = req.body;

    const user = await db.getUserById(req.user.userId);
    if (!user || !user.github_access_token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    const name = repoName || project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

    // Create repo on GitHub
    const createRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.github_access_token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description: description || `Project: ${project.name}`,
        private: isPrivate !== false,
        auto_init: true,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      return res.status(createRes.status).json({ error: err.message || 'Failed to create repo' });
    }

    const repo = await createRes.json();

    // Push workspace files to the repo
    const workspaceDir = path.join(DATA_DIR, 'workspaces', projectId);
    const fs = require('fs');

    if (fs.existsSync(workspaceDir)) {
      // Get the latest iteration HTML to push
      const iterations = await db.getIterationsByProject(projectId);
      const latest = iterations && iterations.length > 0 ? iterations[iterations.length - 1] : null;

      if (latest) {
        const iterDir = path.join(DATA_DIR, 'iterations', projectId, latest.id);
        const htmlPath = path.join(iterDir, 'index.html');

        if (fs.existsSync(htmlPath)) {
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          const base64Content = Buffer.from(htmlContent).toString('base64');

          // Push index.html to repo
          await fetch(`https://api.github.com/repos/${repo.full_name}/contents/index.html`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${user.github_access_token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: 'Initial deploy from GURU platform',
              content: base64Content,
            }),
          });
        }
      }

      // Also push any workspace files (excluding CLAUDE.md and hidden dirs)
      const workspaceFiles = fs.readdirSync(workspaceDir).filter(f =>
        !f.startsWith('.') && f !== 'CLAUDE.md' && f !== 'node_modules'
      );

      for (const file of workspaceFiles) {
        const filePath = path.join(workspaceDir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile() && stat.size < 1024 * 1024) { // Skip files > 1MB
          const content = fs.readFileSync(filePath);
          const base64 = content.toString('base64');

          await fetch(`https://api.github.com/repos/${repo.full_name}/contents/${file}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${user.github_access_token}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Add ${file}`,
              content: base64,
            }),
          });
        }
      }
    }

    // Save GitHub link on the project
    await db.updateProjectGithub(projectId, {
      github_repo_url: repo.html_url,
      github_repo_name: repo.full_name,
      github_last_sync: new Date().toISOString(),
    });

    res.json({
      ok: true,
      repo_url: repo.html_url,
      repo_name: repo.full_name,
    });
  } catch (err) {
    log.error('GitHub deploy error:', err.message);
    res.status(500).json({ error: 'Failed to deploy to GitHub' });
  }
});

// POST /api/github/import/:projectId — import from a GitHub repo into project workspace
router.post('/import/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { repoFullName } = req.body;

    const user = await db.getUserById(req.user.userId);
    if (!user || !user.github_access_token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    // Get repo contents (root level)
    const contentsRes = await fetch(`https://api.github.com/repos/${repoFullName}/contents/`, {
      headers: {
        Authorization: `Bearer ${user.github_access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    if (!contentsRes.ok) {
      const err = await contentsRes.json().catch(() => ({}));
      return res.status(contentsRes.status).json({ error: err.message || 'Failed to access repo' });
    }

    const contents = await contentsRes.json();
    const fs = require('fs');
    const workspaceDir = path.join(DATA_DIR, 'workspaces', projectId);
    if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });

    let importedFiles = 0;

    // Download files from repo root
    for (const item of contents) {
      if (item.type !== 'file') continue;
      if (item.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

      const fileRes = await fetch(item.download_url);
      if (!fileRes.ok) continue;

      const fileBuffer = Buffer.from(await fileRes.arrayBuffer());
      fs.writeFileSync(path.join(workspaceDir, item.name), fileBuffer);
      importedFiles++;
    }

    // Link project to this repo
    const repoRes = await fetch(`https://api.github.com/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${user.github_access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const repoData = await repoRes.json();

    await db.updateProjectGithub(projectId, {
      github_repo_url: repoData.html_url || `https://github.com/${repoFullName}`,
      github_repo_name: repoFullName,
      github_last_sync: new Date().toISOString(),
    });

    res.json({
      ok: true,
      imported_files: importedFiles,
      repo_name: repoFullName,
    });
  } catch (err) {
    log.error('GitHub import error:', err.message);
    res.status(500).json({ error: 'Failed to import from GitHub' });
  }
});

// POST /api/github/sync/:projectId — sync project with linked GitHub repo
router.post('/sync/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { direction } = req.body; // 'push' or 'pull'

    const user = await db.getUserById(req.user.userId);
    if (!user || !user.github_access_token) {
      return res.status(400).json({ error: 'GitHub not connected' });
    }

    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });
    if (!project.github_repo_name) return res.status(400).json({ error: 'Project not linked to a GitHub repo' });

    const fs = require('fs');

    if (direction === 'push') {
      // Push latest iteration to GitHub
      const iterations = await db.getIterationsByProject(projectId);
      const latest = iterations && iterations.length > 0 ? iterations[iterations.length - 1] : null;

      if (!latest) return res.status(400).json({ error: 'No iterations to push' });

      const iterDir = path.join(DATA_DIR, 'iterations', projectId, latest.id);
      const htmlPath = path.join(iterDir, 'index.html');

      if (!fs.existsSync(htmlPath)) return res.status(400).json({ error: 'Iteration file not found' });

      const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
      const base64Content = Buffer.from(htmlContent).toString('base64');

      // Get current file SHA (required for update)
      let sha = null;
      try {
        const existingRes = await fetch(`https://api.github.com/repos/${project.github_repo_name}/contents/index.html`, {
          headers: {
            Authorization: `Bearer ${user.github_access_token}`,
            Accept: 'application/vnd.github+json',
          },
        });
        if (existingRes.ok) {
          const existing = await existingRes.json();
          sha = existing.sha;
        }
      } catch (_) {}

      const pushBody = {
        message: `Update from GURU — iteration v${latest.version}`,
        content: base64Content,
      };
      if (sha) pushBody.sha = sha;

      const pushRes = await fetch(`https://api.github.com/repos/${project.github_repo_name}/contents/index.html`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${user.github_access_token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushBody),
      });

      if (!pushRes.ok) {
        const err = await pushRes.json().catch(() => ({}));
        return res.status(pushRes.status).json({ error: err.message || 'Failed to push' });
      }

      await db.updateProjectGithub(projectId, {
        github_last_sync: new Date().toISOString(),
      });

      return res.json({ ok: true, direction: 'push' });
    }

    if (direction === 'pull') {
      // Pull index.html from repo into workspace
      const fileRes = await fetch(`https://api.github.com/repos/${project.github_repo_name}/contents/index.html`, {
        headers: {
          Authorization: `Bearer ${user.github_access_token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!fileRes.ok) return res.status(400).json({ error: 'Could not find index.html in repo' });

      const fileData = await fileRes.json();
      const content = Buffer.from(fileData.content, 'base64').toString('utf-8');

      const workspaceDir = path.join(DATA_DIR, 'workspaces', projectId);
      if (!fs.existsSync(workspaceDir)) fs.mkdirSync(workspaceDir, { recursive: true });
      fs.writeFileSync(path.join(workspaceDir, 'index.html'), content);

      await db.updateProjectGithub(projectId, {
        github_last_sync: new Date().toISOString(),
      });

      return res.json({ ok: true, direction: 'pull' });
    }

    return res.status(400).json({ error: 'Invalid direction. Use "push" or "pull".' });
  } catch (err) {
    log.error('GitHub sync error:', err.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// POST /api/github/unlink/:projectId — unlink a project from its GitHub repo
router.post('/unlink/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    await db.updateProjectGithub(projectId, {
      github_repo_url: null,
      github_repo_name: null,
      github_last_sync: null,
    });

    res.json({ ok: true });
  } catch (err) {
    log.error('GitHub unlink error:', err.message);
    res.status(500).json({ error: 'Failed to unlink' });
  }
});

// --- Helpers ---

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

async function fetchGitHubUser(accessToken) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchGitHubEmail(accessToken) {
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) return null;
    const emails = await res.json();
    const primary = emails.find(e => e.primary && e.verified);
    return primary ? primary.email : (emails[0] ? emails[0].email : null);
  } catch (_) {
    return null;
  }
}

function redirectWithAuth(res, data) {
  // Redirect to frontend with auth data in URL hash (not query params for security)
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  return res.redirect(`/auth/github/success#${encoded}`);
}

function redirectWithError(res, message, redirectTo) {
  const target = redirectTo || '/login';
  return res.redirect(`${target}?error=${encodeURIComponent(message)}`);
}

module.exports = router;
