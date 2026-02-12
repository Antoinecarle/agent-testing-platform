const express = require('express');
const db = require('../db');

const router = express.Router();

// Helper: generate slug from name
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ==================== STATIC ROUTES (must be before :id) ====================

// GET /api/skills — list all skills (with optional search/category filter)
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let skills;
    if (search) {
      skills = await db.searchSkills(search);
    } else if (category) {
      skills = await db.getSkillsByCategory(category);
    } else {
      skills = await db.getAllSkills();
    }
    res.json(skills);
  } catch (err) {
    console.error('[Skills] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/stats — skill statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getSkillStats();
    res.json(stats);
  } catch (err) {
    console.error('[Skills] Stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/categories — list unique skill categories
router.get('/categories', async (req, res) => {
  try {
    const skills = await db.getAllSkills();
    const cats = [...new Set(skills.map(s => s.category).filter(Boolean))].sort();
    res.json(cats);
  } catch (err) {
    console.error('[Skills] Categories error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills — create a new skill
router.post('/', async (req, res) => {
  try {
    const { name, description, prompt, category, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const slug = slugify(name.trim());
    if (!slug) {
      return res.status(400).json({ error: 'Invalid name — must produce a valid slug' });
    }

    // Check for duplicate slug
    const existing = await db.getSkillBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: `Skill with slug "${slug}" already exists` });
    }

    const skill = await db.createSkill(
      name.trim(), slug, description, prompt, category, icon, color, req.user?.userId
    );
    res.status(201).json(skill);
  } catch (err) {
    console.error('[Skills] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/bulk — create multiple skills at once
router.post('/bulk', async (req, res) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: 'skills array is required' });
    }

    const created = [];
    const errors = [];

    for (const s of skills) {
      if (!s.name || !s.name.trim()) {
        errors.push({ name: s.name, error: 'Name is required' });
        continue;
      }
      const slug = slugify(s.name.trim());
      const existing = await db.getSkillBySlug(slug);
      if (existing) {
        errors.push({ name: s.name, error: 'Already exists' });
        continue;
      }
      try {
        const skill = await db.createSkill(
          s.name.trim(), slug, s.description, s.prompt, s.category, s.icon, s.color, req.user?.userId
        );
        created.push(skill);
      } catch (err) {
        errors.push({ name: s.name, error: err.message });
      }
    }

    res.status(201).json({ created: created.length, errors: errors.length, skills: created, failures: errors });
  } catch (err) {
    console.error('[Skills] Bulk create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AGENT-SCOPED ROUTES (before :id) ====================

// GET /api/skills/agent/:agentName — get all skills for an agent
router.get('/agent/:agentName', async (req, res) => {
  try {
    const skills = await db.getAgentSkills(req.params.agentName);
    res.json(skills);
  } catch (err) {
    console.error('[Skills] Agent skills error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/agent/:agentName/bulk — assign multiple skills to one agent
router.post('/agent/:agentName/bulk', async (req, res) => {
  try {
    const { skill_ids } = req.body;
    if (!Array.isArray(skill_ids) || skill_ids.length === 0) {
      return res.status(400).json({ error: 'skill_ids array is required' });
    }
    await db.bulkAssignSkillsToAgent(req.params.agentName, skill_ids);
    const skills = await db.getAgentSkills(req.params.agentName);
    res.json(skills);
  } catch (err) {
    console.error('[Skills] Bulk assign to agent error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PARAMETERIZED :id ROUTES ====================

// GET /api/skills/:id — get single skill (enriched with agents)
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const agents = await db.getSkillAgents(req.params.id);
    res.json({ ...skill, agents });
  } catch (err) {
    console.error('[Skills] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/skills/:id — update skill
router.put('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const { name, description, prompt, category, icon, color } = req.body;
    const fields = { description, prompt, category, icon, color };

    // If name changed, update slug too
    if (name !== undefined && name.trim() !== skill.name) {
      fields.name = name.trim();
      fields.slug = slugify(name.trim());
      // Check slug uniqueness
      const dup = await db.getSkillBySlug(fields.slug);
      if (dup && dup.id !== skill.id) {
        return res.status(409).json({ error: `Skill with slug "${fields.slug}" already exists` });
      }
    }

    await db.updateSkill(req.params.id, fields);
    const updated = await db.getSkill(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('[Skills] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/skills/:id — delete skill
router.delete('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    await db.deleteSkill(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Skills] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/assign/:agentName — assign skill to agent
router.post('/:id/assign/:agentName', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const agent = await db.getAgent(req.params.agentName);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    await db.assignSkillToAgent(req.params.agentName, req.params.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.message && err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Skill already assigned to this agent' });
    }
    console.error('[Skills] Assign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/skills/:id/unassign/:agentName — unassign skill from agent
router.delete('/:id/unassign/:agentName', async (req, res) => {
  try {
    await db.unassignSkillFromAgent(req.params.agentName, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Skills] Unassign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/bulk-assign — assign skill to multiple agents
router.post('/:id/bulk-assign', async (req, res) => {
  try {
    const { agent_names } = req.body;
    if (!Array.isArray(agent_names) || agent_names.length === 0) {
      return res.status(400).json({ error: 'agent_names array is required' });
    }
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    await db.bulkAssignSkill(req.params.id, agent_names);
    const agents = await db.getSkillAgents(req.params.id);
    res.json({ ok: true, agent_count: agents.length });
  } catch (err) {
    console.error('[Skills] Bulk assign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
