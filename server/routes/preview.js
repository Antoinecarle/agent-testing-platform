const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');
const db = require('../db');

/**
 * Generate a placeholder SVG for missing images.
 */
function placeholderSvg(filename, width = 800, height = 600) {
  const label = (filename || 'image').replace(/\.\w+$/, '').replace(/[-_]/g, ' ');
  const colors = {
    hero:    { bg1: '#1a1a2e', bg2: '#16213e', accent: '#0f3460' },
    feature: { bg1: '#1a1a2e', bg2: '#0a1628', accent: '#1b4965' },
    about:   { bg1: '#1a1a2e', bg2: '#1c1427', accent: '#4a2c6e' },
  };
  const key = Object.keys(colors).find(k => label.toLowerCase().includes(k)) || 'hero';
  const c = colors[key];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c.bg1}"/>
      <stop offset="100%" style="stop-color:${c.bg2}"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <rect width="100%" height="100%" fill="url(#grid)"/>
  <rect x="${width/2-60}" y="${height/2-40}" width="120" height="80" rx="8" fill="${c.accent}" opacity="0.5"/>
  <text x="50%" y="${height/2-5}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="20" fill="rgba(255,255,255,0.6)">&#128247;</text>
  <text x="50%" y="${height/2+20}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="11" fill="rgba(255,255,255,0.35)" letter-spacing="2">${label}</text>
</svg>`;
}

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates', 'demo');

// GET /api/preview/template/:templateId — serve bundled template HTML for iframe preview
router.get('/template/:templateId', (req, res) => {
  try {
    const manifestPath = path.join(TEMPLATES_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return res.status(404).send('<h1>Templates not available</h1>');
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const tmpl = manifest.find(t => t.id === req.params.templateId);
    if (!tmpl) {
      return res.status(404).send('<h1>Template not found</h1>');
    }
    const filePath = path.join(TEMPLATES_DIR, tmpl.file);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('<h1>Template file missing</h1>');
    }
    res.sendFile(filePath);
  } catch (err) {
    console.error('[Preview] Template error:', err.message);
    res.status(500).send('<h1>Server error</h1>');
  }
});

// GET /api/preview/showcase/:projectId — public project info + all iterations (for client sharing)
router.get('/showcase/:projectId', async (req, res) => {
  try {
    const project = await db.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const iterations = await db.getIterationsByProject(req.params.projectId);
    res.json({ project, iterations });
  } catch (err) {
    console.error('[Preview] Showcase error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/download/:projectId/:iterationId — download iteration as zip
router.get('/download/:projectId/:iterationId', async (req, res) => {
  const archiver = require('archiver');
  try {
    const iterDir = path.join(ITERATIONS_DIR, req.params.projectId, req.params.iterationId);
    if (!fs.existsSync(iterDir)) {
      return res.status(404).json({ error: 'Iteration not found' });
    }

    const iteration = await db.getIteration(req.params.iterationId);
    const project = await db.getProject(req.params.projectId);
    const name = (project?.name || 'project').replace(/[^a-zA-Z0-9-_]/g, '-');
    const version = iteration?.version || 'v1';
    const filename = `${name}-v${version}.zip`;

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);
    archive.directory(iterDir, false);
    archive.finalize();
  } catch (err) {
    console.error('[Preview] Download error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/raw/:projectId/:iterationId — MUST be before wildcard routes
router.get('/raw/:projectId/:iterationId', (req, res) => {
  try {
    const filePath = path.join(ITERATIONS_DIR, req.params.projectId, req.params.iterationId, 'index.html');
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ content });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/preview/:projectId/:iterationId — serve iteration HTML
router.get('/:projectId/:iterationId', (req, res) => {
  try {
    const filePath = path.join(ITERATIONS_DIR, req.params.projectId, req.params.iterationId, 'index.html');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('<h1>Iteration not found</h1>');
    }
    res.sendFile(filePath);
  } catch (err) {
    console.error('[Preview] Error:', err.message);
    res.status(500).send('<h1>Server error</h1>');
  }
});

// GET /api/preview/:projectId/:iterationId/* — serve assets or placeholder images
router.get('/:projectId/:iterationId/*', (req, res) => {
  const relPath = req.params[0];
  const absPath = path.join(ITERATIONS_DIR, req.params.projectId, req.params.iterationId, relPath);

  // Serve real file if it exists
  if (fs.existsSync(absPath)) {
    return res.sendFile(absPath);
  }

  // For image extensions, serve a placeholder SVG
  if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(relPath)) {
    const svg = placeholderSvg(path.basename(relPath));
    res.set('Content-Type', 'image/svg+xml');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  }

  res.status(404).send('Not found');
});

module.exports = router;
