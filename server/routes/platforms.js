const express = require('express');
const db = require('../db');
const { encryptCredentials, testPlatformCredentials, executePlatformAction } = require('../lib/platform-integrations');
const { PLATFORM_TOOL_DEFINITIONS } = require('../lib/mcp-processors');

const router = express.Router();

// =================== AGENT-PLATFORM LINKING (must be before /:slug) ===================

// GET /api/platforms/agent/:name/platforms — Get agent's linked platforms
router.get('/agent/:name/platforms', async (req, res) => {
  try {
    const links = await db.getAgentPlatforms(req.params.name);
    res.json(links);
  } catch (err) {
    console.error('[Platforms] Get agent platforms error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/platforms/agent/:name/platforms — Link a platform to an agent
router.post('/agent/:name/platforms', async (req, res) => {
  try {
    const { platform_id, enabled_actions, config } = req.body;
    if (!platform_id) return res.status(400).json({ error: 'platform_id is required' });

    const link = await db.linkAgentPlatform(req.params.name, platform_id, enabled_actions || [], config || {});
    res.json(link);
  } catch (err) {
    console.error('[Platforms] Link agent platform error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/platforms/agent/:name/platforms/:id — Update agent-platform link
router.put('/agent/:name/platforms/:id', async (req, res) => {
  try {
    await db.updateAgentPlatformLink(req.params.id, req.body);
    res.json({ success: true });
  } catch (err) {
    console.error('[Platforms] Update agent platform link error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/platforms/agent/:name/platforms/:platformId — Unlink platform
router.delete('/agent/:name/platforms/:platformId', async (req, res) => {
  try {
    await db.unlinkAgentPlatform(req.params.name, req.params.platformId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Platforms] Unlink agent platform error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/platforms/agent/:name/mcp-tools — Get MCP tools generated for agent's linked platforms
router.get('/agent/:name/mcp-tools', async (req, res) => {
  try {
    const links = await db.getAgentPlatforms(req.params.name);
    const tools = [];

    for (const link of links) {
      const platformSlug = link.platform_integrations?.slug;
      if (!platformSlug) continue;

      const platformDefs = PLATFORM_TOOL_DEFINITIONS[platformSlug];
      if (!platformDefs) continue;

      const enabledActions = link.enabled_actions || [];
      const actionsToInclude = enabledActions.length > 0
        ? enabledActions
        : Object.keys(platformDefs);

      for (const actionName of actionsToInclude) {
        const toolDef = platformDefs[actionName];
        if (!toolDef) continue;
        tools.push({
          tool_name: toolDef.tool_name,
          description: toolDef.description,
          platform_slug: platformSlug,
          platform_name: link.platform_integrations?.name || platformSlug,
          action: actionName,
          input_schema: toolDef.input_schema,
        });
      }
    }

    res.json(tools);
  } catch (err) {
    console.error('[Platforms] Get agent MCP tools error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =================== PLATFORM CATALOG ===================

// GET /api/platforms — List all platforms (with user's credential status)
router.get('/', async (req, res) => {
  try {
    const platforms = await db.getAllPlatforms();
    const userId = req.user?.userId;

    // If authenticated, attach credential status per platform
    if (userId) {
      const userCreds = await db.getUserPlatformCredentials(userId);
      const credMap = {};
      for (const cred of userCreds) {
        credMap[cred.platform_id] = {
          connected: true,
          connected_at: cred.credential_metadata?.connected_at || cred.created_at,
          metadata: cred.credential_metadata || {},
        };
      }

      const enriched = platforms.map(p => ({
        ...p,
        credential_status: credMap[p.id] || { connected: false },
      }));
      return res.json(enriched);
    }

    res.json(platforms);
  } catch (err) {
    console.error('[Platforms] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/platforms/:slug — Get platform details
router.get('/:slug', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });

    // Attach credential status if authenticated
    if (req.user?.userId) {
      const cred = await db.getPlatformCredential(req.user.userId, platform.id);
      platform.credential_status = cred
        ? { connected: true, connected_at: cred.credential_metadata?.connected_at || cred.created_at, metadata: cred.credential_metadata }
        : { connected: false };
    }

    res.json(platform);
  } catch (err) {
    console.error('[Platforms] Get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// =================== CREDENTIALS ===================

// POST /api/platforms/:slug/credentials — Save encrypted credentials
router.post('/:slug/credentials', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });
    if (platform.status !== 'active') return res.status(400).json({ error: 'Platform is not yet available' });

    const { token, api_key, credentials, metadata } = req.body;
    const rawCredential = token || api_key || credentials;
    if (!rawCredential) return res.status(400).json({ error: 'Credentials are required (token, api_key, or credentials)' });
    if (typeof rawCredential !== 'string' || rawCredential.length > 4096) {
      return res.status(400).json({ error: 'Credential value is too long (max 4096 characters)' });
    }

    // If extra fields are provided (e.g., domain, email for Jira), store as JSON
    let toEncrypt = rawCredential;
    if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
      toEncrypt = JSON.stringify({ token: rawCredential, ...metadata });
    }

    const encrypted = encryptCredentials(toEncrypt);
    const credMetadata = {
      connected_at: new Date().toISOString(),
      ...(metadata || {}),
    };
    // Remove sensitive fields from metadata
    delete credMetadata.token;
    delete credMetadata.api_key;

    await db.savePlatformCredential(req.user.userId, platform.id, encrypted, credMetadata);

    res.json({
      success: true,
      platform: platform.slug,
      connected: true,
      connected_at: credMetadata.connected_at,
    });
  } catch (err) {
    console.error('[Platforms] Save credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/platforms/:slug/credentials — Check credential status (no decrypt)
router.get('/:slug/credentials', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });

    const cred = await db.getPlatformCredential(req.user.userId, platform.id);
    if (!cred) return res.json({ connected: false });

    res.json({
      connected: true,
      is_active: cred.is_active,
      connected_at: cred.credential_metadata?.connected_at || cred.created_at,
      metadata: cred.credential_metadata || {},
    });
  } catch (err) {
    console.error('[Platforms] Check credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/platforms/:slug/credentials — Remove credentials
router.delete('/:slug/credentials', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });

    await db.deletePlatformCredential(req.user.userId, platform.id);
    res.json({ success: true, platform: platform.slug, connected: false });
  } catch (err) {
    console.error('[Platforms] Delete credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/platforms/:slug/test — Test credentials
router.post('/:slug/test', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });

    const cred = await db.getPlatformCredential(req.user.userId, platform.id);
    if (!cred) return res.status(400).json({ error: 'No credentials saved for this platform' });

    const result = await testPlatformCredentials(platform.slug, cred.encrypted_credentials);
    res.json(result);
  } catch (err) {
    console.error('[Platforms] Test credentials error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/platforms/:slug/execute — Execute a platform action (direct)
router.post('/:slug/execute', async (req, res) => {
  try {
    const platform = await db.getPlatformBySlug(req.params.slug);
    if (!platform) return res.status(404).json({ error: 'Platform not found' });
    if (platform.status !== 'active') return res.status(400).json({ error: 'Platform is not yet available' });

    const { action, params } = req.body;
    if (!action) return res.status(400).json({ error: 'action is required' });

    const cred = await db.getPlatformCredential(req.user.userId, platform.id);
    if (!cred) return res.status(400).json({ error: 'No credentials for this platform. Connect it first.' });

    const result = await executePlatformAction(platform.slug, action, cred.encrypted_credentials, params || {});
    res.json(result);
  } catch (err) {
    console.error('[Platforms] Execute error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
