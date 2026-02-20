/**
 * Dev Server API Routes
 *
 * Manages Node.js dev server lifecycle for projects.
 */

const express = require('express');
const router = express.Router();
const { startDevServer, stopDevServer, getDevServerStatus, getDevServerPort, isNodeProject } = require('../lib/dev-server');
const db = require('../db');

// POST /api/dev-server/:projectId/start — start dev server
router.post('/:projectId/start', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    if (!isNodeProject(projectId)) {
      return res.status(400).json({ error: 'Not a Node.js project (no package.json)' });
    }

    const result = await startDevServer(projectId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dev-server/:projectId/stop — stop dev server
router.post('/:projectId/stop', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await db.getProject(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id !== req.user.userId) return res.status(403).json({ error: 'Not authorized' });

    stopDevServer(projectId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dev-server/:projectId/status — get dev server status
router.get('/:projectId/status', async (req, res) => {
  try {
    const { projectId } = req.params;
    const status = getDevServerStatus(projectId);
    status.isNodeProject = isNodeProject(projectId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
