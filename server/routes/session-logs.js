/**
 * Session Logs API
 *
 * Provides endpoints to read Claude CLI session activity logs
 * for the Activity panel in the terminal area.
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { getUserHomePath } = require('../user-home');
const { listSessionFiles, parseSessionFile, getLatestSession, computeProjectHash, groupEventsIntoTurns } = require('../lib/session-parser');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'));

/**
 * GET /api/session-logs/:projectId/sessions
 * List all available Claude session logs for a project
 */
router.get('/:projectId/sessions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const userHome = getUserHomePath(userId);
    const workspacePath = path.resolve(DATA_DIR, 'workspaces', projectId);
    const sessions = listSessionFiles(userHome, workspacePath);

    res.json({ sessions });
  } catch (err) {
    console.error('[SessionLogs] List error:', err.message);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

/**
 * GET /api/session-logs/:projectId/activity
 * Get parsed activity events from the latest (or specified) session
 * Query params: ?sessionId=xxx&limit=200&since=ISO_DATE
 */
router.get('/:projectId/activity', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId, limit = 200, since } = req.query;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const userHome = getUserHomePath(userId);
    const workspacePath = path.resolve(DATA_DIR, 'workspaces', projectId);

    let sessionFile;
    if (sessionId) {
      const projectHash = computeProjectHash(workspacePath);
      const filePath = path.join(userHome, '.claude', 'projects', projectHash, `${sessionId}.jsonl`);
      sessionFile = { filePath, sessionId };
    } else {
      sessionFile = getLatestSession(userHome, workspacePath);
    }

    if (!sessionFile) {
      return res.json({ events: [], sessionId: null, message: 'No session logs found' });
    }

    const result = await parseSessionFile(sessionFile.filePath, {
      limit: Math.min(parseInt(limit) || 200, 500),
      since: since || null,
    });

    res.json({
      ...result,
      sessionId: sessionFile.sessionId,
    });
  } catch (err) {
    console.error('[SessionLogs] Activity error:', err.message);
    res.status(500).json({ error: 'Failed to parse session' });
  }
});

/**
 * GET /api/session-logs/:projectId/turns
 * Get session events pre-grouped into conversation turns
 * Query params: ?sessionId=xxx&limit=500
 */
router.get('/:projectId/turns', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { sessionId, limit = 500 } = req.query;
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const userHome = getUserHomePath(userId);
    const workspacePath = path.resolve(DATA_DIR, 'workspaces', projectId);

    let sessionFile;
    if (sessionId) {
      const projectHash = computeProjectHash(workspacePath);
      const filePath = path.join(userHome, '.claude', 'projects', projectHash, `${sessionId}.jsonl`);
      sessionFile = { filePath, sessionId };
    } else {
      sessionFile = getLatestSession(userHome, workspacePath);
    }

    if (!sessionFile) {
      return res.json({ turns: [], sessionId: null, message: 'No session logs found' });
    }

    const result = await parseSessionFile(sessionFile.filePath, {
      limit: Math.min(parseInt(limit) || 500, 1000),
    });

    const turns = groupEventsIntoTurns(result.events || []);

    res.json({
      turns,
      sessionId: sessionFile.sessionId,
      total: result.total,
    });
  } catch (err) {
    console.error('[SessionLogs] Turns error:', err.message);
    res.status(500).json({ error: 'Failed to parse session turns' });
  }
});

module.exports = router;
