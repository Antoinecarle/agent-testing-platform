/**
 * Agent Proxy API — secure proxy for AI services + project database
 *
 * SECURITY: Agent terminals have NO access to platform secrets (API keys, DB creds, etc.).
 * Instead, they receive a scoped AGENT_SESSION_TOKEN that grants access to these
 * proxy endpoints only. The server uses its own secret keys to call external APIs.
 *
 * Endpoints:
 *   POST /api/agent-proxy/ai-chat     — ChatGPT completion proxy
 *   POST /api/agent-proxy/image       — Gemini image generation proxy
 *   POST /api/agent-proxy/embed       — OpenAI embeddings proxy
 *   GET  /api/agent-proxy/status      — Check proxy availability + capabilities
 *   GET  /api/agent-proxy/project     — Get current project info
 *   GET  /api/agent-proxy/iterations  — List project iterations
 *   GET  /api/agent-proxy/storage     — List all storage keys
 *   GET  /api/agent-proxy/storage/:key — Get storage value
 *   POST /api/agent-proxy/storage     — Save storage key-value
 *   DELETE /api/agent-proxy/storage/:key — Delete storage key
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { createLogger } = require('../lib/logger');
const log = createLogger('agent-proxy');

// ── Token Verification Middleware ────────────────────────────────────────────

function verifyAgentToken(req, res, next) {
  const token =
    req.headers['x-agent-token'] ||
    req.headers.authorization?.replace('Bearer ', '') ||
    req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing agent session token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'guru-agent-proxy',
    });

    if (decoded.type !== 'agent_session') {
      return res.status(403).json({ error: 'Invalid token type — use agent session token' });
    }

    req.agentSession = {
      sessionId: decoded.sessionId,
      projectId: decoded.projectId,
      userId: decoded.userId,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Agent session token expired' });
    }
    return res.status(403).json({ error: 'Invalid agent session token' });
  }
}

router.use(verifyAgentToken);

// ── Rate Limiting (per-session) ─────────────────────────────────────────────

const sessionRequests = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30; // 30 requests per minute per session

function checkRate(sessionId) {
  const now = Date.now();
  let entry = sessionRequests.get(sessionId);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    sessionRequests.set(sessionId, entry);
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Clean up old rate entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [key, entry] of sessionRequests) {
    if (entry.windowStart < cutoff) sessionRequests.delete(key);
  }
}, 300_000).unref();

function rateLimitMiddleware(req, res, next) {
  if (!checkRate(req.agentSession.sessionId)) {
    return res.status(429).json({ error: 'Rate limit exceeded (30 req/min)' });
  }
  next();
}

router.use(rateLimitMiddleware);

// ── GET /status — Check proxy capabilities ──────────────────────────────────

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    session: req.agentSession,
    capabilities: {
      'ai-chat': !!process.env.OPENAI_API_KEY,
      image: !!process.env.GOOGLE_AI_API_KEY,
      embed: !!process.env.OPENAI_API_KEY,
      project: true,
      iterations: true,
      storage: true,
    },
  });
});

// ── POST /ai-chat — ChatGPT Completion Proxy ───────────────────────────────

router.post('/ai-chat', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'AI chat not configured on this server' });
  }

  const { messages, model, temperature, max_tokens, response_format } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Validate messages structure
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      return res.status(400).json({ error: 'Each message must have role and content' });
    }
    if (!['system', 'user', 'assistant'].includes(msg.role)) {
      return res.status(400).json({ error: `Invalid role: ${msg.role}` });
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages,
        temperature: temperature ?? 0.7,
        max_tokens: Math.min(max_tokens || 4096, 16384), // Cap at 16k
        ...(response_format ? { response_format } : {}),
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      log.error(`[ai-chat] OpenAI error: ${response.status}`, err);
      return res.status(response.status).json({
        error: 'AI service error',
        detail: err.error?.message || `HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    // Return a simplified response (don't expose internal API details)
    res.json({
      content: data.choices?.[0]?.message?.content || '',
      role: 'assistant',
      usage: data.usage || null,
      model: data.model,
    });
  } catch (err) {
    log.error(`[ai-chat] Fetch error:`, err.message);
    res.status(500).json({ error: 'Failed to reach AI service' });
  }
});

// ── POST /image — Gemini Image Generation Proxy ─────────────────────────────

router.post('/image', async (req, res) => {
  if (!process.env.GOOGLE_AI_API_KEY) {
    return res.status(503).json({ error: 'Image generation not configured on this server' });
  }

  const { prompt, aspect_ratio } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt string is required' });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt too long (max 2000 chars)' });
  }

  const validRatios = ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  if (aspect_ratio && !validRatios.includes(aspect_ratio)) {
    return res.status(400).json({ error: `Invalid aspect_ratio. Valid: ${validRatios.join(', ')}` });
  }

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      log.error(`[image] Gemini error: ${response.status}`, err);
      return res.status(response.status).json({
        error: 'Image generation error',
        detail: err.error?.message || `HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    // Extract image data from response
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find(p => p.inlineData);
    const textPart = parts.find(p => p.text);

    if (!imagePart) {
      return res.status(500).json({ error: 'No image returned by the model' });
    }

    res.json({
      image: {
        mimeType: imagePart.inlineData.mimeType,
        data: imagePart.inlineData.data, // base64
      },
      text: textPart?.text || null,
    });
  } catch (err) {
    log.error(`[image] Fetch error:`, err.message);
    res.status(500).json({ error: 'Failed to reach image service' });
  }
});

// ── POST /embed — OpenAI Embeddings Proxy ───────────────────────────────────

router.post('/embed', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Embeddings not configured on this server' });
  }

  const { input, model } = req.body;

  if (!input) {
    return res.status(400).json({ error: 'input is required (string or string[])' });
  }

  // Normalize to array and validate
  const inputs = Array.isArray(input) ? input : [input];
  if (inputs.length > 20) {
    return res.status(400).json({ error: 'Max 20 inputs per request' });
  }
  for (const text of inputs) {
    if (typeof text !== 'string' || text.length > 32000) {
      return res.status(400).json({ error: 'Each input must be a string under 32k chars' });
    }
  }

  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model || 'text-embedding-3-small',
        input: inputs,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      log.error(`[embed] OpenAI error: ${response.status}`, err);
      return res.status(response.status).json({
        error: 'Embedding service error',
        detail: err.error?.message || `HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    res.json({
      embeddings: data.data?.map(d => d.embedding) || [],
      model: data.model,
      usage: data.usage || null,
    });
  } catch (err) {
    log.error(`[embed] Fetch error:`, err.message);
    res.status(500).json({ error: 'Failed to reach embedding service' });
  }
});

// ── GET /project — Current project info ──────────────────────────────────────

router.get('/project', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  try {
    const project = await db.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      id: project.id,
      name: project.name,
      description: project.description,
      agent_name: project.agent_name,
      project_type: project.project_type,
      status: project.status,
      iteration_count: project.iteration_count,
      created_at: project.created_at,
    });
  } catch (err) {
    log.error(`[project] Error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// ── GET /iterations — List project iterations ────────────────────────────────

router.get('/iterations', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  try {
    const iterations = await db.getIterationsByProject(projectId);
    res.json(iterations.map(it => ({
      id: it.id,
      version: it.version,
      title: it.title,
      prompt: it.prompt,
      agent_name: it.agent_name,
      parent_id: it.parent_id,
      status: it.status,
      file_path: it.file_path,
      created_at: it.created_at,
    })));
  } catch (err) {
    log.error(`[iterations] Error:`, err.message);
    res.status(500).json({ error: 'Failed to fetch iterations' });
  }
});

// ── GET /storage — List all storage keys for project ─────────────────────────

router.get('/storage', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  try {
    const items = await db.listProjectStorage(projectId);
    res.json(items);
  } catch (err) {
    log.error(`[storage] List error:`, err.message);
    res.status(500).json({ error: 'Failed to list storage' });
  }
});

// ── GET /storage/:key — Get a specific storage value ─────────────────────────

router.get('/storage/:key', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  try {
    const item = await db.getProjectStorage(projectId, req.params.key);
    if (!item) {
      return res.status(404).json({ error: 'Key not found' });
    }
    res.json({ key: item.key, value: item.value, updated_at: item.updated_at });
  } catch (err) {
    log.error(`[storage] Get error:`, err.message);
    res.status(500).json({ error: 'Failed to get storage value' });
  }
});

// ── POST /storage — Save a key-value pair ────────────────────────────────────

router.post('/storage', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  const { key, value } = req.body;
  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'key (string) is required' });
  }
  if (key.length > 255) {
    return res.status(400).json({ error: 'key must be 255 characters or less' });
  }
  if (value === undefined) {
    return res.status(400).json({ error: 'value is required (any JSON value)' });
  }

  try {
    const item = await db.upsertProjectStorage(projectId, key, value);
    res.json({ ok: true, key: item.key, value: item.value, updated_at: item.updated_at });
  } catch (err) {
    log.error(`[storage] Save error:`, err.message);
    res.status(500).json({ error: 'Failed to save storage value' });
  }
});

// ── DELETE /storage/:key — Delete a storage key ──────────────────────────────

router.delete('/storage/:key', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  try {
    await db.deleteProjectStorage(projectId, req.params.key);
    res.json({ ok: true });
  } catch (err) {
    log.error(`[storage] Delete error:`, err.message);
    res.status(500).json({ error: 'Failed to delete storage value' });
  }
});

module.exports = router;
