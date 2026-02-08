const express = require('express');
const db = require('../db');
const { isSessionAlive, getWorkspacePath } = require('../terminal');
const { generateWorkspaceContext, writeBranchContext } = require('../workspace');
const { manualImport, watchProject } = require('../watcher');

const router = express.Router();

// GET /api/terminal-tabs/:projectId — get saved tabs for a project
router.get('/:projectId', (req, res) => {
  try {
    const tabs = db.getTerminalTabsByProject(req.params.projectId);
    // Mark which sessions are still alive
    const result = tabs.map(tab => ({
      ...tab,
      alive: tab.session_id ? isSessionAlive(tab.session_id) : false,
    }));
    res.json(result);
  } catch (err) {
    console.error('[TerminalTabs] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs — save/update a tab
router.post('/', (req, res) => {
  try {
    const { id, project_id, session_id, name } = req.body;
    if (!id || !project_id) {
      return res.status(400).json({ error: 'id and project_id required' });
    }
    const cwd = getWorkspacePath(project_id);
    db.upsertTerminalTab(id, project_id, session_id || '', name || '', cwd);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TerminalTabs] Save error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/terminal-tabs/:id/session — update session ID for a tab
router.put('/:id/session', (req, res) => {
  try {
    const { session_id } = req.body;
    db.updateTerminalTabSession(req.params.id, session_id || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/terminal-tabs/:id — remove a tab
router.delete('/:id', (req, res) => {
  try {
    db.removeTerminalTab(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs/:projectId/import — manually import index.html as iteration
router.post('/:projectId/import', (req, res) => {
  try {
    // Ensure watcher is running
    watchProject(req.params.projectId);
    const iterationId = manualImport(req.params.projectId);
    if (!iterationId) {
      return res.status(404).json({ error: 'No new index.html found or no changes detected' });
    }
    res.json({ ok: true, iterationId });
  } catch (err) {
    console.error('[TerminalTabs] Import error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs/:projectId/branch-context — set branch parent for next import
router.post('/:projectId/branch-context', (req, res) => {
  try {
    const { parentId } = req.body;
    const projectId = req.params.projectId;
    // Write branch context file
    writeBranchContext(projectId, parentId !== undefined ? parentId : null);
    // Regenerate CLAUDE.md with branch context
    generateWorkspaceContext(projectId, { parentId: parentId !== undefined ? parentId : null });
    res.json({ ok: true });
  } catch (err) {
    console.error('[TerminalTabs] Branch context error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs/:projectId/refresh-context — regenerate CLAUDE.md
router.post('/:projectId/refresh-context', (req, res) => {
  try {
    const result = generateWorkspaceContext(req.params.projectId);
    if (!result) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true, path: result });
  } catch (err) {
    console.error('[TerminalTabs] Refresh context error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
