const express = require('express');
const db = require('../db');
const { isSessionAlive, getWorkspacePath } = require('../terminal');
const { generateWorkspaceContext, writeBranchContext } = require('../workspace');

let watcher;
try {
  watcher = require('../watcher');
} catch (_) {
  console.warn('[TerminalTabs] Watcher module not available');
}

const router = express.Router();

// GET /api/terminal-tabs/:projectId — get saved tabs for a project
router.get('/:projectId', async (req, res) => {
  try {
    const tabs = await db.getTerminalTabsByProject(req.params.projectId);
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
router.post('/', async (req, res) => {
  try {
    const { id, project_id, session_id, name } = req.body;
    if (!id || !project_id) {
      return res.status(400).json({ error: 'id and project_id required' });
    }
    const cwd = getWorkspacePath(project_id);
    await db.upsertTerminalTab(id, project_id, session_id || '', name || '', cwd);
    res.json({ ok: true });
  } catch (err) {
    console.error('[TerminalTabs] Save error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/terminal-tabs/:id/session — update session ID for a tab
router.put('/:id/session', async (req, res) => {
  try {
    const { session_id } = req.body;
    await db.updateTerminalTabSession(req.params.id, session_id || '');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/terminal-tabs/:id — remove a tab
router.delete('/:id', async (req, res) => {
  try {
    await db.removeTerminalTab(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs/:projectId/import — manually import index.html as iteration
router.post('/:projectId/import', async (req, res) => {
  try {
    if (!watcher) return res.status(503).json({ error: 'Terminal/watcher not available in this environment' });
    // Ensure watcher is running
    watcher.watchProject(req.params.projectId);
    const iterationId = await watcher.manualImport(req.params.projectId);
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
router.post('/:projectId/branch-context', async (req, res) => {
  try {
    const { parentId } = req.body;
    const projectId = req.params.projectId;
    // Write branch context file
    writeBranchContext(projectId, parentId !== undefined ? parentId : null);
    // Regenerate CLAUDE.md with branch context
    await generateWorkspaceContext(projectId, { parentId: parentId !== undefined ? parentId : null });
    res.json({ ok: true });
  } catch (err) {
    console.error('[TerminalTabs] Branch context error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/terminal-tabs/:projectId/refresh-context — regenerate CLAUDE.md
router.post('/:projectId/refresh-context', async (req, res) => {
  try {
    const result = await generateWorkspaceContext(req.params.projectId);
    if (!result) return res.status(404).json({ error: 'Project not found' });
    res.json({ ok: true, path: result });
  } catch (err) {
    console.error('[TerminalTabs] Refresh context error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
