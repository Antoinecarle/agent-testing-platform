/**
 * MCP Pre-Processors — Server-side data gathering that runs BEFORE the LLM call.
 *
 * Each processor fetches/analyzes REAL data and injects it into the tool context.
 * This transforms MCP tools from "structured prompts" into tools with real capabilities:
 *
 *   Tool call → [FETCH URL] → [ANALYZE HTML] → [SCORE SEO] → real context → LLM → expert response
 *
 * Processors are defined per-tool in the `pre_processors` JSONB field:
 *   [{ "type": "fetch_url", "param": "url" }, { "type": "seo_score" }]
 *
 * Each processor reads from args/previous results and writes to a shared `processorData` object.
 * Templates can reference processor output via {{__processor_name__}} placeholders.
 */

const { extractHtmlInfo, formatHtmlAnalysis } = require('./mcp-agent-tools');

// =================== URL FETCHER ===================

/**
 * Fetch a URL and return the HTML content.
 * Handles redirects, timeouts, and common errors.
 */
async function fetchUrl(url, options = {}) {
  const timeout = options.timeout || 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GuruMCP/1.0; +https://guru-api-production.up.railway.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      return { error: `HTTP ${res.status} ${res.statusText}`, status: res.status };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('html') && !contentType.includes('text')) {
      return { error: `Non-HTML content type: ${contentType}`, status: res.status };
    }

    const html = await res.text();
    return {
      html,
      url: res.url, // final URL after redirects
      status: res.status,
      contentType,
      size: html.length,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: `Timeout after ${timeout}ms`, status: 0 };
    }
    return { error: err.message, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}


// =================== SEO SCORER ===================

/**
 * Score a page's SEO based on REAL extracted data (not assumptions).
 * Returns a 0-100 score with detailed breakdown.
 */
