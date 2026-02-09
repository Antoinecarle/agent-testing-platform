const express = require('express');
const crypto = require('crypto');
const db = require('../db');

const router = express.Router();

// POST /api/agent-teams/:teamId/runs — create a team run
router.post('/:teamId/runs', (req, res) => {
  try {
    const team = db.getTeam(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const { project_id, config } = req.body;
    const id = crypto.randomUUID();
    db.createTeamRun(id, req.params.teamId, project_id || null, config);
    const run = db.getTeamRun(id);
    res.status(201).json(run);
  } catch (err) {
    console.error('[TeamRuns] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agent-teams/:teamId/runs — list all runs for a team
router.get('/:teamId/runs', (req, res) => {
  try {
    const team = db.getTeam(req.params.teamId);
    if (!team) return res.status(404).json({ error: 'Team not found' });

    const runs = db.getTeamRuns(req.params.teamId);
    const members = db.getTeamMembers(req.params.teamId);
    res.json({ runs, members });
  } catch (err) {
    console.error('[TeamRuns] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agent-teams/:teamId/runs/:runId — get run details with logs
router.get('/:teamId/runs/:runId', (req, res) => {
  try {
    const run = db.getTeamRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.team_id !== req.params.teamId) return res.status(404).json({ error: 'Run not found' });

    const logs = db.getTeamRunLogs(req.params.runId);
    const members = db.getTeamMembers(req.params.teamId);
    res.json({ ...run, logs, members });
  } catch (err) {
    console.error('[TeamRuns] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agent-teams/:teamId/runs/:runId/start — set status to 'running'
router.post('/:teamId/runs/:runId/start', (req, res) => {
  try {
    const run = db.getTeamRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.team_id !== req.params.teamId) return res.status(404).json({ error: 'Run not found' });

    db.updateTeamRunStatus(req.params.runId, 'running');
    const updated = db.getTeamRun(req.params.runId);
    res.json(updated);
  } catch (err) {
    console.error('[TeamRuns] Start error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agent-teams/:teamId/runs/:runId/complete — set status to 'completed' or 'failed'
router.post('/:teamId/runs/:runId/complete', (req, res) => {
  try {
    const run = db.getTeamRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.team_id !== req.params.teamId) return res.status(404).json({ error: 'Run not found' });

    const { status } = req.body;
    if (!status || !['completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'status must be "completed" or "failed"' });
    }

    db.updateTeamRunStatus(req.params.runId, status);
    const updated = db.getTeamRun(req.params.runId);
    res.json(updated);
  } catch (err) {
    console.error('[TeamRuns] Complete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agent-teams/:teamId/runs/:runId/log — add a log entry
router.post('/:teamId/runs/:runId/log', (req, res) => {
  try {
    const run = db.getTeamRun(req.params.runId);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    if (run.team_id !== req.params.teamId) return res.status(404).json({ error: 'Run not found' });

    const { agent_name, message, log_type } = req.body;
    const id = crypto.randomUUID();
    db.addTeamRunLog(id, req.params.runId, agent_name, message, log_type);
    res.status(201).json({ id, run_id: req.params.runId, agent_name: agent_name || '', message: message || '', log_type: log_type || 'info' });
  } catch (err) {
    console.error('[TeamRuns] Log error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
