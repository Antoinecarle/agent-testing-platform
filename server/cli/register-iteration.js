#!/usr/bin/env node
/**
 * CLI helper to register an HTML file as a new iteration.
 * Used as a fallback when the auto-watcher doesn't detect the file.
 *
 * Calls the local save-iteration HTTP endpoint instead of hitting Supabase directly.
 * This ensures a single save pipeline (watcher) handles all imports.
 *
 * Usage from terminal:
 *   node /app/server/cli/register-iteration.js [projectId]
 *
 * If projectId is omitted, auto-detects from the current working directory.
 */

const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 4000;

// Determine projectId
let projectId = process.argv[2];
if (!projectId) {
  const cwd = process.cwd();
  const wsMatch = cwd.match(/workspaces\/([a-f0-9-]+)/);
  if (wsMatch) {
    projectId = wsMatch[1];
    console.log(`Auto-detected project: ${projectId}`);
  } else {
    console.error('Usage: node register-iteration.js [projectId]');
    console.error('  Or run from within a workspace directory (auto-detects projectId)');
    process.exit(1);
  }
}

const options = {
  hostname: '127.0.0.1',
  port: PORT,
  path: `/api/projects/${projectId}/save-iteration`,
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      if (data.ok && data.saved) {
        console.log(`Saved iteration ${data.iterationId}`);
      } else if (data.ok && !data.saved) {
        console.log(`No changes detected: ${data.message}`);
      } else {
        console.error(`Error: ${data.error || 'Unknown error'}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`Failed to parse response: ${body}`);
      process.exit(1);
    }
  });
});

req.on('error', (err) => {
  console.error(`Connection error: ${err.message}`);
  console.error('Make sure the GURU server is running.');
  process.exit(1);
});

req.end();
