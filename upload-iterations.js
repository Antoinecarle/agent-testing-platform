const fs = require('fs');
const path = require('path');
const localDb = require('./server/db');

const RAILWAY_URL = 'https://guru-api-production.up.railway.app';
const EMAIL = 'admin@guru.ai';
const PASSWORD = 'admin123';
const ITERATIONS_DIR = path.join(__dirname, 'data', 'iterations');

async function main() {
  // Login
  console.log('Logging in...');
  const loginRes = await fetch(RAILWAY_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const { token } = await loginRes.json();
  if (!token) { console.error('Login failed'); process.exit(1); }

  // Get Railway projects
  const projRes = await fetch(RAILWAY_URL + '/api/projects', {
    headers: { Authorization: 'Bearer ' + token },
  });
  const railwayProjects = await projRes.json();

  // Get local projects
  const localProjects = localDb.getAllProjects();
  let totalUploaded = 0;

  for (const localProject of localProjects) {
    // Match Railway project by name
    const rp = railwayProjects.find(function(p) { return p.name === localProject.name; });
    if (!rp) {
      console.log('[SKIP] ' + localProject.name + ' - no match on Railway');
      continue;
    }

    // Check if Railway already has iterations
    const existingRes = await fetch(RAILWAY_URL + '/api/iterations/' + rp.id, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const existing = await existingRes.json();
    if (Array.isArray(existing) && existing.length > 0) {
      console.log('[SKIP] ' + localProject.name + ' - already has ' + existing.length + ' iterations on Railway');
      continue;
    }

    // Get local iterations for this project (sorted by version)
    const localIters = localDb.getIterationsByProject(localProject.id);
    if (localIters.length === 0) {
      console.log('[SKIP] ' + localProject.name + ' - no local iterations');
      continue;
    }

    console.log('\n[UPLOAD] ' + localProject.name + ' (' + localIters.length + ' iterations)');

    for (const iter of localIters) {
      // Read HTML content from iterations dir
      const htmlPath = path.join(ITERATIONS_DIR, localProject.id, iter.id, 'index.html');
      if (!fs.existsSync(htmlPath)) {
        console.log('  [SKIP] ' + (iter.title || 'V' + iter.version) + ' - file not found');
        continue;
      }
      const content = fs.readFileSync(htmlPath, 'utf-8');
      if (content.trim().length < 50) {
        console.log('  [SKIP] ' + (iter.title || 'V' + iter.version) + ' - too small');
        continue;
      }

      const body = {
        project_id: rp.id,
        agent_name: iter.agent_name || rp.agent_name || 'unknown',
        title: iter.title || null,
        prompt: iter.prompt || '',
        parent_id: null,
        html_content: content,
      };

      const res = await fetch(RAILWAY_URL + '/api/iterations', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        console.log('  [OK] ' + (iter.title || 'V' + iter.version) + ' (' + Math.round(content.length/1024) + ' KB)');
        totalUploaded++;
      } else {
        console.log('  [ERR] ' + (iter.title || 'V' + iter.version) + ': ' + (data.error || 'unknown'));
      }
    }
  }

  console.log('\nDone! Uploaded ' + totalUploaded + ' iterations total.');
}

main().catch(function(e) { console.error(e); process.exit(1); });
