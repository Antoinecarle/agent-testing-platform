const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const SYSTEM_CLAUDE_DIR = path.resolve(process.env.HOME || '/root', '.claude');
const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', 'agents');
const AGENTS_SOURCE = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : path.join(SYSTEM_CLAUDE_DIR, 'agents');

function ensureUserHome(userId) {
  const userHome = path.join(USERS_DIR, userId);
  const userClaudeDir = path.join(userHome, '.claude');
  const userAgentsLink = path.join(userClaudeDir, 'agents');

  // Create user home + .claude directory
  if (!fs.existsSync(userClaudeDir)) {
    fs.mkdirSync(userClaudeDir, { recursive: true });
  }

  // Agents are NOT copied to user HOME anymore.
  // Each workspace gets only its project's assigned agent via workspace.js.
  // This prevents /agents from showing all 70+ agents when only 1 is needed.

  // Clean up old agents dir if it exists (from previous behavior)
  try {
    if (fs.existsSync(userAgentsLink) && fs.statSync(userAgentsLink).isDirectory()) {
      const oldFiles = fs.readdirSync(userAgentsLink);
      if (oldFiles.length > 5) {
        // Too many agents = old behavior, clean it up
        for (const f of oldFiles) {
          try { fs.unlinkSync(path.join(userAgentsLink, f)); } catch (_) {}
        }
        console.log(`[UserHome] Cleaned up ${oldFiles.length} old agent files from ${userId}`);
      }
    }
  } catch (_) {}
  // Remove stale symlink if present (from old code)
  try {
    if (fs.lstatSync(userAgentsLink).isSymbolicLink()) {
      fs.unlinkSync(userAgentsLink);
    }
  } catch (_) {}

  // Create permissive settings.json so agents can write files
  const userSettingsPath = path.join(userClaudeDir, 'settings.json');
  if (!fs.existsSync(userSettingsPath)) {
    const settings = {
      permissions: {
        allow: [
          "Read",
          "Write",
          "Edit",
          "Bash(*)",
          "Glob",
          "Grep",
          "WebFetch",
          "WebSearch",
          "Task"
        ]
      },
      maxTokens: 128000,
      contextWindow: 200000
    };
    try {
      fs.writeFileSync(userSettingsPath, JSON.stringify(settings, null, 2));
      console.log(`[UserHome] Created permissive settings.json for ${userId}`);
    } catch (err) {
      console.warn(`[UserHome] Failed to create settings.json for ${userId}:`, err.message);
    }
  }

  return userHome;
}

// Migrate existing system-level Claude credentials to a user's per-user home
function migrateSystemCredentials(userId) {
  const systemCredPath = path.join(SYSTEM_CLAUDE_DIR, '.credentials.json');
  const userCredPath = path.join(USERS_DIR, userId, '.claude', '.credentials.json');

  // Only migrate if system credentials exist and user doesn't have their own yet
  if (fs.existsSync(systemCredPath) && !fs.existsSync(userCredPath)) {
    try {
      ensureUserHome(userId);
      fs.copyFileSync(systemCredPath, userCredPath);
      console.log(`[UserHome] Migrated system Claude credentials to user ${userId}`);
      return true;
    } catch (err) {
      console.warn(`[UserHome] Failed to migrate credentials for ${userId}:`, err.message);
    }
  }
  return false;
}

function getUserHomePath(userId) {
  return path.join(USERS_DIR, userId);
}

function getUserClaudeCredentials(userId) {
  const credPath = path.join(USERS_DIR, userId, '.claude', '.credentials.json');
  if (!fs.existsSync(credPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(credPath, 'utf8'));
  } catch {
    return null;
  }
}

function isClaudeAuthenticated(userId) {
  const creds = getUserClaudeCredentials(userId);
  if (!creds) return false;

  // Check for OAuth token presence
  if (creds.oauthToken || creds.claudeAiOauth) {
    // Check expiry if available
    const token = creds.oauthToken || creds.claudeAiOauth;
    if (token.expiresAt) {
      return Date.now() < token.expiresAt;
    }
    return true;
  }

  // Also check for any token-like fields (Claude CLI stores credentials in various formats)
  if (creds.accessToken || creds.token) {
    return true;
  }

  return false;
}

module.exports = {
  ensureUserHome,
  getUserHomePath,
  getUserClaudeCredentials,
  isClaudeAuthenticated,
  migrateSystemCredentials,
  USERS_DIR,
};
