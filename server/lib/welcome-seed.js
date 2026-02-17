const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates', 'demo');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');

/**
 * Seeds a "Welcome to GURU" demo project for a newly registered user.
 * Idempotent: skips if user already has a project with that name.
 * Non-blocking: caller should fire-and-forget.
 */
async function seedWelcomeProject(userId) {
  // Guard: templates must exist
  const manifestPath = path.join(TEMPLATES_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.log('[WelcomeSeed] No templates found, skipping');
    return;
  }

  // Idempotent check: does user already have a welcome project?
  const existing = await db.getProjectsByUser(userId);
  if (existing.some(p => p.name === 'Welcome to GURU')) {
    console.log('[WelcomeSeed] User already has welcome project, skipping');
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  if (!manifest.length) return;

  // Create the demo project
  const projectId = crypto.randomUUID();
  await db.createProject(projectId, 'Welcome to GURU', 'Demo project showcasing different agent styles. Explore these templates to see what GURU can build!', manifest[0].agent_name, 'solo', null, userId);

  // Create one iteration per template
  for (let i = 0; i < manifest.length; i++) {
    const tmpl = manifest[i];
    const srcFile = path.join(TEMPLATES_DIR, tmpl.file);
    if (!fs.existsSync(srcFile)) continue;

    const iterationId = crypto.randomUUID();
    const destDir = path.join(ITERATIONS_DIR, projectId, iterationId);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(srcFile, path.join(destDir, 'index.html'));

    const filePath = `${projectId}/${iterationId}/index.html`;
    const version = i + 1;
    await db.createIteration(
      iterationId, projectId, tmpl.agent_name, version,
      tmpl.name, tmpl.description, null, filePath, '', 'completed',
      { template_id: tmpl.id, accent_color: tmpl.accent_color }
    );
  }

  await db.updateProjectIterationCount(projectId, manifest.length);
  console.log(`[WelcomeSeed] Created welcome project with ${manifest.length} templates for user ${userId}`);
}

module.exports = { seedWelcomeProject };
