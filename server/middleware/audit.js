const db = require('../db');

// Lightweight audit logger — logs user actions to Supabase via db.js
async function logAudit(userId, action, resource, resourceId, details, ip) {
  try {
    await db.insertAuditLog(userId, action, resource, resourceId, details, ip);
  } catch (err) {
    // Don't let audit failures break the request
    console.error('[Audit] Log error:', err.message);
  }
}

// Express middleware that auto-logs write operations
function auditMiddleware(req, res, next) {
  // Only audit state-changing methods
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  // Store original json/send to capture response
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    // Log after successful response
    if (res.statusCode < 400) {
      const userId = req.user?.userId || null;
      const action = req.method;
      const resource = req.baseUrl + req.path;
      const ip = req.ip || req.headers['x-forwarded-for'] || '';

      logAudit(userId, action, resource, req.params.id || req.params.name || req.params.projectId || null, {
        statusCode: res.statusCode,
      }, ip);
    }
    return originalJson(body);
  };

  next();
}

// Ensure audit_logs table exists
async function ensureAuditTable() {
  try {
    // Try a simple query — if it fails, table doesn't exist
    await db.supabase.from('audit_logs').select('id').limit(1);
  } catch (err) {
    console.warn('[Audit] audit_logs table may not exist yet. Create it in Supabase:');
    console.warn(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        details JSONB DEFAULT '{}',
        ip_address TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT now()
      );
      CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);
    `);
  }
}

module.exports = {
  logAudit,
  auditMiddleware,
  ensureAuditTable,
};
