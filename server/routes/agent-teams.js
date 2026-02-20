const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// GET /api/agent-teams — list teams (filtered by user, admin sees all)
router.get('/', async (req, res) => {
  try {
    const teams = await db.getTeamsByUser(req.user.userId);
    res.json(teams);
  } catch (err) {
    console.error('[AgentTeams] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agent-teams — create team
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const id = crypto.randomUUID();
    await db.createTeam(id, name.trim(), description, req.user.userId);
    const created = await db.getTeam(id);
    res.status(201).json(created);
  } catch (err) {
    console.error('[AgentTeams] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agent-teams/:id — get team with full member details
router.get('/:id', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.user_id && team.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const members = await db.getTeamMembers(req.params.id);
    res.json({ ...team, members });
  } catch (err) {
    console.error('[AgentTeams] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agent-teams/:id — update team
router.put('/:id', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.user_id && team.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { name, description } = req.body;
    await db.updateTeam(
      req.params.id,
      (name || team.name).trim(),
      description !== undefined ? description : team.description
    );
    res.json(await db.getTeam(req.params.id));
  } catch (err) {
    console.error('[AgentTeams] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agent-teams/:id — delete team (cascades members)
router.delete('/:id', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.user_id && team.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.deleteTeam(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AgentTeams] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agent-teams/:id/members — add member
router.post('/:id/members', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { agent_name, role } = req.body;
    if (!agent_name) return res.status(400).json({ error: 'agent_name is required' });

    const agent = await db.getAgent(agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const members = await db.getTeamMembers(req.params.id);
    const sortOrder = members.length;

    const id = crypto.randomUUID();
    await db.addTeamMember(id, req.params.id, agent_name, role, sortOrder);
    const updatedMembers = await db.getTeamMembers(req.params.id);
    res.status(201).json(updatedMembers);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint')) {
      return res.status(409).json({ error: 'Agent is already a member of this team' });
    }
    console.error('[AgentTeams] Add member error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agent-teams/:id/members/reorder — reorder members (must be before /:agentName)
router.put('/:id/members/reorder', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { agent_names } = req.body;
    if (!Array.isArray(agent_names) || agent_names.length === 0) {
      return res.status(400).json({ error: 'agent_names array is required' });
    }

    await db.reorderTeamMembers(req.params.id, agent_names);
    const members = await db.getTeamMembers(req.params.id);
    res.json(members);
  } catch (err) {
    console.error('[AgentTeams] Reorder error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agent-teams/:id/members/:agentName — update member role
router.put('/:id/members/:agentName', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { role } = req.body;
    if (!role || !['leader', 'member', 'reviewer'].includes(role)) {
      return res.status(400).json({ error: 'role must be "leader", "member", or "reviewer"' });
    }

    await db.updateTeamMemberRole(req.params.id, req.params.agentName, role);
    const members = await db.getTeamMembers(req.params.id);
    res.json(members);
  } catch (err) {
    console.error('[AgentTeams] Update member role error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agent-teams/:id/members/:agentName — remove member
router.delete('/:id/members/:agentName', async (req, res) => {
  try {
    const team = await db.getTeam(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    await db.removeTeamMember(req.params.id, req.params.agentName);
    res.json({ ok: true });
  } catch (err) {
    console.error('[AgentTeams] Remove member error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
