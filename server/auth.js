const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { ensureUserHome, isClaudeAuthenticated } = require('./user-home');
const { seedWelcomeProject } = require('./lib/welcome-seed');
const { validate, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema } = require('./middleware/validate');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

const router = express.Router();

// Token configuration
const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '7d'; // Industry standard — was 30d, reduced for security

function generateTokens(payload) {
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, process.env.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
  return { accessToken, refreshToken };
}

// POST /api/auth/login
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.getUserByEmail(email);
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken } = generateTokens(payload);

    // Check Claude connection status
    const claudeConnected = isClaudeAuthenticated(user.id);

    res.json({
      token: accessToken,
      refreshToken,
      email: user.email,
      role: user.role,
      userId: user.id,
      displayName: user.display_name || '',
      claudeConnected,
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/register
router.post('/register', validate(registerSchema), async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    const homeDir = path.join(DATA_DIR, 'users', id);

    // Create user in DB
    await db.createUser(id, email, passwordHash, 'user', displayName || '', homeDir);

    // Create user home directory with symlinked agents
    ensureUserHome(id);

    // Fire-and-forget: seed welcome demo project for new user
    seedWelcomeProject(id).catch(err => console.error('[Auth] Welcome seed failed:', err.message));

    const payload = { userId: id, email, role: 'user' };
    const { accessToken, refreshToken } = generateTokens(payload);

    res.status(201).json({
      token: accessToken,
      refreshToken,
      email,
      role: 'user',
      userId: id,
      displayName: displayName || '',
      claudeConnected: false,
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/refresh — exchange refresh token for new access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Verify user still exists and is active
    const user = await db.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error('[Auth] Refresh error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password — request password reset
router.post('/forgot-password', validate(forgotPasswordSchema), async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account exists with that email, a reset link has been generated.' });
    }

    // Generate a time-limited reset token (15 min)
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Store the reset token hash in the user record
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await db.supabase.from('users').update({
      reset_token_hash: tokenHash,
      reset_token_expires: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }).eq('id', user.id);

    // In production, send email with reset link. For now, return the token directly.
    // TODO: Integrate email service (SendGrid, Resend, etc.)
    const resetUrl = `${req.headers.origin || 'http://localhost:4000'}/reset-password?token=${resetToken}`;

    console.log(`[Auth] Password reset requested for ${email}. Reset URL: ${resetUrl}`);

    res.json({
      message: 'If an account exists with that email, a reset link has been generated.',
      // Include resetUrl in dev mode only — remove in production with real email
      ...(process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT ? { resetUrl } : {}),
    });
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password — reset password with token
router.post('/reset-password', validate(resetPasswordSchema), async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (decoded.type !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid token type' });
    }

    // Verify token hash matches what's stored in DB
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await db.getUserById(decoded.userId);
    if (!user || user.reset_token_hash !== tokenHash) {
      return res.status(400).json({ error: 'Invalid or already used reset token' });
    }

    // Check expiry
    if (user.reset_token_expires && new Date(user.reset_token_expires) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password and update
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.supabase.from('users').update({
      password_hash: passwordHash,
      reset_token_hash: null,
      reset_token_expires: null,
    }).eq('id', user.id);

    res.json({ message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

function verifyToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Don't allow refresh tokens as access tokens
    if (decoded.type === 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { router, verifyToken };