function scoreSeo(htmlInfo) {
  if (!htmlInfo) return { score: 0, breakdown: {}, issues: ['No HTML data to analyze'] };

  const breakdown = {};
  const issues = [];
  const passed = [];

  // Title (0-10)
  if (htmlInfo.title) {
    const len = htmlInfo.title.length;
    if (len >= 30 && len <= 65) {
      breakdown.title = 10;
      passed.push(`Title tag present and good length (${len} chars)`);
    } else if (len > 0) {
      breakdown.title = 5;
      issues.push(`Title length ${len} chars (recommended: 30-65)`);
    }
  } else {
    breakdown.title = 0;
    issues.push('CRITICAL: No <title> tag found');
  }

  // Meta description (0-10)
  if (htmlInfo.metaDescription) {
    const len = htmlInfo.metaDescription.length;
    if (len >= 120 && len <= 160) {
      breakdown.metaDescription = 10;
      passed.push(`Meta description present and good length (${len} chars)`);
    } else if (len > 0) {
      breakdown.metaDescription = 5;
      issues.push(`Meta description length ${len} chars (recommended: 120-160)`);
    }
  } else {
    breakdown.metaDescription = 0;
    issues.push('CRITICAL: No meta description found');
  }

  // H1 tags (0-10)
  if (htmlInfo.h1s.length === 1) {
    breakdown.h1 = 10;
    passed.push(`Single H1 tag: "${htmlInfo.h1s[0].slice(0, 60)}"`);
  } else if (htmlInfo.h1s.length > 1) {
    breakdown.h1 = 5;
    issues.push(`Multiple H1 tags (${htmlInfo.h1s.length}) — should have exactly 1`);
  } else {
    breakdown.h1 = 0;
    issues.push('CRITICAL: No H1 tag found');
  }

  // Heading hierarchy (0-10)
  const hasH2 = htmlInfo.h2s.length > 0;
  const hasH3 = htmlInfo.h3s.length > 0;
  if (hasH2 && hasH3) {
    breakdown.headings = 10;
    passed.push(`Good heading hierarchy: ${htmlInfo.h2s.length} H2s, ${htmlInfo.h3s.length} H3s`);
  } else if (hasH2) {
    breakdown.headings = 7;
    passed.push(`Has ${htmlInfo.h2s.length} H2 tags`);
  } else {
    breakdown.headings = 0;
    issues.push('No H2 headings found — poor content structure');
  }

  // Schema markup (0-10)
  if (htmlInfo.hasSchema) {
    breakdown.schema = 10;
    passed.push('JSON-LD schema markup found');
  } else {
    breakdown.schema = 0;
    issues.push('No JSON-LD schema markup — missing rich results opportunity');
  }

  // Open Graph tags (0-10)
  if (htmlInfo.hasOG) {
    breakdown.og = 10;
    passed.push('Open Graph tags present');
  } else {
    breakdown.og = 0;
    issues.push('No Open Graph tags — social sharing will look bad');
  }

  // Canonical URL (0-5)
  if (htmlInfo.canonical) {
    breakdown.canonical = 5;
    passed.push(`Canonical URL set: ${htmlInfo.canonical}`);
  } else {
    breakdown.canonical = 0;
    issues.push('No canonical URL — risk of duplicate content');
  }

  // Image alt text (0-10)
  if (htmlInfo.totalImages === 0) {
    breakdown.images = 5; // No images is neutral
  } else if (htmlInfo.imagesWithoutAlt === 0) {
    breakdown.images = 10;
    passed.push(`All ${htmlInfo.totalImages} images have alt text`);
  } else {
    const ratio = 1 - (htmlInfo.imagesWithoutAlt / htmlInfo.totalImages);
    breakdown.images = Math.round(ratio * 10);
    issues.push(`${htmlInfo.imagesWithoutAlt}/${htmlInfo.totalImages} images missing alt text`);
  }

  // Language attribute (0-5)
  if (htmlInfo.detectedLang) {
    breakdown.lang = 5;
    passed.push(`Language attribute set: ${htmlInfo.detectedLang}`);
  } else {
    breakdown.lang = 0;
    issues.push('No lang attribute on <html> tag');
  }

  // Semantic HTML (0-10)
  const sem = htmlInfo.semanticHtml;
  const semanticCount = [sem.hasMain, sem.hasNav, sem.hasArticle, sem.hasSection, sem.hasFooter]
    .filter(Boolean).length;
  breakdown.semantic = Math.min(10, semanticCount * 2);
  if (semanticCount >= 3) {
    passed.push(`Good semantic HTML: ${semanticCount} semantic elements`);
  } else {
    issues.push(`Poor semantic HTML (${semanticCount}/5 elements) — use <main>, <nav>, <article>, <section>, <footer>`);
  }

  // Content length (0-10)
  if (htmlInfo.wordCount >= 800) {
    breakdown.content = 10;
    passed.push(`Good content length: ~${htmlInfo.wordCount} words`);
  } else if (htmlInfo.wordCount >= 300) {
    breakdown.content = 6;
    issues.push(`Content may be thin: ~${htmlInfo.wordCount} words (aim for 800+)`);
  } else {
    breakdown.content = 2;
    issues.push(`Very thin content: ~${htmlInfo.wordCount} words`);
  }

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const maxScore = 100;
  const normalizedScore = Math.round((score / maxScore) * 100);

  return { score: normalizedScore, breakdown, issues, passed };
}

/**
 * Format SEO score into readable context for LLM injection.
 */
function formatSeoScore(scoreData) {
  if (!scoreData) return '[No score data]';

  let out = `### Real SEO Score: ${scoreData.score}/100\n\n`;

  out += '#### Issues Found\n';
  if (scoreData.issues.length === 0) {
    out += '- None! All checks passed.\n';
  } else {
    for (const issue of scoreData.issues) {
      out += `- ${issue}\n`;
    }
  }

  out += '\n#### Passed Checks\n';
  for (const pass of scoreData.passed) {
    out += `- ${pass}\n`;
  }

  out += '\n#### Score Breakdown\n';
  for (const [key, val] of Object.entries(scoreData.breakdown)) {
    const maxPerKey = key === 'canonical' || key === 'lang' ? 5 : 10;
    out += `- ${key}: ${val}/${maxPerKey}\n`;
  }

  return out;
}


