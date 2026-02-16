/**
 * Embedding generation service using OpenAI text-embedding-3-small
 * Optimized for knowledge base semantic search with chunking support
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const MAX_TOKENS_PER_CHUNK = 6000; // conservative limit (model max is 8191)
const CHARS_PER_TOKEN = 2; // safe ratio — PDF/garbled text can be as low as 1.5
const CHUNK_OVERLAP_CHARS = 200;

/**
 * Generate embedding for a single text string
 * @param {string} text
 * @returns {Promise<number[]>} 1536-dim vector
 */
async function generateEmbedding(text) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  if (!text || !text.trim()) throw new Error('Empty text cannot be embedded');

  let cleanText = text.trim().replace(/\n{3,}/g, '\n\n');
  // Hard cap to stay under 8191 token limit
  const MAX_CHARS = 8000 * CHARS_PER_TOKEN;
  if (cleanText.length > MAX_CHARS) cleanText = cleanText.slice(0, MAX_CHARS);

  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: cleanText,
      model: EMBEDDING_MODEL,
      dimensions: EMBEDDING_DIMENSIONS,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    let errMsg = '';
    try { const parsed = JSON.parse(body); errMsg = parsed.error?.message || ''; } catch (_) {}
    throw new Error(`OpenAI Embedding API error (HTTP ${res.status}): ${errMsg || body.slice(0, 200) || 'Unknown error'}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch call
 * OpenAI supports up to 2048 inputs per batch
 * @param {string[]} texts
 * @returns {Promise<number[][]>} array of 1536-dim vectors
 */
async function generateEmbeddingsBatch(texts) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  if (!texts || texts.length === 0) return [];

  // Hard cap each text to ~8000 tokens (safe under 8191 limit)
  const MAX_CHARS = 8000 * CHARS_PER_TOKEN;
  const cleanTexts = texts.map(t => {
    const clean = t.trim().replace(/\n{3,}/g, '\n\n');
    return clean.length > MAX_CHARS ? clean.slice(0, MAX_CHARS) : clean;
  });

  // Process in batches of 100 to avoid rate limits
  const BATCH_SIZE = 100;
  const allEmbeddings = [];

  for (let i = 0; i < cleanTexts.length; i += BATCH_SIZE) {
    const batch = cleanTexts.slice(i, i + BATCH_SIZE);

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: batch,
        model: EMBEDDING_MODEL,
        dimensions: EMBEDDING_DIMENSIONS,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      let errMsg = '';
      try { const parsed = JSON.parse(body); errMsg = parsed.error?.message || ''; } catch (_) {}
      throw new Error(`OpenAI Embedding API error (HTTP ${res.status}): ${errMsg || body.slice(0, 200) || 'Unknown error'}`);
    }

    const data = await res.json();
    // Sort by index to maintain order
    const sorted = data.data.sort((a, b) => a.index - b.index);
    allEmbeddings.push(...sorted.map(d => d.embedding));
  }

  return allEmbeddings;
}

/**
 * Estimate token count for text (rough approximation: ~4 chars per token)
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into chunks for embedding
 * Uses paragraph-aware splitting with overlap for context continuity
 * @param {string} text
 * @param {number} maxCharsPerChunk - ~32000 by default (8K tokens)
 * @returns {{ content: string, tokenCount: number }[]}
 */
function chunkText(text, maxCharsPerChunk = MAX_TOKENS_PER_CHUNK * CHARS_PER_TOKEN) {
  if (!text || !text.trim()) return [];

  const cleanText = text.trim();

  // If text fits in one chunk, return as-is
  if (cleanText.length <= maxCharsPerChunk) {
    return [{ content: cleanText, tokenCount: estimateTokens(cleanText) }];
  }

  const chunks = [];
  const paragraphs = cleanText.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // If a single paragraph exceeds max, split it by sentences
    if (paragraph.length > maxCharsPerChunk) {
      // Flush current chunk first
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      // Split long paragraph by sentences
      const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
      let sentenceChunk = '';
      for (const sentence of sentences) {
        if ((sentenceChunk + sentence).length > maxCharsPerChunk) {
          if (sentenceChunk.trim()) chunks.push(sentenceChunk.trim());
          sentenceChunk = sentence;
        } else {
          sentenceChunk += sentence;
        }
      }
      if (sentenceChunk.trim()) {
        currentChunk = sentenceChunk;
      }
      continue;
    }

    if ((currentChunk + '\n\n' + paragraph).length > maxCharsPerChunk) {
      if (currentChunk.trim()) chunks.push(currentChunk.trim());
      // Start new chunk with overlap from end of previous
      const overlap = currentChunk.slice(-CHUNK_OVERLAP_CHARS);
      currentChunk = overlap ? overlap + '\n\n' + paragraph : paragraph;
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }

  if (currentChunk.trim()) chunks.push(currentChunk.trim());

  return chunks.map(c => ({ content: c, tokenCount: estimateTokens(c) }));
}

/**
 * Process and embed a document: chunk the text, generate embeddings for each chunk
 * @param {string} text - full document text
 * @param {string} title - document title (prepended to each chunk for context)
 * @returns {Promise<{ chunks: { content: string, embedding: number[], tokenCount: number }[] }>}
 */
async function embedDocument(text, title = '') {
  const chunks = chunkText(text);
  if (chunks.length === 0) throw new Error('No content to embed');

  // Prepend title to each chunk for better semantic context
  const textsToEmbed = chunks.map(c =>
    title ? `${title}\n\n${c.content}` : c.content
  );

  const embeddings = await generateEmbeddingsBatch(textsToEmbed);

  return {
    chunks: chunks.map((c, i) => ({
      content: c.content,
      embedding: embeddings[i],
      tokenCount: c.tokenCount,
    })),
  };
}

module.exports = {
  generateEmbedding,
  generateEmbeddingsBatch,
  chunkText,
  embedDocument,
  estimateTokens,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
};
