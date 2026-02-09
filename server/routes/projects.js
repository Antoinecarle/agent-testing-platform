const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// GET /api/projects — list all projects
router.get('/', (req, res) => {
  try {
    const projects = db.getAllProjects();
    res.json(projects);
  } catch (err) {
    console.error('[Projects] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects — create project
router.post('/', (req, res) => {
  try {
    const { name, description, agent_name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });

    const id = crypto.randomUUID();
    db.createProject(id, name, description, agent_name);
    const project = db.getProject(id);
    res.status(201).json(project);
  } catch (err) {
    console.error('[Projects] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects/fork — create new project from an existing iteration
router.post('/fork', (req, res) => {
  try {
    const { name, description, agent_name, source_project_id, source_iteration_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    if (!source_iteration_id) return res.status(400).json({ error: 'source_iteration_id required' });

    const sourceIteration = db.getIteration(source_iteration_id);
    if (!sourceIteration) return res.status(404).json({ error: 'Source iteration not found' });

    // Create the new project
    const projectId = crypto.randomUUID();
    const agentName = agent_name || sourceIteration.agent_name || '';
    db.createProject(projectId, name, description || '', agentName);

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
    db.createIteration(iterationId, projectId, agentName, 1, `Forked from v${sourceIteration.version}`, '', null, filePath, '', 'completed', { forked_from: source_iteration_id });
    db.updateProjectIterationCount(projectId, 1);

    const project = db.getProject(projectId);
    res.status(201).json({ project, iterationId });
  } catch (err) {
    console.error('[Projects] Fork error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:id — get project
router.get('/:id', (req, res) => {
  try {
    const project = db.getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id — update project
router.put('/:id', (req, res) => {
  try {
    const { name, description, agent_name, status } = req.body;
    const existing = db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    db.updateProject(
      req.params.id,
      name || existing.name,
      description !== undefined ? description : existing.description,
      agent_name !== undefined ? agent_name : existing.agent_name,
      status || existing.status
    );

    res.json(db.getProject(req.params.id));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id — delete project
router.delete('/:id', (req, res) => {
  try {
    db.deleteProject(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
