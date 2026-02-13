// Skill Storage — File CRUD on disk + tree scanning + DB sync
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const SKILLS_DIR = path.join(DATA_DIR, 'skills');
const TEMPLATES_DIR = path.join(__dirname, '..', 'skills', 'templates');

// Ensure base skills dir exists
function ensureSkillsDir() {
  if (!fs.existsSync(SKILLS_DIR)) fs.mkdirSync(SKILLS_DIR, { recursive: true });
}

/**
 * Get the absolute path for a skill's directory
 */
function getSkillDir(slug) {
  return path.join(SKILLS_DIR, slug);
}

/**
 * Recursively scan a skill directory and return a JSON tree
 */
function scanSkillTree(slug) {
  const dir = getSkillDir(slug);
  if (!fs.existsSync(dir)) return null;

  function scanDir(dirPath, relativeTo) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden

      const fullPath = path.join(dirPath, entry.name);
      const relPath = path.relative(relativeTo, fullPath);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: 'directory',
          path: relPath,
          children: scanDir(fullPath, relativeTo),
        });
      } else {
        const stat = fs.statSync(fullPath);
        items.push({
          name: entry.name,
          type: 'file',
          path: relPath,
          size: stat.size,
          modified: Math.floor(stat.mtimeMs / 1000),
        });
      }
    }

    // Sort: directories first, then files, alphabetical
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return items;
  }

  return scanDir(dir, dir);
}

/**
 * Count total files in a skill tree
 */
function countFiles(tree) {
  if (!tree) return 0;
  let count = 0;
  for (const item of tree) {
    if (item.type === 'file') count++;
    else if (item.children) count += countFiles(item.children);
  }
  return count;
}

/**
 * Read a file from a skill directory
 */
function readSkillFile(slug, relativePath) {
  const filePath = path.join(getSkillDir(slug), relativePath);
  // Security: ensure path doesn't escape skill dir
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(getSkillDir(slug)))) {
    throw new Error('Path traversal detected');
  }
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  return {
    content: fs.readFileSync(filePath, 'utf-8'),
    size: stat.size,
    modified: Math.floor(stat.mtimeMs / 1000),
  };
}

/**
 * Write (create or update) a file in a skill directory
 */
function writeSkillFile(slug, relativePath, content) {
  const dir = getSkillDir(slug);
  const filePath = path.join(dir, relativePath);
  // Security check
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir))) {
    throw new Error('Path traversal detected');
  }
  // Ensure parent dir exists
  const parentDir = path.dirname(filePath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });

  fs.writeFileSync(filePath, content, 'utf-8');

  // Return updated tree
  return scanSkillTree(slug);
}

/**
 * Delete a file from a skill directory, clean empty parent dirs
 */
function deleteSkillFile(slug, relativePath) {
  const dir = getSkillDir(slug);
  const filePath = path.join(dir, relativePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(dir))) {
    throw new Error('Path traversal detected');
  }
  if (!fs.existsSync(filePath)) return null;

  if (fs.statSync(filePath).isDirectory()) {
    fs.rmSync(filePath, { recursive: true });
  } else {
    fs.unlinkSync(filePath);
  }

  // Clean empty parent dirs up to skill root
  let parentDir = path.dirname(filePath);
  while (parentDir !== dir && parentDir.startsWith(dir)) {
    const entries = fs.readdirSync(parentDir);
    if (entries.length === 0) {
      fs.rmdirSync(parentDir);
      parentDir = path.dirname(parentDir);
    } else {
      break;
    }
  }

  return scanSkillTree(slug);
}

/**
 * Create a subdirectory in a skill
 */
function createSkillDir(slug, relativePath) {
  const dir = getSkillDir(slug);
  const fullPath = path.join(dir, relativePath);
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(dir))) {
    throw new Error('Path traversal detected');
  }
  if (!fs.existsSync(fullPath)) fs.mkdirSync(fullPath, { recursive: true });
  return scanSkillTree(slug);
}

/**
 * Initialize a skill directory from a template or blank
 */
function initSkillFromTemplate(slug, templateSlug) {
  ensureSkillsDir();
  const dir = getSkillDir(slug);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (templateSlug && templateSlug !== 'blank') {
    const templateDir = path.join(TEMPLATES_DIR, templateSlug);
    if (fs.existsSync(templateDir)) {
      copyDirRecursive(templateDir, dir);
      return scanSkillTree(slug);
    }
  }

  // Blank template — just SKILL.md
  const skillMd = `# ${slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

## Overview

Describe this skill's purpose here.

## Instructions

Add instructions, rules, and patterns here.
`;
  fs.writeFileSync(path.join(dir, 'SKILL.md'), skillMd, 'utf-8');

  // Create standard dirs
  fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

  return scanSkillTree(slug);
}

/**
 * Copy directory recursively
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Sync skill's file tree to DB (update file_tree + total_files)
 */
async function syncSkillTreeToDB(skillId, slug) {
  const tree = scanSkillTree(slug);
  const total = countFiles(tree);
  await db.updateSkillFileTree(skillId, tree, total);
  return { tree, totalFiles: total };
}

/**
 * List available templates
 */
function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const readmePath = path.join(TEMPLATES_DIR, d.name, 'SKILL.md');
      let description = '';
      let totalFiles = 0;
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, 'utf-8');
        const descMatch = content.match(/^## Overview\n\n(.+)/m);
        if (descMatch) description = descMatch[1].trim();
      }
      const tree = scanSkillTree(d.name);
      // Count files in template by scanning
      const templateDir = path.join(TEMPLATES_DIR, d.name);
      function countFilesInDir(dir) {
        let count = 0;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) count += countFilesInDir(path.join(dir, e.name));
          else count++;
        }
        return count;
      }
      totalFiles = countFilesInDir(templateDir);

      return {
        slug: d.name,
        name: d.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description,
        totalFiles,
      };
    });
}

/**
 * Delete an entire skill directory
 */
function deleteSkillDir(slug) {
  const dir = getSkillDir(slug);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
  }
}

module.exports = {
  ensureSkillsDir,
  getSkillDir,
  scanSkillTree,
  countFiles,
  readSkillFile,
  writeSkillFile,
  deleteSkillFile,
  createSkillDir,
  initSkillFromTemplate,
  syncSkillTreeToDB,
  listTemplates,
  deleteSkillDir,
  SKILLS_DIR,
  TEMPLATES_DIR,
};
