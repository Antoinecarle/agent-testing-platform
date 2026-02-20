const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const skillStorage = require('../skill-storage');
const { callGPT5, analyzeDocument, deepAnalyzeContentURL } = require('../lib/agent-analysis');
const { DOCUMENT_EXTRACTION_MODES } = require('../lib/agent-templates');

const router = express.Router();

// Multer setup for skill document uploads
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const SKILL_UPLOAD_DIR = path.join(DATA_DIR, 'skill-document-uploads');

const skillDocStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(SKILL_UPLOAD_DIR)) fs.mkdirSync(SKILL_UPLOAD_DIR, { recursive: true });
    cb(null, SKILL_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const skillDocUpload = multer({
  storage: skillDocStorage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf', 'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/x-yaml', 'text/yaml',
      'text/html', 'application/xml', 'text/xml',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    ];
    const allowedExts = ['.pdf', '.md', '.txt', '.json', '.yaml', '.yml', '.csv', '.html', '.xml', '.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
    }
  }
});

// Helper: generate slug from name
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ==================== STATIC ROUTES (must be before :id) ====================

// GET /api/skills — list skills (filtered by user, admin sees all)
router.get('/', async (req, res) => {
  try {
    const { search, category } = req.query;
    let skills;
    if (search) {
      skills = await db.searchSkillsForUser(search, req.user.userId);
    } else if (category) {
      skills = await db.getSkillsByCategoryForUser(category, req.user.userId);
    } else {
      skills = await db.getAllSkillsForUser(req.user.userId);
    }
    res.json(skills);
  } catch (err) {
    console.error('[Skills] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/stats — skill statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getSkillStats();
    res.json(stats);
  } catch (err) {
    console.error('[Skills] Stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/categories — list unique skill categories (filtered by user)
router.get('/categories', async (req, res) => {
  try {
    const skills = await db.getAllSkillsForUser(req.user.userId);
    const cats = [...new Set(skills.map(s => s.category).filter(Boolean))].sort();
    res.json(cats);
  } catch (err) {
    console.error('[Skills] Categories error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills — create a new skill
router.post('/', async (req, res) => {
  try {
    const { name, description, prompt, category, icon, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const slug = slugify(name.trim());
    if (!slug) {
      return res.status(400).json({ error: 'Invalid name — must produce a valid slug' });
    }

    // Check for duplicate slug
    const existing = await db.getSkillBySlug(slug);
    if (existing) {
      return res.status(409).json({ error: `Skill with slug "${slug}" already exists` });
    }

    const skill = await db.createSkill(
      name.trim(), slug, description, prompt, category, icon, color, req.user?.userId
    );

    // Auto-create files on disk if prompt is provided
    if (prompt && prompt.trim()) {
      try {
        skillStorage.ensureSkillsDir();
        const dir = skillStorage.getSkillDir(slug);
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.mkdirSync(path.join(dir, 'references'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'SKILL.md'), prompt.trim(), 'utf-8');
        const tree = skillStorage.scanSkillTree(slug);
        const totalFiles = skillStorage.countFiles(tree);
        await db.updateSkillFileTree(skill.id, tree, totalFiles);
        skill.file_tree = tree;
        skill.total_files = totalFiles;
      } catch (fileErr) {
        console.warn('[Skills] Auto-create files failed:', fileErr.message);
      }
    }

    res.status(201).json(skill);
  } catch (err) {
    console.error('[Skills] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/extraction-types — list available document extraction types
router.get('/extraction-types', (req, res) => {
  const types = Object.entries(DOCUMENT_EXTRACTION_MODES).map(([id, config]) => ({
    id,
    label: config.label,
    icon: config.icon,
    description: config.description,
  }));
  res.json(types);
});

// POST /api/skills/bulk — create multiple skills at once
router.post('/bulk', async (req, res) => {
  try {
    const { skills } = req.body;
    if (!Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ error: 'skills array is required' });
    }

    const created = [];
    const errors = [];

    for (const s of skills) {
      if (!s.name || !s.name.trim()) {
        errors.push({ name: s.name, error: 'Name is required' });
        continue;
      }
      const slug = slugify(s.name.trim());
      const existing = await db.getSkillBySlug(slug);
      if (existing) {
        errors.push({ name: s.name, error: 'Already exists' });
        continue;
      }
      try {
        const skill = await db.createSkill(
          s.name.trim(), slug, s.description, s.prompt, s.category, s.icon, s.color, req.user?.userId
        );
        created.push(skill);
      } catch (err) {
        errors.push({ name: s.name, error: err.message });
      }
    }

    res.status(201).json({ created: created.length, errors: errors.length, skills: created, failures: errors });
  } catch (err) {
    console.error('[Skills] Bulk create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== AGENT-SCOPED ROUTES (before :id) ====================

// GET /api/skills/agent/:agentName — get all skills for an agent
router.get('/agent/:agentName', async (req, res) => {
  try {
    const skills = await db.getAgentSkills(req.params.agentName);
    res.json(skills);
  } catch (err) {
    console.error('[Skills] Agent skills error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/agent/:agentName/bulk — assign multiple skills to one agent
router.post('/agent/:agentName/bulk', async (req, res) => {
  try {
    const { skill_ids } = req.body;
    if (!Array.isArray(skill_ids) || skill_ids.length === 0) {
      return res.status(400).json({ error: 'skill_ids array is required' });
    }
    await db.bulkAssignSkillsToAgent(req.params.agentName, skill_ids);
    const skills = await db.getAgentSkills(req.params.agentName);
    res.json(skills);
  } catch (err) {
    console.error('[Skills] Bulk assign to agent error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/agent/:agentName/ai-generate — AI-generate skills based on agent context
router.post('/agent/:agentName/ai-generate', async (req, res) => {
  try {
    const agentName = req.params.agentName;
    const agent = await db.getAgent(agentName);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const existingSkills = await db.getAgentSkills(agentName);
    const existingNames = existingSkills.map(s => s.name);

    const prompt = `You are a skill architect for AI agents. Analyze this agent's full context and generate complementary skills that would enhance its capabilities.

AGENT CONTEXT:
- Name: ${agent.name}
- Description: ${agent.description || 'N/A'}
- Model: ${agent.model || 'N/A'}
- Category: ${agent.category || 'N/A'}
- System Prompt (first 2000 chars): ${(agent.full_prompt || agent.prompt || '').slice(0, 2000)}
- Tools: ${agent.tools || 'N/A'}
- Permission Mode: ${agent.permission_mode || 'N/A'}

EXISTING SKILLS (DO NOT duplicate these):
${existingNames.length > 0 ? existingNames.map(n => `- ${n}`).join('\n') : '(none)'}

Generate 8-12 NEW skills that:
1. Are specifically tailored to this agent's domain and capabilities
2. Complement (not duplicate) existing skills
3. Cover different aspects: core competency, analysis, output quality, domain knowledge, workflow
4. Have actionable, specific names (not vague)

Return JSON:
{
  "skills": [
    {
      "name": "Skill Name",
      "description": "What this skill enables the agent to do (1-2 sentences)",
      "category": "one of: core, analysis, quality, domain, workflow, integration, research, output",
      "color": "#hex color that fits the category"
    }
  ]
}`;

    const result = await callGPT5(
      [
        { role: 'system', content: 'You are a skill architect. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 2000, responseFormat: 'json' }
    );

    if (!result || !result.trim()) {
      throw new Error('GPT returned empty response');
    }
    // Strip markdown fences if present
    let jsonStr = result.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    const parsed = JSON.parse(jsonStr);
    res.json({ skills: parsed.skills || [] });
  } catch (err) {
    console.error('[Skills] AI generate error:', err.message);
    res.status(500).json({ error: 'AI generation failed: ' + err.message });
  }
});

// ==================== FILE MANAGEMENT ROUTES ====================

// GET /api/skills/:id/files — get file tree
router.get('/:id/files', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const tree = skillStorage.scanSkillTree(skill.slug);
    res.json({ tree, totalFiles: skillStorage.countFiles(tree) });
  } catch (err) {
    console.error('[Skills] Files tree error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/skills/:id/files/* — read a file
router.get('/:id/files/*', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const relativePath = req.params[0];
    if (!relativePath) return res.status(400).json({ error: 'File path required' });

    const file = skillStorage.readSkillFile(skill.slug, relativePath);
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json(file);
  } catch (err) {
    console.error('[Skills] Read file error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/skills/:id/files/* — write/update a file
router.put('/:id/files/*', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const relativePath = req.params[0];
    if (!relativePath) return res.status(400).json({ error: 'File path required' });

    const { content } = req.body;
    if (content === undefined) return res.status(400).json({ error: 'content is required' });

    const tree = skillStorage.writeSkillFile(skill.slug, relativePath, content);
    const totalFiles = skillStorage.countFiles(tree);
    await db.updateSkillFileTree(skill.id, tree, totalFiles);

    res.json({ tree, totalFiles });
  } catch (err) {
    console.error('[Skills] Write file error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/skills/:id/files/* — delete a file
router.delete('/:id/files/*', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const relativePath = req.params[0];
    if (!relativePath) return res.status(400).json({ error: 'File path required' });

    const tree = skillStorage.deleteSkillFile(skill.slug, relativePath);
    const totalFiles = skillStorage.countFiles(tree);
    await db.updateSkillFileTree(skill.id, tree, totalFiles);

    res.json({ tree, totalFiles });
  } catch (err) {
    console.error('[Skills] Delete file error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/skills/:id/dirs — create a subdirectory
router.post('/:id/dirs', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const { path: dirPath } = req.body;
    if (!dirPath) return res.status(400).json({ error: 'path is required' });

    const tree = skillStorage.createSkillDir(skill.slug, dirPath);
    res.json({ tree });
  } catch (err) {
    console.error('[Skills] Create dir error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/skills/:id/init — initialize from template or blank
router.post('/:id/init', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const { template } = req.body;
    const tree = skillStorage.initSkillFromTemplate(skill.slug, template || 'blank');
    const totalFiles = skillStorage.countFiles(tree);
    await db.updateSkillFileTree(skill.id, tree, totalFiles);

    res.json({ tree, totalFiles });
  } catch (err) {
    console.error('[Skills] Init error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ==================== PARAMETERIZED :id ROUTES ====================

// GET /api/skills/:id — get single skill (enriched with agents)
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const agents = await db.getSkillAgents(req.params.id);
    res.json({ ...skill, agents });
  } catch (err) {
    console.error('[Skills] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/skills/:id — update skill
router.put('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Ownership check
    if (skill.created_by && skill.created_by !== req.user.userId)
      return res.status(403).json({ error: 'Only the creator can edit this skill' });

    const { name, description, prompt, category, icon, color } = req.body;
    const fields = { description, prompt, category, icon, color };

    // If name changed, update slug too
    if (name !== undefined && name.trim() !== skill.name) {
      fields.name = name.trim();
      fields.slug = slugify(name.trim());
      // Check slug uniqueness
      const dup = await db.getSkillBySlug(fields.slug);
      if (dup && dup.id !== skill.id) {
        return res.status(409).json({ error: `Skill with slug "${fields.slug}" already exists` });
      }
    }

    await db.updateSkill(req.params.id, fields);
    const updated = await db.getSkill(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('[Skills] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/skills/:id — delete skill
router.delete('/:id', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Ownership check
    if (skill.created_by && skill.created_by !== req.user.userId)
      return res.status(403).json({ error: 'Only the creator can delete this skill' });

    await db.deleteSkill(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Skills] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/assign/:agentName — assign skill to agent
router.post('/:id/assign/:agentName', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const agent = await db.getAgent(req.params.agentName);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    await db.assignSkillToAgent(req.params.agentName, req.params.id);
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.message && err.message.includes('duplicate')) {
      return res.status(409).json({ error: 'Skill already assigned to this agent' });
    }
    console.error('[Skills] Assign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/skills/:id/unassign/:agentName — unassign skill from agent
router.delete('/:id/unassign/:agentName', async (req, res) => {
  try {
    await db.unassignSkillFromAgent(req.params.agentName, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Skills] Unassign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/bulk-assign — assign skill to multiple agents
router.post('/:id/bulk-assign', async (req, res) => {
  try {
    const { agent_names } = req.body;
    if (!Array.isArray(agent_names) || agent_names.length === 0) {
      return res.status(400).json({ error: 'agent_names array is required' });
    }
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    await db.bulkAssignSkill(req.params.id, agent_names);
    const agents = await db.getSkillAgents(req.params.id);
    res.json({ ok: true, agent_count: agents.length });
  } catch (err) {
    console.error('[Skills] Bulk assign error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DOCUMENT INGESTION ====================

// GET /api/skills/:id/documents — list documents for a skill
router.get('/:id/documents', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const documents = await db.getSkillDocuments(req.params.id);
    const stats = await db.getSkillDocumentStats(req.params.id);
    res.json({ documents, stats });
  } catch (err) {
    console.error('[Skills] List documents error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/documents — upload + analyze a document
router.post('/:id/documents', skillDocUpload.single('document'), async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    if (!req.file) return res.status(400).json({ error: 'No document uploaded' });

    const { extraction_type, notes } = req.body;
    const { filename, originalname, mimetype, size, path: filePath } = req.file;

    // Create document record
    const doc = await db.createSkillDocument(
      req.params.id, filename, originalname, mimetype, size,
      extraction_type || 'general',
      req.user?.userId
    );

    // Update status to analyzing
    await db.updateSkillDocument(doc.id, { status: 'analyzing', notes: notes || null });

    // Run AI analysis in background but return immediately with doc ID
    analyzeDocumentForSkill(doc.id, filePath, originalname, mimetype, extraction_type || 'general', skill)
      .catch(err => console.error('[Skills] Background analysis error:', err.message));

    res.status(201).json({ document: { ...doc, status: 'analyzing' } });
  } catch (err) {
    console.error('[Skills] Upload document error:', err.message);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

// GET /api/skills/:id/documents/:docId — get single document with extracted data
router.get('/:id/documents/:docId', async (req, res) => {
  try {
    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(doc);
  } catch (err) {
    console.error('[Skills] Get document error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/skills/:id/documents/:docId — update document (edit extracted data, validate, reject)
router.put('/:id/documents/:docId', async (req, res) => {
  try {
    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { status, extracted_data, notes } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (extracted_data !== undefined) updates.extracted_data = extracted_data;
    if (notes !== undefined) updates.notes = notes;

    const updated = await db.updateSkillDocument(req.params.docId, updates);
    res.json(updated);
  } catch (err) {
    console.error('[Skills] Update document error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/skills/:id/documents/:docId — delete a document
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from disk
    const filePath = path.join(SKILL_UPLOAD_DIR, doc.filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}

    await db.deleteSkillDocument(req.params.docId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Skills] Delete document error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/documents/:docId/inject — inject validated document into skill files
router.post('/:id/documents/:docId/inject', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!doc.extracted_data) {
      return res.status(400).json({ error: 'Document has no extracted data to inject' });
    }

    const { target_file } = req.body;
    const targetFile = target_file || `references/doc-${doc.original_name.replace(/\.[^.]+$/, '')}.md`;

    // Build markdown content from extracted data
    const content = buildMarkdownFromExtraction(doc);

    // Write to skill files
    const tree = skillStorage.writeSkillFile(skill.slug, targetFile, content);
    const totalFiles = skillStorage.countFiles(tree);
    await db.updateSkillFileTree(skill.id, tree, totalFiles);

    // Update document status
    await db.updateSkillDocument(doc.id, { status: 'injected', injected_to_file: targetFile });

    res.json({ ok: true, file: targetFile, tree, totalFiles });
  } catch (err) {
    console.error('[Skills] Inject document error:', err.message);
    res.status(500).json({ error: err.message || 'Injection failed' });
  }
});

// POST /api/skills/:id/documents/:docId/reanalyze — re-run analysis with different extraction type
router.post('/:id/documents/:docId/reanalyze', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const { extraction_type } = req.body;
    const newType = extraction_type || doc.extraction_type;

    const filePath = path.join(SKILL_UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Original file no longer exists on disk' });
    }

    await db.updateSkillDocument(doc.id, { status: 'analyzing' });

    analyzeDocumentForSkill(doc.id, filePath, doc.original_name, doc.mime_type, newType, skill)
      .catch(err => console.error('[Skills] Re-analysis error:', err.message));

    res.json({ ok: true, status: 'analyzing' });
  } catch (err) {
    console.error('[Skills] Reanalyze document error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/skills/:id/documents/from-url — analyze a URL and create document record
router.post('/:id/documents/from-url', async (req, res) => {
  try {
    const skill = await db.getSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    const { url, extraction_type, notes } = req.body;
    if (!url || !url.trim()) return res.status(400).json({ error: 'URL is required' });

    const extractionType = extraction_type || 'general';
    const filename = url.length > 80 ? url.substring(0, 80) + '...' : url;

    // Create document record
    const doc = await db.createSkillDocument(
      req.params.id, `url-${Date.now()}`, filename, 'text/html', 0,
      extractionType, req.user?.userId
    );
    await db.updateSkillDocument(doc.id, { status: 'analyzing', notes: notes || null });

    // Run URL analysis in background
    analyzeUrlForSkill(doc.id, url.trim(), extractionType, skill)
      .catch(err => console.error('[Skills] URL analysis error:', err.message));

    res.status(201).json({ document: { ...doc, status: 'analyzing' } });
  } catch (err) {
    console.error('[Skills] URL document error:', err.message);
    res.status(500).json({ error: err.message || 'URL analysis failed' });
  }
});

// GET /api/skills/:id/documents/:docId/download — download original file
router.get('/:id/documents/:docId/download', async (req, res) => {
  try {
    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const filePath = path.join(SKILL_UPLOAD_DIR, doc.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File no longer exists on disk' });
    }
    res.download(filePath, doc.original_name);
  } catch (err) {
    console.error('[Skills] Download document error:', err.message);
    res.status(500).json({ error: 'Download failed' });
  }
});

// GET /api/skills/:id/documents/:docId/export-csv — export extracted data as CSV
router.get('/:id/documents/:docId/export-csv', async (req, res) => {
  try {
    const doc = await db.getSkillDocument(req.params.docId);
    if (!doc || doc.skill_id !== req.params.id) {
      return res.status(404).json({ error: 'Document not found' });
    }
    if (!doc.extracted_data) {
      return res.status(400).json({ error: 'No extracted data to export' });
    }

    const data = doc.extracted_data;
    const rows = [['Key', 'Value']];

    // Flatten extracted data into key-value CSV rows
    function flatten(obj, prefix = '') {
      for (const [key, val] of Object.entries(obj || {})) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (val === null || val === undefined) {
          rows.push([fullKey, '']);
        } else if (Array.isArray(val)) {
          val.forEach((item, i) => {
            if (typeof item === 'object') flatten(item, `${fullKey}[${i}]`);
            else rows.push([`${fullKey}[${i}]`, String(item)]);
          });
        } else if (typeof val === 'object') {
          flatten(val, fullKey);
        } else {
          rows.push([fullKey, String(val)]);
        }
      }
    }
    flatten(data);

    const csvContent = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const safeName = doc.original_name.replace(/\.[^.]+$/, '') + '-analysis.csv';

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('[Skills] Export CSV error:', err.message);
    res.status(500).json({ error: 'Export failed' });
  }
});

// --- Helper: background URL analysis ---
async function analyzeUrlForSkill(docId, url, extractionType, skill) {
  try {
    const result = await deepAnalyzeContentURL(url);

    const gptAnalysis = result.gptAnalysis || null;
    const textPreview = result.extracted?.textPreview || '';

    await db.updateSkillDocument(docId, {
      status: gptAnalysis ? 'analyzed' : 'pending',
      raw_text: textPreview || '',
      extracted_data: gptAnalysis || { error: 'No analysis returned' },
      notes: !gptAnalysis ? 'URL analysis failed — no AI response. Try re-analyzing.' : undefined,
    });
    console.log(`[Skills] URL ${docId} analyzed (${extractionType}): ${url}`);
  } catch (err) {
    console.error(`[Skills] URL analysis failed for ${docId}:`, err.message);
    await db.updateSkillDocument(docId, {
      status: 'pending',
      notes: `URL analysis error: ${err.message}`,
    });
  }
}

// --- Helper: background document analysis ---
async function analyzeDocumentForSkill(docId, filePath, filename, mimeType, extractionType, skill) {
  try {
    const result = await analyzeDocument(filePath, filename, mimeType, extractionType);

    const updates = {
      status: 'analyzed',
      raw_text: result.textPreview || '',
      extracted_data: result.gptAnalysis || { error: 'No analysis returned' },
    };

    // If analysis failed, mark as pending for retry
    if (!result.gptAnalysis) {
      updates.status = 'pending';
      updates.notes = 'Analysis failed — no AI response. Try re-analyzing.';
    }

    await db.updateSkillDocument(docId, updates);
    console.log(`[Skills] Document ${docId} analyzed (${extractionType}): ${result.textLength} chars`);
  } catch (err) {
    console.error(`[Skills] Document analysis failed for ${docId}:`, err.message);
    await db.updateSkillDocument(docId, {
      status: 'pending',
      notes: `Analysis error: ${err.message}`,
    });
  }
}

// --- Helper: build markdown from extracted data ---
function buildMarkdownFromExtraction(doc) {
  const data = doc.extracted_data;
  const lines = [];

  lines.push(`# ${doc.original_name}`);
  lines.push(`> Extracted from document (${doc.extraction_type} analysis)`);
  lines.push('');

  if (data.summary) {
    lines.push('## Summary');
    lines.push(data.summary);
    lines.push('');
  }

  // Handle different extraction type structures
  if (data.keyInsights || data.key_insights) {
    lines.push('## Key Insights');
    for (const insight of (data.keyInsights || data.key_insights || [])) {
      lines.push(`- ${typeof insight === 'string' ? insight : JSON.stringify(insight)}`);
    }
    lines.push('');
  }

  if (data.patterns) {
    lines.push('## Patterns');
    for (const p of (Array.isArray(data.patterns) ? data.patterns : [data.patterns])) {
      lines.push(`- ${typeof p === 'string' ? p : JSON.stringify(p)}`);
    }
    lines.push('');
  }

  if (data.rules || data.guidelines) {
    lines.push('## Rules & Guidelines');
    for (const r of (data.rules || data.guidelines || [])) {
      lines.push(`- ${typeof r === 'string' ? r : JSON.stringify(r)}`);
    }
    lines.push('');
  }

  if (data.designTokens || data.design_tokens) {
    lines.push('## Design Tokens');
    const tokens = data.designTokens || data.design_tokens;
    if (typeof tokens === 'object') {
      for (const [key, val] of Object.entries(tokens)) {
        lines.push(`### ${key}`);
        if (typeof val === 'object') {
          for (const [k, v] of Object.entries(val)) {
            lines.push(`- **${k}**: ${v}`);
          }
        } else {
          lines.push(String(val));
        }
        lines.push('');
      }
    }
  }

  if (data.technicalDetails || data.technical_details) {
    lines.push('## Technical Details');
    const tech = data.technicalDetails || data.technical_details;
    if (tech.technologies) {
      lines.push('### Technologies');
      for (const t of tech.technologies) lines.push(`- ${t}`);
    }
    if (tech.patterns) {
      lines.push('### Patterns');
      for (const p of tech.patterns) lines.push(`- ${p}`);
    }
    if (tech.codeSnippets || tech.code_snippets) {
      lines.push('### Code Snippets');
      for (const s of (tech.codeSnippets || tech.code_snippets || [])) {
        lines.push('```');
        lines.push(s);
        lines.push('```');
      }
    }
    lines.push('');
  }

  if (data.recommendations) {
    lines.push('## Recommendations');
    for (const r of data.recommendations) {
      lines.push(`- ${typeof r === 'string' ? r : JSON.stringify(r)}`);
    }
    lines.push('');
  }

  // Catch-all: if there are other top-level keys not already handled
  const handledKeys = new Set(['summary', 'keyInsights', 'key_insights', 'patterns', 'rules', 'guidelines', 'designTokens', 'design_tokens', 'technicalDetails', 'technical_details', 'recommendations', 'relevanceForAgent', 'relevance_for_agent']);
  for (const [key, val] of Object.entries(data)) {
    if (handledKeys.has(key)) continue;
    if (val === null || val === undefined) continue;
    const title = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
    lines.push(`## ${title}`);
    if (Array.isArray(val)) {
      for (const item of val) {
        lines.push(`- ${typeof item === 'string' ? item : JSON.stringify(item)}`);
      }
    } else if (typeof val === 'object') {
      lines.push('```json');
      lines.push(JSON.stringify(val, null, 2));
      lines.push('```');
    } else {
      lines.push(String(val));
    }
    lines.push('');
  }

  return lines.join('\n');
}

module.exports = router;
