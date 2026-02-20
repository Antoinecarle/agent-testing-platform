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

    await db.createIteration(id, project_id, agent_name, version, title, prompt, parent_id, filePath, '', 'completed', {}, html_content || null);

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

// PUT /api/iterations/detail/:id/html — update iteration HTML content
router.put('/detail/:id/html', async (req, res) => {
  try {
    const { html_content } = req.body;
    if (!html_content) return res.status(400).json({ error: 'html_content required' });
    const iteration = await db.getIteration(req.params.id);
    if (!iteration) return res.status(404).json({ error: 'Iteration not found' });
    if (!iteration.file_path) return res.status(400).json({ error: 'No file path' });
    const htmlPath = path.join(ITERATIONS_DIR, iteration.file_path);
    const htmlDir = path.dirname(htmlPath);
    if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
    fs.writeFileSync(htmlPath, html_content);
    // Also sync to DB for cross-server access
    await db.updateIteration(req.params.id, { html_content });
    res.json({ ok: true, size: html_content.length });
  } catch (err) {
    console.error('[Iterations] Update HTML error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/iterations/detail/:id — rename iteration (update title)
router.patch('/detail/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (title === undefined) return res.status(400).json({ error: 'title required' });
    const iteration = await db.getIteration(req.params.id);
    if (!iteration) return res.status(404).json({ error: 'Iteration not found' });
    await db.updateIteration(req.params.id, title, iteration.prompt, iteration.status, iteration.metadata);
    res.json(await db.getIteration(req.params.id));
  } catch (err) {
    console.error('[Iterations] Rename error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/iterations/detail/:id/restore — copy iteration HTML back to workspace
router.post('/detail/:id/restore', async (req, res) => {
  try {
    const iteration = await db.getIteration(req.params.id);
    if (!iteration) return res.status(404).json({ error: 'Iteration not found' });
    if (!iteration.file_path) return res.status(400).json({ error: 'No file to restore' });

    const htmlPath = path.join(ITERATIONS_DIR, iteration.file_path);
    if (!fs.existsSync(htmlPath)) return res.status(404).json({ error: 'HTML file not found' });

    const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
    const wsDir = path.join(WORKSPACES_DIR, iteration.project_id);
    if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

    const content = fs.readFileSync(htmlPath, 'utf-8');
    fs.writeFileSync(path.join(wsDir, 'index.html'), content);

    res.json({ ok: true, message: `Restored ${iteration.title || 'V' + iteration.version} to workspace` });
  } catch (err) {
    console.error('[Iterations] Restore error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/iterations/:projectId/batch-delete — delete multiple iterations
router.post('/:projectId/batch-delete', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    let deleted = 0;
    for (const id of ids) {
      try {
        const iteration = await db.getIteration(id);
        if (!iteration || iteration.project_id !== req.params.projectId) continue;
        if (iteration.file_path) {
          const fullPath = path.join(ITERATIONS_DIR, path.dirname(iteration.file_path));
          if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        }
        await db.deleteIteration(id);
        deleted++;
      } catch (_) {}
    }

    const count = await db.countIterations(req.params.projectId);
    await db.updateProjectIterationCount(req.params.projectId, count);
    try { await generateWorkspaceContext(req.params.projectId); } catch (_) {}

    res.json({ ok: true, deleted });
  } catch (err) {
    console.error('[Iterations] Batch delete error:', err.message);
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
