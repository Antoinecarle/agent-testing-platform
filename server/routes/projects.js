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
