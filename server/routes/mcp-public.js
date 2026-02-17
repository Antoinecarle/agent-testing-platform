const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { generateEmbedding } = require('../lib/embeddings');

const router = express.Router();

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// =================== MCP SSE TRANSPORT (JSON-RPC 2.0) ===================
const mcpSessions = new Map(); // sessionId -> { res, deploymentId, agentName, slug }

// Cleanup stale sessions every 5 min
setInterval(() => {
  for (const [id, session] of mcpSessions) {
    try { session.res.write(':ping\n\n'); }
    catch (_) { mcpSessions.delete(id); }
  }
}, 5 * 60 * 1000);

// GET /mcp/:slug/sse — SSE stream for MCP protocol
router.get('/:slug/sse', async (req, res) => {
  try {
    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment || deployment.status !== 'active') {
      return res.status(404).json({ error: 'MCP not found or inactive' });
    }

    // Auth via query param or header — accepts both gru_ (deployment) and guru_ (marketplace) keys
    const apiKey = req.query.key || (req.headers.authorization || '').replace('Bearer ', '');
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required. Pass ?key=YOUR_KEY or Authorization: Bearer YOUR_KEY' });
    }
    const keyHash = hashApiKey(apiKey);
    let keyRecord = await db.getApiKeyByHash(keyHash);
    let keySource = 'deployment';
    if (!keyRecord) {
      // Try marketplace user_api_tokens
      keyRecord = await db.getUserApiTokenByHash(keyHash);
      keySource = 'marketplace';
    }
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    const sessionId = crypto.randomUUID();

    // Set SSE headers — disable proxy buffering for Railway/nginx
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
    });
    res.flushHeaders();

    // Store session
    mcpSessions.set(sessionId, {
      res,
      deploymentId: deployment.id,
      agentName: deployment.agent_name,
      slug: deployment.slug,
      apiKeyId: keyRecord.id,
    });

    // Send endpoint event (first event per MCP SSE spec) — use absolute URL
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const messagesUrl = `${proto}://${host}/mcp/${deployment.slug}/messages?sessionId=${sessionId}`;
    res.write(`event: endpoint\ndata: ${messagesUrl}\n\n`);
    if (res.flush) res.flush();
    console.log(`[MCP SSE] Session ${sessionId} opened for ${deployment.slug} (key: ${keySource})`);

    // Keepalive
    const keepalive = setInterval(() => {
      try { res.write(':keepalive\n\n'); if (res.flush) res.flush(); }
      catch (_) { clearInterval(keepalive); mcpSessions.delete(sessionId); }
    }, 30000);

    req.on('close', () => {
      clearInterval(keepalive);
      mcpSessions.delete(sessionId);
    });

  } catch (err) {
    console.error('[MCP SSE] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /mcp/:slug/messages — JSON-RPC message handler for MCP protocol
router.post('/:slug/messages', async (req, res) => {
  const sessionId = req.query.sessionId;
  const session = mcpSessions.get(sessionId);
  if (!session) {
    console.log(`[MCP Messages] Session not found: ${sessionId}, active sessions: ${mcpSessions.size}`);
    return res.status(404).json({ error: 'Session not found. Re-open the SSE connection.' });
  }

  const msg = req.body;
  console.log(`[MCP Messages] ${session.slug} method=${msg?.method} id=${msg?.id}`);
  if (!msg || !msg.jsonrpc) {
    return res.status(400).json({ error: 'Invalid JSON-RPC message' });
  }

  // Accept the request immediately
  res.status(202).json({ ok: true });

  // Process and send response via SSE
  try {
    const response = await handleMcpMessage(msg, session);
    if (response) {
      session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
      if (session.res.flush) session.res.flush();
    }
  } catch (err) {
    console.error('[MCP Messages] Error:', err.message);
    if (msg.id) {
      const errResp = {
        jsonrpc: '2.0', id: msg.id,
        error: { code: -32603, message: err.message },
      };
      try {
        session.res.write(`event: message\ndata: ${JSON.stringify(errResp)}\n\n`);
        if (session.res.flush) session.res.flush();
      } catch (_) {}
    }
  }
});

async function handleMcpMessage(msg, session) {
  const { method, id, params } = msg;

  // Notifications (no id) — no response needed
  if (!id && method === 'notifications/initialized') return null;
  if (!id) return null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: `guru-${session.agentName}`,
            version: '1.0.0',
          },
        },
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0', id,
        result: {
          tools: [
            {
              name: 'chat',
              description: `Send a message to ${session.agentName} AI agent and get a response. The agent has deep domain knowledge and specialized skills loaded.`,
              inputSchema: {
                type: 'object',
                properties: {
                  message: { type: 'string', description: 'Your message to the agent' },
                  context: { type: 'string', description: 'Optional context or previous conversation to include' },
                },
                required: ['message'],
              },
            },
            {
              name: 'get_agent_info',
              description: `Get information about the ${session.agentName} agent including skills, capabilities, and token counts.`,
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
      };

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (toolName === 'chat') {
        return await handleChatTool(id, toolArgs, session);
      } else if (toolName === 'get_agent_info') {
        return await handleInfoTool(id, session);
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } };
    }

    case 'resources/list':
      return {
        jsonrpc: '2.0', id,
        result: { resources: [] },
      };

    case 'prompts/list': {
      const agent = await db.getAgent(session.agentName);
      return {
        jsonrpc: '2.0', id,
        result: {
          prompts: [
            {
              name: 'agent_system_prompt',
              description: `The full system prompt for ${session.agentName}, including all skills and knowledge.`,
              arguments: [],
            },
          ],
        },
      };
    }

    case 'prompts/get': {
      const promptName = params?.name;
      if (promptName === 'agent_system_prompt') {
        const agent = await db.getAgent(session.agentName);
        let systemPrompt = agent?.full_prompt || '';
        try {
          const skills = await db.getAgentSkills(session.agentName);
          if (skills?.length > 0) {
            systemPrompt += '\n\n## Assigned Skills\n\n';
            for (const skill of skills) {
              systemPrompt += `### ${skill.name}\n`;
              if (skill.description) systemPrompt += `${skill.description}\n\n`;
              if (skill.prompt) systemPrompt += `${skill.prompt}\n\n`;
            }
          }
        } catch (_) {}
        return {
          jsonrpc: '2.0', id,
          result: {
            description: `System prompt for ${session.agentName}`,
            messages: [{ role: 'user', content: { type: 'text', text: systemPrompt } }],
          },
        };
      }
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown prompt: ${promptName}` } };
    }

    default:
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  }
}

async function handleChatTool(id, args, session) {
  const startTime = Date.now();
  const agent = await db.getAgent(session.agentName);
  if (!agent) return { jsonrpc: '2.0', id, error: { code: -32603, message: 'Agent not found' } };

  // Build system prompt
  let systemPrompt = agent.full_prompt || agent.prompt_preview || '';
  try {
    const skills = await db.getAgentSkills(session.agentName);
    if (skills?.length > 0) {
      systemPrompt += '\n\n## Assigned Skills\n\n';
      for (const skill of skills) {
        systemPrompt += `### ${skill.name}\n`;
        if (skill.description) systemPrompt += `${skill.description}\n\n`;
        if (skill.prompt) systemPrompt += `${skill.prompt}\n\n`;
      }
    }
  } catch (_) {}

  // Build messages
  const messages = [
    { role: 'system', content: systemPrompt },
  ];
  if (args.context) messages.push({ role: 'user', content: args.context });
  messages.push({ role: 'user', content: args.message });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return { jsonrpc: '2.0', id, error: { code: -32603, message: 'OpenAI not configured' } };

  const model = 'gpt-5-mini-2025-08-07';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
    body: JSON.stringify({ model, messages, max_completion_tokens: 4096 }),
  });

  const result = await response.json();
  const durationMs = Date.now() - startTime;

  if (result.error) {
    await db.logTokenUsage(session.deploymentId, session.agentName, model, 0, 0, 'mcp-chat', '', durationMs, 'error', result.error.message);
    return { jsonrpc: '2.0', id, error: { code: -32603, message: result.error.message } };
  }

  const usage = result.usage || {};
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  await db.logTokenUsage(session.deploymentId, session.agentName, model, inputTokens, outputTokens, 'mcp-chat', '', durationMs, 'success', '');
  await db.incrementDeploymentStats(session.deploymentId, inputTokens, outputTokens);
  await db.updateApiKeyLastUsed(session.apiKeyId);

  const text = result.choices?.[0]?.message?.content || '';
  return {
    jsonrpc: '2.0', id,
    result: {
      content: [{ type: 'text', text }],
      isError: false,
    },
  };
}

async function handleInfoTool(id, session) {
  const agent = await db.getAgent(session.agentName);
  if (!agent) return { jsonrpc: '2.0', id, error: { code: -32603, message: 'Agent not found' } };
  let skills = [];
  try { skills = await db.getAgentSkills(session.agentName); } catch (_) {}
  const promptTokens = agent.full_prompt ? Math.round(agent.full_prompt.length / 4) : 0;
  const skillTokens = skills.reduce((sum, s) => sum + (s.prompt ? Math.round(s.prompt.length / 4) : 0), 0);

  return {
    jsonrpc: '2.0', id,
    result: {
      content: [{
        type: 'text',
        text: JSON.stringify({
          name: agent.name,
          description: agent.description,
          model: agent.model,
          category: agent.category,
          rating: agent.rating,
          skills: skills.map(s => ({ name: s.name, category: s.category })),
          tokens: { core: promptTokens, skills: skillTokens, total: promptTokens + skillTokens },
        }, null, 2),
      }],
      isError: false,
    },
  };
}

// Validate API key middleware
async function validateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <api_key>' });
  }
  const apiKey = authHeader.substring(7);
  const keyHash = hashApiKey(apiKey);
  const keyRecord = await db.getApiKeyByHash(keyHash);
  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  // Update last used
  await db.updateApiKeyLastUsed(keyRecord.id);
  req.deploymentId = keyRecord.deployment_id;
  req.apiKeyId = keyRecord.id;
  next();
}

// GET /mcp/:slug — Landing page
router.get('/:slug', async (req, res) => {
  try {
    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment) return res.status(404).send('MCP not found');

    const agent = await db.getAgent(deployment.agent_name);
    if (!agent) return res.status(404).send('Agent not found');

    const monthlyUsage = await db.getMonthlyTokenUsage(deployment.id);
    const stats = await db.getTokenUsageStats(deployment.id, 'month');

    // Load agent skills
    let skills = [];
    try {
      skills = await db.getAgentSkills(deployment.agent_name);
    } catch (_) {}

    // Load projects count
    let projectCount = 0;
    try {
      projectCount = await db.getAgentProjectCount(deployment.agent_name);
    } catch (_) {}

    const html = generateLandingPage(deployment, agent, monthlyUsage, stats, skills, projectCount);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[MCP Landing] Error:', err.message);
    res.status(500).send('Server error');
  }
});

