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
router.get('/auth', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth not configured' });
  }

  const platform = req.query.platform || 'google-drive'; // 'google-drive' | 'gmail' | 'both'
  const userId = req.user.userId; // From verified JWT — trusted

  // Build scopes based on requested platform
  let scope;
  if (platform === 'both') {
    scope = `${SCOPES['google-drive']} ${SCOPES.gmail}`;
  } else {
    scope = SCOPES[platform] || SCOPES['google-drive'];
  }

  const state = signState({ userId, platform });

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

    if (oauthError) {
      log.error('Google OAuth error:', oauthError);
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, oauthError);
      }
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, 'No authorization code received');
      }
      return res.redirect('/settings?tab=platforms&google=error&message=No+authorization+code+received');
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
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent('Token exchange failed')}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      log.error('Google token exchange failed:', tokenData.error_description || tokenData.error);
      const msg = tokenData.error_description || tokenData.error;
      if (stateData.action === 'login') {
        return redirectWithLoginError(res, msg);
      }
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent(msg)}`);
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
      return res.redirect('/settings?tab=platforms&google=error&message=Invalid+state+parameter');
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

    const platformsToSave = stateData.platform === 'both'
      ? ['google-drive', 'gmail']
      : [stateData.platform];

    for (const slug of platformsToSave) {
      const platform = await db.getPlatformBySlug(slug);
      if (platform) {
        await db.savePlatformCredential(stateData.userId, platform.id, encrypted, metadata);
        log.info(`Google OAuth: saved credentials for ${slug} (user ${stateData.userId})`);
      }
    }

    res.redirect('/settings?tab=platforms&google=connected');
  } catch (err) {
    log.error('Google OAuth callback error:', err.message);
    res.redirect(`/login?error=${encodeURIComponent('Authentication failed')}`);
  }
});

module.exports = router;
