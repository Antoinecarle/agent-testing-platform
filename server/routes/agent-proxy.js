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

// ── GET /mcp-tools — List MCP tools for this project's agent ──────────────

router.get('/mcp-tools', async (req, res) => {
  const { projectId } = req.agentSession;
  if (!projectId) {
    return res.json({ tools: [] });
  }

  try {
    const project = await db.getProject(projectId);
    if (!project || !project.agent_name) {
      return res.json({ tools: [] });
    }

    const agentName = project.agent_name;
    const { formatToolsForMcp } = require('../lib/mcp-agent-tools');
    const { getSystemToolsMcp, getPlatformToolsMcp } = require('../lib/mcp-processors');

    // 1. Agent-specific tools from DB
    let agentTools;
    try {
      const dbTools = await db.getMcpAgentTools(agentName);
      agentTools = formatToolsForMcp(dbTools, agentName);
    } catch (err) {
      log.warn(`[mcp-tools] Failed to load agent tools:`, err.message);
      agentTools = [];
    }

    // 2. System tools (fetch_web, fetch_sitemap, fetch_multi_urls)
    const systemTools = getSystemToolsMcp();
    agentTools = [...systemTools, ...agentTools];

    // 3. Platform tools (Gmail, Nano Banana, Notion, etc.)
    try {
      const agentPlatforms = await db.getAgentPlatforms(agentName);
      if (agentPlatforms.length > 0) {
        const platformTools = getPlatformToolsMcp(agentPlatforms);
        agentTools = [...agentTools, ...platformTools];
      }
    } catch (err) {
      log.warn(`[mcp-tools] Failed to load platform tools:`, err.message);
    }

    log.info(`[mcp-tools] Returning ${agentTools.length} tools for agent "${agentName}"`);
    res.json({ tools: agentTools });
  } catch (err) {
    log.error(`[mcp-tools] Error:`, err.message);
    res.status(500).json({ error: 'Failed to load MCP tools' });
  }
});

// ── POST /mcp-call — Execute an MCP tool call ────────────────────────────

// Separate rate limit for LLM-backed tool calls (expensive)
const mcpCallRequests = new Map();
const MCP_CALL_LIMIT = 20; // 20 LLM calls per minute per session

