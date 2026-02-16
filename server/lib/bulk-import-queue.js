/**
 * Bulk import processing engine for knowledge base file imports.
 * In-memory job store with concurrent file processing and Socket.IO progress.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const jobs = new Map();
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

function createJob(knowledgeBaseId, userId) {
  const id = crypto.randomUUID();
  const job = {
    id,
    knowledgeBaseId,
    userId,
    status: 'created', // created -> uploading -> processing -> done -> cancelled
    files: [],
    stats: { total: 0, completed: 0, failed: 0, processing: 0 },
    cancelled: false,
    createdAt: Date.now(),
  };
  jobs.set(id, job);
  return job;
}

function getJob(jobId) {
  return jobs.get(jobId) || null;
}

function addFilesToJob(jobId, multerFiles) {
  const job = jobs.get(jobId);
  if (!job) throw new Error('Job not found');

  for (const f of multerFiles) {
    job.files.push({
      id: crypto.randomUUID(),
      originalName: f.originalname,
      diskPath: f.path,
      mimeType: f.mimetype,
      size: f.size,
      status: 'queued', // queued -> extracting -> chunking -> embedding -> done | error
      error: null,
      entryId: null,
    });
  }
  job.stats.total = job.files.length;
  return job;
}

/**
 * Process all queued files in the job with limited concurrency.
 * @param {object} job
 * @param {Function} extractFileContent - (filePath, mimeType) => string
 * @param {Function} embedAndChunkEntry - from knowledge.js helpers
 * @param {object} db - database module
 * @param {Function} onProgress - (job, fileTracker) => void, called on each status change
 */
async function processJob(job, extractFileContent, embedAndChunkEntry, db, onProgress) {
  const CONCURRENCY = 3;
  const MAX_RETRIES = 3;
  job.status = 'processing';

  const queue = job.files.filter(f => f.status === 'queued');
  let idx = 0;

  async function processFile(ft) {
    if (job.cancelled) {
      ft.status = 'error';
      ft.error = 'Cancelled';
      job.stats.failed++;
      onProgress(job, ft);
      return;
    }

    job.stats.processing++;

    try {
      // Phase 1: Extract
      ft.status = 'extracting';
      onProgress(job, ft);
      const content = await extractFileContent(ft.diskPath, ft.mimeType);
      if (!content || !content.trim()) throw new Error('Empty file content');

      // Phase 2: Create entry in DB
      ft.status = 'chunking';
      onProgress(job, ft);
      const title = ft.originalName.replace(/\.[^.]+$/, '');
      const sourceType = ft.mimeType === 'text/csv' ? 'csv' : 'document';
      const { estimateTokens } = require('./embeddings');

      const entry = await db.createKnowledgeEntry(
        job.knowledgeBaseId, title, content, sourceType, '', ft.originalName,
        { mimeType: ft.mimeType, fileSize: ft.size, bulkImportJobId: job.id },
        null, estimateTokens(content)
      );
      ft.entryId = entry.id;

      // Phase 3: Embed with retry
      ft.status = 'embedding';
      onProgress(job, ft);
      await retryWithBackoff(() => embedAndChunkEntry(entry.id, job.knowledgeBaseId, title, content), MAX_RETRIES);

      // Done
      ft.status = 'done';
      job.stats.completed++;
    } catch (err) {
      ft.status = 'error';
      ft.error = err.message;
      job.stats.failed++;
    } finally {
      job.stats.processing--;
      onProgress(job, ft);

      // Clean up disk file
      try { if (fs.existsSync(ft.diskPath)) fs.unlinkSync(ft.diskPath); } catch (_) {}
    }
  }

  async function worker() {
    while (idx < queue.length && !job.cancelled) {
      const ft = queue[idx++];
      await processFile(ft);
    }
  }

  const workers = [];
  for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);

  // Update KB entry count once
  try { await db.updateKnowledgeBaseEntryCount(job.knowledgeBaseId); } catch (_) {}

  job.status = job.cancelled ? 'cancelled' : 'done';
  onProgress(job, null);

  // Schedule cleanup
  setTimeout(() => cleanupJob(job.id), JOB_TTL_MS);
}

function cancelJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.cancelled = true;
  job.status = 'cancelled';
}

function cleanupJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  // Clean any remaining disk files
  for (const ft of job.files) {
    try { if (ft.diskPath && fs.existsSync(ft.diskPath)) fs.unlinkSync(ft.diskPath); } catch (_) {}
  }
  jobs.delete(jobId);
}

async function retryWithBackoff(fn, maxRetries) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err.message && (err.message.includes('429') || err.message.includes('rate limit'));
      if (attempt >= maxRetries || !is429) throw err;
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Periodic cleanup of expired jobs
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) {
      cleanupJob(id);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = { createJob, getJob, addFilesToJob, processJob, cancelJob };
