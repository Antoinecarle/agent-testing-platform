const express = require('express');
const crypto = require('crypto');
const path = require('path');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { encryptCredentials } = require('../lib/platform-integrations');
const { ensureUserHome, isClaudeAuthenticated } = require('../user-home');
const { seedWelcomeProject } = require('../lib/welcome-seed');
const { createLogger } = require('../lib/logger');
const log = createLogger('google-oauth');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

function redirectWithAuth(res, data) {
  const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
  return res.redirect(`/auth/google/success#${encoded}`);
}

function redirectWithLoginError(res, message) {
  return res.redirect(`/login?error=${encodeURIComponent(message)}`);
}

const SCOPES = {
  'google-drive': 'https://www.googleapis.com/auth/drive',
  gmail: 'https://www.googleapis.com/auth/gmail.modify',
  'google-calendar': 'https://www.googleapis.com/auth/calendar',
  'google-sheets': 'https://www.googleapis.com/auth/spreadsheets',
};

const SCOPE_LABELS = {
  'https://www.googleapis.com/auth/drive': 'Google Drive',
  'https://www.googleapis.com/auth/gmail.modify': 'Gmail',
  'https://www.googleapis.com/auth/calendar': 'Google Calendar',
  'https://www.googleapis.com/auth/spreadsheets': 'Google Sheets',
};

