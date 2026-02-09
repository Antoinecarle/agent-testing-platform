#!/usr/bin/env node
/**
 * CLI helper to register an HTML file as a new iteration.
 * Used as a fallback when the auto-watcher doesn't detect the file.
 *
 * Usage from terminal:
 *   node /app/server/cli/register-iteration.js <projectId> [htmlFile]
 *
 * If htmlFile is omitted, defaults to ./index.html in the workspace.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'platform.db');

// Minimal DB access (no need for the full server)
let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
} catch (err) {
  console.error('Error: Cannot open database at', DB_PATH);
  console.error(err.message);
  process.exit(1);
}

const projectId = process.argv[2];
if (!projectId) {
  // Try to detect projectId from current working directory
  const cwd = process.cwd();
  const wsMatch = cwd.match(/workspaces\/([a-f0-9-]+)/);
  if (wsMatch) {
    console.log(`Auto-detected project: ${wsMatch[1]}`);
    run(wsMatch[1], process.argv[3]);
  } else {
    console.error('Usage: node register-iteration.js <projectId> [htmlFile]');
    console.error('  Or run from within a workspace directory (auto-detects projectId)');
    process.exit(1);
  }
} else {
  run(projectId, process.argv[3]);
}

function run(projectId, htmlFileArg) {
  // Find HTML file
  const wsDir = path.join(DATA_DIR, 'workspaces', projectId);
  let htmlPath;

  if (htmlFileArg) {
    htmlPath = path.resolve(htmlFileArg);
  } else {
    // Look for index.html in workspace
    htmlPath = path.join(wsDir, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      // Look for any .html file
      try {
        const htmlFiles = fs.readdirSync(wsDir).filter(f => f.endsWith('.html') && !f.startsWith('.'));
        if (htmlFiles.length > 0) {
          htmlPath = path.join(wsDir, htmlFiles[0]);
          console.log(`Found: ${htmlFiles[0]}`);
        }
      } catch (_) {}
    }
  }

  if (!fs.existsSync(htmlPath)) {
    console.error(`Error: No HTML file found at ${htmlPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(htmlPath, 'utf-8');
  if (content.trim().length < 50) {
    console.error('Error: HTML file is too small (< 50 chars)');
    process.exit(1);
  }

  // Get project info
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    console.error(`Error: Project ${projectId} not found in database`);
    process.exit(1);
  }

  // Get next version
  const maxVersion = db.prepare('SELECT MAX(version) as v FROM iterations WHERE project_id = ?').get(projectId);
  const version = (maxVersion?.v || 0) + 1;

  // Get latest iteration for parent chain
  const latest = db.prepare('SELECT id FROM iterations WHERE project_id = ? ORDER BY version DESC LIMIT 1').get(projectId);
  const parentId = latest?.id || null;

  // Create iteration
  const id = crypto.randomUUID();
  const agentName = project.agent_name || 'unknown';
  const title = `V${version}`;

  // Copy to iterations directory
  const iterDir = path.join(DATA_DIR, 'iterations', projectId, id);
  fs.mkdirSync(iterDir, { recursive: true });
  fs.writeFileSync(path.join(iterDir, 'index.html'), content);
  const filePath = `${projectId}/${id}/index.html`;

  // Insert into DB
  db.prepare(`
    INSERT INTO iterations (id, project_id, agent_name, version, title, prompt, parent_id, file_path, thumbnail, status, meta)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, projectId, agentName, version, title, '', parentId, filePath, '', 'completed', '{}');

  // Update project iteration count
  const count = db.prepare('SELECT COUNT(*) as c FROM iterations WHERE project_id = ?').get(projectId);
  db.prepare('UPDATE projects SET iteration_count = ?, updated_at = ? WHERE id = ?').run(count.c, Date.now(), projectId);

  console.log(`Registered iteration ${title} (${id})`);
  console.log(`  Project: ${project.name}`);
  console.log(`  Parent: ${parentId || 'ROOT'}`);
  console.log(`  File: ${filePath}`);

  db.close();
  process.exit(0);
}