// =================== PROCESSOR RUNNER ===================

/**
 * Available processor types and their implementations.
 * Each processor: (args, processorConfig, processorData) => void
 * Processors READ from args + processorData and WRITE to processorData.
 */
const PROCESSORS = {
  /**
   * fetch_url: Fetches a URL from the specified param.
   * Config: { "type": "fetch_url", "param": "url" }
   * Writes: __fetched_html__, __fetched_url__, __fetch_status__
   */
  fetch_url: async (args, config, data) => {
    const urlParam = config.param || 'url';
    const url = args[urlParam];
    if (!url) {
      data.__fetch_error__ = `No URL provided in param "${urlParam}"`;
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      data.__fetch_error__ = `Invalid URL: ${url}`;
      return;
    }

    console.log(`[MCP Processor] Fetching URL: ${url}`);
    const result = await fetchUrl(url);

    if (result.error) {
      data.__fetch_error__ = result.error;
      data.__fetch_status__ = result.status;
      return;
    }

    data.__fetched_html__ = result.html;
    data.__fetched_url__ = result.url;
    data.__fetch_status__ = result.status;
    data.__fetch_size__ = result.size;
  },

  /**
   * html_analysis: Extracts structured SEO data from HTML.
   * Config: { "type": "html_analysis", "param": "page_content" }
   * If no param, uses __fetched_html__ from a previous fetch_url processor.
   * Writes: __html_analysis__, __html_info__ (raw object)
   */
  html_analysis: async (args, config, data) => {
    const paramName = config.param;
    let html = paramName ? args[paramName] : null;

    // Fall back to fetched HTML
    if (!html && data.__fetched_html__) {
      html = data.__fetched_html__;
    }

    if (!html) {
      data.__html_analysis__ = '[No HTML content available for analysis]';
      return;
    }

    const info = extractHtmlInfo(html);
    data.__html_info__ = info;
    data.__html_analysis__ = formatHtmlAnalysis(info);
  },

  /**
   * seo_score: Runs real SEO scoring based on extracted HTML data.
   * Requires html_analysis to have run first.
   * Writes: __seo_score__, __seo_score_data__ (raw object)
   */
  seo_score: async (args, config, data) => {
    if (!data.__html_info__) {
      data.__seo_score__ = '[Cannot score: no HTML analysis data. Run html_analysis first.]';
      return;
    }

    const scoreData = scoreSeo(data.__html_info__);
    data.__seo_score_data__ = scoreData;
    data.__seo_score__ = formatSeoScore(scoreData);
  },

  /**
   * check_existing: Checks what SEO elements already exist in the page.
   * Produces a detailed "what exists vs what's missing" report.
   * Requires html_analysis to have run first.
   * Writes: __existing_elements__
   */
  check_existing: async (args, config, data) => {
    const info = data.__html_info__;
    if (!info) {
      data.__existing_elements__ = '[Cannot check: no HTML analysis data]';
      return;
    }

    let out = '### Existing SEO Elements (REAL — verified from page source)\n\n';

    // Title
    out += `**Title tag:** ${info.title ? `"${info.title}" (${info.title.length} chars)` : 'MISSING'}\n`;
    out += `**Meta description:** ${info.metaDescription ? `"${info.metaDescription.slice(0, 100)}..." (${info.metaDescription.length} chars)` : 'MISSING'}\n`;
    out += `**Canonical:** ${info.canonical || 'MISSING'}\n`;
    out += `**Language:** ${info.detectedLang || 'MISSING'}\n\n`;

    // Headings
    out += `**H1 tags (${info.h1s.length}):** ${info.h1s.length > 0 ? info.h1s.map(h => `"${h}"`).join(', ') : 'NONE'}\n`;
    out += `**H2 tags (${info.h2s.length}):** ${info.h2s.length > 0 ? info.h2s.slice(0, 8).map(h => `"${h}"`).join(', ') : 'NONE'}\n`;
    out += `**H3 tags (${info.h3s.length}):** ${info.h3s.length > 0 ? info.h3s.slice(0, 6).map(h => `"${h}"`).join(', ') : 'NONE'}\n\n`;

    // Social
    out += `**Open Graph tags:** ${info.hasOG ? 'YES' : 'MISSING'}\n`;
    out += `**Twitter Card tags:** ${info.hasTwitter ? 'YES' : 'MISSING'}\n\n`;

    // Schema
    if (info.hasSchema) {
      out += '**Schema markup:** YES (existing)\n';
      out += '```json\n' + (info.existingSchema || '').slice(0, 3000) + '\n```\n\n';
    } else {
      out += '**Schema markup:** MISSING\n\n';
    }

    // Images
    out += `**Images:** ${info.totalImages} total, ${info.imagesWithoutAlt} without alt text\n`;
    out += `**Links:** ${info.internalLinks} internal, ${info.externalLinks} external\n`;
    out += `**Word count:** ~${info.wordCount}\n\n`;

    // Semantic
    const sem = info.semanticHtml;
    const tags = [];
    if (sem.hasMain) tags.push('main');
    if (sem.hasNav) tags.push('nav');
    if (sem.hasArticle) tags.push('article');
    if (sem.hasSection) tags.push('section');
    if (sem.hasAside) tags.push('aside');
    if (sem.hasFooter) tags.push('footer');
    out += `**Semantic HTML elements:** ${tags.length > 0 ? tags.join(', ') : 'NONE'}\n`;

    // Meta tags inventory
    const importantMeta = ['robots', 'viewport', 'author', 'og:title', 'og:description', 'og:image', 'twitter:card'];
    const existingMeta = importantMeta.filter(m => info.metaTags[m]);
    const missingMeta = importantMeta.filter(m => !info.metaTags[m]);
    out += `\n**Meta tags found:** ${existingMeta.join(', ') || 'none'}\n`;
    out += `**Meta tags missing:** ${missingMeta.join(', ') || 'none'}\n`;

    out += '\n---\n**IMPORTANT:** Only recommend changes for elements that are MISSING or inadequate. Do NOT recommend creating things that already exist.\n';

    data.__existing_elements__ = out;
  },

  /**
   * extract_text: Extracts visible text content from HTML for content analysis.
   * Writes: __page_text__
   */
  extract_text: async (args, config, data) => {
    const html = data.__fetched_html__ || args[config.param];
    if (!html) {
      data.__page_text__ = '[No HTML content available]';
      return;
    }

    // Strip scripts, styles, and tags
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Truncate to reasonable size for LLM context
    data.__page_text__ = text.slice(0, 8000);
  },
};