function getRedirectUri(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}/api/google-oauth/callback`;
}

/**
 * Sign the OAuth state with HMAC-SHA256 to prevent tampering.
 * Format: base64url(json).signature
 */
function signState(payload) {
  const raw = JSON.stringify(payload);
  const encoded = Buffer.from(raw).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(raw).digest('hex');
  return `${encoded}.${sig}`;
}

/**
 * Verify and decode a signed state parameter.
 * Returns the parsed payload or null if invalid.
 */
function verifyState(state) {
  if (!state || !state.includes('.')) return null;
  const [encoded, receivedSig] = state.split('.');
  if (!encoded || !receivedSig) return null;

  let raw;
  try {
    raw = Buffer.from(encoded, 'base64url').toString();
  } catch {
    return null;
  }

  const expectedSig = crypto.createHmac('sha256', process.env.JWT_SECRET).update(raw).digest('hex');

  // Timing-safe comparison
  if (receivedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(receivedSig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// GET /api/google-oauth/status — Check Google connection status per service
router.get('/status', async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.userId;
    const services = {};

    // Check each Google platform
    for (const slug of ['google-drive', 'gmail']) {
      const platform = await db.getPlatformBySlug(slug);
      if (!platform) continue;

      const cred = await db.getPlatformCredential(userId, platform.id);
      if (!cred) {
        services[slug] = { connected: false };
        continue;
      }

      // Decrypt to check scope and expiry
      let scopeStr = '';
      let expiresAt = null;
      let hasRefreshToken = false;
      try {
        const decrypted = require('../lib/platform-integrations').decryptCredentials(cred.encrypted_credentials);
        const parsed = JSON.parse(decrypted);
        scopeStr = parsed.scope || '';
        expiresAt = parsed.expires_at || null;
        hasRefreshToken = !!parsed.refresh_token;
      } catch {}

      const grantedScopes = scopeStr.split(' ').filter(Boolean);
      const scopeLabels = grantedScopes
        .map(s => SCOPE_LABELS[s])
        .filter(Boolean);

      services[slug] = {
        connected: true,
        connected_at: cred.credential_metadata?.connected_at || cred.created_at,
        scopes: grantedScopes,
        scope_labels: scopeLabels,
        has_refresh_token: hasRefreshToken,
        token_expires_at: expiresAt,
        token_valid: expiresAt ? expiresAt > Date.now() : null,
      };
    }

    // Detect Google account email from Drive test (light)
    let googleEmail = null;
    const driveService = services['google-drive'];
    if (driveService?.connected) {
      try {
        const drivePlatform = await db.getPlatformBySlug('google-drive');
        const driveCred = await db.getPlatformCredential(userId, drivePlatform.id);
        if (driveCred) {
          const { refreshGoogleTokenIfNeeded } = require('../lib/platform-integrations');
          const { token } = await refreshGoogleTokenIfNeeded(driveCred.encrypted_credentials);
          const aboutRes = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress,displayName,photoLink)', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (aboutRes.ok) {
            const about = await aboutRes.json();
            googleEmail = about.user?.emailAddress;
            services._account = {
              email: about.user?.emailAddress,
              name: about.user?.displayName,
              photo: about.user?.photoLink,
            };
          }
        }
      } catch {}
    }
    // Fallback: try Gmail profile
    if (!googleEmail && services.gmail?.connected) {
      try {
        const gmailPlatform = await db.getPlatformBySlug('gmail');
        const gmailCred = await db.getPlatformCredential(userId, gmailPlatform.id);
        if (gmailCred) {
          const { refreshGoogleTokenIfNeeded } = require('../lib/platform-integrations');
          const { token } = await refreshGoogleTokenIfNeeded(gmailCred.encrypted_credentials);
          const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (profileRes.ok) {
            const profile = await profileRes.json();
            services._account = {
              email: profile.emailAddress,
            };
          }
        }
      } catch {}
    }

    res.json({
      configured: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
      services,
    });
  } catch (err) {
    log.error('Google OAuth status error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google-oauth/login — Initiate Google OAuth login (no auth required)
router.get('/login', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.redirect('/login?error=Google+OAuth+not+configured');
  }

  const state = signState({ action: 'login' });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// GET /api/google-oauth/auth — Initiate Google OAuth flow for platform connection
// NOTE: This route requires JWT auth (verifyToken middleware applied in index.js)
// so req.user.userId is available and trusted.
// Supports: ?platform=google-drive|gmail|both  OR  ?services=google-drive,gmail (comma-separated)
router.get('/auth', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }

  const userId = req.user.userId; // From verified JWT — trusted

  // Support both ?platform= (legacy) and ?services= (new comma-separated list)
  let requestedServices = [];
  if (req.query.services) {
    requestedServices = req.query.services.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    const platform = req.query.platform || 'google-drive';
    if (platform === 'both') {
      requestedServices = ['google-drive', 'gmail'];
    } else {
      requestedServices = [platform];
    }
  }

  // Build combined scope from all requested services
  const scopeParts = requestedServices.map(s => SCOPES[s]).filter(Boolean);
  if (scopeParts.length === 0) scopeParts.push(SCOPES['google-drive']);
  const scope = scopeParts.join(' ');

  // Save all requested services in state so callback knows which platforms to store credentials for
  // Also save returnTo so we redirect back to the right page
  const returnTo = req.query.returnTo || '/settings?tab=platforms';
  const state = signState({ userId, platform: requestedServices.length === 1 ? requestedServices[0] : 'multi', services: requestedServices, returnTo });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: getRedirectUri(req),
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent', // Always get refresh_token
    state,
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// GET /api/google-oauth/callback — Handle Google redirect (login OR platform connection)
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Verify HMAC-signed state first to determine which flow we're in
    const stateData = verifyState(state);
    if (!stateData) {
      log.error('Google OAuth: invalid or tampered state parameter');
      // Could be login or platform flow — redirect to login as safe default
      return redirectWithLoginError(res, 'Invalid state parameter. Please try again.');
    }

    // Build error redirect URL using returnTo from state (or fallback)
    const errorRedirectBase = stateData.returnTo || '/settings?tab=platforms';
    const errSep = errorRedirectBase.includes('?') ? '&' : '?';

    if (oauthError) {
      log.error('Google OAuth error:', oauthError);
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, oauthError);
      }
      return res.redirect(`${errorRedirectBase}${errSep}google=error&message=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, 'No authorization code received');
      }
      return res.redirect(`${errorRedirectBase}${errSep}google=error&message=No+authorization+code+received`);
    }

    // Exchange code for tokens
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: getRedirectUri(req),
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      log.error('Google token exchange HTTP error:', tokenRes.status, body.slice(0, 200));
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, 'Token exchange failed');
      }
      return res.redirect(`${errorRedirectBase}${errSep}google=error&message=${encodeURIComponent('Token exchange failed')}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      log.error('Google token exchange failed:', tokenData.error_description || tokenData.error);
      const msg = tokenData.error_description || tokenData.error;
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, msg);
      }
      return res.redirect(`${errorRedirectBase}${errSep}google=error&message=${encodeURIComponent(msg)}`);
    }

    const { access_token, refresh_token, expires_in, scope: grantedScope } = tokenData;
    const expiresAt = Date.now() + (expires_in || 3600) * 1000;

    // ── LOGIN FLOW ──────────────────────────────────────────────────────────
    if (stateData.action === 'login') {
      // Get user info from Google
      const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      if (!userInfoRes.ok) {
        return redirectWithLoginError(res, 'Could not fetch Google user info');
      }
      const googleUser = await userInfoRes.json();
      const email = googleUser.email;
      const displayName = googleUser.name || googleUser.given_name || email.split('@')[0];

      if (!email) {
        return redirectWithLoginError(res, 'No email returned from Google');
      }

      // Find or create platform user
      let user = await db.getUserByEmail(email);

      if (user) {
        // Existing user — log in
        log.info(`Google login: existing user ${user.id} (${email})`);
        const payload = { userId: user.id, email: user.email, role: user.role };
        const { accessToken: jwtToken, refreshToken: jwtRefresh } = generateTokens(payload);
        return redirectWithAuth(res, {
          token: jwtToken,
          refreshToken: jwtRefresh,
          userId: user.id,
          email: user.email,
          displayName: user.display_name || displayName,
          role: user.role,
          claudeConnected: isClaudeAuthenticated(user.id),
        });
      }

      // New user — register
      const id = crypto.randomUUID();
      const homeDir = path.join(DATA_DIR, 'users', id);
      await db.createUser(id, email, null, 'user', displayName, homeDir);
      ensureUserHome(id);
      seedWelcomeProject(id).catch(err => log.error('Welcome seed failed:', err.message));

      log.info(`Google login: new user created ${id} (${email})`);
      const payload = { userId: id, email, role: 'user' };
      const { accessToken: jwtToken, refreshToken: jwtRefresh } = generateTokens(payload);
      return redirectWithAuth(res, {
        token: jwtToken,
        refreshToken: jwtRefresh,
        userId: id,
        email,
        displayName,
        role: 'user',
        claudeConnected: false,
        isNewUser: true,
      });
    }

    // ── PLATFORM CONNECTION FLOW ────────────────────────────────────────────
    if (!stateData.userId) {
      log.error('Google OAuth: no userId in state for platform connection');
      return res.redirect(`${errorRedirectBase}${errSep}google=error&message=Invalid+state+parameter`);
    }

    if (!refresh_token) {
      log.warn(`Google OAuth: No refresh_token returned for user ${stateData.userId}. Token refresh will not work.`);
    }

    const credentialJson = JSON.stringify({
      access_token,
      refresh_token: refresh_token || null,
      expires_at: expiresAt,
      scope: grantedScope || '',
    });

    const encrypted = encryptCredentials(credentialJson);
    const metadata = {
      connected_at: new Date().toISOString(),
      auth_type: 'oauth2',
    };

    // Use services array (new) or fall back to platform field (legacy)
    let platformsToSave;
    if (stateData.services && Array.isArray(stateData.services)) {
      platformsToSave = stateData.services;
    } else if (stateData.platform === 'both') {
      platformsToSave = ['google-drive', 'gmail'];
    } else {
      platformsToSave = [stateData.platform];
    }

    for (const slug of platformsToSave) {
      const platform = await db.getPlatformBySlug(slug);
      if (platform) {
        await db.savePlatformCredential(stateData.userId, platform.id, encrypted, metadata);
        log.info(`Google OAuth: saved credentials for ${slug} (user ${stateData.userId})`);
      }
    }

    // Redirect back to where the user came from (with google=connected flag)
    const returnTo = stateData.returnTo || '/settings?tab=platforms';
    const separator = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${returnTo}${separator}google=connected`);
  } catch (err) {
    log.error('Google OAuth callback error:', err.message);
    res.redirect(`/login?error=${encodeURIComponent('Authentication failed')}`);
  }
});

module.exports = router;
