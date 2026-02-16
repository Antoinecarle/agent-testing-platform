/**
 * UMAP visualization engine for knowledge base embeddings
 * Reduces 1536D embeddings to 2D + grid-based clustering + keyword extraction
 */

const { UMAP } = require('umap-js');

// In-memory cache: key = `${kbId}:${entryCount}`, value = { data, timestamp }
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'about', 'up', 'its', 'it', 'this', 'that',
  'these', 'those', 'what', 'which', 'who', 'whom', 'he', 'she', 'they',
  'them', 'his', 'her', 'their', 'my', 'your', 'our', 'i', 'you', 'we',
  'me', 'him', 'us', 'chunk', 'also', 'like', 'get', 'use', 'using',
]);

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function extractKeywords(entries, clusterIndices) {
  // TF-IDF-lite: titles weighted 3x, content first 200 chars
  const termFreq = {};
  const docCount = {};
  const totalDocs = clusterIndices.length;

  for (const idx of clusterIndices) {
    const entry = entries[idx];
    if (!entry) continue;
    const titleWords = tokenize(entry.title || '');
    const contentWords = tokenize((entry.content || '').slice(0, 200));
    const seen = new Set();

    // Title terms weighted 3x
    for (const w of titleWords) {
      termFreq[w] = (termFreq[w] || 0) + 3;
      if (!seen.has(w)) { docCount[w] = (docCount[w] || 0) + 1; seen.add(w); }
    }
    for (const w of contentWords) {
      termFreq[w] = (termFreq[w] || 0) + 1;
      if (!seen.has(w)) { docCount[w] = (docCount[w] || 0) + 1; seen.add(w); }
    }
  }

  // Score = tf * idf
  const scores = Object.entries(termFreq).map(([term, tf]) => {
    const idf = Math.log(1 + totalDocs / (docCount[term] || 1));
    return { term, score: tf * idf };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, 3).map(s => s.term);
}

function tokenize(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));
}

function gridCluster(points2D, gridSize = 20) {
  if (points2D.length === 0) return [];

  // Find bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of points2D) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  // Assign each point to a grid cell
  const grid = {};
  const pointCells = [];
  for (let i = 0; i < points2D.length; i++) {
    const cx = Math.min(gridSize - 1, Math.floor((points2D[i][0] - minX) / rangeX * gridSize));
    const cy = Math.min(gridSize - 1, Math.floor((points2D[i][1] - minY) / rangeY * gridSize));
    const key = `${cx},${cy}`;
    if (!grid[key]) grid[key] = [];
    grid[key].push(i);
    pointCells.push(key);
  }

  // Density threshold: cells with > average count are "dense"
  const cellCounts = Object.values(grid).map(arr => arr.length);
  const avgCount = cellCounts.reduce((s, c) => s + c, 0) / cellCounts.length;
  const densityThreshold = Math.max(1, avgCount * 0.8);

  const denseCells = new Set();
  for (const [key, indices] of Object.entries(grid)) {
    if (indices.length >= densityThreshold) denseCells.add(key);
  }

  // Flood-fill adjacent dense cells
  const visited = new Set();
  const clusters = [];

  for (const cell of denseCells) {
    if (visited.has(cell)) continue;
    const cluster = [];
    const queue = [cell];
    visited.add(cell);

    while (queue.length > 0) {
      const current = queue.shift();
      const [cx, cy] = current.split(',').map(Number);
      cluster.push(...(grid[current] || []));

      // Check 8 neighbors
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = `${cx + dx},${cy + dy}`;
          if (denseCells.has(neighbor) && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    if (cluster.length >= 2) clusters.push(cluster);
  }

  return clusters;
}

async function buildVisualization(kbId, db) {
  const entries = await db.getKnowledgeEntriesWithEmbeddings(kbId);
  if (!entries || entries.length === 0) {
    return { points: [], clusters: [], bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, entryCount: 0 };
  }

  // Check cache
  const cacheKey = `${kbId}:${entries.length}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Filter entries that have embeddings
  const withEmbeddings = entries.filter(e => e.embedding);
  if (withEmbeddings.length < 2) {
    // Not enough data for UMAP - return single point or empty
    const points = withEmbeddings.map((e, i) => ({
      id: e.id,
      title: e.title,
      sourceType: e.source_type,
      tokenCount: e.token_count || 0,
      x: 0.5,
      y: 0.5,
    }));
    const result = { points, clusters: [], bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 }, entryCount: entries.length };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  // Parse embeddings (may be strings from Supabase pgvector)
  const embeddings = withEmbeddings.map(e => {
    if (typeof e.embedding === 'string') {
      // pgvector returns "[0.1,0.2,...]" format
      const clean = e.embedding.replace(/^\[|\]$/g, '');
      return clean.split(',').map(Number);
    }
    return e.embedding;
  });

  // UMAP parameters
  const nNeighbors = Math.min(15, Math.max(2, Math.floor(embeddings.length / 3)));
  const umap = new UMAP({
    nComponents: 2,
    nNeighbors,
    minDist: 0.1,
    spread: 1.0,
  });

  const projected = umap.fit(embeddings);

  // Compute bounds
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of projected) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Normalize to 0-1
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const normalized = projected.map(([x, y]) => [
    (x - minX) / rangeX,
    (y - minY) / rangeY,
  ]);

  // Build points
  const points = withEmbeddings.map((e, i) => ({
    id: e.id,
    title: e.title,
    sourceType: e.source_type,
    tokenCount: e.token_count || 0,
    x: normalized[i][0],
    y: normalized[i][1],
  }));

  // Grid-based clustering
  const clusterIndices = gridCluster(normalized);
  const clusters = clusterIndices.map(indices => {
    const keywords = extractKeywords(withEmbeddings, indices);
    // Cluster centroid
    let cx = 0, cy = 0;
    for (const idx of indices) {
      cx += normalized[idx][0];
      cy += normalized[idx][1];
    }
    cx /= indices.length;
    cy /= indices.length;
    return {
      label: keywords.join(' / ') || 'cluster',
      x: cx,
      y: cy,
      pointIds: indices.map(idx => withEmbeddings[idx].id),
      size: indices.length,
    };
  });

  const result = {
    points,
    clusters,
    bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
    entryCount: entries.length,
  };

  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

async function searchVisualization(kbId, query, db, generateEmbedding) {
  const entries = await db.getKnowledgeEntriesWithEmbeddings(kbId);
  if (!entries || entries.length === 0) return { matches: {}, topResults: [] };

  const queryEmbedding = await generateEmbedding(query);

  // Compute cosine similarity for each entry with an embedding
  const matches = {};
  const results = [];

  for (const entry of entries) {
    if (!entry.embedding) continue;
    let emb = entry.embedding;
    if (typeof emb === 'string') {
      emb = emb.replace(/^\[|\]$/g, '').split(',').map(Number);
    }
    const sim = cosineSimilarity(queryEmbedding, emb);
    matches[entry.id] = sim;
    results.push({ id: entry.id, title: entry.title, similarity: sim, sourceType: entry.source_type, tokenCount: entry.token_count || 0 });
  }

  results.sort((a, b) => b.similarity - a.similarity);

  return {
    matches,
    topResults: results.slice(0, 10),
  };
}

function invalidateCache(kbId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${kbId}:`)) cache.delete(key);
  }
}

module.exports = { buildVisualization, searchVisualization, invalidateCache, cosineSimilarity };