/**
 * Run all pre-processors for a tool call.
 *
 * @param {Array} processors - Array of processor configs: [{ type, param, ... }]
 * @param {Object} args - Tool call arguments
 * @returns {Object} processorData - accumulated data from all processors
 */
async function runProcessors(processors, args) {
  if (!processors || !Array.isArray(processors) || processors.length === 0) {
    return {};
  }

  const data = {};
  for (const config of processors) {
    const processor = PROCESSORS[config.type];
    if (!processor) {
      console.warn(`[MCP Processor] Unknown processor type: ${config.type}`);
      continue;
    }

    try {
      await processor(args, config, data);
    } catch (err) {
      console.error(`[MCP Processor] ${config.type} failed:`, err.message);
      data[`__${config.type}_error__`] = err.message;
    }
  }

  return data;
}

/**
 * Inject processor data into a context template.
 * Replaces {{__processor_key__}} placeholders with real processor output.
 */
function injectProcessorData(template, processorData) {
  if (!template || !processorData) return template;

  let result = template;
  for (const [key, value] of Object.entries(processorData)) {
    const placeholder = `{{${key}}}`;
    if (result.includes(placeholder)) {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    }
  }
  return result;
}


module.exports = {
  runProcessors,
  injectProcessorData,
  fetchUrl,
  scoreSeo,
  formatSeoScore,
  extractHtmlInfo,
  PROCESSORS,
};
