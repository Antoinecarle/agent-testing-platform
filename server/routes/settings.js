const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

// Schemas
const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(100).optional(),
  company: z.string().max(200).optional(),
  job_title: z.string().max(200).optional(),
  avatar_url: z.string().max(2000).optional(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(6).max(128),
});

const requestVerificationSchema = z.object({
  email: z.string().email().optional(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(32).max(128),
});

// GET /api/settings/profile — get current user profile
router.get('/profile', async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name || '',
      company: user.company || '',
      job_title: user.job_title || '',
      avatar_url: user.avatar_url || '',
      role: user.role,
      email_verified: user.email_verified || false,
      onboarding_completed: user.onboarding_completed || false,
      created_at: user.created_at,
    });
  } catch (err) {
    console.error('[Settings] Profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/profile — update user profile
router.put('/profile', validate(updateProfileSchema), async (req, res) => {
  try {
    const { display_name, company, job_title, avatar_url } = req.body;
    await db.updateUserProfile(req.user.userId, {
      display_name, company, job_title, avatar_url,
    });

    const user = await db.getUserById(req.user.userId);
    res.json({
      id: user.id,
      email: user.email,
      display_name: user.display_name || '',
      company: user.company || '',
      job_title: user.job_title || '',
      avatar_url: user.avatar_url || '',
      role: user.role,
      email_verified: user.email_verified || false,
    });
  } catch (err) {
    console.error('[Settings] Update profile error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/change-password — change password
router.post('/change-password', validate(changePasswordSchema), async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const user = await db.getUserById(req.user.userId);
    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Cannot change password for this account' });
    }

    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 10);
    await db.updateUserPassword(req.user.userId, newHash);

    res.json({ ok: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('[Settings] Change password error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/request-verification — send email verification
router.post('/request-verification', async (req, res) => {
  try {
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.email_verified) {
      return res.json({ ok: true, message: 'Email already verified' });
    }

    // Generate verification token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h

    await db.setEmailVerificationToken(req.user.userId, token, expiresAt);

    // In production, send email via nodemailer/SendGrid
    // For now, return the token for testing (remove in production)
    const appUrl = process.env.APP_URL || 'https://guru-api-production.up.railway.app';
    const verifyUrl = `${appUrl}/verify-email?token=${token}`;

    // TODO: Send actual email via SMTP
    // For now, log and return URL (testing only)
    console.log(`[Settings] Verification URL for ${user.email}: ${verifyUrl}`);

    res.json({
      ok: true,
      message: 'Verification email sent',
      // Remove verify_url in production — only for testing
      ...(process.env.NODE_ENV !== 'production' && !process.env.RAILWAY_ENVIRONMENT ? { verify_url: verifyUrl } : {}),
    });
  } catch (err) {
    console.error('[Settings] Verification request error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/verify-email — verify email with token
router.post('/verify-email', validate(verifyEmailSchema), async (req, res) => {
  try {
    const { token } = req.body;

    const user = await db.getUserByVerificationToken(token);
    if (!user) {
      return res.status(404).json({ error: 'Invalid or expired verification token' });
    }

    if (new Date(user.email_verification_expires_at) < new Date()) {
      return res.status(410).json({ error: 'Verification token expired' });
    }

    await db.verifyUserEmail(user.id);
    res.json({ ok: true, message: 'Email verified successfully' });
  } catch (err) {
    console.error('[Settings] Verify email error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/settings/billing — get billing summary for user's orgs
router.get('/billing', async (req, res) => {
  try {
    const orgs = await db.getUserOrganizations(req.user.userId);
    const billingInfo = orgs.map(org => ({
      organization_id: org.id,
      organization_name: org.name,
      plan: org.plan || 'free',
      user_role: org.user_role,
      max_projects: org.max_projects,
      max_agents: org.max_agents,
      max_members: org.max_members,
    }));

    res.json({ organizations: billingInfo });
  } catch (err) {
    console.error('[Settings] Billing error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/settings/account — delete user account
router.delete('/account', async (req, res) => {
  try {
    const { password } = req.body;
    const user = await db.getUserById(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Verify password before deletion
    if (user.password_hash) {
      if (!password) return res.status(400).json({ error: 'Password required for account deletion' });
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Incorrect password' });
    }

    // Check if user is org owner - can't delete without transferring
    const orgs = await db.getUserOrganizations(req.user.userId);
    const ownedOrgs = orgs.filter(o => o.user_role === 'owner');
    if (ownedOrgs.length > 0) {
      return res.status(400).json({
        error: 'You must transfer ownership of your organizations before deleting your account',
        organizations: ownedOrgs.map(o => ({ id: o.id, name: o.name })),
      });
    }

    // Delete user (cascades should handle related data)
    await db.deleteUser(req.user.userId);
    res.json({ ok: true, message: 'Account deleted' });
  } catch (err) {
    console.error('[Settings] Delete account error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
