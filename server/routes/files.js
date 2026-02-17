const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');

// File type categorization for icons
const FILE_TYPES = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'css', '.less': 'css',
  '.json': 'json', '.jsonc': 'json',
  '.md': 'markdown', '.mdx': 'markdown',
  '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.gif': 'image', '.svg': 'image', '.webp': 'image',
  '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.toml': 'config', '.ini': 'config', '.env': 'config',
  '.lock': 'lock',
  '.txt': 'text', '.log': 'text',
};

// Directories to skip when scanning
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.claude', '.next', '.nuxt', 'dist', 'build',
  '.cache', '.parcel-cache', '.turbo', '__pycache__', '.venv', 'venv',
  'vendor', '.svelte-kit',
]);

// Max depth for recursive scanning
const MAX_DEPTH = 8;

/**
 * Recursively scan a directory and return a tree structure
 */
function scanDirectory(dirPath, basePath, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  if (!fs.existsSync(dirPath)) return [];

  const entries = [];
  let items;
  try {
    items = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (_) {
    return [];
  }

  // Sort: directories first, then files, alphabetical
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (const item of items) {
    if (item.name.startsWith('.') && item.name !== '.env' && item.name !== '.gitignore') continue;

    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.relative(basePath, fullPath);

    if (item.isDirectory()) {
      if (SKIP_DIRS.has(item.name)) {
        // Show skipped dirs as collapsed with a marker
        entries.push({
          name: item.name,
          path: relativePath,
          type: 'directory',
          skipped: true,
          children: [],
        });
        continue;
      }
      const children = scanDirectory(fullPath, basePath, depth + 1);
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'directory',
        children,
      });
    } else {
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (_) {
        continue;
      }
      const ext = path.extname(item.name).toLowerCase();
      entries.push({
        name: item.name,
        path: relativePath,
        type: 'file',
        fileType: FILE_TYPES[ext] || 'unknown',
        size: stat.size,
        mtime: stat.mtimeMs,
      });
    }
  }

  return entries;
}

// GET /api/projects/:projectId/files — list workspace files as tree
router.get('/:projectId/files', async (req, res) => {
  try {
    const project = await db.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id && project.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const wsDir = path.join(WORKSPACES_DIR, req.params.projectId);
    if (!fs.existsSync(wsDir)) {
      return res.json({ tree: [], exists: false });
    }

    const tree = scanDirectory(wsDir, wsDir);
    res.json({ tree, exists: true });
  } catch (err) {
    console.error('[Files] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/projects/:projectId/files/read — read file content
router.get('/:projectId/files/read', async (req, res) => {
  try {
    const project = await db.getProject(req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (project.user_id && project.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'path query parameter required' });

    // Prevent path traversal
    const wsDir = path.join(WORKSPACES_DIR, req.params.projectId);
    const fullPath = path.resolve(wsDir, filePath);
    if (!fullPath.startsWith(wsDir)) {
      return res.status(403).json({ error: 'Path traversal not allowed' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ error: 'Cannot read a directory' });
    }

    // Don't read files larger than 1MB
    if (stat.size > 1024 * 1024) {
      return res.json({
        content: null,
        truncated: true,
        size: stat.size,
        message: 'File too large to display (> 1MB)',
      });
    }

    // Check if binary
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz']);
    if (binaryExts.has(ext)) {
      return res.json({
        content: null,
        binary: true,
        size: stat.size,
        message: 'Binary file',
      });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({
      content,
      size: stat.size,
      mtime: stat.mtimeMs,
    });
  } catch (err) {
    console.error('[Files] Read error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
