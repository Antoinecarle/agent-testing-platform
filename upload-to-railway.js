#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://guru-api-production.up.railway.app';
const EMAIL = 'admin@guru.ai';
const PASSWORD = 'admin123';
const WORKSPACES = path.join(__dirname, 'data', 'workspaces');
const localDb = require('./server/db');

async function main() {
  console.log('Logging in to Railway...');
  const loginRes = await fetch(RAILWAY_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) { console.error('Login failed:', loginData); process.exit(1); }
  const token = loginData.token;
  console.log('Logged in successfully');

  const projRes = await fetch(RAILWAY_URL + '/api/projects', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const railwayProjects = await projRes.json();
  console.log('Found ' + railwayProjects.length + ' Railway projects');

  const localProjects = localDb.getAllProjects();
  console.log('Found ' + localProjects.length + ' local projects');

  let totalUploaded = 0;

  for (const localProject of localProjects) {
    const wsDir = path.join(WORKSPACES, localProject.id);
    if (!fs.existsSync(wsDir)) { continue; }

    const railwayProject = railwayProjects.find(function(rp) { return rp.name === localProject.name; });
    if (!railwayProject) {
      console.log('[SKIP] ' + localProject.name + ' - no matching Railway project');
      continue;
    }

    // Skip if Railway already has iterations for this project
    if (railwayProject.iteration_count > 0) {
      console.log('[SKIP] ' + localProject.name + ' - already has ' + railwayProject.iteration_count + ' iterations on Railway');
      continue;
    }

    const htmlFiles = [];

    // Root-level HTML files
    const rootFiles = fs.readdirSync(wsDir).filter(function(f) { return f.endsWith('.html') && !f.startsWith('.'); });
    for (const f of rootFiles) {
      const baseName = f.replace(/\.html$/, '');
      const vMatch = baseName.match(/(?:version-?|v)(\d+)/i);
      const title = vMatch ? 'V' + vMatch[1] : (f === 'index.html' ? null : baseName);
      htmlFiles.push({ path: path.join(wsDir, f), title: title, sortKey: vMatch ? parseInt(vMatch[1]) : 0 });
    }

    // Subdirectory HTML files
    const entries = fs.readdirSync(wsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      const indexPath = path.join(wsDir, entry.name, 'index.html');
      if (fs.existsSync(indexPath)) {
        const vMatch = entry.name.match(/(?:version-?|v)(\d+)/i);
        const title = vMatch ? 'V' + vMatch[1] : entry.name;
        htmlFiles.push({ path: indexPath, title: title, sortKey: vMatch ? parseInt(vMatch[1]) : 99 });
      }
    }

    if (htmlFiles.length === 0) continue;
    htmlFiles.sort(function(a, b) { return a.sortKey - b.sortKey; });

    console.log('\n[UPLOAD] ' + localProject.name + ' => ' + railwayProject.id + ' (' + htmlFiles.length + ' files)');

    for (const file of htmlFiles) {
      const content = fs.readFileSync(file.path, 'utf-8');
      if (content.trim().length < 50) { console.log('  [SKIP] ' + (file.title || 'index') + ' - too small'); continue; }

      const iterRes = await fetch(RAILWAY_URL + '/api/iterations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: railwayProject.id,
          agent_name: railwayProject.agent_name || localProject.agent_name || 'unknown',
          title: file.title,
          prompt: '',
          parent_id: null,
          html_content: content,
        }),
      });

      const iterData = await iterRes.json();
      if (iterRes.ok) {
        const sizeKB = Math.round(content.length / 1024);
        console.log('  [OK] ' + (file.title || 'V' + iterData.version) + ' (' + sizeKB + ' KB)');
        totalUploaded++;
      } else {
        console.log('  [ERR] ' + (file.title || 'index') + ': ' + (iterData.error || 'unknown error'));
      }
    }
  }

  console.log('\nDone! Uploaded ' + totalUploaded + ' iterations to Railway.');
}

main().catch(function(err) { console.error('Fatal error:', err); process.exit(1); });
