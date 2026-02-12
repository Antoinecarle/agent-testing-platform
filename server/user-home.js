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

  // Copy agents from bundled/system dir + custom-agents to user's .claude/agents/
  // Use direct copy instead of symlinks (more reliable across volume mounts)

  // Remove stale symlink if present (from old code)
  try {
    if (fs.lstatSync(userAgentsLink).isSymbolicLink()) {
      fs.unlinkSync(userAgentsLink);
    }
  } catch (_) {}

  // Create agents directory
  if (!fs.existsSync(userAgentsLink)) {
    fs.mkdirSync(userAgentsLink, { recursive: true });
  }

  // Collect agent files from multiple sources
  const agentSources = [];
  if (fs.existsSync(AGENTS_SOURCE)) agentSources.push(AGENTS_SOURCE);
  // Also load custom agents from persistent volume (created via Agent Creator)
  const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');
  if (fs.existsSync(CUSTOM_AGENTS_DIR)) agentSources.push(CUSTOM_AGENTS_DIR);

  try {
    let copied = 0;
    for (const sourceDir of agentSources) {
      const agentFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.md'));
      for (const file of agentFiles) {
        const src = path.join(sourceDir, file);
        const dest = path.join(userAgentsLink, file);
        // Always copy if source is newer or dest doesn't exist
        let shouldCopy = !fs.existsSync(dest);
        if (!shouldCopy) {
          try {
            const srcMtime = fs.statSync(src).mtimeMs;
            const destMtime = fs.statSync(dest).mtimeMs;
            shouldCopy = srcMtime > destMtime;
          } catch (_) { shouldCopy = true; }
        }
        if (shouldCopy) {
          fs.copyFileSync(src, dest);
          copied++;
        }
      }
    }
    if (copied > 0) console.log(`[UserHome] Copied ${copied} agents to ${userId}`);
  } catch (err) {
    console.warn(`[UserHome] Failed to copy agents for ${userId}:`, err.message);
  }

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
      }
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
