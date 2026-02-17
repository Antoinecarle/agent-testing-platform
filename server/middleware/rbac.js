const db = require('../db');

// Role hierarchy: owner > admin > member > viewer
const ROLE_HIERARCHY = { owner: 4, admin: 3, member: 2, viewer: 1 };

// Check if user has at least the required role in the org
function hasRole(userRole, requiredRole) {
  return (ROLE_HIERARCHY[userRole] || 0) >= (ROLE_HIERARCHY[requiredRole] || 0);
}

// Middleware: require user to be member of the org (any role)
function requireOrgMember(req, res, next) {
  if (!req.orgRole) {
    return res.status(403).json({ error: 'Organization membership required' });
  }
  next();
}

// Middleware factory: require minimum role
function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.orgRole || !hasRole(req.orgRole, minRole)) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` });
    }
    next();
  };
}

// Middleware: resolve org from header, query, or route param and attach role
async function resolveOrg(req, res, next) {
  const orgId = req.headers['x-organization-id'] || req.query.org_id || req.params.id;
  if (!orgId) {
    // No org context — continue without org (backward-compatible)
    req.organizationId = null;
    req.orgRole = null;
    return next();
  }

  try {
    const org = await db.getOrganization(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const role = await db.getUserOrgRole(orgId, req.user.userId);
    if (!role) {
      return res.status(403).json({ error: 'Not a member of this organization' });
    }

    req.organizationId = orgId;
    req.organization = org;
    req.orgRole = role;
    next();
  } catch (err) {
    console.error('[RBAC] resolveOrg error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

// Plan limits by tier
const PLAN_LIMITS = {
  free: { max_projects: 3, max_agents: 5, max_members: 1, max_storage_mb: 500 },
  pro: { max_projects: 25, max_agents: 50, max_members: 10, max_storage_mb: 5000 },
  enterprise: { max_projects: -1, max_agents: -1, max_members: -1, max_storage_mb: 50000 },
};

// Middleware: check plan limit before resource creation
function checkPlanLimit(resourceType) {
  return async (req, res, next) => {
    if (!req.organizationId || !req.organization) {
      return next(); // No org context, skip check
    }

    const plan = req.organization.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
    const limitKey = `max_${resourceType}`;
    const limit = req.organization[limitKey] || limits[limitKey];

    if (limit === -1) return next(); // Unlimited

    try {
      const counts = await db.getOrgResourceCounts(req.organizationId);
      const current = counts[resourceType] || 0;

      if (current >= limit) {
        return res.status(402).json({
          error: `Plan limit reached: ${current}/${limit} ${resourceType}. Upgrade to create more.`,
          limit,
          current,
          plan,
        });
      }
      next();
    } catch (err) {
      console.error('[RBAC] checkPlanLimit error:', err.message);
      // Fail closed: deny resource creation if we can't verify limits
      res.status(503).json({ error: 'Unable to verify plan limits. Please try again.' });
    }
  };
}

module.exports = {
  hasRole,
  requireOrgMember,
  requireRole,
  resolveOrg,
  checkPlanLimit,
  PLAN_LIMITS,
  ROLE_HIERARCHY,
};
