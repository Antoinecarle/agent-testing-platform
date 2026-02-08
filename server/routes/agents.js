const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

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

  // Try to detect category from name
  if (name.includes('epiminds')) category = 'epiminds';
  else if (name.includes('seo') || name.includes('geo')) category = 'seo';
  else if (name.includes('reviewer') || name.includes('code')) category = 'dev-tools';
  else if (name.includes('builder') || name.includes('architect')) category = 'builders';
  else if (name.includes('animation') || name.includes('scroll')) category = 'animation';
  else if (name.includes('design') || name.includes('theme') || name.includes('stylist')) category = 'design';
  else category = 'style';

  const promptPreview = content.substring(0, 500);
  const fullPrompt = content;

  return { name, description, model, category, promptPreview, fullPrompt, tools, maxTurns, memory, permissionMode };
}

// Sync agents from filesystem to DB
function syncAgents() {
  if (!fs.existsSync(AGENTS_DIR)) return [];

  const files = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
  const synced = [];

  for (const file of files) {
    try {
      const filePath = path.join(AGENTS_DIR, file);
      const parsed = parseAgentFile(filePath);
      const existing = db.getAgent(parsed.name);

      db.upsertAgent(
        parsed.name,
        parsed.description,
        parsed.model,
        parsed.category,
        parsed.promptPreview,
        existing ? existing.screenshot_path : '',
        existing ? existing.rating : 0,
        parsed.fullPrompt,
        'filesystem',
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

  return synced;
}

// GET /api/agents — list all agents
router.get('/', (req, res) => {
  try {
    const { category, search } = req.query;
    let agents;

    if (search) {
      agents = db.searchAgents(search);
    } else if (category) {
      agents = db.getAgentsByCategory(category);
    } else {
      agents = db.getAllAgents();
    }

    res.json(agents);
  } catch (err) {
    console.error('[Agents] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/categories — get unique categories
router.get('/categories', (req, res) => {
  try {
    const agents = db.getAllAgents();
    const categories = [...new Set(agents.map(a => a.category))].sort();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/sync — sync agents from filesystem
router.post('/sync', (req, res) => {
  try {
    const synced = syncAgents();
    res.json({ synced: synced.length, agents: synced });
  } catch (err) {
    console.error('[Agents] Sync error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents — create agent manually
router.post('/', (req, res) => {
  try {
    const { name, description, model, category, prompt, tools, max_turns, memory, permission_mode } = req.body;
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      return res.status(400).json({ error: 'Name must be kebab-case (e.g. my-agent)' });
    }
    const existing = db.getAgent(name);
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
    db.createAgentManual(name, description || '', model || '', category || 'uncategorized', promptPreview, fullContent, tools || '', max_turns || 0, memory || '', permission_mode || '');

    const created = db.getAgent(name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name — get single agent (enriched)
router.get('/:name', (req, res) => {
  try {
    const agent = db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.project_count = db.getAgentProjectCount(req.params.name);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/projects — projects using this agent
router.get('/:name/projects', (req, res) => {
  try {
    const agent = db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const projects = db.getProjectsByAgent(req.params.name);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agents/:name — update agent fields
router.put('/:name', (req, res) => {
  try {
    const agent = db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { description, model, category, prompt_preview } = req.body;
    db.updateAgent(req.params.name, { description, model, category, prompt_preview });
    res.json(db.getAgent(req.params.name));
  } catch (err) {
    console.error('[Agents] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/:name/rating — update rating
router.patch('/:name/rating', (req, res) => {
  try {
    const { rating } = req.body;
    db.updateAgentRating(req.params.name, rating);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agents/:name — delete agent
router.delete('/:name', (req, res) => {
  try {
    const agent = db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    db.deleteAgent(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Agents] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Auto-sync on first load
let synced = false;
function ensureSynced() {
  if (!synced) {
    syncAgents();
    synced = true;
  }
}

module.exports = router;
module.exports.syncAgents = syncAgents;
module.exports.ensureSynced = ensureSynced;
