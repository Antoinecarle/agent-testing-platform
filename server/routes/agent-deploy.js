const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// Generate a secure API key
function generateApiKey() {
  const prefix = 'gru';
  const key = crypto.randomBytes(32).toString('hex');
  return `${prefix}_${key}`;
}

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// POST /api/agents/:name/deploy — Deploy an agent as MCP
router.post('/:name/deploy', async (req, res) => {
  try {
    const { name } = req.params;
    const { tier, description, tagline, primaryColor } = req.body;
    const userId = req.user.userId;

    // Check agent exists
    const agent = await db.getAgent(name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Check if already deployed
    const existing = await db.getDeploymentByAgent(name);
    if (existing) return res.status(409).json({ error: 'Agent already deployed', deployment: existing });

    // Generate slug from agent name
    const slug = name;

    // Generate API key
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    // Create deployment
    const deployment = await db.createDeployment(
      name, slug, keyHash,
      tier || 'starter',
      description || agent.description,
      tagline || `${agent.name} — AI Agent MCP Server`,
      primaryColor || '#8B5CF6',
      userId
    );

    // Create the default API key entry
    await db.createDeploymentApiKey(deployment.id, keyHash, apiKey.substring(0, 8), 'Default');

    res.status(201).json({
      deployment,
      apiKey, // Return the raw key only on creation
      landingPageUrl: `/mcp/${slug}`,
      mcpEndpoint: `/mcp/${slug}/api`,
    });
  } catch (err) {
    console.error('[Deploy] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/:name/deployment — Get deployment info
router.get('/:name/deployment', async (req, res) => {
  try {
    const deployment = await db.getDeploymentByAgent(req.params.name);
    if (!deployment) return res.status(404).json({ error: 'Not deployed' });

    const agent = await db.getAgent(req.params.name);
    const apiKeys = await db.getDeploymentApiKeys(deployment.id);
    const monthlyUsage = await db.getMonthlyTokenUsage(deployment.id);

    res.json({
      ...deployment,
      agent,
      apiKeys: apiKeys.map(k => ({ id: k.id, prefix: k.key_prefix, name: k.name, isActive: k.is_active, lastUsed: k.last_used_at, createdAt: k.created_at })),
      monthlyUsage,
      landingPageUrl: `/mcp/${deployment.slug}`,
      mcpEndpoint: `/mcp/${deployment.slug}/api`,
    });
  } catch (err) {
    console.error('[Deploy] Get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agents/:name/deployment — Update deployment
router.put('/:name/deployment', async (req, res) => {
  try {
    const deployment = await db.getDeploymentByAgent(req.params.name);
    if (!deployment) return res.status(404).json({ error: 'Not deployed' });

    await db.updateDeployment(deployment.id, req.body);
    const updated = await db.getDeployment(deployment.id);
    res.json(updated);
  } catch (err) {
    console.error('[Deploy] Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agents/:name/deployment — Undeploy
router.delete('/:name/deployment', async (req, res) => {
  try {
    const deployment = await db.getDeploymentByAgent(req.params.name);
    if (!deployment) return res.status(404).json({ error: 'Not deployed' });

    await db.deleteDeployment(deployment.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Deploy] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agents/:name/deployment/api-key — Generate new API key
router.post('/:name/deployment/api-key', async (req, res) => {
  try {
    const deployment = await db.getDeploymentByAgent(req.params.name);
    if (!deployment) return res.status(404).json({ error: 'Not deployed' });

    const { name: keyName } = req.body;
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    await db.createDeploymentApiKey(deployment.id, keyHash, apiKey.substring(0, 8), keyName || 'API Key');

    res.status(201).json({ apiKey, prefix: apiKey.substring(0, 8) });
  } catch (err) {
    console.error('[Deploy] API key error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agents/:name/deployment/api-key/:keyId — Revoke API key
router.delete('/:name/deployment/api-key/:keyId', async (req, res) => {
  try {
    await db.deactivateApiKey(req.params.keyId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Deploy] Revoke key error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agents/:name/deployment/usage — Get token usage stats
router.get('/:name/deployment/usage', async (req, res) => {
  try {
    const deployment = await db.getDeploymentByAgent(req.params.name);
    if (!deployment) return res.status(404).json({ error: 'Not deployed' });

    const { period, limit, offset } = req.query;
    const stats = await db.getTokenUsageStats(deployment.id, period || 'month');
    const recent = await db.getTokenUsage(deployment.id, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });
    const monthlyUsage = await db.getMonthlyTokenUsage(deployment.id);

    res.json({
      stats,
      recent,
      monthlyUsage,
      monthlyLimit: deployment.monthly_token_limit,
      usagePercent: deployment.monthly_token_limit > 0
        ? Math.round((monthlyUsage / deployment.monthly_token_limit) * 100)
        : 0,
    });
  } catch (err) {
    console.error('[Deploy] Usage error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deployments — List deployments (filtered by user, admin sees all)
router.get('/', async (req, res) => {
  try {
    const deployments = await db.getDeploymentsByUser(req.user.userId);
    // Enrich with agent info
    const enriched = [];
    for (const d of deployments) {
      const agent = await db.getAgent(d.agent_name);
      const monthlyUsage = await db.getMonthlyTokenUsage(d.id);
      enriched.push({
        ...d, agent,
        monthlyUsage,
        landingPageUrl: `/mcp/${d.slug}`,
      });
    }
    res.json(enriched);
  } catch (err) {
    console.error('[Deploy] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
