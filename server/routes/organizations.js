const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { resolveOrg, requireRole, requireOrgMember, PLAN_LIMITS } = require('../middleware/rbac');
const { z } = require('zod');
const { validate } = require('../middleware/validate');

const router = express.Router();

const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(50),
});

const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

const inviteMemberSchema = z.object({
  email: z.string().email().max(255),
  role: z.enum(['admin', 'member', 'viewer']).optional().default('member'),
});

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'member', 'viewer']),
});

// GET /api/organizations — list user's orgs
router.get('/', async (req, res) => {
  try {
    const orgs = await db.getUserOrganizations(req.user.userId);
    res.json(orgs);
  } catch (err) {
    console.error('[Orgs] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/organizations — create org
router.post('/', validate(createOrgSchema), async (req, res) => {
  try {
    const { name, slug } = req.body;

    // Check slug uniqueness
    const existing = await db.getOrganizationBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: 'Slug already taken' });
    }

    const org = await db.createOrganization(name, slug, 'free', req.user.userId);
    res.status(201).json(org);
  } catch (err) {
    console.error('[Orgs] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/organizations/:id — get org details
router.get('/:id', resolveOrg, requireOrgMember, async (req, res) => {
  try {
    const members = await db.getOrganizationMembers(req.organizationId);
    const counts = await db.getOrgResourceCounts(req.organizationId);
    res.json({ ...req.organization, user_role: req.orgRole, members, usage: counts });
  } catch (err) {
    console.error('[Orgs] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/organizations/:id — update org (admin+)
router.put('/:id', resolveOrg, requireRole('admin'), validate(updateOrgSchema), async (req, res) => {
  try {
    await db.updateOrganization(req.params.id, req.body);
    const org = await db.getOrganization(req.params.id);
    res.json(org);
  } catch (err) {
    console.error('[Orgs] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/organizations/:id — delete org (owner only)
router.delete('/:id', resolveOrg, requireRole('owner'), async (req, res) => {
  try {
    await db.deleteOrganization(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/organizations/:id/invite — invite member (admin+)
router.post('/:id/invite', resolveOrg, requireRole('admin'), validate(inviteMemberSchema), async (req, res) => {
  try {
    const { email, role } = req.body;

    // Check plan limit
    const counts = await db.getOrgResourceCounts(req.params.id);
    const plan = req.organization.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const maxMembers = req.organization.max_members || limits.max_members;
    if (maxMembers !== -1 && counts.members >= maxMembers) {
      return res.status(402).json({ error: `Member limit reached (${maxMembers}). Upgrade your plan.` });
    }

    // Check if user already exists
    const existingUser = await db.getUserByEmail(email);
    if (existingUser) {
      const existingRole = await db.getUserOrgRole(req.params.id, existingUser.id);
      if (existingRole) {
        return res.status(409).json({ error: 'User is already a member' });
      }
      // Direct add if user exists
      await db.addOrganizationMember(req.params.id, existingUser.id, role);
      return res.status(201).json({ added: true, email });
    }

    // Create invitation token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const invitation = await db.createInvitation(req.params.id, email, role, token, req.user.userId, expiresAt);
    res.status(201).json({ invited: true, email, token: invitation.token, expires_at: invitation.expires_at });
  } catch (err) {
    console.error('[Orgs] Invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/organizations/accept-invite — accept invitation
router.post('/accept-invite', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    const invitation = await db.getInvitationByToken(token);
    if (!invitation) return res.status(404).json({ error: 'Invalid or expired invitation' });

    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Invitation expired' });
    }

    // Verify the invitation email matches the authenticated user
    const user = await db.getUserById(req.user.userId);
    if (!user || user.email !== invitation.email) {
      return res.status(403).json({ error: 'This invitation was sent to a different email address' });
    }

    // Mark invitation accepted first (fail-safe: prevents reuse if crash after this)
    await db.acceptInvitation(invitation.id);
    // Add user to org
    await db.addOrganizationMember(invitation.organization_id, req.user.userId, invitation.role);

    const org = await db.getOrganization(invitation.organization_id);
    res.json({ joined: true, organization: org });
  } catch (err) {
    console.error('[Orgs] Accept invite error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/organizations/:id/members/:userId/role — update member role (owner only)
router.put('/:id/members/:userId/role', resolveOrg, requireRole('owner'), validate(updateMemberRoleSchema), async (req, res) => {
  try {
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    await db.updateOrganizationMemberRole(req.params.id, req.params.userId, req.body.role);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Update role error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/organizations/:id/members/:userId — remove member (admin+)
router.delete('/:id/members/:userId', resolveOrg, requireRole('admin'), async (req, res) => {
  try {
    if (req.params.userId === req.user.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }
    // Can't remove the owner
    const targetRole = await db.getUserOrgRole(req.params.id, req.params.userId);
    if (targetRole === 'owner') {
      return res.status(403).json({ error: 'Cannot remove the owner' });
    }
    await db.removeOrganizationMember(req.params.id, req.params.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Orgs] Remove member error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/organizations/:id/usage — get usage for current period (any member)
router.get('/:id/usage', resolveOrg, requireOrgMember, async (req, res) => {
  try {
    const usage = await db.getUsage(req.params.id);
    const counts = await db.getOrgResourceCounts(req.params.id);
    const plan = req.organization.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    res.json({ usage, counts, limits, plan });
  } catch (err) {
    console.error('[Orgs] Usage error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
