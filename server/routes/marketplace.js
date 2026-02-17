const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

const { syncCustomAgentsFromDB } = require('./agents');

const router = express.Router();

const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');

// GET /api/marketplace — list marketplace agents
router.get('/', async (req, res) => {
  try {
    const { search, category, sort, limit, offset } = req.query;
    const agents = await db.getMarketplaceAgents({
      search, category,
      sortBy: sort || 'popular',
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(agents);
  } catch (err) {
    console.error('[Marketplace] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/:name — agent detail + showcases
router.get('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const [showcases, projectCount, projects] = await Promise.all([
      db.getShowcasesByAgent(req.params.name),
      db.getAgentProjectCount(req.params.name),
      db.getProjectsByAgent(req.params.name),
    ]);

    // Get creator info
    let creator = null;
    if (agent.created_by) {
      const user = await db.getUserById(agent.created_by);
      if (user) creator = { id: user.id, email: user.email, display_name: user.display_name };
    }

    // Get iterations for all projects of this agent (for iteration browser)
    const projectsList = projects.slice(0, 20);
    const iterationsByProject = {};
    await Promise.all(projectsList.map(async (p) => {
      const iters = await db.getIterationsByProject(p.id);
      if (iters && iters.length > 0) iterationsByProject[p.id] = iters;
    }));

    res.json({
      ...agent,
      project_count: projectCount,
      showcases,
      projects: projectsList,
      iterations_by_project: iterationsByProject,
      creator,
    });
  } catch (err) {
    console.error('[Marketplace] Detail error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/marketplace/:name/download — download .md file
router.get('/:name/download', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    await db.incrementAgentDownloads(req.params.name);

    const content = agent.full_prompt || '';
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${agent.name}.md"`);
    res.send(content);
  } catch (err) {
    console.error('[Marketplace] Download error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/:name/fork — fork an agent to your account
router.post('/:name/fork', async (req, res) => {
  try {
    const source = await db.getAgent(req.params.name);
    if (!source) return res.status(404).json({ error: 'Agent not found' });

    // Generate fork name: original-name-fork or original-name-fork-2, etc.
    let forkName = req.body.new_name;
    if (!forkName) {
      forkName = `${source.name}-fork`;
      let suffix = 1;
      while (await db.getAgent(forkName)) {
        suffix++;
        forkName = `${source.name}-fork-${suffix}`;
      }
    } else {
      // Sanitize user-provided name
      forkName = forkName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      const existing = await db.getAgent(forkName);
      if (existing) return res.status(409).json({ error: 'An agent with that name already exists' });
    }

    // Copy all fields to new agent
    const fullPrompt = source.full_prompt || '';
    const promptPreview = fullPrompt.substring(0, 500);
    await db.createAgentManual(
      forkName,
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

    // Set forked_from on the new agent
    await db.supabase.from('agents').update({ forked_from: source.name }).eq('name', forkName);

    // Increment fork count on the original
    await db.incrementAgentForks(req.params.name);

    // Write .md file to disk
    if (!fs.existsSync(BUNDLED_AGENTS_DIR)) fs.mkdirSync(BUNDLED_AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(BUNDLED_AGENTS_DIR, `${forkName}.md`), fullPrompt, 'utf-8');

    // Sync to user homes
    try { await syncCustomAgentsFromDB(); } catch (_) {}

    const created = await db.getAgent(forkName);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Marketplace] Fork error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/marketplace/:name/showcases — add showcase
router.post('/:name/showcases', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Authorization: creator or admin only
    const isCreator = agent.created_by && agent.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the agent creator or an admin can manage showcases' });
    }

    // Max 6 showcases
    const count = await db.countShowcases(req.params.name);
    if (count >= 6) {
      return res.status(400).json({ error: 'Maximum 6 showcases per agent' });
    }

    const { project_id, iteration_id, title, description } = req.body;
    if (!project_id || !iteration_id) {
      return res.status(400).json({ error: 'project_id and iteration_id are required' });
    }

    const id = crypto.randomUUID();
    await db.createShowcase(id, req.params.name, project_id, iteration_id, title || '', description || '', count);

    const showcase = await db.getShowcase(id);
    res.status(201).json(showcase);
  } catch (err) {
    console.error('[Marketplace] Add showcase error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/marketplace/:name/showcases/:id — remove showcase
router.delete('/:name/showcases/:id', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const isCreator = agent.created_by && agent.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the agent creator or an admin can manage showcases' });
    }

    const showcase = await db.getShowcase(req.params.id);
    if (!showcase || showcase.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Showcase not found' });
    }

    await db.deleteShowcase(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Marketplace] Delete showcase error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/marketplace/:name/showcases/reorder — reorder showcases
router.put('/:name/showcases/reorder', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const isCreator = agent.created_by && agent.created_by === req.user.userId;
    const isAdmin = req.user.role === 'admin';
    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: 'Only the agent creator or an admin can manage showcases' });
    }

    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'ids array is required' });
    }

    await db.reorderShowcases(req.params.name, ids);
    const showcases = await db.getShowcasesByAgent(req.params.name);
    res.json(showcases);
  } catch (err) {
    console.error('[Marketplace] Reorder showcases error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
