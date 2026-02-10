const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();
const SOURCE_DIR = '/root/ProjectList/agent-testing/landing-pages';
const ITERATIONS_DIR = path.join(__dirname, '..', '..', 'data', 'iterations');

// Map folder names to agent names and project groups
function parseLandingPageDir(dirName) {
  // Pattern: agent-name or agent-name-v2
  const match = dirName.match(/^(.+?)(?:-(v\d+[a-z]?))?$/);
  if (!match) return null;

  const baseName = match[1];
  const versionStr = match[2] || 'v1';

  // Map base names to actual agent names
  const agentMap = {
    'brutalist-raw': 'brutalist-raw',
    'cyberpunk-terminal': 'cyberpunk-terminal',
    'dark-luxury': 'dark-luxury',
    'editorial-magazine': 'editorial-magazine',
    'epiminds-dark': 'epiminds-site-architect',
    'glassmorphism-aurora': 'glassmorphism-aurora',
    'organic-earth': 'organic-earth',
    'pop-bento': 'pop-bento-builder',
  };

  const agentName = agentMap[baseName] || baseName;
  const version = parseInt(versionStr.replace(/[^0-9]/g, '')) || 1;
  const versionSuffix = versionStr.replace(/^v\d+/, '');

  return {
    dirName,
    baseName,
    agentName,
    version,
    versionSuffix,
    projectName: baseName,
  };
}

// POST /api/seed — import existing landing pages
router.post('/', async (req, res) => {
  try {
    if (!fs.existsSync(SOURCE_DIR)) {
      return res.status(404).json({ error: 'Source directory not found: ' + SOURCE_DIR });
    }

    const dirs = fs.readdirSync(SOURCE_DIR)
      .filter(d => {
        const stat = fs.statSync(path.join(SOURCE_DIR, d));
        return stat.isDirectory() && fs.existsSync(path.join(SOURCE_DIR, d, 'index.html'));
      });

    // Group by project
    const projectGroups = {};
    for (const dir of dirs) {
      const parsed = parseLandingPageDir(dir);
      if (!parsed) continue;

      if (!projectGroups[parsed.projectName]) {
        projectGroups[parsed.projectName] = {
          agentName: parsed.agentName,
          iterations: [],
        };
      }
      projectGroups[parsed.projectName].iterations.push(parsed);
    }

    const results = { projects: 0, iterations: 0 };

    for (const [projectName, group] of Object.entries(projectGroups)) {
      // Create project
      const projectId = crypto.randomUUID();
      const displayName = projectName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      await db.createProject(projectId, displayName, `Landing page tests with ${group.agentName} agent`, group.agentName);
      results.projects++;

      // Sort iterations by version
      const sorted = group.iterations.sort((a, b) => {
        if (a.version !== b.version) return a.version - b.version;
        return a.versionSuffix.localeCompare(b.versionSuffix);
      });

      let prevId = null;
      let versionCounter = 1;

      for (const iter of sorted) {
        const iterationId = crypto.randomUUID();
        const sourcePath = path.join(SOURCE_DIR, iter.dirName, 'index.html');

        // Copy HTML + images to iterations dir
        const targetDir = path.join(ITERATIONS_DIR, projectId, iterationId);
        fs.mkdirSync(targetDir, { recursive: true });
        fs.copyFileSync(sourcePath, path.join(targetDir, 'index.html'));

        // Copy images/ directory if it exists
        const sourceImagesDir = path.join(SOURCE_DIR, iter.dirName, 'images');
        if (fs.existsSync(sourceImagesDir)) {
          const targetImagesDir = path.join(targetDir, 'images');
          fs.mkdirSync(targetImagesDir, { recursive: true });
          for (const img of fs.readdirSync(sourceImagesDir)) {
            fs.copyFileSync(path.join(sourceImagesDir, img), path.join(targetImagesDir, img));
          }
        }

        const filePath = `${projectId}/${iterationId}/index.html`;
        const title = iter.versionSuffix
          ? `V${iter.version}${iter.versionSuffix}`
          : `V${iter.version}`;

        // Check if this is a branch (e.g., v4a, v4b are siblings of v3 or v4)
        let parentId = prevId;
        if (iter.versionSuffix && versionCounter > 1) {
          // Branch variants share the same parent as the first in this version group
          const sameVersionSiblings = sorted.filter(s =>
            s.version === iter.version && s !== iter && !s.versionSuffix
          );
          if (sameVersionSiblings.length > 0) {
            // Use the previous non-branched iteration as parent
          }
        }

        await db.createIteration(
          iterationId, projectId, iter.agentName, versionCounter,
          title, `Iteration ${title} of ${displayName}`,
          parentId, filePath, '', 'completed', { source: iter.dirName }
        );

        prevId = iterationId;
        versionCounter++;
        results.iterations++;
      }

      // Update project iteration count
      await db.updateProjectIterationCount(projectId, versionCounter - 1);
    }

    res.json({ ok: true, ...results });
  } catch (err) {
    console.error('[Seed] Error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/seed/status — check if seed data exists
router.get('/status', async (req, res) => {
  try {
    const projects = await db.getAllProjects();
    res.json({ seeded: projects.length > 0, projectCount: projects.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
