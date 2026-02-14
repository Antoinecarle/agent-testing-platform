const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { ensureUserHome, USERS_DIR } = require('../user-home');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');

// Use project-bundled agents as primary, fallback to system ~/.claude/agents
const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
const SYSTEM_AGENTS_DIR = path.join(require('os').homedir(), '.claude', 'agents');
const AGENTS_DIR = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : SYSTEM_AGENTS_DIR;

// Parse a .md agent file to extract metadata
function parseAgentFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, '.md');

  let description = '';
  let model = '';
  let category = 'uncategorized';
  let tools = '';
  let maxTurns = 0;
  let memory = '';
  let permissionMode = '';

  // Extract YAML front matter if present
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const descMatch = fm.match(/description:\s*"([^"]+)"/);
    if (descMatch) description = descMatch[1];
    const modelMatch = fm.match(/model:\s*(\S+)/);
    if (modelMatch) model = modelMatch[1];
    const toolsMatch = fm.match(/tools:\s*\[([^\]]*)\]/);
    if (toolsMatch) tools = toolsMatch[1].replace(/\s/g, '');
    const turnsMatch = fm.match(/max_turns:\s*(\d+)/);
    if (turnsMatch) maxTurns = parseInt(turnsMatch[1], 10);
    const memMatch = fm.match(/memory:\s*"([^"]+)"/);
    if (memMatch) memory = memMatch[1];
    const permMatch = fm.match(/permission_mode:\s*(\S+)/);
    if (permMatch) permissionMode = permMatch[1];
    // Extract category from front matter (personaboarding agents set this)
    const catMatch = fm.match(/category:\s*(\S+)/);
    if (catMatch) category = catMatch[1];
  }

  // Fallback: extract description from body text
  if (!description) {
    const body = fmMatch ? content.slice(fmMatch[0].length) : content;
    const lines = body.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('---')) continue;
      if (line.includes('Use proactively when') || line.includes('Use this')) {
        description = line.trim().replace(/^[-*]\s*/, '');
        break;
      }
      if (!description && !line.startsWith('(') && !line.startsWith('[')) {
        description = line.trim();
      }
    }
  }

  // Auto-detect category from name only if not set from front matter
  if (category === 'uncategorized') {
    if (name.includes('epiminds')) category = 'epiminds';
    else if (name.includes('seo') || name.includes('geo')) category = 'seo';
    else if (name.includes('reviewer') || name.includes('code')) category = 'dev-tools';
    else if (name.includes('builder') || name.includes('architect')) category = 'builders';
    else if (name.includes('animation') || name.includes('scroll')) category = 'animation';
    else if (name.includes('design') || name.includes('theme') || name.includes('stylist')) category = 'design';
    else category = 'style';
  }

  const promptPreview = content.substring(0, 500);
  const fullPrompt = content;

  return { name, description, model, category, promptPreview, fullPrompt, tools, maxTurns, memory, permissionMode };
}

// Sync agents from filesystem to DB (bundled + custom-agents from persistent volume)
async function syncAgents() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');

  // Collect .md files from both bundled and custom agents dirs
  const agentDirs = [];
  if (fs.existsSync(AGENTS_DIR)) agentDirs.push({ dir: AGENTS_DIR, source: 'filesystem' });
  if (fs.existsSync(CUSTOM_AGENTS_DIR)) agentDirs.push({ dir: CUSTOM_AGENTS_DIR, source: 'manual' });

  console.log(`[Agents] Syncing from ${agentDirs.length} source(s): ${agentDirs.map(d => d.dir).join(', ')}`);

  const synced = [];

  for (const { dir, source } of agentDirs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    console.log(`[Agents] Found ${files.length} agent files in ${dir}`);

    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const parsed = parseAgentFile(filePath);
        const existing = await db.getAgent(parsed.name);

        // For custom agents, preserve their source as 'manual'
        const agentSource = source === 'manual' ? 'manual' : 'filesystem';

        await db.upsertAgent(
          parsed.name,
          parsed.description,
          parsed.model,
          parsed.category,
          parsed.promptPreview,
          existing ? existing.screenshot_path : '',
          existing ? existing.rating : 0,
          parsed.fullPrompt,
          agentSource,
          parsed.tools,
          parsed.maxTurns,
          parsed.memory,
          parsed.permissionMode
        );
        synced.push(parsed.name);
      } catch (err) {
        console.error(`[Agents] Error parsing ${file}:`, err.message);
      }
    }
  }

  return synced;
}

