const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateEmbedding, embedDocument, estimateTokens } = require('../lib/embeddings');
const bulkQueue = require('../lib/bulk-import-queue');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const KNOWLEDGE_UPLOAD_DIR = path.join(DATA_DIR, 'knowledge-uploads');
if (!fs.existsSync(KNOWLEDGE_UPLOAD_DIR)) fs.mkdirSync(KNOWLEDGE_UPLOAD_DIR, { recursive: true });

// Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, KNOWLEDGE_UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}-${file.originalname}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/plain', 'text/csv', 'text/markdown',
      'application/json', 'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(txt|md|csv|json|pdf|xlsx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'));
    }
  },
});

// ===================== STATIC ROUTES (before /:id to avoid conflicts) =====================

// POST /search — search across knowledge bases
router.post('/search', async (req, res) => {
  try {
    const { query, knowledgeBaseIds, threshold, limit } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const queryEmbedding = await generateEmbedding(query);
    const results = await db.searchKnowledge(queryEmbedding, {
      threshold: threshold || 0.3,
      limit: limit || 10,
      knowledgeBaseIds: knowledgeBaseIds || null,
    });

    res.json({ results, query });
  } catch (err) {
    console.error('[Knowledge] Search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /search-for-agent — search knowledge bases linked to an agent
router.post('/search-for-agent', async (req, res) => {
  try {
    const { query, agentName, threshold, limit } = req.body;
    if (!query || !agentName) return res.status(400).json({ error: 'Query and agentName are required' });

    const kbs = await db.getAgentKnowledgeBases(agentName);
    if (kbs.length === 0) return res.json({ results: [], query, message: 'No knowledge bases linked to this agent' });

    const kbIds = kbs.map(kb => kb.id);
    const queryEmbedding = await generateEmbedding(query);
    const results = await db.searchKnowledge(queryEmbedding, {
      threshold: threshold || 0.25,
      limit: limit || 10,
      knowledgeBaseIds: kbIds,
    });

    res.json({ results, query, knowledgeBaseCount: kbs.length });
  } catch (err) {
    console.error('[Knowledge] Agent search error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /for-agent/:agentName — get all knowledge bases for an agent
router.get('/for-agent/:agentName', async (req, res) => {
  try {
    const kbs = await db.getAgentKnowledgeBases(req.params.agentName);
    res.json({ knowledgeBases: kbs });
  } catch (err) {
    console.error('[Knowledge] Agent KBs error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===================== SOCKET.IO FOR BULK IMPORT =====================

let ioRef = null;

function initKnowledgeSocket(io) {
  ioRef = io;
  const knowledgeNs = io.of('/knowledge');

  knowledgeNs.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  knowledgeNs.on('connection', (socket) => {
    socket.on('join-import', ({ jobId }) => {
      if (jobId) socket.join(`import:${jobId}`);
    });
    socket.on('leave-import', ({ jobId }) => {
      if (jobId) socket.leave(`import:${jobId}`);
    });
    socket.on('disconnect', () => {});
  });
}

function emitProgress(jobId, event, data) {
  if (!ioRef) return;
  ioRef.of('/knowledge').to(`import:${jobId}`).emit(event, data);
}

// ===================== BULK IMPORT ENDPOINTS (before /:id) =====================

// POST /:id/bulk-import/start — create a new bulk import job
router.post('/:id/bulk-import/start', async (req, res) => {
  try {
    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
    const job = bulkQueue.createJob(req.params.id, req.user?.userId);
    res.json({ jobId: job.id });
  } catch (err) {
    console.error('[Knowledge] Bulk import start error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/bulk-import/:jobId/upload — upload a batch of files
router.post('/:id/bulk-import/:jobId/upload', upload.array('files', 20), async (req, res) => {
  try {
    const job = bulkQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Import job not found' });
    if (job.knowledgeBaseId !== req.params.id) return res.status(400).json({ error: 'Job/KB mismatch' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    bulkQueue.addFilesToJob(req.params.jobId, req.files);

    // Return the file IDs for the uploaded batch
    const addedFiles = job.files.slice(-req.files.length).map(f => ({ id: f.id, name: f.originalName }));
    res.json({ uploaded: req.files.length, total: job.stats.total, files: addedFiles });
  } catch (err) {
    console.error('[Knowledge] Bulk import upload error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/bulk-import/:jobId/process — start processing (fire-and-forget)
router.post('/:id/bulk-import/:jobId/process', async (req, res) => {
  try {
    const job = bulkQueue.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Import job not found' });
    if (job.knowledgeBaseId !== req.params.id) return res.status(400).json({ error: 'Job/KB mismatch' });
    if (job.status === 'processing') return res.status(409).json({ error: 'Already processing' });

    // Fire-and-forget processing
    bulkQueue.processJob(
      job,
      extractFileContent,
      embedAndChunkEntry,
      db,
      (j, ft) => {
        if (ft) {
          emitProgress(j.id, 'file-progress', { fileId: ft.id, status: ft.status, error: ft.error });
        }
        emitProgress(j.id, 'job-progress', { stats: j.stats, status: j.status });
      }
    ).catch(err => {
      console.error(`[Knowledge] Bulk import process error for job ${job.id}:`, err.message);
    });

    res.json({ status: 'processing', total: job.stats.total });
  } catch (err) {
    console.error('[Knowledge] Bulk import process error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/bulk-import/:jobId/status — polling fallback
router.get('/:id/bulk-import/:jobId/status', (req, res) => {
  const job = bulkQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Import job not found' });
  res.json({
    status: job.status,
    stats: job.stats,
    files: job.files.map(f => ({ id: f.id, name: f.originalName, status: f.status, error: f.error })),
  });
});

// POST /:id/bulk-import/:jobId/cancel — cancel a running import
router.post('/:id/bulk-import/:jobId/cancel', (req, res) => {
  const job = bulkQueue.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Import job not found' });
  bulkQueue.cancelJob(req.params.jobId);
  res.json({ status: 'cancelled' });
});

// ===================== KNOWLEDGE BASES CRUD =====================

// GET / — list all knowledge bases for user
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId;
    const kbs = userId ? await db.getKnowledgeBasesByUser(userId) : await db.getAllKnowledgeBases();
    res.json({ knowledgeBases: kbs });
  } catch (err) {
    console.error('[Knowledge] List error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST / — create knowledge base
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const kb = await db.createKnowledgeBase(name, description, req.user?.userId);
    res.status(201).json(kb);
  } catch (err) {
    console.error('[Knowledge] Create error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — get knowledge base detail
router.get('/:id', async (req, res) => {
  try {
    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });
    const agents = await db.getKnowledgeBaseAgents(req.params.id);
    res.json({ ...kb, agents });
  } catch (err) {
    console.error('[Knowledge] Get error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id — update knowledge base
router.put('/:id', async (req, res) => {
  try {
    const { name, description } = req.body;
    await db.updateKnowledgeBase(req.params.id, { name, description });
    const kb = await db.getKnowledgeBase(req.params.id);
    res.json(kb);
  } catch (err) {
    console.error('[Knowledge] Update error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — delete knowledge base
router.delete('/:id', async (req, res) => {
  try {
    await db.deleteKnowledgeBase(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Knowledge] Delete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===================== KNOWLEDGE ENTRIES =====================

// GET /:id/entries — list entries
router.get('/:id/entries', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const entries = await db.getKnowledgeEntries(req.params.id, { limit, offset });
    res.json({ entries });
  } catch (err) {
    console.error('[Knowledge] List entries error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/entries — create entry (manual text)
router.post('/:id/entries', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Title and content are required' });

    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    // Generate embedding in background
    const entry = await db.createKnowledgeEntry(
      req.params.id, title, content, 'manual', '', '', {}, null, estimateTokens(content)
    );

    // Async embedding generation
    generateAndStoreEmbedding(entry.id, title, content).catch(err =>
      console.error(`[Knowledge] Embedding failed for entry ${entry.id}:`, err.message)
    );

    await db.updateKnowledgeBaseEntryCount(req.params.id);
    res.status(201).json(entry);
  } catch (err) {
    console.error('[Knowledge] Create entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/entries/from-url — create entry from URL
router.post('/:id/entries/from-url', async (req, res) => {
  try {
    const { url, title } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    // Fetch URL content
    const content = await fetchUrlContent(url);
    const entryTitle = title || extractTitleFromUrl(url);

    const entry = await db.createKnowledgeEntry(
      req.params.id, entryTitle, content, 'url', url, '', { fetchedAt: new Date().toISOString() }, null, estimateTokens(content)
    );

    // Async: chunk and embed
    embedAndChunkEntry(entry.id, req.params.id, entryTitle, content).catch(err =>
      console.error(`[Knowledge] URL embedding failed for ${entry.id}:`, err.message)
    );

    await db.updateKnowledgeBaseEntryCount(req.params.id);
    res.status(201).json(entry);
  } catch (err) {
    console.error('[Knowledge] URL entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/entries/from-file — create entry from uploaded file
router.post('/:id/entries/from-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    const fileContent = await extractFileContent(req.file.path, req.file.mimetype);
    const title = req.body.title || req.file.originalname.replace(/\.[^.]+$/, '');
    const sourceType = req.file.mimetype === 'text/csv' ? 'csv' : 'document';

    const entry = await db.createKnowledgeEntry(
      req.params.id, title, fileContent, sourceType, '', req.file.originalname,
      { mimeType: req.file.mimetype, fileSize: req.file.size }, null, estimateTokens(fileContent)
    );

    // Async: chunk and embed
    embedAndChunkEntry(entry.id, req.params.id, title, fileContent).catch(err =>
      console.error(`[Knowledge] File embedding failed for ${entry.id}:`, err.message)
    );

    await db.updateKnowledgeBaseEntryCount(req.params.id);
    res.status(201).json(entry);
  } catch (err) {
    console.error('[Knowledge] File entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/entries/bulk-csv — import CSV rows as individual entries
router.post('/:id/entries/bulk-csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const kb = await db.getKnowledgeBase(req.params.id);
    if (!kb) return res.status(404).json({ error: 'Knowledge base not found' });

    const csvContent = fs.readFileSync(req.file.path, 'utf-8');
    const rows = parseCSV(csvContent);

    if (rows.length === 0) return res.status(400).json({ error: 'CSV is empty or invalid' });

    // Create entries from CSV rows (async embedding)
    const created = [];
    for (const row of rows) {
      const title = row.title || row.name || row[Object.keys(row)[0]] || 'Untitled';
      const content = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join('\n');
      const entry = await db.createKnowledgeEntry(
        req.params.id, String(title), content, 'csv', '', req.file.originalname,
        { csvRow: row }, null, estimateTokens(content)
      );
      created.push(entry);
    }

    // Batch embed all entries
    batchEmbedEntries(created.map(e => ({ id: e.id, title: e.title, content: e.content }))).catch(err =>
      console.error(`[Knowledge] Batch CSV embedding failed:`, err.message)
    );

    await db.updateKnowledgeBaseEntryCount(req.params.id);
    res.status(201).json({ imported: created.length, entries: created.slice(0, 5) });
  } catch (err) {
    console.error('[Knowledge] Bulk CSV error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/entries/:entryId — get single entry
router.get('/:id/entries/:entryId', async (req, res) => {
  try {
    const entry = await db.getKnowledgeEntry(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    console.error('[Knowledge] Get entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/entries/:entryId — update entry
router.put('/:id/entries/:entryId', async (req, res) => {
  try {
    const { title, content } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) {
      updates.content = content;
      updates.token_count = estimateTokens(content);
    }
    await db.updateKnowledgeEntry(req.params.entryId, updates);

    // Re-embed if content changed
    if (content !== undefined) {
      const entry = await db.getKnowledgeEntry(req.params.entryId);
      if (entry) {
        generateAndStoreEmbedding(entry.id, entry.title, content).catch(err =>
          console.error(`[Knowledge] Re-embedding failed for ${entry.id}:`, err.message)
        );
      }
    }

    const entry = await db.getKnowledgeEntry(req.params.entryId);
    res.json(entry);
  } catch (err) {
    console.error('[Knowledge] Update entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id/entries/:entryId — delete entry
router.delete('/:id/entries/:entryId', async (req, res) => {
  try {
    await db.deleteKnowledgeEntry(req.params.entryId);
    await db.updateKnowledgeBaseEntryCount(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Knowledge] Delete entry error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===================== AGENT-KNOWLEDGE BASE LINKING =====================

// POST /:id/agents — link agent to knowledge base
router.post('/:id/agents', async (req, res) => {
  try {
    const { agentName } = req.body;
    if (!agentName) return res.status(400).json({ error: 'agentName is required' });
    const link = await db.assignKnowledgeBaseToAgent(agentName, req.params.id);
    res.status(201).json(link);
  } catch (err) {
    console.error('[Knowledge] Link agent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id/agents/:agentName — unlink agent
router.delete('/:id/agents/:agentName', async (req, res) => {
  try {
    await db.unassignKnowledgeBaseFromAgent(req.params.agentName, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Knowledge] Unlink agent error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ===================== HELPERS =====================

async function generateAndStoreEmbedding(entryId, title, content) {
  const textToEmbed = title ? `${title}\n\n${content}` : content;
  const embedding = await generateEmbedding(textToEmbed);
  await db.updateKnowledgeEntry(entryId, { embedding, token_count: estimateTokens(textToEmbed) });
  console.log(`[Knowledge] Embedded entry ${entryId} (${estimateTokens(textToEmbed)} tokens)`);
}

async function embedAndChunkEntry(entryId, knowledgeBaseId, title, content) {
  const { chunks } = await embedDocument(content, title);

  if (chunks.length === 1) {
    // Single chunk — store embedding directly on the entry
    await db.updateKnowledgeEntry(entryId, {
      embedding: chunks[0].embedding,
      token_count: chunks[0].tokenCount,
    });
    console.log(`[Knowledge] Embedded entry ${entryId} (single chunk, ${chunks[0].tokenCount} tokens)`);
  } else {
    // Multiple chunks — create child entries for each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await db.createKnowledgeEntry(
        knowledgeBaseId,
        `${title} [chunk ${i + 1}/${chunks.length}]`,
        chunk.content,
        'document', '', '',
        { parentEntryId: entryId, chunkOf: title },
        chunk.embedding,
        chunk.tokenCount,
        i,
        entryId
      );
    }
    // Store first chunk embedding on parent too for basic matching
    await db.updateKnowledgeEntry(entryId, {
      embedding: chunks[0].embedding,
      token_count: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
    });
    console.log(`[Knowledge] Embedded entry ${entryId} (${chunks.length} chunks, ${chunks.reduce((s, c) => s + c.tokenCount, 0)} total tokens)`);
    await db.updateKnowledgeBaseEntryCount(knowledgeBaseId);
  }
}

async function batchEmbedEntries(entries) {
  for (const entry of entries) {
    try {
      await generateAndStoreEmbedding(entry.id, entry.title, entry.content);
    } catch (err) {
      console.error(`[Knowledge] Batch embed failed for ${entry.id}:`, err.message);
    }
  }
}

async function fetchUrlContent(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'GURU-Knowledge-Bot/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // Strip HTML tags for text extraction
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100000); // Cap at 100K chars
  } catch (err) {
    throw new Error(`Failed to fetch URL: ${err.message}`);
  }
}

function extractTitleFromUrl(url) {
  try {
    const u = new URL(url);
    const pathParts = u.pathname.split('/').filter(Boolean);
    return pathParts.length > 0 ? pathParts[pathParts.length - 1].replace(/[-_]/g, ' ') : u.hostname;
  } catch {
    return url.slice(0, 50);
  }
}

async function extractFileContent(filePath, mimeType) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  if (mimeType === 'application/json') {
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  }

  if (mimeType === 'application/pdf') {
    // For PDF, try basic text extraction (plain text fallback)
    // Full PDF parsing would need pdf-parse library
    return raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return raw;
}

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || '').trim();
    });
    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

router.initKnowledgeSocket = initKnowledgeSocket;
module.exports = router;
