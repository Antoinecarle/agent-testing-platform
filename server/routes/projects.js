const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { validate, createProjectSchema, updateProjectSchema, forkProjectSchema } = require('../middleware/validate');
const { resolveOrg, checkPlanLimit } = require('../middleware/rbac');

const router = express.Router();

// GET /api/projects — list projects (filtered by user, admin sees all)
router.get('/', async (req, res) => {
  try {
    const projects = await db.getProjectsByUser(req.user.userId);
    res.json(projects);
  } catch (err) {
    console.error('[Projects] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects — create project (solo or orchestra)
router.post('/', resolveOrg, checkPlanLimit('projects'), validate(createProjectSchema), async (req, res) => {
  try {
    const { name, description, agent_name, mode, team_config, project_type } = req.body;

    const projectId = crypto.randomUUID();
    let teamId = null;

    // Orchestra mode: create team with orchestrator + workers
    if (mode === 'orchestra' && team_config) {
      teamId = crypto.randomUUID();
      await db.createTeam(teamId, team_config.name || `${name} Team`, team_config.description || '', req.user.userId);

      if (team_config.orchestrator) {
        await db.addTeamMember(crypto.randomUUID(), teamId, team_config.orchestrator, 'leader', 0);
      }
      if (team_config.workers && Array.isArray(team_config.workers)) {
        for (let i = 0; i < team_config.workers.length; i++) {
          await db.addTeamMember(crypto.randomUUID(), teamId, team_config.workers[i].agent_name, 'member', i + 1);
        }
      }
    }

    const orchestratorAgent = (mode === 'orchestra' && team_config?.orchestrator)
      ? team_config.orchestrator
      : (agent_name || '');

    await db.createProject(projectId, name, description, orchestratorAgent, mode || 'solo', teamId, req.user.userId, project_type || 'html', req.organizationId || null);
    const project = await db.getProject(projectId);
    res.status(201).json(project);
  } catch (err) {
    console.error('[Projects] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects/fork — create new project from an existing iteration
router.post('/fork', validate(forkProjectSchema), async (req, res) => {
  try {
    const { name, description, agent_name, source_project_id, source_iteration_id } = req.body;

    const sourceIteration = await db.getIteration(source_iteration_id);
    if (!sourceIteration) return res.status(404).json({ error: 'Source iteration not found' });

    // Create the new project
    const projectId = crypto.randomUUID();
    const agentName = agent_name || sourceIteration.agent_name || '';
    await db.createProject(projectId, name, description || '', agentName, 'solo', null, req.user.userId);

    // Create v1 iteration in the new project
    const iterationId = crypto.randomUUID();
    const path = require('path');
    const fs = require('fs');
    const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
    const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');

    const sourceDir = path.join(ITERATIONS_DIR, source_project_id || sourceIteration.project_id, source_iteration_id);
    const destDir = path.join(ITERATIONS_DIR, projectId, iterationId);

    // Copy iteration files
    if (fs.existsSync(sourceDir)) {
      fs.mkdirSync(destDir, { recursive: true });
      const files = fs.readdirSync(sourceDir);
      for (const file of files) {
        fs.copyFileSync(path.join(sourceDir, file), path.join(destDir, file));
      }
    }

    const filePath = `${projectId}/${iterationId}/index.html`;
    await db.createIteration(iterationId, projectId, agentName, 1, `Forked from v${sourceIteration.version}`, '', null, filePath, '', 'completed', { forked_from: source_iteration_id });
    await db.updateProjectIterationCount(projectId, 1);

    const project = await db.getProject(projectId);
    res.status(201).json({ project, iterationId });
  } catch (err) {
    console.error('[Projects] Fork error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id — get project (enriched with team data for orchestra)
router.get('/:id', async (req, res) => {
  try {
    const { project, team, members } = await db.getProjectWithTeam(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id && project.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    res.json({ ...project, team: team || null, team_members: members || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id — update project
router.put('/:id', validate(updateProjectSchema), async (req, res) => {
  try {
    const { name, description, agent_name, status, project_type } = req.body;
    const existing = await db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    if (existing.user_id && existing.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await db.updateProject(
      req.params.id,
      name || existing.name,
      description !== undefined ? description : existing.description,
      agent_name !== undefined ? agent_name : existing.agent_name,
      status || existing.status,
      undefined,
      undefined,
      project_type !== undefined ? project_type : existing.project_type
    );

    res.json(await db.getProject(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id — delete project
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });
    if (existing.user_id && existing.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await db.deleteProject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
