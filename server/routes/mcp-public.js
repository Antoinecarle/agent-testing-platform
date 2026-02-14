const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

function hashApiKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
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

    /* ===== FOOTER ===== */
    footer {
      border-top: 1px solid var(--border); padding: 40px 0;
      text-align: center; color: var(--text-dim); font-size: 13px;
    }
    footer a { color: var(--primary); text-decoration: none; }
    footer a:hover { text-decoration: underline; }

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
        <a href="#agent">Agent</a>
        <a href="#skills">Skills</a>
        <a href="#setup">Setup</a>
        <a href="#usage">Usage</a>
      </div>
      <a class="btn-primary" href="#setup">Get API Key</a>
    </div>
  </nav>

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
        <a class="btn-primary" href="#setup">Get Started</a>
        <a class="btn-outline" href="#capabilities">View Capabilities</a>
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

  <!-- SETUP -->
  <section class="section" id="setup">
    <div class="container">
      <div class="section-header">
        <h2>Quick Setup</h2>
        <p>Start using ${agentName} MCP in under 30 seconds</p>
      </div>
      <div class="setup-block">
        <div class="setup-tabs">
          <button class="setup-tab active" onclick="switchTab(this, 'curl')">cURL</button>
          <button class="setup-tab" onclick="switchTab(this, 'node')">Node.js</button>
          <button class="setup-tab" onclick="switchTab(this, 'python')">Python</button>
        </div>
        <div class="setup-content">
          <div id="tab-curl" class="tab-panel">
            <div class="code-block">
              <button class="copy-btn" onclick="copyCode(this)">Copy</button>
<span class="comment"># Chat with ${agentName} MCP</span>
curl -X POST ${getBaseUrl()}/mcp/${deployment.slug}/api/chat \\
  -H <span class="string">"Authorization: Bearer YOUR_API_KEY"</span> \\
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
    <span class="string">'Authorization'</span>: <span class="string">\`Bearer \${API_KEY}\`</span>,
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
        <span class="string">"Authorization"</span>: <span class="string">f"Bearer {API_KEY}"</span>,
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

  <!-- PRICING -->
  <section class="section" id="pricing">
    <div class="container">
      <div class="section-header">
        <h2>Pricing</h2>
        <p>Scale with your usage</p>
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
          <button class="btn-primary" style="width:100%; justify-content:center;">Current Plan</button>
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