// POST /mcp/:slug/api/chat — MCP chat endpoint
router.post('/:slug/api/chat', validateApiKey, async (req, res) => {
  const startTime = Date.now();
  try {
    const deployment = await db.getDeployment(req.deploymentId);
    if (!deployment || deployment.status !== 'active') {
      return res.status(403).json({ error: 'MCP deployment is not active' });
    }

    // Check rate limit
    const monthlyUsage = await db.getMonthlyTokenUsage(deployment.id);
    if (monthlyUsage >= deployment.monthly_token_limit) {
      await db.logTokenUsage(deployment.id, deployment.agent_name, '', 0, 0, 'chat', req.ip, 0, 'rate_limited', 'Monthly token limit exceeded');
      return res.status(429).json({ error: 'Monthly token limit exceeded', usage: monthlyUsage, limit: deployment.monthly_token_limit });
    }

    const agent = await db.getAgent(deployment.agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { messages, model } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Build system prompt from agent + skills
    let systemPrompt = agent.full_prompt || agent.prompt_preview || '';

    // Inject assigned skills (same as workspace.js does)
    try {
      const skills = await db.getAgentSkills(deployment.agent_name);
      if (skills && skills.length > 0) {
        systemPrompt += '\n\n## Assigned Skills\n\n';
        systemPrompt += 'The following skills are loaded for this agent. Use them as reference and follow their patterns:\n\n';
        for (const skill of skills) {
          systemPrompt += `### ${skill.name}\n`;
          if (skill.description) systemPrompt += `${skill.description}\n\n`;
          if (skill.prompt) systemPrompt += `${skill.prompt}\n\n`;
        }
      }
    } catch (err) {
      console.warn('[MCP] Failed to load skills for', deployment.agent_name, err.message);
    }

    // Inject relevant knowledge via RAG (semantic search on last user message)
    try {
      const agentKBs = await db.getAgentKnowledgeBases(deployment.agent_name);
      if (agentKBs && agentKBs.length > 0) {
        // Get the last user message for semantic search
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (lastUserMsg && lastUserMsg.content) {
          const queryText = typeof lastUserMsg.content === 'string'
            ? lastUserMsg.content
            : JSON.stringify(lastUserMsg.content);

          const queryEmbedding = await generateEmbedding(queryText);
          const kbIds = agentKBs.map(kb => kb.id);
          const results = await db.searchKnowledge(queryEmbedding, {
            threshold: 0.25,
            limit: 8,
            knowledgeBaseIds: kbIds,
          });

          if (results && results.length > 0) {
            systemPrompt += '\n\n## Relevant Knowledge\n\n';
            systemPrompt += 'The following information was retrieved from your knowledge bases. Use it to answer accurately:\n\n';
            for (const entry of results) {
              const pct = Math.round((entry.similarity || 0) * 100);
              systemPrompt += `**${entry.title || 'Entry'}** (${pct}% relevance)\n`;
              systemPrompt += `${entry.content}\n\n`;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[MCP] Failed to load knowledge for', deployment.agent_name, err.message);
    }

    // Prepare messages with system prompt
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    // Forward to OpenAI (using the agent's configured model or default)
    const selectedModel = model || 'gpt-5-mini-2025-08-07';
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(503).json({ error: 'OpenAI API key not configured on server' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: fullMessages,
        max_completion_tokens: 4096,
      }),
    });

    const result = await response.json();
    const durationMs = Date.now() - startTime;

    if (result.error) {
      await db.logTokenUsage(deployment.id, deployment.agent_name, selectedModel, 0, 0, 'chat', req.ip, durationMs, 'error', result.error.message);
      return res.status(502).json({ error: result.error.message });
    }

    const usage = result.usage || {};
    const inputTokens = usage.prompt_tokens || 0;
    const outputTokens = usage.completion_tokens || 0;

    // Log usage
    await db.logTokenUsage(deployment.id, deployment.agent_name, selectedModel, inputTokens, outputTokens, 'chat', req.ip, durationMs, 'success', '');
    await db.incrementDeploymentStats(deployment.id, inputTokens, outputTokens);

    res.json({
      id: result.id,
      object: 'response',
      model: selectedModel,
      agent: deployment.agent_name,
      output: result.choices?.map(c => ({
        type: 'message',
        role: c.message?.role || 'assistant',
        content: [{ type: 'output_text', text: c.message?.content || '' }],
      })) || [],
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    });
  } catch (err) {
    const durationMs = Date.now() - startTime;
    console.error('[MCP API] Error:', err.message);
    try {
      const deployment = await db.getDeployment(req.deploymentId);
      if (deployment) {
        await db.logTokenUsage(deployment.id, deployment.agent_name, '', 0, 0, 'chat', req.ip, durationMs, 'error', err.message);
      }
    } catch (_) {}
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /mcp/:slug/api/logs — Request logs (public, limited data)
router.get('/:slug/api/logs', async (req, res) => {
  try {
    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment) return res.status(404).json({ error: 'Not found' });
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const logs = await db.getTokenUsage(deployment.id, { limit });
    // Sanitize: remove caller_ip for public
    const sanitized = (logs || []).map(l => ({
      id: l.id, created_at: l.created_at, request_type: l.request_type,
      input_tokens: l.input_tokens, output_tokens: l.output_tokens,
      total_tokens: l.total_tokens, status: l.status, duration_ms: l.duration_ms,
      model: l.model,
    }));
    res.json(sanitized);
  } catch (err) {
    console.error('[MCP Logs] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /mcp/:slug/api/prompt — Get the agent prompt (requires purchase or public if free)
router.get('/:slug/api/prompt', async (req, res) => {
  try {
    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment) return res.status(404).json({ error: 'Not found' });
    const agent = await db.getAgent(deployment.agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Build the full prompt including skills
    let fullPrompt = agent.full_prompt || agent.prompt_preview || '';
    try {
      const skills = await db.getAgentSkills(deployment.agent_name);
      if (skills && skills.length > 0) {
        fullPrompt += '\n\n## Assigned Skills\n\n';
        for (const skill of skills) {
          fullPrompt += `### ${skill.name}\n`;
          if (skill.description) fullPrompt += `${skill.description}\n\n`;
          if (skill.prompt) fullPrompt += `${skill.prompt}\n\n`;
        }
      }
    } catch (_) {}

    res.json({
      prompt: fullPrompt,
      tokens: Math.round(fullPrompt.length / 4),
      agent_name: agent.name,
      model: agent.model,
    });
  } catch (err) {
    console.error('[MCP Prompt] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /mcp/:slug/api/info — Public info about the MCP
router.get('/:slug/api/info', async (req, res) => {
  try {
    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment) return res.status(404).json({ error: 'Not found' });

    const agent = await db.getAgent(deployment.agent_name);
    res.json({
      name: deployment.agent_name,
      slug: deployment.slug,
      status: deployment.status,
      description: deployment.description || agent?.description || '',
      tagline: deployment.tagline,
      tier: deployment.tier,
      model: agent?.model || '',
      category: agent?.category || '',
      endpoints: {
        chat: `/mcp/${deployment.slug}/api/chat`,
        info: `/mcp/${deployment.slug}/api/info`,
      },
    });
  } catch (err) {
    console.error('[MCP Info] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /mcp/:slug/api/usage — Public usage stats (requires API key)
router.get('/:slug/api/usage', validateApiKey, async (req, res) => {
  try {
    const deployment = await db.getDeployment(req.deploymentId);
    if (!deployment) return res.status(404).json({ error: 'Not found' });

    const stats = await db.getTokenUsageStats(deployment.id, req.query.period || 'month');
    const monthlyUsage = await db.getMonthlyTokenUsage(deployment.id);

    res.json({
      ...stats,
      monthlyUsage,
      monthlyLimit: deployment.monthly_token_limit,
      usagePercent: deployment.monthly_token_limit > 0
        ? Math.round((monthlyUsage / deployment.monthly_token_limit) * 100)
        : 0,
    });
  } catch (err) {
    console.error('[MCP Usage] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /mcp/:slug/api/demo-chat — Public demo chat (no API key, rate-limited per IP)
const demoChatLimits = new Map(); // ip -> { count, resetAt }

router.post('/:slug/api/demo-chat', async (req, res) => {
  try {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    // Rate limit: 20 messages per 10 min per IP
    let limit = demoChatLimits.get(ip);
    if (!limit || now > limit.resetAt) {
      limit = { count: 0, resetAt: now + 10 * 60 * 1000 };
      demoChatLimits.set(ip, limit);
    }
    limit.count++;
    if (limit.count > 20) {
      return res.status(429).json({ error: 'Demo rate limit reached. Try again in a few minutes.' });
    }

    const deployment = await db.getDeploymentBySlug(req.params.slug);
    if (!deployment || deployment.status !== 'active') {
      return res.status(404).json({ error: 'MCP not found or inactive' });
    }

    const agent = await db.getAgent(deployment.agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    // Limit conversation length for demo
    const trimmedMessages = messages.slice(-10);

    // Build full system prompt with skills (deep — read from disk)
    let systemPrompt = agent.full_prompt || agent.prompt_preview || '';

    try {
      const skills = await db.getAgentSkills(deployment.agent_name);
      if (skills && skills.length > 0) {
        const skillStorage = require('../skill-storage');
        systemPrompt += '\n\n## Assigned Skills\n\n';
        systemPrompt += 'The following skills are loaded. Use them as reference and follow their patterns:\n\n';
        for (const skill of skills) {
          systemPrompt += `### ${skill.name}\n`;
          if (skill.description) systemPrompt += `${skill.description}\n\n`;
          try {
            const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
            if (entryFile && entryFile.content) {
              systemPrompt += entryFile.content.slice(0, 6000) + '\n\n';
            } else if (skill.prompt) {
              systemPrompt += skill.prompt.slice(0, 6000) + '\n\n';
            }
          } catch (_) {
            if (skill.prompt) systemPrompt += skill.prompt.slice(0, 6000) + '\n\n';
          }
          // Reference files
          try {
            const tree = skillStorage.scanSkillTree(skill.slug);
            if (tree) {
              const refFiles = [];
              const walkTree = (items) => {
                for (const item of items) {
                  if (item.type === 'file' && item.path !== 'SKILL.md' && item.path !== (skill.entry_point || 'SKILL.md') && refFiles.length < 3) {
                    refFiles.push(item.path);
                  }
                  if (item.children) walkTree(item.children);
                }
              };
              walkTree(tree);
              for (const refPath of refFiles) {
                const refFile = skillStorage.readSkillFile(skill.slug, refPath);
                if (refFile && refFile.content) {
                  systemPrompt += `#### ${refPath}\n${refFile.content.slice(0, 2000)}\n\n`;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[MCP Demo] Failed to load skills:', err.message);
    }

    const { callGPT5 } = require('../lib/agent-analysis');
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmedMessages,
    ];

    const response = await callGPT5(fullMessages, { max_completion_tokens: 4000 });

    res.json({
      role: 'assistant',
      content: response,
      context: {
        tokens: Math.round(systemPrompt.length / 4),
      },
    });
  } catch (err) {
    console.error('[MCP Demo Chat] Error:', err.message);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// Clean up rate limit map every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, limit] of demoChatLimits) {
    if (now > limit.resetAt) demoChatLimits.delete(ip);
  }
}, 30 * 60 * 1000);

// =================== LANDING PAGE GENERATOR ===================

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function generateLandingPage(deployment, agent, monthlyUsage, stats, skills, projectCount) {
  const color = deployment.primary_color || '#8B5CF6';
  const agentName = escapeHtml(agent.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
  const description = escapeHtml(deployment.description || agent.description || '');
  const tagline = escapeHtml(deployment.tagline || `${agentName} MCP Server`);
  const category = agent.category || 'uncategorized';
  const model = agent.model || 'opus';
  const tools = (agent.tools || '').split(',').map(t => t.trim()).filter(Boolean);
  const tierLabels = { starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise' };
  const usagePercent = deployment.monthly_token_limit > 0
    ? Math.round((monthlyUsage / deployment.monthly_token_limit) * 100) : 0;
  const safeSkills = (skills || []).map(s => ({
    name: escapeHtml(s.name || ''),
    description: escapeHtml(s.description || ''),
    category: escapeHtml(s.category || 'general'),
    color: s.color || color,
    promptLength: s.prompt ? s.prompt.length : 0,
  }));
  const promptTokens = agent.full_prompt ? Math.round(agent.full_prompt.length / 4) : 0;
  const totalSkillTokens = (skills || []).reduce((sum, s) => sum + (s.prompt ? Math.round(s.prompt.length / 4) : 0), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName} — MCP Server | GURU</title>
  <meta name="description" content="${description}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --primary: ${color};
      --primary-light: ${color}33;
      --primary-glow: ${color}66;
      --bg: #09090b;
      --bg-card: #18181b;
      --bg-card-hover: #27272a;
      --border: #27272a;
      --border-light: #3f3f46;
      --text: #fafafa;
      --text-muted: #a1a1aa;
      --text-dim: #71717a;
      --success: #22c55e;
      --warning: #eab308;
      --error: #ef4444;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      overflow-x: hidden;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
    }

    /* ===== NAV ===== */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      background: rgba(9,9,11,0.8);
      border-bottom: 1px solid var(--border);
    }
    nav .container {
      display: flex; align-items: center; justify-content: space-between;
      height: 64px;
    }
    .nav-logo {
      display: flex; align-items: center; gap: 12px;
      font-weight: 700; font-size: 18px; text-decoration: none; color: var(--text);
    }
    .nav-logo .dot {
      width: 10px; height: 10px; border-radius: 50%;
      background: var(--primary);
      box-shadow: 0 0 12px var(--primary-glow);
    }
    .nav-badge {
      font-size: 11px; font-weight: 500; padding: 2px 8px;
      border-radius: 100px; background: var(--primary-light);
      color: var(--primary); border: 1px solid ${color}44;
    }
    .nav-links { display: flex; gap: 8px; }
    .nav-links a {
      padding: 8px 16px; border-radius: 8px; font-size: 14px;
      text-decoration: none; color: var(--text-muted); transition: all 0.2s;
    }
    .nav-links a:hover { color: var(--text); background: var(--bg-card); }
    .btn-primary {
      padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
      background: var(--primary); color: #fff; border: none; cursor: pointer;
      text-decoration: none; display: inline-flex; align-items: center; gap: 6px;
      transition: all 0.2s; box-shadow: 0 0 20px ${color}33;
    }
    .btn-primary:hover { opacity: 0.9; box-shadow: 0 0 30px ${color}55; }
    .btn-outline {
      padding: 8px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;
      background: transparent; color: var(--text); border: 1px solid var(--border);
      cursor: pointer; text-decoration: none; transition: all 0.2s;
    }
    .btn-outline:hover { border-color: var(--primary); color: var(--primary); }

    /* ===== HERO ===== */
    .hero {
      padding: 160px 0 100px; text-align: center; position: relative;
    }
    .hero::before {
      content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
      width: 600px; height: 600px; border-radius: 50%;
      background: radial-gradient(circle, ${color}15 0%, transparent 70%);
      pointer-events: none;
    }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 16px; border-radius: 100px; font-size: 13px;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-muted); margin-bottom: 32px;
    }
    .hero-badge .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: ${deployment.status === 'active' ? 'var(--success)' : 'var(--warning)'};
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .hero h1 {
      font-size: clamp(40px, 6vw, 72px); font-weight: 800;
      line-height: 1.05; margin-bottom: 24px;
      background: linear-gradient(135deg, var(--text) 0%, var(--text-muted) 50%, var(--primary) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    .hero p {
      font-size: 18px; color: var(--text-muted); max-width: 600px; margin: 0 auto 40px;
    }
    .hero-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

    /* ===== STATS ROW ===== */
    .stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1px; background: var(--border); border-radius: 16px;
      overflow: hidden; margin: 80px 0;
    }
    .stat-card {
      background: var(--bg-card); padding: 32px; text-align: center;
    }
    .stat-card .value {
      font-size: 36px; font-weight: 700; color: var(--text);
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-card .label {
      font-size: 13px; color: var(--text-dim); margin-top: 8px; text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ===== SECTION HEADINGS ===== */
    .section { padding: 80px 0; }
    .section-header { text-align: center; margin-bottom: 56px; }
    .section-header h2 {
      font-size: 36px; font-weight: 700; margin-bottom: 16px;
    }
    .section-header p { color: var(--text-muted); font-size: 16px; max-width: 500px; margin: 0 auto; }

    /* ===== CAPABILITIES GRID ===== */
    .capabilities-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    .capability-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 32px; transition: all 0.3s;
    }
    .capability-card:hover {
      border-color: var(--primary); transform: translateY(-2px);
      box-shadow: 0 8px 32px ${color}15;
    }
    .capability-icon {
      width: 48px; height: 48px; border-radius: 12px;
      background: var(--primary-light); display: flex; align-items: center;
      justify-content: center; font-size: 24px; margin-bottom: 20px;
    }
    .capability-card h3 { font-size: 18px; font-weight: 600; margin-bottom: 8px; }
    .capability-card p { font-size: 14px; color: var(--text-muted); line-height: 1.7; }

    /* ===== SETUP SECTION ===== */
    .setup-block {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; overflow: hidden;
    }
    .setup-tabs {
      display: flex; border-bottom: 1px solid var(--border);
    }
    .setup-tab {
      padding: 16px 24px; font-size: 14px; font-weight: 500;
      color: var(--text-muted); cursor: pointer; border: none;
      background: none; transition: all 0.2s;
    }
    .setup-tab.active {
      color: var(--primary); box-shadow: inset 0 -2px 0 var(--primary);
    }
    .setup-content { padding: 24px; }
    .code-block {
      background: #0c0c0e; border: 1px solid var(--border); border-radius: 12px;
      padding: 20px; font-family: 'JetBrains Mono', monospace; font-size: 13px;
      color: var(--text-muted); overflow-x: auto; line-height: 1.8;
      position: relative;
    }
    .code-block .comment { color: var(--text-dim); }
    .code-block .string { color: var(--success); }
    .code-block .keyword { color: var(--primary); }
    .copy-btn {
      position: absolute; top: 12px; right: 12px; padding: 6px 12px;
      border-radius: 6px; font-size: 12px; background: var(--bg-card);
      border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; transition: all 0.2s;
    }
    .copy-btn:hover { border-color: var(--primary); color: var(--primary); }

    /* ===== PRICING ===== */
    .pricing-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px; max-width: 1000px; margin: 0 auto;
    }
    .pricing-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 40px 32px; position: relative;
    }
    .pricing-card.featured {
      border-color: var(--primary);
      box-shadow: 0 0 40px ${color}15;
    }
    .pricing-card.featured::before {
      content: 'POPULAR'; position: absolute; top: -12px; left: 50%;
      transform: translateX(-50%); padding: 4px 16px; border-radius: 100px;
      font-size: 11px; font-weight: 600; background: var(--primary); color: #fff;
      letter-spacing: 0.5px;
    }
    .pricing-card .tier-name {
      font-size: 18px; font-weight: 600; margin-bottom: 8px;
    }
    .pricing-card .price {
      font-size: 48px; font-weight: 800; margin-bottom: 4px;
    }
    .pricing-card .price span { font-size: 16px; font-weight: 400; color: var(--text-muted); }
    .pricing-card .price-note { font-size: 13px; color: var(--text-dim); margin-bottom: 24px; }
    .pricing-card ul {
      list-style: none; margin-bottom: 32px;
    }
    .pricing-card li {
      padding: 8px 0; font-size: 14px; color: var(--text-muted);
      display: flex; align-items: center; gap: 10px;
    }
    .pricing-card li::before {
      content: '\\2713'; color: var(--primary); font-weight: 700; font-size: 14px;
    }

    /* ===== USAGE BAR ===== */
    .usage-section { padding: 60px 0; }
    .usage-bar-container {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 32px;
    }
    .usage-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
    }
    .usage-header h3 { font-size: 18px; font-weight: 600; }
    .usage-header .usage-text {
      font-family: 'JetBrains Mono', monospace; font-size: 14px; color: var(--text-muted);
    }
    .usage-bar {
      height: 12px; background: var(--border); border-radius: 6px; overflow: hidden;
    }
    .usage-bar-fill {
      height: 100%; border-radius: 6px; transition: width 1s ease;
      background: linear-gradient(90deg, var(--primary), ${color}cc);
    }
    .usage-details {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px; margin-top: 24px;
    }
    .usage-detail {
      text-align: center; padding: 16px;
      background: rgba(255,255,255,0.02); border-radius: 8px;
    }
    .usage-detail .val {
      font-size: 24px; font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .usage-detail .lbl {
      font-size: 12px; color: var(--text-dim); margin-top: 4px;
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    /* ===== TOOLS SECTION ===== */
    .tools-grid {
      display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
    }
    .tool-badge {
      padding: 8px 16px; border-radius: 8px; font-size: 13px;
      font-family: 'JetBrains Mono', monospace; font-weight: 500;
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-muted); transition: all 0.2s;
    }
    .tool-badge:hover { border-color: var(--primary); color: var(--primary); }

    /* ===== AGENT PROFILE ===== */
    .agent-profile {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; overflow: hidden;
    }
    .agent-profile-header {
      padding: 32px; display: flex; gap: 24px; align-items: flex-start;
      border-bottom: 1px solid var(--border);
    }
    .agent-avatar {
      width: 72px; height: 72px; border-radius: 16px; flex-shrink: 0;
      background: linear-gradient(135deg, var(--primary-light), ${color}22);
      display: flex; align-items: center; justify-content: center;
      font-size: 32px; border: 1px solid ${color}33;
    }
    .agent-meta { flex: 1; }
    .agent-meta h3 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
    .agent-meta .agent-desc { font-size: 14px; color: var(--text-muted); margin-bottom: 12px; line-height: 1.6; }
    .agent-badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .agent-badge {
      padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.3px;
    }
    .agent-badge.cat { background: ${color}15; color: var(--primary); border: 1px solid ${color}33; }
    .agent-badge.model { background: rgba(34,197,94,0.1); color: var(--success); border: 1px solid rgba(34,197,94,0.2); }
    .agent-badge.rating { background: rgba(234,179,8,0.1); color: var(--warning); border: 1px solid rgba(234,179,8,0.2); }
    .agent-badge.projects { background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); }
    .agent-profile-stats {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 1px; background: var(--border);
    }
    .agent-profile-stat {
      background: var(--bg-card); padding: 20px; text-align: center;
    }
    .agent-profile-stat .val {
      font-size: 20px; font-weight: 700; font-family: 'JetBrains Mono', monospace;
    }
    .agent-profile-stat .lbl {
      font-size: 11px; color: var(--text-dim); margin-top: 4px; text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    /* ===== SKILLS SECTION ===== */
    .skills-grid {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    .skill-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 16px; padding: 28px; transition: all 0.3s;
      position: relative; overflow: hidden;
    }
    .skill-card::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
    }
    .skill-card:hover {
      border-color: var(--border-light); transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .skill-card-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 12px;
    }
    .skill-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
    }
    .skill-card h3 { font-size: 16px; font-weight: 600; }
    .skill-category {
      font-size: 10px; padding: 2px 8px; border-radius: 100px;
      background: rgba(255,255,255,0.05); color: var(--text-dim);
      font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px;
    }
    .skill-card .skill-desc {
      font-size: 13px; color: var(--text-muted); line-height: 1.7; margin-bottom: 12px;
    }
    .skill-card .skill-meta {
      display: flex; gap: 12px; font-size: 11px; color: var(--text-dim);
    }
    .skill-card .skill-meta span {
      display: flex; align-items: center; gap: 4px;
    }

    /* ===== INLINE CHAT SECTION ===== */
    .chat-section {
      padding: 120px 0 100px; position: relative; overflow: hidden;
    }
    .chat-section::before {
      content: ''; position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 80% 60% at 50% 40%, ${color}10 0%, transparent 60%),
        radial-gradient(circle at 20% 80%, ${color}08 0%, transparent 40%),
        radial-gradient(circle at 80% 20%, #a78bfa08 0%, transparent 40%);
      pointer-events: none;
    }
    .chat-section::after {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent 0%, ${color}33 50%, transparent 100%);
    }
    .chat-section-header {
      text-align: center; margin-bottom: 56px; position: relative; z-index: 1;
    }
    .chat-section-label {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 20px; border-radius: 100px; font-size: 12px; font-weight: 600;
      background: linear-gradient(135deg, ${color}18 0%, ${color}08 100%);
      color: var(--primary); border: 1px solid ${color}33;
      text-transform: uppercase; letter-spacing: 1px; margin-bottom: 28px;
    }
    .chat-section-label .pulse-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--success);
      box-shadow: 0 0 8px rgba(34,197,94,0.5); animation: pulse 2s infinite;
    }
    .chat-section-header h2 {
      font-size: clamp(36px, 5vw, 56px); font-weight: 800; line-height: 1.1;
      margin-bottom: 20px;
    }
    .chat-section-header .gradient-text {
      background: linear-gradient(135deg, var(--primary) 0%, #a78bfa 50%, ${color}cc 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-size: 200% auto;
      animation: gradientShift 4s ease infinite;
    }
    @keyframes gradientShift {
      0% { background-position: 0% center; }
      50% { background-position: 100% center; }
      100% { background-position: 0% center; }
    }
    .chat-section-header p {
      font-size: 17px; color: var(--text-muted); max-width: 580px;
      margin: 0 auto; line-height: 1.7;
    }
    .chat-section-badges {
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 24px;
    }
    .chat-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 18px; border-radius: 100px; font-size: 13px; font-weight: 500;
      background: rgba(255,255,255,0.03); border: 1px solid var(--border);
      color: var(--text-muted); backdrop-filter: blur(8px);
    }
    .chat-badge-icon { font-size: 15px; }

    /* Inline Chat Container */
    .inline-chat-wrapper {
      position: relative; z-index: 1; max-width: 820px; margin: 0 auto;
    }
    .inline-chat-glow {
      position: absolute; inset: -2px; border-radius: 26px; z-index: 0;
      background: linear-gradient(135deg, ${color}55 0%, transparent 30%, transparent 70%, #a78bfa44 100%);
      opacity: 0.6; filter: blur(1px);
      animation: glowPulse 4s ease-in-out infinite;
    }
    @keyframes glowPulse {
      0%, 100% { opacity: 0.4; }
      50% { opacity: 0.8; }
    }
    .inline-chat {
      position: relative; z-index: 1; border-radius: 24px; overflow: hidden;
      background: rgba(9,9,11,0.85); border: 1px solid ${color}22;
      backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
      box-shadow:
        0 24px 80px rgba(0,0,0,0.5),
        0 0 60px ${color}08,
        inset 0 1px 0 rgba(255,255,255,0.04);
    }
    .inline-chat-header {
      padding: 18px 24px; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 100%);
    }
    .inline-chat-header-left { display: flex; align-items: center; gap: 14px; }
    .inline-chat-avatar {
      width: 44px; height: 44px; border-radius: 14px;
      background: linear-gradient(135deg, ${color}33 0%, ${color}11 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; border: 1px solid ${color}33;
      box-shadow: 0 0 20px ${color}22;
    }
    .inline-chat-info h4 {
      font-size: 16px; font-weight: 700; margin: 0; color: var(--text);
    }
    .inline-chat-info .online-status {
      font-size: 12px; color: var(--success); display: flex; align-items: center; gap: 5px;
      margin-top: 2px;
    }
    .inline-chat-info .online-dot {
      width: 7px; height: 7px; border-radius: 50%; background: var(--success);
      box-shadow: 0 0 6px rgba(34,197,94,0.5); animation: pulse 2s infinite;
    }
    .inline-chat-header-right { display: flex; align-items: center; gap: 10px; }
    .inline-chat-tag {
      padding: 4px 12px; border-radius: 100px; font-size: 11px; font-weight: 600;
      background: ${color}15; color: var(--primary); border: 1px solid ${color}33;
    }
    .inline-chat-clear-btn {
      padding: 5px 12px; border-radius: 8px; font-size: 11px; font-weight: 500;
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      cursor: pointer; transition: all 0.2s; display: none;
    }
    .inline-chat-clear-btn:hover { border-color: var(--primary); color: var(--primary); }

    /* Messages */
    .inline-chat-messages {
      height: 420px; overflow-y: auto; padding: 24px; scroll-behavior: smooth;
      background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 20%, transparent 80%, rgba(0,0,0,0.1) 100%);
    }
    .inline-chat-messages::-webkit-scrollbar { width: 4px; }
    .inline-chat-messages::-webkit-scrollbar-track { background: transparent; }
    .inline-chat-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    .inline-chat-messages::-webkit-scrollbar-thumb:hover { background: var(--border-light); }

    .inline-welcome {
      text-align: center; padding: 40px 20px;
    }
    .inline-welcome-avatar {
      width: 72px; height: 72px; border-radius: 20px; margin: 0 auto 20px;
      background: linear-gradient(135deg, ${color}33 0%, ${color}11 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 36px; border: 1px solid ${color}33;
      box-shadow: 0 0 40px ${color}22, 0 8px 32px rgba(0,0,0,0.3);
    }
    .inline-welcome h3 {
      font-size: 20px; font-weight: 700; margin-bottom: 8px;
    }
    .inline-welcome p {
      font-size: 14px; color: var(--text-muted); margin-bottom: 4px;
    }
    .inline-welcome .sub {
      font-size: 12px; color: var(--text-dim); margin-bottom: 28px;
    }
    .inline-suggestions {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
      max-width: 440px; margin: 0 auto;
    }
    .inline-suggestion {
      padding: 12px 16px; border-radius: 12px; font-size: 13px; font-weight: 500;
      background: rgba(255,255,255,0.03); border: 1px solid var(--border);
      color: var(--text-muted); cursor: pointer; transition: all 0.25s;
      text-align: left; display: flex; align-items: center; gap: 8px;
    }
    .inline-suggestion:hover {
      border-color: var(--primary); color: var(--primary);
      background: ${color}08; transform: translateY(-1px);
      box-shadow: 0 4px 16px ${color}11;
    }
    .inline-suggestion .sug-icon { font-size: 16px; flex-shrink: 0; }

    .ic-msg {
      display: flex; gap: 12px; margin-bottom: 18px; animation: icMsgIn 0.35s ease;
    }
    .ic-msg.user { flex-direction: row-reverse; }
    @keyframes icMsgIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .ic-msg-avatar {
      width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 15px;
    }
    .ic-msg.user .ic-msg-avatar {
      background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
      border: 1px solid rgba(255,255,255,0.08);
    }
    .ic-msg.assistant .ic-msg-avatar {
      background: linear-gradient(135deg, ${color}33, ${color}11);
      border: 1px solid ${color}33;
    }
    .ic-msg-bubble {
      max-width: 78%; padding: 12px 18px; font-size: 14px; line-height: 1.7;
      word-break: break-word; white-space: pre-wrap;
    }
    .ic-msg.user .ic-msg-bubble {
      background: linear-gradient(135deg, ${color}22 0%, ${color}11 100%);
      border: 1px solid ${color}33; border-radius: 18px 18px 4px 18px;
      color: var(--text);
    }
    .ic-msg.assistant .ic-msg-bubble {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 18px 18px 18px 4px; color: var(--text-muted);
    }
    .ic-cursor {
      display: inline-block; width: 2px; height: 16px; background: var(--primary);
      margin-left: 2px; vertical-align: text-bottom;
      animation: blink 0.8s infinite; box-shadow: 0 0 6px ${color}66;
    }
    .ic-typing { display: flex; gap: 5px; padding: 12px 18px; }
    .ic-typing span {
      width: 7px; height: 7px; border-radius: 50%; background: var(--text-dim);
      animation: typing 1.4s infinite;
    }
    .ic-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ic-typing span:nth-child(3) { animation-delay: 0.4s; }

    /* Input area */
    .inline-chat-input-area {
      padding: 18px 24px; border-top: 1px solid rgba(255,255,255,0.06);
      display: flex; gap: 10px; align-items: center;
      background: linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.02) 100%);
    }
    .inline-chat-input {
      flex: 1; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px; padding: 14px 18px; font-size: 14px;
      color: var(--text); outline: none; font-family: 'Inter', sans-serif;
      transition: all 0.25s;
    }
    .inline-chat-input:focus {
      border-color: ${color}55; background: rgba(255,255,255,0.06);
      box-shadow: 0 0 0 3px ${color}15;
    }
    .inline-chat-input::placeholder { color: var(--text-dim); }
    .inline-chat-send {
      width: 48px; height: 48px; border-radius: 14px; border: none;
      background: linear-gradient(135deg, var(--primary) 0%, ${color}cc 100%);
      color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.25s; font-size: 18px; flex-shrink: 0;
      box-shadow: 0 4px 16px ${color}33;
    }
    .inline-chat-send:hover { box-shadow: 0 6px 24px ${color}55; transform: scale(1.04); }
    .inline-chat-send:disabled { opacity: 0.3; cursor: default; box-shadow: none; transform: none; }
    .inline-chat-footer {
      padding: 10px 24px 14px; display: flex; justify-content: center; gap: 16px;
      font-size: 11px; color: var(--text-dim);
    }
    .inline-chat-footer span {
      display: flex; align-items: center; gap: 4px;
    }

    @media (max-width: 768px) {
      .chat-section { padding: 80px 0 60px; }
      .inline-chat-messages { height: 350px; }
      .inline-suggestions { grid-template-columns: 1fr; }
      .inline-chat-wrapper { margin: 0 -8px; }
    }

    /* ===== FOOTER ===== */
    footer {
      border-top: 1px solid var(--border); padding: 40px 0;
      text-align: center; color: var(--text-dim); font-size: 13px;
    }
    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }

    /* ===== FLOATING CHAT ===== */
    .chat-fab {
      position: fixed; bottom: 28px; right: 28px; z-index: 999;
      width: 60px; height: 60px; border-radius: 50%;
      background: var(--primary); color: #fff; border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 24px ${color}55, 0 0 0 0 ${color}33;
      transition: all 0.3s; font-size: 26px;
    }
    .chat-fab:hover { transform: scale(1.08); box-shadow: 0 6px 32px ${color}77; }
    .chat-fab-pulse {
      position: absolute; inset: -4px; border-radius: 50%;
      border: 2px solid var(--primary); animation: fabPulse 2s infinite;
      pointer-events: none;
    }
    @keyframes fabPulse {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.4); opacity: 0; }
    }
    .chat-float {
      position: fixed; bottom: 100px; right: 28px; z-index: 1000;
      width: 420px; height: 560px; border-radius: 20px;
      background: var(--bg); border: 1px solid var(--border);
      box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${color}15;
      display: flex; flex-direction: column; overflow: hidden;
      animation: chatIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
    }
    @keyframes chatIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .chat-header {
      padding: 14px 18px; border-bottom: 1px solid var(--border);
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(255,255,255,0.02); flex-shrink: 0;
    }
    .chat-header-left { display: flex; align-items: center; gap: 10px; }
    .chat-avatar-sm {
      width: 32px; height: 32px; border-radius: 10px;
      background: linear-gradient(135deg, var(--primary-light), ${color}22);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; border: 1px solid ${color}33;
    }
    .chat-header h3 { font-size: 14px; font-weight: 600; margin: 0; }
    .chat-clear {
      background: none; border: 1px solid var(--border); border-radius: 6px;
      color: var(--text-dim); font-size: 10px; padding: 3px 8px; cursor: pointer;
      transition: all 0.2s;
    }
    .chat-clear:hover { border-color: var(--primary); color: var(--primary); }
    .chat-close {
      background: none; border: none; color: var(--text-dim); font-size: 16px;
      cursor: pointer; padding: 4px 6px; border-radius: 6px; transition: all 0.2s;
      line-height: 1;
    }
    .chat-close:hover { background: rgba(255,255,255,0.05); color: var(--text); }
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 18px; scroll-behavior: smooth;
    }
    .chat-empty { text-align: center; padding: 30px 16px; }
    .chat-empty-icon { font-size: 36px; margin-bottom: 12px; opacity: 0.15; }
    .chat-empty p { color: var(--text-muted); font-size: 14px; margin-bottom: 6px; }
    .chat-empty .sub { color: var(--text-dim); font-size: 11px; }
    .chat-suggestions {
      display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 16px;
    }
    .chat-suggestion {
      padding: 5px 12px; border-radius: 100px; font-size: 11px;
      background: transparent; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; transition: all 0.2s;
    }
    .chat-suggestion:hover {
      border-color: var(--primary); color: var(--primary); background: var(--primary-light);
    }
    .chat-msg {
      display: flex; gap: 10px; margin-bottom: 14px; animation: msgIn 0.3s ease;
    }
    .chat-msg.user { flex-direction: row-reverse; }
    @keyframes msgIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .chat-msg-avatar {
      width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 13px;
    }
    .chat-msg.user .chat-msg-avatar { background: rgba(255,255,255,0.08); }
    .chat-msg.assistant .chat-msg-avatar { background: var(--primary-light); }
    .chat-msg-bubble {
      max-width: 82%; padding: 10px 14px; font-size: 13px; line-height: 1.7;
      white-space: pre-wrap; word-break: break-word;
    }
    .chat-msg.user .chat-msg-bubble {
      background: var(--primary-light); border: 1px solid ${color}33;
      border-radius: 14px 14px 4px 14px; color: var(--text);
    }
    .chat-msg.assistant .chat-msg-bubble {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 14px 14px 14px 4px; color: var(--text-muted);
    }
    .chat-cursor {
      display: inline-block; width: 2px; height: 14px; background: var(--primary);
      margin-left: 2px; vertical-align: text-bottom;
      animation: blink 0.8s infinite;
    }
    @keyframes blink { 0%,100%{opacity:1;} 50%{opacity:0;} }
    .chat-typing-dots { display: flex; gap: 4px; padding: 10px 14px; }
    .chat-typing-dots span {
      width: 6px; height: 6px; border-radius: 50%; background: var(--text-dim);
      animation: typing 1.4s infinite;
    }
    .chat-typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .chat-typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing {
      0%,60%,100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-4px); }
    }
    .chat-input-area {
      padding: 12px 18px; border-top: 1px solid var(--border);
      display: flex; gap: 8px; flex-shrink: 0;
    }
    .chat-input {
      flex: 1; background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 10px 14px; font-size: 13px;
      color: var(--text); outline: none; font-family: inherit;
      transition: border-color 0.2s;
    }
    .chat-input:focus { border-color: var(--primary); }
    .chat-input::placeholder { color: var(--text-dim); }
    .chat-send {
      width: 40px; height: 40px; border-radius: 10px; border: none;
      background: var(--primary); color: #fff; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.2s; font-size: 16px;
    }
    .chat-send:hover { opacity: 0.9; box-shadow: 0 0 16px ${color}44; }
    .chat-send:disabled { opacity: 0.3; cursor: default; box-shadow: none; }

    @media (max-width: 768px) {
      .chat-float {
        width: calc(100vw - 24px); right: 12px; bottom: 80px;
        height: calc(100vh - 120px); max-height: 500px;
      }
      .chat-fab { bottom: 16px; right: 16px; width: 52px; height: 52px; font-size: 22px; }
    }

    /* ===== AUTH NAV ===== */
    .nav-auth { display: flex; align-items: center; gap: 10px; }
    .nav-wallet-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600;
      background: linear-gradient(135deg, ${color}18 0%, ${color}08 100%);
      color: var(--primary); border: 1px solid ${color}33;
      cursor: pointer; transition: all 0.2s;
      font-family: 'JetBrains Mono', monospace;
    }
    .nav-wallet-badge:hover { border-color: var(--primary); background: ${color}22; }
    .nav-user-badge {
      display: flex; align-items: center; gap: 8px; padding: 6px 14px;
      border-radius: 100px; background: var(--bg-card); border: 1px solid var(--border);
      font-size: 12px; color: var(--text-muted); cursor: default;
    }
    .nav-user-dot {
      width: 8px; height: 8px; border-radius: 50%; background: var(--success);
      box-shadow: 0 0 6px rgba(34,197,94,0.4);
    }
    .btn-signin {
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: transparent; color: var(--text); border: 1px solid var(--border);
      cursor: pointer; transition: all 0.2s;
    }
    .btn-signin:hover { border-color: var(--primary); color: var(--primary); }
    .btn-logout {
      padding: 6px 12px; border-radius: 6px; font-size: 11px;
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      cursor: pointer; transition: all 0.2s;
    }
    .btn-logout:hover { border-color: var(--error); color: var(--error); }

    /* ===== LOGIN MODAL ===== */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0,0,0,0.7); backdrop-filter: blur(8px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    .modal-card {
      width: 420px; max-width: 95vw; border-radius: 20px;
      background: var(--bg-card); border: 1px solid var(--border);
      box-shadow: 0 24px 80px rgba(0,0,0,0.6), 0 0 60px ${color}08;
      animation: modalIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
      overflow: hidden;
    }
    @keyframes modalIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-header {
      padding: 28px 28px 0; display: flex; justify-content: space-between; align-items: flex-start;
    }
    .modal-header h2 { font-size: 22px; font-weight: 700; }
    .modal-header p { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
    .modal-close {
      background: none; border: none; color: var(--text-dim); font-size: 20px;
      cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: all 0.2s;
    }
    .modal-close:hover { background: rgba(255,255,255,0.05); color: var(--text); }
    .modal-body { padding: 24px 28px 28px; }
    .form-group { margin-bottom: 16px; }
    .form-label {
      display: block; font-size: 12px; font-weight: 600; color: var(--text-muted);
      margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .form-input {
      width: 100%; padding: 12px 16px; border-radius: 10px; font-size: 14px;
      background: var(--bg); border: 1px solid var(--border); color: var(--text);
      outline: none; font-family: inherit; transition: all 0.2s;
    }
    .form-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px ${color}15; }
    .form-input::placeholder { color: var(--text-dim); }
    .form-error {
      margin-top: 6px; font-size: 12px; color: var(--error); display: none;
    }
    .form-submit {
      width: 100%; padding: 12px; border-radius: 10px; font-size: 14px; font-weight: 600;
      background: var(--primary); color: #fff; border: none; cursor: pointer;
      transition: all 0.2s; margin-top: 8px;
    }
    .form-submit:hover { opacity: 0.9; box-shadow: 0 0 20px ${color}33; }
    .form-submit:disabled { opacity: 0.5; cursor: default; }
    .form-switch {
      text-align: center; margin-top: 16px; font-size: 13px; color: var(--text-muted);
    }
    .form-switch a {
      color: var(--primary); cursor: pointer; text-decoration: none; font-weight: 500;
    }
    .form-switch a:hover { text-decoration: underline; }

    /* ===== ACCESS / PURCHASE SECTION ===== */
    .access-section { padding: 80px 0; position: relative; }
    .access-section::before {
      content: ''; position: absolute; inset: 0;
      background: radial-gradient(ellipse 80% 50% at 50% 50%, ${color}08 0%, transparent 60%);
      pointer-events: none;
    }
    .access-card {
      max-width: 720px; margin: 0 auto; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 20px; overflow: hidden;
      position: relative;
    }
    .access-card.purchased { border-color: var(--success); box-shadow: 0 0 40px rgba(34,197,94,0.1); }
    .access-header {
      padding: 36px 36px 0; text-align: center;
    }
    .access-header h2 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .access-header p { font-size: 15px; color: var(--text-muted); }
    .access-price-row {
      display: flex; align-items: center; justify-content: center; gap: 16px;
      padding: 28px 36px; border-bottom: 1px solid var(--border);
    }
    .access-price {
      font-size: 48px; font-weight: 800; font-family: 'JetBrains Mono', monospace;
      color: var(--primary);
    }
    .access-price span { font-size: 16px; font-weight: 400; color: var(--text-muted); }
    .access-features {
      padding: 28px 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
    }
    .access-feature {
      display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--text-muted);
    }
    .access-feature-icon { color: var(--primary); font-size: 16px; }
    .access-actions {
      padding: 20px 36px 32px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    }
    .btn-purchase {
      width: 100%; max-width: 400px; padding: 16px; border-radius: 12px;
      font-size: 16px; font-weight: 700; border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: all 0.3s;
      background: linear-gradient(135deg, var(--primary) 0%, #a78bfa 100%);
      color: #fff; box-shadow: 0 4px 24px ${color}33;
    }
    .btn-purchase:hover { box-shadow: 0 8px 40px ${color}55; transform: translateY(-2px); }
    .btn-purchase:disabled { opacity: 0.5; cursor: default; transform: none; box-shadow: none; }
    .btn-purchase.purchased-btn {
      background: linear-gradient(135deg, var(--success), #22c55ecc);
      box-shadow: 0 4px 24px rgba(34,197,94,0.3);
    }
    .access-balance {
      font-size: 13px; color: var(--text-dim); display: flex; align-items: center; gap: 6px;
    }
    .access-balance strong { color: var(--text-muted); font-family: 'JetBrains Mono', monospace; }

    /* ===== API KEYS SECTION ===== */
    .apikeys-section { padding: 60px 0; }
    .apikeys-card {
      max-width: 820px; margin: 0 auto; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
    }
    .apikeys-header {
      padding: 28px 28px 0; display: flex; justify-content: space-between;
      align-items: center; flex-wrap: wrap; gap: 12px;
    }
    .apikeys-header h3 { font-size: 20px; font-weight: 700; }
    .btn-generate {
      padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 600;
      background: var(--primary); color: #fff; border: none; cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; gap: 6px;
    }
    .btn-generate:hover { opacity: 0.9; box-shadow: 0 0 16px ${color}33; }
    .btn-generate:disabled { opacity: 0.5; cursor: default; }
    .apikeys-list { padding: 20px 28px 28px; }
    .apikey-row {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 14px 16px; border-radius: 10px; border: 1px solid var(--border);
      margin-bottom: 8px; transition: all 0.2s;
    }
    .apikey-row:hover { border-color: var(--border-light); }
    .apikey-info { flex: 1; min-width: 0; }
    .apikey-name { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 2px; }
    .apikey-prefix {
      font-size: 12px; font-family: 'JetBrains Mono', monospace;
      color: var(--text-dim); display: flex; align-items: center; gap: 6px;
    }
    .apikey-actions { display: flex; gap: 6px; flex-shrink: 0; }
    .apikey-btn {
      padding: 6px 10px; border-radius: 6px; font-size: 11px;
      background: none; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; transition: all 0.2s;
    }
    .apikey-btn:hover { border-color: var(--primary); color: var(--primary); }
    .apikey-btn.danger:hover { border-color: var(--error); color: var(--error); }
    .apikeys-empty {
      text-align: center; padding: 40px 20px; color: var(--text-dim); font-size: 14px;
    }
    .new-token-banner {
      margin: 16px 28px; padding: 16px; border-radius: 12px;
      background: linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05));
      border: 1px solid rgba(34,197,94,0.3);
    }
    .new-token-banner p { font-size: 12px; color: var(--success); margin-bottom: 8px; font-weight: 600; }
    .new-token-value {
      display: flex; align-items: center; gap: 8px; padding: 10px 14px;
      background: var(--bg); border: 1px solid rgba(34,197,94,0.2); border-radius: 8px;
    }
    .new-token-value code {
      flex: 1; font-size: 12px; font-family: 'JetBrains Mono', monospace;
      color: var(--success); word-break: break-all;
    }
    .new-token-value button {
      padding: 4px 10px; border-radius: 6px; font-size: 11px;
      background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);
      color: var(--success); cursor: pointer; transition: all 0.2s; flex-shrink: 0;
    }
    .new-token-value button:hover { background: rgba(34,197,94,0.25); }
    .new-token-warning {
      margin-top: 10px; font-size: 11px; color: var(--warning);
      display: flex; align-items: center; gap: 6px;
    }

    /* ===== REQUEST LOGS TABLE ===== */
    .logs-section { padding: 60px 0; }
    .logs-card {
      max-width: 960px; margin: 0 auto; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
    }
    .logs-header {
      padding: 24px 28px; display: flex; justify-content: space-between;
      align-items: center; border-bottom: 1px solid var(--border);
    }
    .logs-header h3 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .logs-header .log-count {
      font-size: 11px; padding: 3px 10px; border-radius: 100px;
      background: var(--primary-light); color: var(--primary); font-weight: 600;
    }
    .logs-refresh {
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 500;
      background: none; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 5px;
    }
    .logs-refresh:hover { border-color: var(--primary); color: var(--primary); }
    .logs-table-wrap { overflow-x: auto; }
    .logs-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .logs-table th {
      padding: 12px 16px; text-align: left; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-dim);
      background: rgba(255,255,255,0.02); border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .logs-table td {
      padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
      color: var(--text-muted); white-space: nowrap;
    }
    .logs-table tr:hover td { background: rgba(255,255,255,0.02); }
    .logs-table .log-time {
      font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-dim);
    }
    .logs-table .log-endpoint {
      font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--primary);
    }
    .logs-table .log-tokens {
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
    }
    .log-status {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 600;
    }
    .log-status.ok { background: rgba(34,197,94,0.1); color: var(--success); }
    .log-status.err { background: rgba(239,68,68,0.1); color: var(--error); }
    .log-status.limit { background: rgba(234,179,8,0.1); color: var(--warning); }
    .logs-empty {
      padding: 48px 20px; text-align: center; color: var(--text-dim); font-size: 14px;
    }
    .logs-empty-icon { font-size: 32px; margin-bottom: 12px; opacity: 0.3; }

    /* ===== PROMPT SECTION ===== */
    .prompt-section { padding: 60px 0; }
    .prompt-card {
      max-width: 960px; margin: 0 auto; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
    }
    .prompt-header {
      padding: 24px 28px; display: flex; justify-content: space-between;
      align-items: center; border-bottom: 1px solid var(--border);
    }
    .prompt-header h3 { font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .prompt-header .prompt-tokens {
      font-size: 11px; padding: 3px 10px; border-radius: 100px;
      background: rgba(34,197,94,0.1); color: var(--success); font-weight: 600;
      font-family: 'JetBrains Mono', monospace;
    }
    .prompt-actions { display: flex; gap: 8px; }
    .prompt-copy-btn {
      padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
      background: var(--primary); color: #fff; border: none; cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; gap: 5px;
    }
    .prompt-copy-btn:hover { opacity: 0.9; box-shadow: 0 0 16px ${color}33; }
    .prompt-body {
      padding: 0; max-height: 500px; overflow-y: auto; position: relative;
    }
    .prompt-body pre {
      padding: 24px 28px; margin: 0; font-family: 'JetBrains Mono', monospace;
      font-size: 12px; line-height: 1.8; color: var(--text-muted);
      white-space: pre-wrap; word-break: break-word;
      background: rgba(0,0,0,0.2);
    }
    .prompt-body::-webkit-scrollbar { width: 6px; }
    .prompt-body::-webkit-scrollbar-track { background: transparent; }
    .prompt-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    .prompt-fade {
      position: absolute; bottom: 0; left: 0; right: 0; height: 60px;
      background: linear-gradient(transparent, var(--bg-card));
      pointer-events: none;
    }
    .prompt-toggle {
      padding: 12px 28px; text-align: center; border-top: 1px solid var(--border);
    }
    .prompt-toggle button {
      padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 500;
      background: none; border: 1px solid var(--border); color: var(--text-muted);
      cursor: pointer; transition: all 0.2s;
    }
    .prompt-toggle button:hover { border-color: var(--primary); color: var(--primary); }

    /* ===== TOAST ===== */
    .mcp-toast {
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      z-index: 3000; padding: 12px 24px; border-radius: 12px;
      display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500;
      backdrop-filter: blur(12px); animation: toastIn 0.3s ease;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .mcp-toast.success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: var(--success); }
    .mcp-toast.error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: var(--error); }
    @keyframes toastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }

    /* ===== RESPONSIVE ===== */
    @media (max-width: 768px) {
      .hero { padding: 120px 0 60px; }
      .hero h1 { font-size: 36px; }
      .capabilities-grid { grid-template-columns: 1fr; }
      .pricing-grid { grid-template-columns: 1fr; }
      .stats-row { grid-template-columns: 1fr 1fr; }
      .skills-grid { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .agent-profile-header { flex-direction: column; }
      .access-features { grid-template-columns: 1fr; }
      .nav-user-badge { display: none; }
      .access-card { margin: 0 -8px; }
      .apikeys-card { margin: 0 -8px; }
      .apikey-row { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <!-- NAV -->
  <nav>
    <div class="container">
      <a class="nav-logo" href="/mcp/${deployment.slug}">
        <span class="dot"></span>
        ${agentName}
        <span class="nav-badge">MCP</span>
      </a>
      <div class="nav-links">
        <a href="#try-chat" style="color:var(--primary);font-weight:600">Try Chat</a>
        <a href="#agent">Agent</a>
        <a href="#prompt">Prompt</a>
        <a href="#logs">Logs</a>
        <a href="#access">Access</a>
      </div>
      <div class="nav-auth" id="nav-auth">
        <button class="btn-primary" onclick="toggleChat()" style="margin-right:4px">&#x1f4ac; Chat Now</button>
        <!-- Logged out state -->
        <button class="btn-signin" id="nav-signin" onclick="openLogin()">Sign In</button>
        <!-- Logged in state (hidden by default) -->
        <div id="nav-logged" style="display:none;align-items:center;gap:10px">
          <div class="nav-wallet-badge" id="nav-wallet" onclick="scrollToAccess()" title="Your balance">
            &#x1fa99; <span id="nav-balance">0</span> credits
          </div>
          <span class="nav-user-badge" id="nav-user"><span class="nav-user-dot"></span><span id="nav-email"></span></span>
          <button class="btn-logout" onclick="doLogout()">Logout</button>
        </div>
      </div>
    </div>
  </nav>

  <!-- LOGIN MODAL -->
  <div class="modal-overlay" id="login-modal" style="display:none" onclick="if(event.target===this)closeLogin()">
    <div class="modal-card">
      <div class="modal-header">
        <div>
          <h2 id="modal-title">Sign In</h2>
          <p id="modal-subtitle">Access your wallet and API keys</p>
        </div>
        <button class="modal-close" onclick="closeLogin()">&#x2715;</button>
      </div>
      <div class="modal-body">
        <form id="login-form" onsubmit="handleAuth(event)">
          <div class="form-group" id="fg-name" style="display:none">
            <label class="form-label">Display Name</label>
            <input class="form-input" type="text" id="auth-name" placeholder="Your name">
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-input" type="email" id="auth-email" placeholder="you@example.com" required>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input class="form-input" type="password" id="auth-password" placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" required>
          </div>
          <div class="form-error" id="auth-error"></div>
          <button class="form-submit" type="submit" id="auth-submit">Sign In</button>
          <div class="form-switch">
            <span id="auth-switch-text">Don't have an account?</span>
            <a id="auth-switch-link" onclick="toggleAuthMode()">Create one</a>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- HERO -->
  <section class="hero">
    <div class="container">
      <div class="hero-badge">
        <span class="status-dot"></span>
        ${deployment.status === 'active' ? 'Live' : 'Paused'} &middot; ${tierLabels[deployment.tier] || 'Starter'} Tier
      </div>
      <h1>${agentName}<br>MCP Server</h1>
      <p>${tagline}</p>
      <div class="hero-buttons">
        <button class="btn-primary" onclick="toggleChat()" style="padding:12px 28px;font-size:16px;font-weight:600">&#x1f4ac; Talk to ${agentName}</button>
        <a class="btn-outline" href="#setup" style="padding:12px 28px;font-size:16px">Get API Key</a>
      </div>
    </div>
  </section>

  <!-- STATS -->
  <div class="container">
    <div class="stats-row">
      <div class="stat-card">
        <div class="value">${formatNumber(stats.totalRequests || 0)}</div>
        <div class="label">Total Requests</div>
      </div>
      <div class="stat-card">
        <div class="value">${safeSkills.length}</div>
        <div class="label">Skills Loaded</div>
      </div>
      <div class="stat-card">
        <div class="value">${formatTokens(promptTokens + totalSkillTokens)}</div>
        <div class="label">Knowledge Tokens</div>
      </div>
      <div class="stat-card">
        <div class="value">${model}</div>
        <div class="label">AI Model</div>
      </div>
    </div>
  </div>

  <!-- AGENT PROFILE -->
  <section class="section" id="agent">
    <div class="container">
      <div class="section-header">
        <h2>About This Agent</h2>
        <p>Deep expertise encoded as a deployable AI service</p>
      </div>
      <div class="agent-profile">
        <div class="agent-profile-header">
          <div class="agent-avatar">&#x1f916;</div>
          <div class="agent-meta">
            <h3>${agentName}</h3>
            <p class="agent-desc">${description}</p>
            <div class="agent-badges">
              <span class="agent-badge cat">${escapeHtml(category)}</span>
              <span class="agent-badge model">${escapeHtml(model)}</span>
              ${agent.rating > 0 ? `<span class="agent-badge rating">${'&#9733;'.repeat(agent.rating)}${'&#9734;'.repeat(5 - agent.rating)}</span>` : ''}
              ${projectCount > 0 ? `<span class="agent-badge projects">${projectCount} project${projectCount > 1 ? 's' : ''}</span>` : ''}
              ${safeSkills.length > 0 ? `<span class="agent-badge cat">${safeSkills.length} skill${safeSkills.length > 1 ? 's' : ''}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="agent-profile-stats">
          <div class="agent-profile-stat">
            <div class="val">${formatTokens(promptTokens)}</div>
            <div class="lbl">Core Prompt</div>
          </div>
          <div class="agent-profile-stat">
            <div class="val">${formatTokens(totalSkillTokens)}</div>
            <div class="lbl">Skill Knowledge</div>
          </div>
          <div class="agent-profile-stat">
            <div class="val">${formatTokens(promptTokens + totalSkillTokens)}</div>
            <div class="lbl">Total Context</div>
          </div>
          <div class="agent-profile-stat">
            <div class="val">${tools.length || 0}</div>
            <div class="lbl">Tools</div>
          </div>
          ${agent.memory ? `<div class="agent-profile-stat">
            <div class="val" style="font-size:14px">${escapeHtml(agent.memory)}</div>
            <div class="lbl">Memory</div>
          </div>` : ''}
          ${agent.permission_mode ? `<div class="agent-profile-stat">
            <div class="val" style="font-size:14px">${escapeHtml(agent.permission_mode)}</div>
            <div class="lbl">Permission</div>
          </div>` : ''}
        </div>
      </div>

      ${tools.length > 0 ? `
      <div style="margin-top: 24px">
        <h3 style="font-size: 15px; font-weight: 600; margin-bottom: 12px; color: var(--text-dim)">Agent Tools</h3>
        <div class="tools-grid" style="justify-content: flex-start">
          ${tools.map(t => `<span class="tool-badge">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </section>

  <!-- SKILLS -->
  ${safeSkills.length > 0 ? `
  <section class="section" id="skills">
    <div class="container">
      <div class="section-header">
        <h2>Loaded Skills</h2>
        <p>${safeSkills.length} specialized skill${safeSkills.length > 1 ? 's' : ''} injected into every conversation</p>
      </div>
      <div class="skills-grid">
        ${safeSkills.map(s => `
        <div class="skill-card" style="border-top: 3px solid ${s.color}">
          <div class="skill-card-header">
            <div class="skill-dot" style="background: ${s.color}; box-shadow: 0 0 8px ${s.color}66"></div>
            <h3>${s.name}</h3>
            <span class="skill-category">${s.category}</span>
          </div>
          ${s.description ? `<p class="skill-desc">${s.description}</p>` : ''}
          <div class="skill-meta">
            <span>&#x1f4dd; ${formatTokens(Math.round(s.promptLength / 4))} tokens</span>
          </div>
        </div>
        `).join('')}
      </div>
    </div>
  </section>
  ` : ''}

  <!-- AGENT PROMPT (copy-paste) -->
  <section class="prompt-section" id="prompt">
    <div class="container">
      <div class="prompt-card">
        <div class="prompt-header">
          <h3>&#x1f4cb; Agent Prompt <span class="prompt-tokens" id="prompt-token-count">${formatTokens(promptTokens + totalSkillTokens)} tokens</span></h3>
          <div class="prompt-actions">
            <button class="prompt-copy-btn" id="prompt-copy-btn" onclick="copyPrompt()">&#x1f4cb; Copy Prompt</button>
          </div>
        </div>
        <div class="prompt-body" id="prompt-body" style="max-height:300px">
          <pre id="prompt-content">Loading prompt...</pre>
          <div class="prompt-fade" id="prompt-fade"></div>
        </div>
        <div class="prompt-toggle">
          <button id="prompt-expand-btn" onclick="togglePrompt()">Show full prompt</button>
        </div>
      </div>
    </div>
  </section>

  <!-- INLINE CHAT SECTION -->
  <section class="chat-section" id="try-chat">
    <div class="container">
      <div class="chat-section-header">
        <div class="chat-section-label">
          <span class="pulse-dot"></span>
          Live Demo
        </div>
        <h2>Start talking to <span class="gradient-text">${agentName}</span></h2>
        <p>${formatTokens(promptTokens + totalSkillTokens)} tokens of deep knowledge${safeSkills.length > 0 ? `, ${safeSkills.length} specialized skill${safeSkills.length > 1 ? 's' : ''}` : ''} — all injected into every response. Try it now, no signup needed.</p>
        <div class="chat-section-badges">
          <span class="chat-badge"><span class="chat-badge-icon">&#x1f9e0;</span> ${formatTokens(promptTokens + totalSkillTokens)} tokens</span>
          ${safeSkills.length > 0 ? `<span class="chat-badge"><span class="chat-badge-icon">&#x26a1;</span> ${safeSkills.length} skill${safeSkills.length > 1 ? 's' : ''}</span>` : ''}
          <span class="chat-badge"><span class="chat-badge-icon">&#x2705;</span> Free &middot; 20 msgs</span>
        </div>
      </div>

      <div class="inline-chat-wrapper">
        <div class="inline-chat-glow"></div>
        <div class="inline-chat">
          <div class="inline-chat-header">
            <div class="inline-chat-header-left">
              <div class="inline-chat-avatar">&#x1f916;</div>
              <div class="inline-chat-info">
                <h4>${agentName}</h4>
                <div class="online-status">
                  <span class="online-dot"></span>
                  Online &middot; ${formatTokens(promptTokens + totalSkillTokens)} tokens loaded
                </div>
              </div>
            </div>
            <div class="inline-chat-header-right">
              <span class="inline-chat-tag">${escapeHtml(category)}</span>
              <button class="inline-chat-clear-btn" id="ic-clear" onclick="icClear()">Clear</button>
            </div>
          </div>
          <div class="inline-chat-messages" id="ic-messages">
            <div class="inline-welcome" id="ic-welcome">
              <div class="inline-welcome-avatar">&#x1f916;</div>
              <h3>Chat with ${agentName}</h3>
              <p>Full agent prompt + all skills loaded into context</p>
              <div class="sub">${escapeHtml(model)} model &middot; ${formatTokens(promptTokens + totalSkillTokens)} context tokens &middot; Real-time responses</div>
              <div class="inline-suggestions">
                <button class="inline-suggestion" onclick="icFill('What can you do?')">
                  <span class="sug-icon">&#x1f4a1;</span> What can you do?
                </button>
                <button class="inline-suggestion" onclick="icFill('List your skills and expertise')">
                  <span class="sug-icon">&#x26a1;</span> List your skills
                </button>
                <button class="inline-suggestion" onclick="icFill('Help me get started with a project')">
                  <span class="sug-icon">&#x1f680;</span> Help me get started
                </button>
                <button class="inline-suggestion" onclick="icFill('What makes you different from other AI agents?')">
                  <span class="sug-icon">&#x2728;</span> What makes you special?
                </button>
              </div>
            </div>
          </div>
          <div class="inline-chat-input-area">
            <input class="inline-chat-input" id="ic-input" type="text"
              placeholder="Ask ${agentName} anything..."
              autocomplete="off"
              onkeydown="if(event.key==='Enter'&&!event.shiftKey)icSend()">
            <button class="inline-chat-send" id="ic-send" onclick="icSend()" title="Send">&#x27A4;</button>
          </div>
          <div class="inline-chat-footer">
            <span>&#x1f512; No data stored</span>
            <span>&#x26a1; Powered by ${escapeHtml(model)}</span>
            <span>&#x1f916; Full agent context</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CAPABILITIES -->
  <section class="section" id="capabilities">
    <div class="container">
      <div class="section-header">
        <h2>MCP Capabilities</h2>
        <p>Built-in features for every deployed agent</p>
      </div>
      <div class="capabilities-grid">
        <div class="capability-card">
          <div class="capability-icon">&#x1f4ac;</div>
          <h3>Conversational API</h3>
          <p>Send messages via REST API. Full multi-turn context with the agent's ${formatTokens(promptTokens + totalSkillTokens)}-token system prompt and ${safeSkills.length} skill${safeSkills.length !== 1 ? 's' : ''} automatically injected.</p>
        </div>
        <div class="capability-card">
          <div class="capability-icon">&#x1f9e0;</div>
          <h3>Deep Domain Knowledge</h3>
          <p>${agentName} has ${formatTokens(promptTokens)} tokens of core expertise${safeSkills.length > 0 ? ` plus ${formatTokens(totalSkillTokens)} tokens across ${safeSkills.length} specialized skills` : ''}. Every response is grounded in this knowledge.</p>
        </div>
        <div class="capability-card">
          <div class="capability-icon">&#x1f4ca;</div>
          <h3>Token Tracking</h3>
          <p>Real-time monitoring of input/output tokens, request counts, success/error rates. Full visibility into your API consumption.</p>
        </div>
        <div class="capability-card">
          <div class="capability-icon">&#x1f512;</div>
          <h3>API Key Auth</h3>
          <p>Secure Bearer token authentication. Generate multiple keys, revoke individually, track last-used timestamps per key.</p>
        </div>
        <div class="capability-card">
          <div class="capability-icon">&#x26a1;</div>
          <h3>Rate Limiting</h3>
          <p>Automatic monthly token limits per tier (${formatTokens(deployment.monthly_token_limit)}). Graceful 429 responses when limits are reached.</p>
        </div>
        <div class="capability-card">
          <div class="capability-icon">&#x1f310;</div>
          <h3>OpenAI-Compatible</h3>
          <p>REST endpoints with JSON request/response format matching OpenAI conventions. Works with any HTTP client or SDK.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FLOATING CHAT WIDGET -->
  <div class="chat-fab" id="chat-fab" onclick="toggleChat()">
    <span class="chat-fab-icon" id="chat-fab-icon">&#x1f4ac;</span>
    <span class="chat-fab-pulse"></span>
  </div>

  <div class="chat-float" id="chat-float" style="display:none">
    <div class="chat-header">
      <div class="chat-header-left">
        <div class="chat-avatar-sm">&#x1f916;</div>
        <div>
          <h3>${agentName}</h3>
          <div style="font-size:10px;color:var(--text-dim);margin-top:1px">${formatTokens(promptTokens + totalSkillTokens)} tokens &middot; ${safeSkills.length} skill${safeSkills.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="chat-clear" id="chat-clear" style="display:none" onclick="clearChat()">Clear</button>
        <button class="chat-close" onclick="toggleChat()">&#x2715;</button>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="chat-empty" id="chat-empty">
        <div class="chat-empty-icon">&#x1f916;</div>
        <p>Chat with ${agentName}</p>
        <div class="sub">Full agent prompt + all skills loaded</div>
        <div class="chat-suggestions">
          <button class="chat-suggestion" onclick="fillInput('What can you do?')">What can you do?</button>
          <button class="chat-suggestion" onclick="fillInput('List your capabilities')">List capabilities</button>
          <button class="chat-suggestion" onclick="fillInput('Help me get started')">Get started</button>
        </div>
      </div>
    </div>
    <div class="chat-input-area">
      <input class="chat-input" id="chat-input" type="text" placeholder="Ask ${agentName} anything..." autocomplete="off"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey)sendDemo()">
      <button class="chat-send" id="chat-send" onclick="sendDemo()" title="Send">&#x27A4;</button>
    </div>
  </div>

  <!-- SETUP -->
  <section class="section" id="setup">
    <div class="container">
      <div class="section-header">
        <h2>Install MCP Server</h2>
        <p>Connect ${agentName} to Claude Code in 3 steps</p>
      </div>

      <!-- Steps -->
      <div style="display:flex;gap:20px;margin-bottom:32px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px;padding:20px;border-radius:12px;background:var(--card-bg);border:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;flex-shrink:0" id="step1-badge">1</div>
            <div style="font-weight:600;font-size:14px;color:var(--text)">Get API Key</div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6" id="step1-desc">
            Sign in and generate an API key in the <a href="#access" style="color:${color}" onclick="event.preventDefault();scrollToAccess()">Access section</a> below.
          </div>
        </div>
        <div style="flex:1;min-width:200px;padding:20px;border-radius:12px;background:var(--card-bg);border:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--text-dim);flex-shrink:0">2</div>
            <div style="font-weight:600;font-size:14px;color:var(--text)">Copy Config</div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
            Copy the MCP config JSON below and add it to your <code style="background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px">.mcp.json</code> file.
          </div>
        </div>
        <div style="flex:1;min-width:200px;padding:20px;border-radius:12px;background:var(--card-bg);border:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--text-dim);flex-shrink:0">3</div>
            <div style="font-weight:600;font-size:14px;color:var(--text)">Use in Claude</div>
          </div>
          <div style="font-size:13px;color:var(--text-muted);line-height:1.6">
            Restart Claude Code. The agent's tools (<code style="background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px">chat</code>, <code style="background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px">get_agent_info</code>) are now available.
          </div>
        </div>
      </div>

      <!-- MCP Config block -->
      <div class="setup-block">
        <div class="setup-tabs">
          <button class="setup-tab active" onclick="switchTab(this, 'mcp')">Claude MCP Config</button>
          <button class="setup-tab" onclick="switchTab(this, 'curl')">cURL</button>
          <button class="setup-tab" onclick="switchTab(this, 'node')">Node.js</button>
          <button class="setup-tab" onclick="switchTab(this, 'python')">Python</button>
        </div>
        <div class="setup-content">
          <div id="tab-mcp" class="tab-panel">
            <!-- Dynamic key status banner -->
            <div id="mcp-key-status" style="margin-bottom:16px;padding:12px 16px;border-radius:8px;font-size:13px;display:none"></div>

            <div style="padding:0 0 12px;font-size:13px;color:var(--text-muted);line-height:1.7">
              Add this to your <code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:12px">.mcp.json</code> file at the root of your project:
            </div>
            <div class="code-block" id="mcp-config-block">
              <button class="copy-btn" onclick="copyMcpConfig()">Copy</button>
{
  <span class="string">"mcpServers"</span>: {
    <span class="string">"${deployment.slug}"</span>: {
      <span class="string">"type"</span>: <span class="string">"sse"</span>,
      <span class="string">"url"</span>: <span class="string">"${getBaseUrl()}/mcp/${deployment.slug}/sse?key=<span id="mcp-key-placeholder">YOUR_API_KEY</span>"</span>
    }
  }
}
            </div>

            <div style="margin-top:16px;padding:16px;border-radius:10px;background:rgba(139,92,246,0.08);border:1px solid ${color}22">
              <div style="font-size:12px;font-weight:600;color:var(--primary);margin-bottom:10px">Available Tools</div>
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <div style="flex:1;min-width:180px;padding:10px 14px;border-radius:8px;background:var(--bg);border:1px solid var(--border)">
                  <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px"><code style="font-size:13px;color:${color}">chat</code></div>
                  <div style="font-size:12px;color:var(--text-muted);line-height:1.5">Send messages to ${agentName} with full context (system prompt + skills)</div>
                </div>
                <div style="flex:1;min-width:180px;padding:10px 14px;border-radius:8px;background:var(--bg);border:1px solid var(--border)">
                  <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px"><code style="font-size:13px;color:${color}">get_agent_info</code></div>
                  <div style="font-size:12px;color:var(--text-muted);line-height:1.5">Get agent capabilities, skills list, and token usage stats</div>
                </div>
              </div>
            </div>

            <div id="mcp-no-key-hint" style="margin-top:12px;font-size:12px;color:var(--text-dim)">
              &#x1f511; Replace <code style="background:var(--bg);padding:1px 4px;border-radius:3px;font-family:'JetBrains Mono',monospace;font-size:11px">YOUR_API_KEY</code> with a key from the <a href="#access" style="color:${color}" onclick="event.preventDefault();scrollToAccess()">Access section</a> below.
            </div>
          </div>
          <div id="tab-curl" class="tab-panel" style="display:none">
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<span class="comment"># Chat with ${agentName} MCP</span>
curl -X POST ${getBaseUrl()}/mcp/${deployment.slug}/api/chat \\
  -H <span class="string">"Authorization: Bearer <span class="mcp-key-inject">YOUR_API_KEY</span>"</span> \\
  -H <span class="string">"Content-Type: application/json"</span> \\
  -d <span class="string">'{
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'</span>
            </div>
          </div>
          <div id="tab-node" class="tab-panel" style="display:none">
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<span class="keyword">const</span> response = <span class="keyword">await</span> fetch(<span class="string">'${getBaseUrl()}/mcp/${deployment.slug}/api/chat'</span>, {
  method: <span class="string">'POST'</span>,
  headers: {
    <span class="string">'Authorization'</span>: <span class="string">\`Bearer <span class="mcp-key-inject">YOUR_API_KEY</span>\`</span>,
    <span class="string">'Content-Type'</span>: <span class="string">'application/json'</span>,
  },
  body: JSON.stringify({
    messages: [{ role: <span class="string">'user'</span>, content: <span class="string">'Hello!'</span> }],
  }),
});

<span class="keyword">const</span> data = <span class="keyword">await</span> response.json();
console.log(data.output[0].content[0].text);
            </div>
          </div>
          <div id="tab-python" class="tab-panel" style="display:none">
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<span class="keyword">import</span> requests

response = requests.post(
    <span class="string">"${getBaseUrl()}/mcp/${deployment.slug}/api/chat"</span>,
    headers={
        <span class="string">"Authorization"</span>: <span class="string">f"Bearer <span class="mcp-key-inject">YOUR_API_KEY</span>"</span>,
        <span class="string">"Content-Type"</span>: <span class="string">"application/json"</span>,
    },
    json={
        <span class="string">"messages"</span>: [{<span class="string">"role"</span>: <span class="string">"user"</span>, <span class="string">"content"</span>: <span class="string">"Hello!"</span>}],
    },
)

data = response.json()
<span class="keyword">print</span>(data[<span class="string">"output"</span>][0][<span class="string">"content"</span>][0][<span class="string">"text"</span>])
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- USAGE -->
  <section class="section usage-section" id="usage">
    <div class="container">
      <div class="section-header">
        <h2>Token Usage</h2>
        <p>Real-time monitoring for this deployment</p>
      </div>
      <div class="usage-bar-container">
        <div class="usage-header">
          <h3>Monthly Usage</h3>
          <span class="usage-text">${formatTokens(monthlyUsage)} / ${formatTokens(deployment.monthly_token_limit)}</span>
        </div>
        <div class="usage-bar">
          <div class="usage-bar-fill" style="width: ${Math.min(usagePercent, 100)}%; background: ${usagePercent > 90 ? 'var(--error)' : usagePercent > 70 ? 'var(--warning)' : `var(--primary)`}"></div>
        </div>
        <div class="usage-details">
          <div class="usage-detail">
            <div class="val">${formatTokens(stats.totalInput || 0)}</div>
            <div class="lbl">Input Tokens</div>
          </div>
          <div class="usage-detail">
            <div class="val">${formatTokens(stats.totalOutput || 0)}</div>
            <div class="lbl">Output Tokens</div>
          </div>
          <div class="usage-detail">
            <div class="val">${stats.successCount || 0}</div>
            <div class="lbl">Successful</div>
          </div>
          <div class="usage-detail">
            <div class="val">${stats.errorCount || 0}</div>
            <div class="lbl">Errors</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- REQUEST LOGS -->
  <section class="logs-section" id="logs">
    <div class="container">
      <div class="section-header">
        <h2>Request Log</h2>
        <p>Recent API requests to this deployment</p>
      </div>
      <div class="logs-card">
        <div class="logs-header">
          <h3>&#x1f4ca; Requests <span class="log-count" id="log-count">0</span></h3>
          <button class="logs-refresh" onclick="loadLogs()">&#x21bb; Refresh</button>
        </div>
        <div class="logs-table-wrap">
          <table class="logs-table" id="logs-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Endpoint</th>
                <th>Input</th>
                <th>Output</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="logs-tbody">
              <tr><td colspan="6" class="logs-empty"><div class="logs-empty-icon">&#x1f4ca;</div>Loading logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </section>

  <!-- ACCESS / PURCHASE -->
  <section class="access-section" id="access">
    <div class="container">
      <div class="section-header">
        <h2>Get Access</h2>
        <p>Purchase this agent to unlock API access and generate your own tokens</p>
      </div>
      <div class="access-card" id="access-card">
        <div class="access-header">
          <h2>${agentName}</h2>
          <p>Full API access with unlimited key generation</p>
        </div>
        <div class="access-price-row">
          <div class="access-price" id="access-price">${agent.is_premium && agent.price > 0 ? `${agent.price} <span>credits</span>` : 'Free <span>tier</span>'}</div>
        </div>
        <div class="access-features">
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> REST API with Bearer auth</div>
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> ${formatTokens(promptTokens + totalSkillTokens)} tokens of knowledge</div>
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> ${safeSkills.length} specialized skills</div>
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> Unlimited API key generation</div>
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> Real-time usage analytics</div>
          <div class="access-feature"><span class="access-feature-icon">&#x2713;</span> OpenAI-compatible format</div>
        </div>
        <div class="access-actions" id="access-actions">
          <!-- Dynamic: changes based on auth/purchase state -->
          <button class="btn-purchase" id="btn-access" onclick="handleAccess()">
            &#x1f512; Sign in to get access
          </button>
          <div class="access-balance" id="access-balance" style="display:none">
            &#x1fa99; Your balance: <strong id="access-balance-val">0</strong> credits
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- API KEYS (only visible when purchased) -->
  <section class="apikeys-section" id="apikeys-section" style="display:none">
    <div class="container">
      <div class="apikeys-card">
        <div class="apikeys-header">
          <h3>&#x1f511; Your API Keys</h3>
          <button class="btn-generate" id="btn-gen-key" onclick="generateKey()">
            + Generate New Key
          </button>
        </div>
        <div id="new-token-banner" style="display:none"></div>
        <div class="apikeys-list" id="apikeys-list">
          <div class="apikeys-empty">Loading...</div>
        </div>
      </div>
    </div>
  </section>

  <!-- PRICING TIERS (kept for reference) -->
  <section class="section" id="pricing">
    <div class="container">
      <div class="section-header">
        <h2>Usage Tiers</h2>
        <p>Scale with your needs</p>
      </div>
      <div class="pricing-grid">
        <div class="pricing-card${deployment.tier === 'starter' ? ' featured' : ''}">
          <div class="tier-name">Starter</div>
          <div class="price">Free <span>/month</span></div>
          <div class="price-note">Perfect for testing</div>
          <ul>
            <li>20K tokens / month</li>
            <li>1 API key</li>
            <li>Basic analytics</li>
            <li>Community support</li>
          </ul>
          <button class="btn-primary" style="width:100%; justify-content:center;" ${deployment.tier === 'starter' ? 'disabled' : ''}>Current Plan</button>
        </div>
        <div class="pricing-card${deployment.tier === 'professional' ? ' featured' : ''}">
          <div class="tier-name">Professional</div>
          <div class="price">$19 <span>/month</span></div>
          <div class="price-note">For production use</div>
          <ul>
            <li>1M tokens / month</li>
            <li>Unlimited API keys</li>
            <li>Advanced analytics</li>
            <li>Priority support</li>
          </ul>
          <button class="btn-outline" style="width:100%; justify-content:center;">Upgrade</button>
        </div>
        <div class="pricing-card${deployment.tier === 'enterprise' ? ' featured' : ''}">
          <div class="tier-name">Enterprise</div>
          <div class="price">$79 <span>/month</span></div>
          <div class="price-note">Unlimited scale</div>
          <ul>
            <li>6M tokens / month</li>
            <li>Custom domain</li>
            <li>Full analytics + export</li>
            <li>Dedicated support</li>
          </ul>
          <button class="btn-outline" style="width:100%; justify-content:center;">Contact Us</button>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="container">
      <p>Powered by <a href="/">GURU Agent Platform</a> &middot; ${agentName} MCP &middot; ${category}</p>
    </div>
  </footer>

  <script>
    function switchTab(el, tabId) {
      document.querySelectorAll('.setup-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      el.classList.add('active');
      document.getElementById('tab-' + tabId).style.display = 'block';
    }

    function copyCode(btn) {
      const block = btn.parentElement;
      const text = block.innerText.replace('Copy', '').trim();
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // ========== FLOATING CHAT ==========
    const chatMessages = [];
    let chatOpen = false;
    let chatBusy = false;

    function toggleChat() {
      chatOpen = !chatOpen;
      const panel = document.getElementById('chat-float');
      const fab = document.getElementById('chat-fab');
      const fabIcon = document.getElementById('chat-fab-icon');
      if (chatOpen) {
        panel.style.display = 'flex';
        fabIcon.innerHTML = '&#x2715;';
        fab.querySelector('.chat-fab-pulse').style.display = 'none';
        document.getElementById('chat-input').focus();
      } else {
        panel.style.display = 'none';
        fabIcon.innerHTML = '&#x1f4ac;';
        fab.querySelector('.chat-fab-pulse').style.display = '';
      }
    }

    function fillInput(text) {
      document.getElementById('chat-input').value = text;
      document.getElementById('chat-input').focus();
    }

    function clearChat() {
      chatMessages.length = 0;
      renderMessages();
      document.getElementById('chat-clear').style.display = 'none';
    }

    function scrollToBottom() {
      const el = document.getElementById('chat-messages');
      el.scrollTop = el.scrollHeight;
    }

    function renderMessages() {
      const container = document.getElementById('chat-messages');
      if (chatMessages.length === 0) {
        container.innerHTML = document.getElementById('chat-empty') ?
          '<div class="chat-empty" id="chat-empty"><div class="chat-empty-icon">&#x1f916;</div><p>Chat with ${agentName}</p><div class="sub">Full agent prompt + all skills loaded</div><div class="chat-suggestions"><button class="chat-suggestion" onclick="fillInput(\\\'What can you do?\\\')">What can you do?</button><button class="chat-suggestion" onclick="fillInput(\\\'List capabilities\\\')">List capabilities</button><button class="chat-suggestion" onclick="fillInput(\\\'Help me get started\\\')">Get started</button></div></div>' : '';
        return;
      }
      let html = '';
      for (const m of chatMessages) {
        const avatarEmoji = m.role === 'user' ? '&#x1f464;' : '&#x1f916;';
        html += '<div class="chat-msg ' + m.role + '">';
        html += '<div class="chat-msg-avatar">' + avatarEmoji + '</div>';
        html += '<div class="chat-msg-bubble" id="' + (m.id || '') + '">' + escapeChat(m.content) + (m.typing ? '<span class="chat-cursor"></span>' : '') + '</div>';
        html += '</div>';
      }
      container.innerHTML = html;
      scrollToBottom();
    }

    function escapeChat(str) {
      if (!str) return '';
      return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>');
    }

    async function sendDemo() {
      const input = document.getElementById('chat-input');
      const msg = input.value.trim();
      if (!msg || chatBusy) return;
      input.value = '';
      chatBusy = true;
      document.getElementById('chat-send').disabled = true;
      document.getElementById('chat-clear').style.display = 'inline-block';

      // Add user message
      chatMessages.push({ role: 'user', content: msg });
      renderMessages();

      // Add typing indicator
      const assistantId = 'msg-' + Date.now();
      chatMessages.push({ role: 'assistant', content: '', typing: true, id: assistantId });
      renderMessages();

      try {
        const apiMessages = chatMessages
          .filter(m => m.content || m.role === 'user')
          .filter(m => !m.typing)
          .map(m => ({ role: m.role, content: m.content }));

        const res = await fetch('/mcp/${deployment.slug}/api/demo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMessages }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        // Remove typing indicator and typewrite the response
        const lastMsg = chatMessages[chatMessages.length - 1];
        lastMsg.typing = false;
        lastMsg.content = '';
        renderMessages();

        await typewrite(assistantId, data.content || 'No response');
        lastMsg.content = data.content || 'No response';

      } catch (err) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        lastMsg.typing = false;
        lastMsg.content = 'Error: ' + (err.message || 'Failed');
        renderMessages();
      }

      chatBusy = false;
      document.getElementById('chat-send').disabled = false;
      input.focus();
    }

    async function typewrite(elementId, text, scrollFn) {
      const el = document.getElementById(elementId);
      if (!el) return;
      let i = 0;
      const speed = Math.max(8, Math.min(30, 2000 / text.length));
      const doScroll = scrollFn || scrollToBottom;
      return new Promise(resolve => {
        function type() {
          if (i < text.length) {
            const chunk = Math.ceil(text.length / 200);
            const end = Math.min(i + chunk, text.length);
            const partial = text.slice(0, end);
            el.innerHTML = escapeChat(partial) + '<span class="' + (scrollFn ? 'ic-cursor' : 'chat-cursor') + '"></span>';
            i = end;
            doScroll();
            requestAnimationFrame(() => setTimeout(type, speed));
          } else {
            el.innerHTML = escapeChat(text);
            doScroll();
            resolve();
          }
        }
        type();
      });
    }

    // ========== INLINE CHAT ==========
    const icMessages = [];
    let icBusy = false;

    function icScrollBottom() {
      const el = document.getElementById('ic-messages');
      if (el) el.scrollTop = el.scrollHeight;
    }

    function icFill(text) {
      document.getElementById('ic-input').value = text;
      document.getElementById('ic-input').focus();
    }

    function icClear() {
      icMessages.length = 0;
      icRender();
      document.getElementById('ic-clear').style.display = 'none';
    }

    function icRender() {
      const container = document.getElementById('ic-messages');
      if (icMessages.length === 0) {
        document.getElementById('ic-welcome') && (container.innerHTML = container.innerHTML);
        // Restore the welcome screen
        container.innerHTML = '<div class="inline-welcome" id="ic-welcome"><div class="inline-welcome-avatar">&#x1f916;</div><h3>Chat with ${agentName}</h3><p>Full agent prompt + all skills loaded into context</p><div class="sub">${escapeHtml(model)} model &middot; ${formatTokens(promptTokens + totalSkillTokens)} context tokens &middot; Real-time responses</div><div class="inline-suggestions"><button class="inline-suggestion" onclick="icFill(\\\'What can you do?\\\')"><span class="sug-icon">&#x1f4a1;</span> What can you do?</button><button class="inline-suggestion" onclick="icFill(\\\'List your skills and expertise\\\')"><span class="sug-icon">&#x26a1;</span> List your skills</button><button class="inline-suggestion" onclick="icFill(\\\'Help me get started with a project\\\')"><span class="sug-icon">&#x1f680;</span> Help me get started</button><button class="inline-suggestion" onclick="icFill(\\\'What makes you different from other AI agents?\\\')"><span class="sug-icon">&#x2728;</span> What makes you special?</button></div></div>';
        return;
      }
      let html = '';
      for (const m of icMessages) {
        const emo = m.role === 'user' ? '&#x1f464;' : '&#x1f916;';
        html += '<div class="ic-msg ' + m.role + '">';
        html += '<div class="ic-msg-avatar">' + emo + '</div>';
        html += '<div class="ic-msg-bubble" id="' + (m.id || '') + '">';
        if (m.typing) {
          html += '<div class="ic-typing"><span></span><span></span><span></span></div>';
        } else {
          html += escapeChat(m.content);
        }
        html += '</div></div>';
      }
      container.innerHTML = html;
      icScrollBottom();
    }

    async function icSend() {
      const input = document.getElementById('ic-input');
      const msg = input.value.trim();
      if (!msg || icBusy) return;
      input.value = '';
      icBusy = true;
      document.getElementById('ic-send').disabled = true;
      document.getElementById('ic-clear').style.display = 'inline-block';

      icMessages.push({ role: 'user', content: msg });
      icRender();

      const assistantId = 'ic-' + Date.now();
      icMessages.push({ role: 'assistant', content: '', typing: true, id: assistantId });
      icRender();

      try {
        const apiMsgs = icMessages
          .filter(m => m.content || m.role === 'user')
          .filter(m => !m.typing)
          .map(m => ({ role: m.role, content: m.content }));

        const res = await fetch('/mcp/${deployment.slug}/api/demo-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiMsgs }),
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const lastMsg = icMessages[icMessages.length - 1];
        lastMsg.typing = false;
        lastMsg.content = '';
        icRender();

        await typewrite(assistantId, data.content || 'No response', icScrollBottom);
        lastMsg.content = data.content || 'No response';

      } catch (err) {
        const lastMsg = icMessages[icMessages.length - 1];
        lastMsg.typing = false;
        lastMsg.content = 'Error: ' + (err.message || 'Failed');
        icRender();
      }

      icBusy = false;
      document.getElementById('ic-send').disabled = false;
      input.focus();
    }

    // ========== AUTH & PURCHASE SYSTEM ==========
    const AGENT_NAME = '${escapeHtml(agent.name)}';
    const AGENT_PRICE = ${agent.price || 0};
    const AGENT_IS_PREMIUM = ${agent.is_premium ? 'true' : 'false'};
    let authToken = localStorage.getItem('guru_token');
    let authUser = null;
    let walletBalance = 0;
    let hasPurchased = false;
    let userTokens = [];
    let authMode = 'login'; // 'login' or 'register'
    let newlyGeneratedToken = null;

    // Toast helper
    function showToast(msg, type) {
      const existing = document.querySelector('.mcp-toast');
      if (existing) existing.remove();
      const t = document.createElement('div');
      t.className = 'mcp-toast ' + type;
      t.innerHTML = (type === 'success' ? '&#x2713; ' : '&#x26a0; ') + msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), 3500);
    }

    // API helper
    async function mcpApi(endpoint, opts = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
      const res = await fetch(endpoint, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      return data;
    }

    // ---- Login/Register Modal ----
    function openLogin() {
      authMode = 'login';
      updateAuthModal();
      document.getElementById('login-modal').style.display = 'flex';
      document.getElementById('auth-email').focus();
    }
    function closeLogin() {
      document.getElementById('login-modal').style.display = 'none';
      document.getElementById('auth-error').style.display = 'none';
    }
    function toggleAuthMode() {
      authMode = authMode === 'login' ? 'register' : 'login';
      updateAuthModal();
    }
    function updateAuthModal() {
      document.getElementById('modal-title').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
      document.getElementById('modal-subtitle').textContent = authMode === 'login' ? 'Access your wallet and API keys' : 'Join GURU to purchase agents';
      document.getElementById('fg-name').style.display = authMode === 'register' ? 'block' : 'none';
      document.getElementById('auth-submit').textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
      document.getElementById('auth-switch-text').textContent = authMode === 'login' ? "Don't have an account? " : 'Already have an account? ';
      document.getElementById('auth-switch-link').textContent = authMode === 'login' ? 'Create one' : 'Sign in';
      document.getElementById('auth-error').style.display = 'none';
    }

    async function handleAuth(e) {
      e.preventDefault();
      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const name = document.getElementById('auth-name').value.trim();
      const errEl = document.getElementById('auth-error');
      const submitBtn = document.getElementById('auth-submit');

      if (!email || !password) { errEl.textContent = 'Email and password required'; errEl.style.display = 'block'; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = authMode === 'login' ? 'Signing in...' : 'Creating account...';

      try {
        const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
        const body = authMode === 'login' ? { email, password } : { email, password, displayName: name || email.split('@')[0] };
        const data = await mcpApi(endpoint, { method: 'POST', body: JSON.stringify(body) });

        authToken = data.token;
        authUser = data.user || { email };
        localStorage.setItem('guru_token', authToken);
        closeLogin();
        showToast('Welcome! You are now signed in.', 'success');
        initAuthState();
      } catch (err) {
        errEl.textContent = err.message || 'Authentication failed';
        errEl.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.textContent = authMode === 'login' ? 'Sign In' : 'Create Account';
    }

    function doLogout() {
      authToken = null;
      authUser = null;
      walletBalance = 0;
      hasPurchased = false;
      userTokens = [];
      localStorage.removeItem('guru_token');
      updateNavUI();
      updateAccessUI();
      updateApiKeysUI();
      showToast('Logged out', 'success');
    }

    // ---- Nav UI Update ----
    function updateNavUI() {
      const signinBtn = document.getElementById('nav-signin');
      const loggedDiv = document.getElementById('nav-logged');
      if (authToken && authUser) {
        signinBtn.style.display = 'none';
        loggedDiv.style.display = 'flex';
        document.getElementById('nav-balance').textContent = walletBalance.toLocaleString();
        document.getElementById('nav-email').textContent = authUser.displayName || authUser.email || '';
      } else {
        signinBtn.style.display = '';
        loggedDiv.style.display = 'none';
      }
    }

    // ---- Access / Purchase UI ----
    function updateAccessUI() {
      const btn = document.getElementById('btn-access');
      const balDiv = document.getElementById('access-balance');
      const card = document.getElementById('access-card');

      if (!authToken) {
        btn.innerHTML = '&#x1f512; Sign in to get access';
        btn.disabled = false;
        btn.className = 'btn-purchase';
        balDiv.style.display = 'none';
        card.classList.remove('purchased');
        return;
      }

      balDiv.style.display = 'flex';
      document.getElementById('access-balance-val').textContent = walletBalance.toLocaleString();

      if (hasPurchased) {
        btn.innerHTML = '&#x2713; Access Granted — Scroll to API Keys';
        btn.className = 'btn-purchase purchased-btn';
        btn.disabled = false;
        card.classList.add('purchased');
      } else if (AGENT_IS_PREMIUM && AGENT_PRICE > 0) {
        if (walletBalance >= AGENT_PRICE) {
          btn.innerHTML = '&#x1fa99; Purchase for ' + AGENT_PRICE + ' credits';
          btn.className = 'btn-purchase';
          btn.disabled = false;
        } else {
          btn.innerHTML = '&#x26a0; Insufficient credits (' + AGENT_PRICE + ' needed)';
          btn.className = 'btn-purchase';
          btn.disabled = true;
        }
        card.classList.remove('purchased');
      } else {
        // Free agent — auto-grant access
        btn.innerHTML = '&#x2713; Free Access — Generate API Key below';
        btn.className = 'btn-purchase purchased-btn';
        btn.disabled = false;
        hasPurchased = true;
        card.classList.add('purchased');
      }
    }

    async function handleAccess() {
      if (!authToken) { openLogin(); return; }
      if (hasPurchased) {
        document.getElementById('apikeys-section').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      // Purchase
      const btn = document.getElementById('btn-access');
      btn.disabled = true;
      btn.innerHTML = '&#x23F3; Processing...';
      try {
        const result = await mcpApi('/api/marketplace/' + AGENT_NAME + '/purchase', { method: 'POST' });
        hasPurchased = true;
        walletBalance = result.balance || walletBalance - AGENT_PRICE;
        if (result.token && result.token.token) {
          newlyGeneratedToken = result.token.token;
        }
        showToast('Agent purchased successfully!', 'success');
        updateNavUI();
        updateAccessUI();
        loadApiKeys();
        document.getElementById('apikeys-section').style.display = '';
        setTimeout(() => {
          document.getElementById('apikeys-section').scrollIntoView({ behavior: 'smooth' });
        }, 300);
      } catch (err) {
        showToast(err.message || 'Purchase failed', 'error');
        btn.disabled = false;
        updateAccessUI();
      }
    }

    function scrollToAccess() {
      document.getElementById('access').scrollIntoView({ behavior: 'smooth' });
    }

    // ---- API Keys UI ----
    async function loadApiKeys() {
      try {
        userTokens = await mcpApi('/api/wallet/tokens');
        // Filter tokens for this agent
        userTokens = userTokens.filter(t => t.agent_name === AGENT_NAME && t.is_active !== false);
        updateApiKeysUI();
      } catch (err) {
        console.warn('Failed to load tokens:', err);
      }
    }

    function updateApiKeysUI() {
      const section = document.getElementById('apikeys-section');
      if (!authToken || (!hasPurchased && AGENT_IS_PREMIUM && AGENT_PRICE > 0)) {
        section.style.display = 'none';
        return;
      }
      section.style.display = '';

      const list = document.getElementById('apikeys-list');
      const banner = document.getElementById('new-token-banner');

      // Show newly generated token banner
      if (newlyGeneratedToken) {
        banner.style.display = '';
        banner.innerHTML = '<div class="new-token-banner"><p>&#x1f389; New API Key Generated — Copy it now!</p><div class="new-token-value"><code>' + newlyGeneratedToken + '</code><button onclick="copyToken(this, \\'' + newlyGeneratedToken + '\\')">Copy</button></div><div class="new-token-warning">&#x26a0; This key will only be shown once. Store it securely.</div></div>';
      } else {
        banner.style.display = 'none';
      }

      if (userTokens.length === 0) {
        list.innerHTML = '<div class="apikeys-empty">No API keys yet. Click "Generate New Key" to create one.</div>';
        updateMcpConfigWithKey(null);
        return;
      }
      // If we have a newly generated token, inject it; otherwise show hint that keys exist
      if (newlyGeneratedToken) {
        updateMcpConfigWithKey(newlyGeneratedToken);
      } else {
        // User has keys but we only see prefixes — show a gentle hint
        const status = document.getElementById('mcp-key-status');
        const hint = document.getElementById('mcp-no-key-hint');
        if (status) {
          status.style.display = '';
          status.style.background = 'rgba(139,92,246,0.08)';
          status.style.border = '1px solid rgba(139,92,246,0.15)';
          status.style.color = 'var(--primary)';
          status.innerHTML = 'You have ' + userTokens.length + ' API key(s) (' + userTokens.map(t => t.token_prefix + '...').join(', ') + '). Replace <code style="background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px">YOUR_API_KEY</code> in the config with your full key, or generate a new one to auto-fill.';
        }
        if (hint) hint.style.display = 'none';
      }

      let html = '';
      for (const tk of userTokens) {
        const created = new Date(tk.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        html += '<div class="apikey-row">';
        html += '<div class="apikey-info">';
        html += '<div class="apikey-name">' + (tk.name || 'API Key') + '</div>';
        html += '<div class="apikey-prefix">' + (tk.token_prefix || 'guru_***') + '&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022; <span style="color:var(--text-dim);font-size:10px">Created ' + created + '</span></div>';
        html += '</div>';
        html += '<div class="apikey-actions">';
        html += '<button class="apikey-btn danger" onclick="revokeKey(\\'' + tk.id + '\\')">Revoke</button>';
        html += '</div>';
        html += '</div>';
      }
      list.innerHTML = html;
    }

    async function generateKey() {
      const btn = document.getElementById('btn-gen-key');
      btn.disabled = true;
      btn.textContent = 'Generating...';
      try {
        const result = await mcpApi('/api/wallet/tokens/' + AGENT_NAME + '/generate', { method: 'POST' });
        newlyGeneratedToken = result.token;
        showToast('API key generated!', 'success');
        await loadApiKeys();
        // Auto-inject key into MCP config blocks
        updateMcpConfigWithKey(newlyGeneratedToken);
      } catch (err) {
        showToast(err.message || 'Failed to generate key', 'error');
      }
      btn.disabled = false;
      btn.innerHTML = '+ Generate New Key';
    }

    async function revokeKey(tokenId) {
      if (!confirm('Revoke this API key? This cannot be undone.')) return;
      try {
        await mcpApi('/api/wallet/tokens/' + tokenId, { method: 'DELETE' });
        showToast('API key revoked', 'success');
        await loadApiKeys();
      } catch (err) {
        showToast(err.message || 'Failed to revoke key', 'error');
      }
    }

    function copyToken(btn, token) {
      navigator.clipboard.writeText(token).then(() => {
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }

    // ---- MCP Config dynamic key injection ----
    const MCP_BASE_URL = '${getBaseUrl()}';
    const MCP_SLUG = '${deployment.slug}';

    function updateMcpConfigWithKey(apiKey) {
      // Update main MCP config placeholder
      const placeholder = document.getElementById('mcp-key-placeholder');
      if (placeholder) {
        placeholder.textContent = apiKey || 'YOUR_API_KEY';
        placeholder.style.color = apiKey ? '#22c55e' : '';
        placeholder.style.fontWeight = apiKey ? '700' : '';
      }
      // Update all code blocks with mcp-key-inject class
      document.querySelectorAll('.mcp-key-inject').forEach(el => {
        el.textContent = apiKey || 'YOUR_API_KEY';
        if (apiKey) { el.style.color = '#22c55e'; el.style.fontWeight = '700'; }
      });
      // Update status banner
      const status = document.getElementById('mcp-key-status');
      const hint = document.getElementById('mcp-no-key-hint');
      if (apiKey) {
        status.style.display = '';
        status.style.background = 'rgba(34,197,94,0.08)';
        status.style.border = '1px solid rgba(34,197,94,0.2)';
        status.style.color = '#22c55e';
        status.innerHTML = '&#x2713; API key injected. Copy the config below and paste it into your <code style="background:var(--bg);padding:1px 5px;border-radius:4px;font-size:12px">.mcp.json</code> file — ready to use!';
        if (hint) hint.style.display = 'none';
      } else {
        status.style.display = 'none';
        if (hint) hint.style.display = '';
      }
    }

    function copyMcpConfig() {
      const key = newlyGeneratedToken || 'YOUR_API_KEY';
      const config = JSON.stringify({
        mcpServers: {
          [MCP_SLUG]: {
            type: 'sse',
            url: MCP_BASE_URL + '/mcp/' + MCP_SLUG + '/sse?key=' + key
          }
        }
      }, null, 2);
      navigator.clipboard.writeText(config).then(() => {
        const btn = document.querySelector('#mcp-config-block .copy-btn');
        if (btn) { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = 'Copy'; }, 2000); }
      });
    }

    // ---- Init on page load ----
    async function initAuthState() {
      if (!authToken) { updateNavUI(); updateAccessUI(); updateApiKeysUI(); return; }
      try {
        // Verify token and get user info
        const user = await mcpApi('/api/user/me');
        authUser = user;
        // Get wallet
        const wallet = await mcpApi('/api/wallet');
        walletBalance = wallet.balance || 0;
        // Check purchase status for this agent
        const purchases = await mcpApi('/api/wallet/purchases');
        hasPurchased = purchases.some(p => p.agent_name === AGENT_NAME);
        updateNavUI();
        updateAccessUI();
        if (hasPurchased) {
          await loadApiKeys();
        }
        updateApiKeysUI();
      } catch (err) {
        // Token expired or invalid
        console.warn('Auth check failed:', err.message);
        authToken = null;
        localStorage.removeItem('guru_token');
        updateNavUI();
        updateAccessUI();
        updateApiKeysUI();
      }
    }

    // ========== REQUEST LOGS ==========
    let logsData = [];

    async function loadLogs() {
      try {
        const res = await fetch('/mcp/${deployment.slug}/api/logs?limit=50');
        logsData = await res.json();
        renderLogs();
      } catch (err) {
        console.warn('Failed to load logs:', err);
      }
    }

    function renderLogs() {
      const tbody = document.getElementById('logs-tbody');
      const countEl = document.getElementById('log-count');
      countEl.textContent = logsData.length;

      if (!logsData || logsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="logs-empty"><div class="logs-empty-icon">&#x1f4ca;</div>No requests yet. Try the chat demo or use the API!</td></tr>';
        return;
      }

      let html = '';
      for (const log of logsData) {
        const date = new Date(log.created_at);
        const timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
                        date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const endpoint = log.request_type || 'chat';
        const statusClass = log.status === 'success' ? 'ok' : log.status === 'rate_limited' ? 'limit' : 'err';
        const statusLabel = log.status === 'success' ? 'OK' : log.status === 'rate_limited' ? 'LIMIT' : 'ERR';
        const duration = log.duration_ms ? (log.duration_ms / 1000).toFixed(1) + 's' : '--';

        html += '<tr>';
        html += '<td class="log-time">' + timeStr + '</td>';
        html += '<td class="log-endpoint">' + endpoint + '</td>';
        html += '<td class="log-tokens">' + (log.input_tokens || 0).toLocaleString() + '</td>';
        html += '<td class="log-tokens">' + (log.output_tokens || 0).toLocaleString() + '</td>';
        html += '<td class="log-tokens" style="color:var(--text-dim)">' + duration + '</td>';
        html += '<td><span class="log-status ' + statusClass + '">' + statusLabel + '</span></td>';
        html += '</tr>';
      }
      tbody.innerHTML = html;
    }

    // ========== PROMPT VIEWER ==========
    let promptExpanded = false;
    let promptText = '';

    async function loadPrompt() {
      try {
        const res = await fetch('/mcp/${deployment.slug}/api/prompt');
        const data = await res.json();
        promptText = data.prompt || '';
        const el = document.getElementById('prompt-content');
        el.textContent = promptText;
        document.getElementById('prompt-token-count').textContent = (data.tokens || 0).toLocaleString() + ' tokens';
      } catch (err) {
        document.getElementById('prompt-content').textContent = 'Failed to load prompt.';
      }
    }

    function togglePrompt() {
      promptExpanded = !promptExpanded;
      const body = document.getElementById('prompt-body');
      const btn = document.getElementById('prompt-expand-btn');
      const fade = document.getElementById('prompt-fade');
      if (promptExpanded) {
        body.style.maxHeight = 'none';
        btn.textContent = 'Collapse prompt';
        fade.style.display = 'none';
      } else {
        body.style.maxHeight = '300px';
        btn.textContent = 'Show full prompt';
        fade.style.display = '';
      }
    }

    function copyPrompt() {
      const btn = document.getElementById('prompt-copy-btn');
      navigator.clipboard.writeText(promptText).then(() => {
        btn.innerHTML = '&#x2713; Copied!';
        showToast('Prompt copied to clipboard', 'success');
        setTimeout(() => { btn.innerHTML = '&#x1f4cb; Copy Prompt'; }, 2000);
      });
    }

    // Run on page load
    initAuthState();
    loadLogs();
    loadPrompt();
  </script>
</body>
</html>`;
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function formatTokens(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function getBaseUrl() {
  if (process.env.RAILWAY_ENVIRONMENT) {
    return 'https://guru-api-production.up.railway.app';
  }
  return `http://localhost:${process.env.PORT || 4000}`;
}

module.exports = router;
