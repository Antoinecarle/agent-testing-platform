const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { generateWorkspaceContext } = require('../workspace');

const router = express.Router();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');

// Ensure iterations directory exists
if (!fs.existsSync(ITERATIONS_DIR)) fs.mkdirSync(ITERATIONS_DIR, { recursive: true });

// GET /api/iterations/:projectId/tree — get tree structure (MUST be before /:projectId)
router.get('/:projectId/tree', async (req, res) => {
  try {
    const iterations = await db.getIterationsByProject(req.params.projectId);

    // Build tree from flat list
    const map = {};
    const roots = [];
    for (const iter of iterations) {
      map[iter.id] = { ...iter, children: [] };
    }
    for (const iter of iterations) {
      if (iter.parent_id && map[iter.parent_id]) {
        map[iter.parent_id].children.push(map[iter.id]);
      } else {
        roots.push(map[iter.id]);
      }
    }

    res.json(roots);
  } catch (err) {
    console.error('[Iterations] Tree error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/iterations — create iteration
router.post('/', async (req, res) => {
  try {
    const { project_id, agent_name, title, prompt, parent_id, html_content } = req.body;
    if (!project_id || !agent_name) {
      return res.status(400).json({ error: 'project_id and agent_name required' });
    }

    const project = await db.getProject(project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const id = crypto.randomUUID();
    const version = await db.getNextVersion(project_id);

    // Save HTML file if provided
    let filePath = '';
    if (html_content) {
      const projectDir = path.join(ITERATIONS_DIR, project_id);
      if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

      const iterDir = path.join(projectDir, id);
      fs.mkdirSync(iterDir, { recursive: true });
      fs.writeFileSync(path.join(iterDir, 'index.html'), html_content);
      filePath = `${project_id}/${id}/index.html`;
    }

    await db.createIteration(id, project_id, agent_name, version, title, prompt, parent_id, filePath, '', 'completed', {});

    // Update project iteration count
    const count = await db.countIterations(project_id);
    await db.updateProjectIterationCount(project_id, count);

    // Refresh workspace CLAUDE.md with updated tree
    try { await generateWorkspaceContext(project_id); } catch (_) {}

    res.status(201).json(await db.getIteration(id));
  } catch (err) {
    console.error('[Iterations] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/iterations/detail/:id — get single iteration
router.get('/detail/:id', async (req, res) => {
  try {
    const iteration = await db.getIteration(req.params.id);
    if (!iteration) return res.status(404).json({ error: 'Iteration not found' });
    res.json(iteration);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/iterations/detail/:id — delete iteration
router.delete('/detail/:id', async (req, res) => {
  try {
    const iteration = await db.getIteration(req.params.id);
    if (!iteration) return res.status(404).json({ error: 'Iteration not found' });

    // Delete files
    if (iteration.file_path) {
      const fullPath = path.join(ITERATIONS_DIR, path.dirname(iteration.file_path));
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      }
    }

    await db.deleteIteration(req.params.id);

    // Update project count
    if (iteration.project_id) {
      const count = await db.countIterations(iteration.project_id);
      await db.updateProjectIterationCount(iteration.project_id, count);
      // Refresh workspace CLAUDE.md
      try { await generateWorkspaceContext(iteration.project_id); } catch (_) {}
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/iterations/:projectId — list iterations for a project (MUST be last due to wildcard param)
router.get('/:projectId', async (req, res) => {
  try {
    const iterations = await db.getIterationsByProject(req.params.projectId);
    res.json(iterations);
  } catch (err) {
    console.error('[Iterations] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