router.post('/mcp-call', async (req, res) => {
  const { projectId, userId, sessionId } = req.agentSession;
  if (!projectId) {
    return res.status(400).json({ error: 'No project associated with this session' });
  }

  const { tool_name, arguments: toolArgs = {} } = req.body;
  if (!tool_name) {
    return res.status(400).json({ error: 'tool_name is required' });
  }

  // MCP-call specific rate limit
  const now = Date.now();
  let mcpEntry = mcpCallRequests.get(sessionId);
  if (!mcpEntry || now - mcpEntry.windowStart > RATE_WINDOW_MS) {
    mcpEntry = { windowStart: now, count: 0 };
    mcpCallRequests.set(sessionId, mcpEntry);
  }
  mcpEntry.count++;
  if (mcpEntry.count > MCP_CALL_LIMIT) {
    return res.status(429).json({ error: 'MCP call rate limit exceeded (20 LLM calls/min)' });
  }

  try {
    const project = await db.getProject(projectId);
    if (!project || !project.agent_name) {
      return res.status(400).json({ error: 'Project has no agent assigned' });
    }

    const agentName = project.agent_name;
    const {
      getSystemTool, executeSystemTool,
      getPlatformTool, runProcessors, injectProcessorData,
    } = require('../lib/mcp-processors');
    const { buildEnrichedContext } = require('../lib/mcp-agent-tools');
    const { callLLMProvider } = require('../lib/llm-providers');
    const { resolveUserLLMConfig } = require('../lib/resolve-llm-key');

    // === 1. SYSTEM TOOLS (direct execution, no LLM) ===
    const systemTool = getSystemTool(tool_name);
    if (systemTool) {
      log.info(`[mcp-call] Executing system tool: ${tool_name}`);
      const resultText = await executeSystemTool(systemTool, toolArgs, { agent_name: agentName });
      return res.json({
        content: [{ type: 'text', text: resultText }],
        isError: false,
      });
    }

    // === 2. PLATFORM TOOLS (Gmail, Nano Banana, Notion — real API calls) ===
    const platformToolDef = getPlatformTool(tool_name);
    if (platformToolDef) {
      log.info(`[mcp-call] Executing platform tool: ${tool_name}`);
      const context = { agent_name: agentName, user_id: userId, deployed_by: userId };
      const processorData = await runProcessors(platformToolDef.pre_processors, toolArgs, context);

      let resultText = processorData.__platform_formatted__ || '';
      if (processorData.__platform_error__) {
        resultText = `Error: ${processorData.__platform_error__}`;
      }
      if (!resultText && processorData.__platform_result__) {
        resultText = JSON.stringify(processorData.__platform_result__, null, 2);
      }

      return res.json({
        content: [{ type: 'text', text: resultText || '[No data returned]' }],
        isError: !!processorData.__platform_error__,
      });
    }

    // === 3. SPECIALIZED TOOLS from DB (requires LLM call) ===
    const dbTools = await db.getMcpAgentTools(agentName);
    const specializedTool = dbTools.find(t => t.tool_name === tool_name && t.is_active !== false);

    if (!specializedTool) {
      return res.status(404).json({
        content: [{ type: 'text', text: `Unknown tool: ${tool_name}` }],
        isError: true,
      });
    }

    log.info(`[mcp-call] Executing specialized tool: ${tool_name} (LLM-backed)`);

    // Build system prompt
    const agent = await db.getAgent(agentName);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const hasTemplate = specializedTool.context_template && specializedTool.context_template.length > 50;
    const promptMode = specializedTool.prompt_mode || 'lean';
    let systemPrompt = '';
    if (promptMode === 'full') {
      // Full mode: include the complete agent prompt + skills
      systemPrompt = agent.full_prompt || agent.prompt_preview || '';
      try {
        const skills = await db.getAgentSkills(agentName);
        if (skills?.length > 0) {
          systemPrompt += '\n\n## Assigned Skills\n\n';
          for (const skill of skills) {
            systemPrompt += `### ${skill.name}\n`;
            if (skill.description) systemPrompt += `${skill.description}\n\n`;
            if (skill.prompt) systemPrompt += `${skill.prompt}\n\n`;
          }
        }
      } catch (_) {}
      if (specializedTool.output_instructions) {
        systemPrompt += `\n## Output Format\n${specializedTool.output_instructions}\n`;
      }
    } else if (hasTemplate) {
      // Lean mode with template — agent identity + description only
      systemPrompt = `You are ${agent.name}. ${agent.description || ''}\n`;
      if (specializedTool.output_instructions) {
        systemPrompt += `\n## Output Format\n${specializedTool.output_instructions}\n`;
      }
    } else {
      // No template — fall back to full agent prompt
      systemPrompt = agent.full_prompt || agent.prompt_preview || '';
    }

    // Run pre-processors
    let processorData = {};
    if (specializedTool.pre_processors && specializedTool.pre_processors.length > 0) {
      processorData = await runProcessors(
        specializedTool.pre_processors,
        toolArgs,
        { agent_name: agentName, tool_name, user_id: userId }
      );
    }

    // Build enriched context from tool template
    const enriched = buildEnrichedContext(specializedTool, toolArgs);

    // Inject processor data into context template
    if (enriched.contextAddition && Object.keys(processorData).length > 0) {
      enriched.contextAddition = injectProcessorData(enriched.contextAddition, processorData);
    }

    // Auto-inject unreferenced processor data
    for (const [key, value] of Object.entries(processorData)) {
      if (typeof value === 'string' && value.length > 10 &&
          !key.endsWith('__error__') &&
          key !== '__fetched_html__' && key !== '__html_info__' && key !== '__seo_score_data__') {
        if (!enriched.contextAddition.includes(key)) {
          enriched.contextAddition += `\n\n${value}`;
        }
      }
    }

    if (enriched.contextAddition) {
      systemPrompt += enriched.contextAddition;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: enriched.userMessage },
    ];

    // Resolve LLM config (user's BYOK > server fallback)
    const llmConfig = await resolveUserLLMConfig(userId);

    const maxTokens = specializedTool.max_tokens > 0
      ? Math.min(specializedTool.max_tokens, 128000)
      : 4096;

    const llmResult = await callLLMProvider(
      llmConfig.provider, llmConfig.apiKey, llmConfig.model,
      messages, { maxTokens }
    );

    log.info(`[mcp-call] ${tool_name} completed (${llmResult.outputTokens || 0} output tokens)`);

    return res.json({
      content: [{ type: 'text', text: llmResult.text }],
      isError: false,
    });
  } catch (err) {
    log.error(`[mcp-call] Error executing ${tool_name}:`, err.message);
    res.status(500).json({
      content: [{ type: 'text', text: `Tool execution failed: ${err.message}` }],
      isError: true,
    });
  }
});

// Clean up MCP rate entries
setInterval(() => {
  const cutoff = Date.now() - RATE_WINDOW_MS * 2;
  for (const [key, entry] of mcpCallRequests) {
    if (entry.windowStart < cutoff) mcpCallRequests.delete(key);
  }
}, 300_000).unref();

module.exports = router;
