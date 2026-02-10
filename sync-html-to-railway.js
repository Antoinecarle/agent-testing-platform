#!/usr/bin/env node
/**
 * Sync local HTML iteration files to Railway.
 * Iterations already exist in Supabase — this deletes and recreates them
 * with html_content so the files are saved on Railway's /data volume.
 */

const fs = require('fs');
const path = require('path');

const RAILWAY_URL = 'https://guru-api-production.up.railway.app';
const EMAIL = 'admin@guru.ai';
const PASSWORD = 'admin123';
const LOCAL_ITERATIONS_DIR = path.join(__dirname, 'data', 'iterations');

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
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  console.log('Logged in.\n');

  const projRes = await fetch(RAILWAY_URL + '/api/projects', { headers });
  const projects = await projRes.json();
  console.log(`Found ${projects.length} projects on Railway.\n`);

  let totalSynced = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const project of projects) {
    const iterRes = await fetch(RAILWAY_URL + '/api/iterations/' + project.id, { headers });
    const iterations = await iterRes.json();
    if (!Array.isArray(iterations) || iterations.length === 0) continue;

    console.log(`[${project.name}] ${iterations.length} iterations`);

    for (const iter of iterations) {
      const localPath = path.join(LOCAL_ITERATIONS_DIR, project.id, iter.id, 'index.html');
      if (!fs.existsSync(localPath)) {
        console.log(`  [SKIP] ${iter.title || 'V' + iter.version} - no local file`);
        totalSkipped++;
        continue;
      }

      const htmlContent = fs.readFileSync(localPath, 'utf-8');
      if (htmlContent.trim().length < 50) {
        console.log(`  [SKIP] ${iter.title || 'V' + iter.version} - too small`);
        totalSkipped++;
        continue;
      }

      // Delete existing iteration on Railway
      const delRes = await fetch(RAILWAY_URL + '/api/iterations/detail/' + iter.id, {
        method: 'DELETE',
        headers,
      });
      if (!delRes.ok) {
        console.log(`  [FAIL] ${iter.title || 'V' + iter.version} - delete failed (${delRes.status})`);
        totalFailed++;
        continue;
      }

      // Re-create with HTML content (saves file to disk on Railway)
      const createRes = await fetch(RAILWAY_URL + '/api/iterations', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          project_id: project.id,
          agent_name: iter.agent_name || project.agent_name || 'unknown',
          title: iter.title || null,
          prompt: iter.prompt || '',
          parent_id: iter.parent_id || null,
          html_content: htmlContent,
        }),
      });

      if (createRes.ok) {
        const sizeKB = Math.round(htmlContent.length / 1024);
        console.log(`  [OK] ${iter.title || 'V' + iter.version} (${sizeKB} KB)`);
        totalSynced++;
      } else {
        const errData = await createRes.json().catch(() => ({}));
        console.log(`  [FAIL] ${iter.title || 'V' + iter.version} - ${errData.error || createRes.status}`);
        totalFailed++;
      }
    }
  }

  console.log(`\nDone! Synced: ${totalSynced}, Skipped: ${totalSkipped}, Failed: ${totalFailed}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
