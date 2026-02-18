const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { encryptCredentials } = require('../lib/platform-integrations');
const { createLogger } = require('../lib/logger');
const log = createLogger('google-oauth');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

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

// GET /api/google-oauth/auth — Initiate Google OAuth flow
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

// GET /api/google-oauth/callback — Handle Google redirect
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      log.error('Google OAuth error:', oauthError);
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent(oauthError)}`);
    }

    if (!code) {
      return res.redirect('/settings?tab=platforms&google=error&message=No+authorization+code+received');
    }

    // Verify HMAC-signed state
    const stateData = verifyState(state);
    if (!stateData || !stateData.userId) {
      log.error('Google OAuth: invalid or tampered state parameter');
      return res.redirect('/settings?tab=platforms&google=error&message=Invalid+state+parameter');
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
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent('Token exchange failed')}`);
    }

    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      log.error('Google token exchange failed:', tokenData.error_description || tokenData.error);
      return res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent(tokenData.error_description || tokenData.error)}`);
    }

    const { access_token, refresh_token, expires_in, scope: grantedScope } = tokenData;
    const expiresAt = Date.now() + (expires_in || 3600) * 1000;

    if (!refresh_token) {
      log.warn(`Google OAuth: No refresh_token returned for user ${stateData.userId}. Token refresh will not work.`);
    }

    // Build credential JSON
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

    // Determine which platforms to save credentials for
    const platformsToSave = [];
    if (stateData.platform === 'both') {
      platformsToSave.push('google-drive', 'gmail');
    } else {
      platformsToSave.push(stateData.platform);
    }

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
    res.redirect(`/settings?tab=platforms&google=error&message=${encodeURIComponent('Authentication failed')}`);
  }
});

module.exports = router;