// GET /api/agents — list all agents
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let agents;

    if (search) {
      agents = await db.searchAgents(search);
    } else if (category) {
      agents = await db.getAgentsByCategory(category);
    } else {
      agents = await db.getAllAgents();
    }

    res.json(agents);
  } catch (err) {
    console.error('[Agents] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/sync — sync agents from filesystem
router.post('/sync', async (req, res) => {
  try {
    const synced = await syncAgents();
    // Also sync custom agents from DB to filesystem
    await syncCustomAgentsFromDB();
    res.json({ synced: synced.length, agents: synced });
  } catch (err) {
    console.error('[Agents] Sync error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Sync custom/manual agents FROM DB TO filesystem + all user homes
 * This ensures agents created via Agent Creator survive redeploys
 * and are available to Claude CLI in all user terminals.
 */
async function syncCustomAgentsFromDB() {
  try {
    const allAgents = await db.getAllAgents();
    const manualAgents = allAgents.filter(a => a.source === 'manual' && a.full_prompt);

    if (manualAgents.length === 0) return 0;

    // Ensure custom-agents dir exists
    if (!fs.existsSync(CUSTOM_AGENTS_DIR)) {
      fs.mkdirSync(CUSTOM_AGENTS_DIR, { recursive: true });
    }

    let written = 0;
    for (const agent of manualAgents) {
      const fileName = `${agent.name}.md`;
      const filePath = path.join(CUSTOM_AGENTS_DIR, fileName);

      // Write to custom-agents dir (persistent volume)
      const content = agent.full_prompt;
      if (!content || content.length < 50) continue;

      // Always write (overwrite) to ensure latest version
      fs.writeFileSync(filePath, content, 'utf8');
      written++;

      // Also write to bundled agents dir (for workspace.js fallback)
      try {
        const bundledPath = path.join(BUNDLED_AGENTS_DIR, fileName);
        fs.writeFileSync(bundledPath, content, 'utf8');
      } catch (_) {}
    }

    // Copy to ALL existing user homes
    if (fs.existsSync(USERS_DIR)) {
      const userDirs = fs.readdirSync(USERS_DIR).filter(d => {
        try { return fs.statSync(path.join(USERS_DIR, d)).isDirectory(); }
        catch (_) { return false; }
      });

      for (const userId of userDirs) {
        const userAgentsDir = path.join(USERS_DIR, userId, '.claude', 'agents');
        if (!fs.existsSync(userAgentsDir)) {
          fs.mkdirSync(userAgentsDir, { recursive: true });
        }
        for (const agent of manualAgents) {
          if (!agent.full_prompt || agent.full_prompt.length < 50) continue;
          const dest = path.join(userAgentsDir, `${agent.name}.md`);
          fs.writeFileSync(dest, agent.full_prompt, 'utf8');
        }
      }
      console.log(`[Agents] Synced ${written} custom agents to ${userDirs.length} user home(s)`);
    } else {
      console.log(`[Agents] Synced ${written} custom agents to filesystem`);
    }

    return written;
  } catch (err) {
    console.error('[Agents] syncCustomAgentsFromDB error:', err.message);
    return 0;
  }
}

// POST /api/agents/ai-generate — generate agent config using ChatGPT
router.post('/ai-generate', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const { purpose, style, tools_needed, category } = req.body;
    if (!purpose) {
      return res.status(400).json({ error: 'purpose is required' });
    }

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        input: [
          {
            role: 'system',
            content: `You are an expert at creating Claude Code agent prompts. Generate a complete agent configuration.
You must respond ONLY with valid JSON. No markdown. No explanation. No extra text.

Response format:
{
  "name": "kebab-case-name",
  "description": "One line description",
  "model": "sonnet|opus|haiku",
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  "max_turns": 10,
  "permission_mode": "default",
  "prompt": "Full agent instructions/prompt text..."
}`
          },
          {
            role: 'user',
            content: `Create an agent for: ${purpose}\nStyle: ${style || 'professional'}\nTools needed: ${tools_needed || 'all'}\nCategory: ${category || 'uncategorized'}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Agents] AI generate API error:', response.status, errBody);
      return res.status(502).json({ error: 'OpenAI API request failed' });
    }

    const data = await response.json();

    // Parse response object format: output[0].content[0].text
    const outputText = data.output?.[0]?.content?.[0]?.text;
    if (!outputText) {
      console.error('[Agents] AI generate: unexpected response format', JSON.stringify(data));
      return res.status(502).json({ error: 'Unexpected response format from OpenAI' });
    }

    const agentConfig = JSON.parse(outputText);
    res.json(agentConfig);
  } catch (err) {
    console.error('[Agents] AI generate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/import — import agent from .md file content
router.post('/import', async (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: 'filename and content are required' });
    }

    const name = filename.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      return res.status(400).json({ error: 'Invalid filename. Must produce a valid kebab-case name.' });
    }

    const existing = await db.getAgent(name);
    if (existing) return res.status(409).json({ error: `Agent "${name}" already exists` });

    // Write .md file
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${name}.md`), content, 'utf-8');

    // Parse and insert
    const parsed = parseAgentFile(path.join(AGENTS_DIR, `${name}.md`));
    await db.createAgentManual(name, parsed.description, parsed.model, parsed.category, parsed.promptPreview, parsed.fullPrompt, parsed.tools, parsed.maxTurns, parsed.memory, parsed.permissionMode, req.user?.userId);

    const created = await db.getAgent(name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Import error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/delete — delete multiple agents
router.post('/bulk/delete', async (req, res) => {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required' });
    }
    await db.bulkDeleteAgents(names);
    res.json({ ok: true, deleted: names.length });
  } catch (err) {
    console.error('[Agents] Bulk delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/categorize — update category for multiple agents
router.post('/bulk/categorize', async (req, res) => {
  try {
    const { names, category } = req.body;
    if (!Array.isArray(names) || names.length === 0 || !category) {
      return res.status(400).json({ error: 'names array and category are required' });
    }
    await db.bulkUpdateCategory(names, category);
    res.json({ ok: true, updated: names.length });
  } catch (err) {
    console.error('[Agents] Bulk categorize error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/export — export multiple agents as .md content
router.post('/bulk/export', async (req, res) => {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required' });
    }
    const results = [];
    for (const name of names) {
      const agent = await db.getAgent(name);
      if (agent) {
        results.push({ name: agent.name, content: agent.full_prompt || '' });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('[Agents] Bulk export error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/stats — get aggregate agent statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getAgentStats();
    res.json(stats);
  } catch (err) {
    console.error('[Agents] Stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const RESERVED_NAMES = ['sync', 'import', 'ai-generate', 'categories', 'stats', 'bulk'];

// POST /api/agents — create agent manually
router.post('/', async (req, res) => {
  try {
    const { name, description, model, category, prompt, tools, max_turns, memory, permission_mode } = req.body;
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      return res.status(400).json({ error: 'Name must be kebab-case (e.g. my-agent)' });
    }
    if (RESERVED_NAMES.includes(name)) {
      return res.status(400).json({ error: `Name "${name}" is reserved` });
    }
    const existing = await db.getAgent(name);
    if (existing) return res.status(409).json({ error: 'Agent already exists' });

    // Build YAML front matter
    const fmParts = [];
    if (description) fmParts.push(`description: "${description.replace(/"/g, '\\"')}"`);
    if (model) fmParts.push(`model: ${model}`);
    if (tools) fmParts.push(`tools: [${tools}]`);
    if (max_turns) fmParts.push(`max_turns: ${max_turns}`);
    if (memory) fmParts.push(`memory: "${memory.replace(/"/g, '\\"')}"`);
    if (permission_mode) fmParts.push(`permission_mode: ${permission_mode}`);
    const frontMatter = fmParts.length > 0 ? `---\n${fmParts.join('\n')}\n---\n\n` : '';
    const fullContent = frontMatter + (prompt || '');

    // Write .md file
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${name}.md`), fullContent, 'utf-8');

    // Insert in DB
    const promptPreview = fullContent.substring(0, 500);
    await db.createAgentManual(name, description || '', model || '', category || 'uncategorized', promptPreview, fullContent, tools || '', max_turns || 0, memory || '', permission_mode || '', req.user?.userId);

    const created = await db.getAgent(name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/export — export agent as .md file content
router.get('/:name/export', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const content = agent.full_prompt || '';
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${agent.name}.md"`);
    res.send(content);
  } catch (err) {
    console.error('[Agents] Export error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name — get single agent (enriched)
router.get('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.project_count = await db.getAgentProjectCount(req.params.name);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/projects — projects using this agent
router.get('/:name/projects', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const projects = await db.getProjectsByAgent(req.params.name);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/versions — list all versions for an agent
router.get('/:name/versions', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const versions = await db.getAgentVersions(req.params.name);
    res.json(versions);
  } catch (err) {
    console.error('[Agents] Versions list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/versions/:versionId — get specific version
router.get('/:name/versions/:versionId', async (req, res) => {
  try {
    const version = await db.getAgentVersion(req.params.versionId);
    if (!version || version.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Version not found' });
    }
    res.json(version);
  } catch (err) {
    console.error('[Agents] Version get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/versions/:versionId/revert — revert agent to this version
router.post('/:name/versions/:versionId/revert', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const version = await db.getAgentVersion(req.params.versionId);
    if (!version || version.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Snapshot current state before reverting
    const nextVersion = await db.getNextAgentVersionNumber(req.params.name);
    await db.createAgentVersion(
      crypto.randomUUID(),
      agent.name,
      nextVersion,
      agent.full_prompt || '',
      agent.description || '',
      agent.model || '',
      agent.tools || '',
      agent.max_turns || 0,
      agent.memory || '',
      agent.permission_mode || '',
      `Reverted to version ${version.version_number}`
    );

    // Apply the version's state to the agent
    const fields = {
      full_prompt: version.full_prompt,
      prompt_preview: (version.full_prompt || '').substring(0, 500),
      description: version.description,
      model: version.model,
      tools: version.tools,
      max_turns: version.max_turns,
      memory: version.memory,
      permission_mode: version.permission_mode,
    };
    await db.updateAgent(req.params.name, fields);

    // Write reverted content to .md file on disk
    const AGENTS_DIR_LOCAL = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : SYSTEM_AGENTS_DIR;
    if (!fs.existsSync(AGENTS_DIR_LOCAL)) fs.mkdirSync(AGENTS_DIR_LOCAL, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR_LOCAL, `${req.params.name}.md`), version.full_prompt || '', 'utf-8');

    res.json(await db.getAgent(req.params.name));
  } catch (err) {
    console.error('[Agents] Revert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agents/:name — update agent fields
router.put('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Ownership checks
    if (agent.source === 'filesystem') return res.status(403).json({ error: 'Platform agents are read-only' });
    if (agent.created_by && agent.created_by !== req.user.userId && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only the creator can edit this agent' });

    // Auto-version: snapshot current state before applying update
    const versionNumber = await db.getNextAgentVersionNumber(req.params.name);
    const changeSummary = req.body.change_summary || '';
    await db.createAgentVersion(
      crypto.randomUUID(),
      agent.name,
      versionNumber,
      agent.full_prompt || '',
      agent.description || '',
      agent.model || '',
      agent.tools || '',
      agent.max_turns || 0,
      agent.memory || '',
      agent.permission_mode || '',
      changeSummary
    );

    const { description, model, category, full_prompt, tools, max_turns, memory, permission_mode } = req.body;
    const fields = { description, model, category, tools, max_turns, memory, permission_mode };

    // If full_prompt is updated, also update prompt_preview and write .md file
    if (full_prompt !== undefined) {
      fields.full_prompt = full_prompt;
      fields.prompt_preview = full_prompt.substring(0, 500);

      // Write updated content to .md file on disk
      if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
      fs.writeFileSync(path.join(AGENTS_DIR, `${req.params.name}.md`), full_prompt, 'utf-8');
    }

    await db.updateAgent(req.params.name, fields);
    res.json(await db.getAgent(req.params.name));
  } catch (err) {
    console.error('[Agents] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/:name/rating — update rating
router.patch('/:name/rating', async (req, res) => {
  try {
    const { rating } = req.body;
    await db.updateAgentRating(req.params.name, rating);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/:name/screenshot — update agent screenshot
router.patch('/:name/screenshot', async (req, res) => {
  try {
    const { screenshot_path } = req.body;
    if (!screenshot_path) return res.status(400).json({ error: 'screenshot_path required' });
    await db.updateAgentScreenshot(req.params.name, screenshot_path);
    res.json({ ok: true, screenshot_path });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/duplicate — duplicate an agent
router.post('/:name/duplicate', async (req, res) => {
  try {
    const source = await db.getAgent(req.params.name);
    if (!source) return res.status(404).json({ error: 'Source agent not found' });

    const { new_name } = req.body;
    if (!new_name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(new_name)) {
      return res.status(400).json({ error: 'new_name must be kebab-case (e.g. my-agent-copy)' });
    }
    const existing = await db.getAgent(new_name);
    if (existing) return res.status(409).json({ error: 'Agent with that name already exists' });

    // Copy all fields to new agent
    const fullPrompt = source.full_prompt || '';
    const promptPreview = fullPrompt.substring(0, 500);
    await db.createAgentManual(
      new_name,
      source.description || '',
      source.model || '',
      source.category || 'uncategorized',
      promptPreview,
      fullPrompt,
      source.tools || '',
      source.max_turns || 0,
      source.memory || '',
      source.permission_mode || '',
      req.user?.userId
    );

    // Write .md file to disk
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${new_name}.md`), fullPrompt, 'utf-8');

    const created = await db.getAgent(new_name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Duplicate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agents/:name — delete agent
router.delete('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Ownership checks
    if (agent.source === 'filesystem') return res.status(403).json({ error: 'Platform agents cannot be deleted' });
    if (agent.created_by && agent.created_by !== req.user.userId && req.user.role !== 'admin')
      return res.status(403).json({ error: 'Only the creator can delete this agent' });

    await db.deleteAgent(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Agents] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== TEST CHAT — Simulate MCP chat with full agent context ====================

router.post('/:name/test-chat', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }

    // Build rich system prompt: agent prompt + all skills with file content
    let systemPrompt = agent.full_prompt || agent.prompt_preview || '';

    // Inject assigned skills (deep — including skill file content from disk)
    try {
      const skills = await db.getAgentSkills(req.params.name);
      if (skills && skills.length > 0) {
        const skillStorage = require('../skill-storage');
        systemPrompt += '\n\n## Assigned Skills\n\n';
        systemPrompt += 'The following skills are loaded. Use them as reference and follow their patterns:\n\n';
        for (const skill of skills) {
          systemPrompt += `### ${skill.name}\n`;
          if (skill.description) systemPrompt += `${skill.description}\n\n`;
          // Try to read SKILL.md from disk for richer context
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
          // Also read reference files for deeper knowledge
          try {
            const tree = skillStorage.scanSkillTree(skill.slug);
            if (tree) {
              const refFiles = [];
              const walkTree = (items) => {
                for (const item of items) {
                  if (item.type === 'file' && item.path !== 'SKILL.md' && item.path !== (skill.entry_point || 'SKILL.md') && refFiles.length < 4) {
                    refFiles.push(item.path);
                  }
                  if (item.children) walkTree(item.children);
                }
              };
              walkTree(tree);
              for (const refPath of refFiles) {
                const refFile = skillStorage.readSkillFile(skill.slug, refPath);
                if (refFile && refFile.content) {
                  systemPrompt += `#### ${refPath}\n${refFile.content.slice(0, 3000)}\n\n`;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[TestChat] Failed to load skills for', req.params.name, err.message);
    }

    // Call GPT
    const { callGPT5 } = require('../lib/agent-analysis');
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await callGPT5(fullMessages, { max_completion_tokens: 8000 });

    res.json({
      role: 'assistant',
      content: response,
      context: {
        systemPromptLength: systemPrompt.length,
        systemPromptTokens: Math.round(systemPrompt.length / 4),
      },
    });
  } catch (err) {
    console.error('[TestChat] Error:', err.message);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// Auto-sync on first load
let synced = false;
function ensureSynced() {
  if (!synced) {
    syncAgents().catch(err => console.error('[Agents] Auto-sync error:', err.message));
    synced = true;
  }
}

module.exports = router;
module.exports.syncAgents = syncAgents;
module.exports.ensureSynced = ensureSynced;
module.exports.syncCustomAgentsFromDB = syncCustomAgentsFromDB;
