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

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function run(projectId, htmlFileArg) {
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
  const { data: project } = await supabase.from('projects').select('*').eq('id', projectId).single();
  if (!project) {
    console.error(`Error: Project ${projectId} not found in database`);
    process.exit(1);
  }

  // Get next version
  const { data: maxRow } = await supabase
    .from('iterations')
    .select('version')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
  const version = (maxRow?.version || 0) + 1;

  // Get latest iteration for parent chain
  const { data: latest } = await supabase
    .from('iterations')
    .select('id')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single();
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
  await supabase.from('iterations').insert({
    id,
    project_id: projectId,
    agent_name: agentName,
    version,
    title,
    prompt: '',
    parent_id: parentId,
    file_path: filePath,
    thumbnail: '',
    status: 'completed',
    meta: '{}',
  });

  // Update project iteration count
  const { count } = await supabase
    .from('iterations')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', projectId);
  await supabase.from('projects').update({
    iteration_count: count,
    updated_at: Math.floor(Date.now() / 1000),
  }).eq('id', projectId);

  console.log(`Registered iteration ${title} (${id})`);
  console.log(`  Project: ${project.name}`);
  console.log(`  Parent: ${parentId || 'ROOT'}`);
  console.log(`  File: ${filePath}`);

  process.exit(0);
}
