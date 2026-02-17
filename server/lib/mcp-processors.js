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

  // Hreflang (0-5)
  if (htmlInfo.hasHreflang) {
    breakdown.hreflang = 5;
    passed.push(`Hreflang tags present (${htmlInfo.hreflangTags.length} languages)`);
  } else {
    breakdown.hreflang = 0;
    // Not an issue for single-language sites, just a bonus
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
  const maxScore = 105; // Updated: 100 base + 5 hreflang bonus
  const normalizedScore = Math.min(100, Math.round((score / maxScore) * 100));

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
    const maxPerKey = (key === 'canonical' || key === 'lang' || key === 'hreflang') ? 5 : 10;
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

    // Schema — list ALL types found
    if (info.hasSchema) {
      const types = info.schemaTypes || [];
      out += `**Schema markup:** YES — ${types.length} type(s) found: ${types.join(', ') || 'unknown'}\n`;
      out += '```json\n' + (info.existingSchema || '').slice(0, 3000) + '\n```\n\n';
    } else {
      out += '**Schema markup:** MISSING\n\n';
    }

    // Hreflang
    if (info.hasHreflang) {
      out += `**Hreflang tags:** YES (${info.hreflangTags.length} languages)\n`;
      for (const h of info.hreflangTags) out += `  - ${h.lang}: ${h.href}\n`;
      out += '\n';
    } else {
      out += '**Hreflang tags:** MISSING\n\n';
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

    // Robots.txt & llms.txt — auto-fetch if not already gathered by dedicated processors
    const fetchedUrl = data.__fetched_url__ || args.url || args.site_url;
    if (data.__robots_txt_exists__ === undefined && fetchedUrl) {
      // Autonomously fetch robots.txt
      await PROCESSORS.check_robots_txt(args, { param: 'url' }, data);
    }
    if (data.__llms_txt_exists__ === undefined && fetchedUrl) {
      // Autonomously fetch llms.txt
      await PROCESSORS.check_llms_txt(args, { param: 'url' }, data);
    }

    if (data.__robots_txt_exists__ !== undefined) {
      out += `\n**robots.txt:** ${data.__robots_txt_exists__ ? 'EXISTS' : 'NOT FOUND'}\n`;
      if (data.__robots_txt_exists__ && data.__robots_txt__) {
        out += '```\n' + data.__robots_txt__.slice(0, 1500) + '\n```\n';
      }
    }
    if (data.__llms_txt_exists__ !== undefined) {
      out += `**llms.txt:** ${data.__llms_txt_exists__ ? 'EXISTS' : 'NOT FOUND'}\n`;
      if (data.__llms_txt_exists__ && data.__llms_txt__) {
        out += '```\n' + data.__llms_txt__.slice(0, 1500) + '\n```\n';
      }
    }

    out += '\n---\n**CRITICAL INSTRUCTION:** You MUST only report based on the DATA ABOVE. If a schema type is listed (e.g. FAQPage, HowTo, BreadcrumbList), it EXISTS — do NOT say it is missing. If hreflang tags are listed, they EXIST. If robots.txt is marked EXISTS, it EXISTS. If llms.txt is marked EXISTS, it EXISTS. NEVER hallucinate missing elements that are shown as present in this report.\n';

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

  /**
   * crawl_sitemap: Fetches and parses sitemap.xml from a domain.
   * Config: { "type": "crawl_sitemap", "param": "url" }
   * Writes: __sitemap_urls__, __sitemap_summary__
   */
  crawl_sitemap: async (args, config, data) => {
    const urlParam = config.param || 'url';
    let baseUrl = args[urlParam];
    if (!baseUrl) {
      data.__sitemap_error__ = 'No URL provided';
      return;
    }

    // Normalize to sitemap URL
    try {
      const parsed = new URL(baseUrl);
      if (!baseUrl.includes('sitemap')) {
        baseUrl = `${parsed.protocol}//${parsed.host}/sitemap.xml`;
      }
    } catch {
      data.__sitemap_error__ = `Invalid URL: ${baseUrl}`;
      return;
    }

    console.log(`[MCP Processor] Fetching sitemap: ${baseUrl}`);
    const result = await fetchUrl(baseUrl, { timeout: 20000 });

    if (result.error) {
      // Try common alternatives
      const alternatives = [
        baseUrl.replace('sitemap.xml', 'sitemap_index.xml'),
        baseUrl.replace('sitemap.xml', 'sitemap-index.xml'),
        baseUrl.replace('sitemap.xml', 'wp-sitemap.xml'),
      ];
      let found = false;
      for (const alt of alternatives) {
        const altResult = await fetchUrl(alt, { timeout: 10000 });
        if (!altResult.error && altResult.html) {
          result.html = altResult.html;
          result.url = altResult.url;
          result.error = null;
          found = true;
          break;
        }
      }
      if (!found) {
        data.__sitemap_error__ = `Could not find sitemap: ${result.error}`;
        data.__sitemap_urls__ = [];
        return;
      }
    }

    const xml = result.html || '';
    const urls = [];

    // Parse sitemap index (references other sitemaps)
    const sitemapLocs = [...xml.matchAll(/<sitemap[\s\S]*?<loc>(.*?)<\/loc>/gi)];
    if (sitemapLocs.length > 0) {
      // This is a sitemap index — fetch child sitemaps (max 5)
      data.__sitemap_type__ = 'index';
      const childSitemaps = sitemapLocs.slice(0, 5).map(m => m[1].trim());
      for (const childUrl of childSitemaps) {
        try {
          const childResult = await fetchUrl(childUrl, { timeout: 10000 });
          if (childResult.html) {
            const childUrls = [...childResult.html.matchAll(/<url[\s\S]*?<loc>(.*?)<\/loc>/gi)];
            for (const m of childUrls) urls.push(m[1].trim());
          }
        } catch (_) {}
      }
    } else {
      // Regular sitemap — extract URLs directly
      data.__sitemap_type__ = 'regular';
      const urlLocs = [...xml.matchAll(/<url[\s\S]*?<loc>(.*?)<\/loc>/gi)];
      for (const m of urlLocs) urls.push(m[1].trim());
    }

    data.__sitemap_urls__ = urls;
    data.__sitemap_count__ = urls.length;

    // Build summary
    let summary = `### Sitemap Analysis (${result.url || baseUrl})\n\n`;
    summary += `**Type:** ${data.__sitemap_type__} sitemap\n`;
    summary += `**Total URLs found:** ${urls.length}\n\n`;

    if (urls.length > 0) {
      // Group by path pattern
      const groups = {};
      for (const u of urls) {
        try {
          const p = new URL(u).pathname;
          const parts = p.split('/').filter(Boolean);
          const group = parts.length > 0 ? `/${parts[0]}/` : '/';
          groups[group] = (groups[group] || 0) + 1;
        } catch { groups['other'] = (groups['other'] || 0) + 1; }
      }

      summary += '**URL groups:**\n';
      const sorted = Object.entries(groups).sort((a, b) => b[1] - a[1]);
      for (const [group, count] of sorted.slice(0, 15)) {
        summary += `- ${group} — ${count} pages\n`;
      }

      summary += `\n**Sample URLs (first 20):**\n`;
      for (const u of urls.slice(0, 20)) {
        summary += `- ${u}\n`;
      }
    }

    data.__sitemap_summary__ = summary;
  },

  /**
   * fetch_multi: Fetches multiple URLs in parallel and analyzes each.
   * Config: { "type": "fetch_multi", "param": "urls" }
   * Writes: __multi_results__, __multi_summary__
   */
  fetch_multi: async (args, config, data) => {
    const urlsParam = config.param || 'urls';
    let urls = args[urlsParam];
    if (!urls) {
      // Try to get from sitemap processor
      if (data.__sitemap_urls__ && data.__sitemap_urls__.length > 0) {
        urls = data.__sitemap_urls__;
      } else {
        data.__fetch_multi_error__ = 'No URLs provided';
        return;
      }
    }

    if (typeof urls === 'string') {
      urls = urls.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
    }

    // Limit to prevent abuse
    const maxUrls = config.max || 10;
    const toFetch = urls.slice(0, maxUrls);

    console.log(`[MCP Processor] Fetching ${toFetch.length} URLs in parallel`);

    const results = await Promise.allSettled(
      toFetch.map(async (url) => {
        const fetchResult = await fetchUrl(url, { timeout: 12000 });
        if (fetchResult.error) {
          return { url, error: fetchResult.error };
        }
        const info = extractHtmlInfo(fetchResult.html);
        const score = scoreSeo(info);
        return {
          url: fetchResult.url || url,
          status: fetchResult.status,
          size: fetchResult.size,
          title: info.title || null,
          metaDescription: info.metaDescription || null,
          h1s: info.h1s,
          wordCount: info.wordCount,
          seoScore: score.score,
          issues: score.issues,
          hasSchema: info.hasSchema,
          hasOG: info.hasOG,
          imagesWithoutAlt: info.imagesWithoutAlt,
          totalImages: info.totalImages,
        };
      })
    );

    const multiResults = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value;
      return { url: toFetch[i], error: r.reason?.message || 'Failed' };
    });

    data.__multi_results__ = multiResults;

    // Build summary
    let summary = `### Multi-URL Analysis (${multiResults.length} pages)\n\n`;
    const successful = multiResults.filter(r => !r.error);
    const failed = multiResults.filter(r => r.error);

    if (successful.length > 0) {
      const avgScore = Math.round(successful.reduce((s, r) => s + (r.seoScore || 0), 0) / successful.length);
      summary += `**Average SEO Score:** ${avgScore}/100\n`;
      summary += `**Successful fetches:** ${successful.length}/${multiResults.length}\n\n`;

      summary += '| URL | Score | Title | Issues |\n|-----|-------|-------|--------|\n';
      for (const r of successful) {
        const shortUrl = r.url.replace(/^https?:\/\//, '').slice(0, 50);
        const shortTitle = (r.title || 'N/A').slice(0, 40);
        summary += `| ${shortUrl} | ${r.seoScore}/100 | ${shortTitle} | ${r.issues?.length || 0} |\n`;
      }
    }

    if (failed.length > 0) {
      summary += `\n**Failed (${failed.length}):**\n`;
      for (const r of failed) summary += `- ${r.url}: ${r.error}\n`;
    }

    // Common issues across all pages
    if (successful.length > 1) {
      const allIssues = {};
      for (const r of successful) {
        for (const issue of (r.issues || [])) {
          allIssues[issue] = (allIssues[issue] || 0) + 1;
        }
      }
      const commonIssues = Object.entries(allIssues).filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]);
      if (commonIssues.length > 0) {
        summary += `\n**Common issues (found on multiple pages):**\n`;
        for (const [issue, count] of commonIssues) {
          summary += `- [${count}/${successful.length} pages] ${issue}\n`;
        }
      }
    }

    data.__multi_summary__ = summary;
  },

  /**
   * check_robots_txt: Fetches /robots.txt from the domain and reports contents.
   * Config: { "type": "check_robots_txt", "param": "url" }
   * Writes: __robots_txt__, __robots_txt_exists__
   */
  check_robots_txt: async (args, config, data) => {
    const urlParam = config.param || 'url';
    let baseUrl = args[urlParam] || data.__fetched_url__;
    if (!baseUrl) {
      data.__robots_txt__ = '[No URL available to check robots.txt]';
      data.__robots_txt_exists__ = false;
      return;
    }

    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
      console.log(`[MCP Processor] Fetching robots.txt: ${robotsUrl}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(robotsUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GuruMCP/1.0)' },
        });
        clearTimeout(timer);

        if (res.ok) {
          const text = await res.text();
          // Verify it's actually robots.txt content (not an HTML error page)
          const isReal = text.includes('User-agent') || text.includes('Sitemap') || text.includes('Disallow') || text.includes('Allow');
          if (isReal) {
            data.__robots_txt__ = text.slice(0, 3000);
            data.__robots_txt_exists__ = true;
          } else {
            data.__robots_txt__ = '[robots.txt returned non-standard content]';
            data.__robots_txt_exists__ = false;
          }
        } else {
          data.__robots_txt__ = `[robots.txt returned HTTP ${res.status}]`;
          data.__robots_txt_exists__ = false;
        }
      } catch (err) {
        clearTimeout(timer);
        data.__robots_txt__ = `[Failed to fetch robots.txt: ${err.message}]`;
        data.__robots_txt_exists__ = false;
      }
    } catch {
      data.__robots_txt__ = '[Invalid URL for robots.txt check]';
      data.__robots_txt_exists__ = false;
    }
  },

  /**
   * check_llms_txt: Fetches /llms.txt from the domain and reports contents.
   * Config: { "type": "check_llms_txt", "param": "url" }
   * Writes: __llms_txt__, __llms_txt_exists__
   */
  check_llms_txt: async (args, config, data) => {
    const urlParam = config.param || 'url';
    let baseUrl = args[urlParam] || data.__fetched_url__;
    if (!baseUrl) {
      data.__llms_txt__ = '[No URL available to check llms.txt]';
      data.__llms_txt_exists__ = false;
      return;
    }

    try {
      const parsed = new URL(baseUrl);
      const llmsUrl = `${parsed.protocol}//${parsed.host}/llms.txt`;
      console.log(`[MCP Processor] Fetching llms.txt: ${llmsUrl}`);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const res = await fetch(llmsUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GuruMCP/1.0)' },
        });
        clearTimeout(timer);

        if (res.ok) {
          const text = await res.text();
          // Verify it's not an HTML error page
          const isHtml = text.trim().startsWith('<') || text.includes('<!DOCTYPE');
          if (!isHtml && text.trim().length > 10) {
            data.__llms_txt__ = text.slice(0, 3000);
            data.__llms_txt_exists__ = true;
          } else {
            data.__llms_txt__ = '[llms.txt returned HTML (likely 404 page)]';
            data.__llms_txt_exists__ = false;
          }
        } else {
          data.__llms_txt__ = `[llms.txt returned HTTP ${res.status}]`;
          data.__llms_txt_exists__ = false;
        }
      } catch (err) {
        clearTimeout(timer);
        data.__llms_txt__ = `[Failed to fetch llms.txt: ${err.message}]`;
        data.__llms_txt_exists__ = false;
      }
    } catch {
      data.__llms_txt__ = '[Invalid URL for llms.txt check]';
      data.__llms_txt_exists__ = false;
    }
  },

  /**
   * inject_knowledge: Searches the agent's knowledge bases using tool params
   * and injects the most relevant entries as structured context.
   * Config: { "type": "inject_knowledge", "search_fields": ["brief", "page_type", "domain"] }
   * Requires context.agent_name to be set (passed from mcp-public.js).
   * Writes: __knowledge_context__
   */
  inject_knowledge: async (args, config, data, context) => {
    const agentName = context?.agent_name;
    if (!agentName) {
      data.__knowledge_context__ = '';
      return;
    }

    // Build search query from specified fields (or all string args)
    const searchFields = config.search_fields || Object.keys(args);
    const queryParts = [];
    for (const field of searchFields) {
      const val = args[field];
      if (val && typeof val === 'string' && val.length > 2) {
        queryParts.push(val);
      }
    }
    // Also include the tool name for context
    if (config.tool_name) queryParts.push(config.tool_name);

    const queryText = queryParts.join(' ').slice(0, 500);
    if (!queryText || queryText.length < 3) {
      data.__knowledge_context__ = '';
      return;
    }

    try {
      const db = require('../db');
      const { generateEmbedding } = require('./embeddings');

      const agentKBs = await db.getAgentKnowledgeBases(agentName);
      if (!agentKBs || agentKBs.length === 0) {
        data.__knowledge_context__ = '';
        return;
      }

      const queryEmbedding = await generateEmbedding(queryText);
      const kbIds = agentKBs.map(kb => kb.id);
      const results = await db.searchKnowledge(queryEmbedding, {
        threshold: 0.2,  // Lower threshold = more results for knowledge-rich agents
        limit: config.limit || 8,
        knowledgeBaseIds: kbIds,
      });

      if (!results || results.length === 0) {
        data.__knowledge_context__ = '';
        return;
      }

      console.log(`[MCP Processor] inject_knowledge: found ${results.length} entries for "${queryText.slice(0, 60)}..."`);

      let out = '## Relevant Knowledge (from agent knowledge bases)\n\n';
      for (const entry of results) {
        const similarity = entry.similarity ? ` (relevance: ${Math.round(entry.similarity * 100)}%)` : '';
        out += `### ${entry.title || 'Knowledge Entry'}${similarity}\n`;
        out += `${entry.content}\n\n`;
      }
      out += '---\nUse the knowledge above to inform your response. Prioritize this domain-specific knowledge over generic patterns.\n';

      data.__knowledge_context__ = out;
    } catch (err) {
      console.warn(`[MCP Processor] inject_knowledge failed:`, err.message);
      data.__knowledge_context__ = '';
    }
  },

  /**
   * analyze_design: UX/design-focused analysis of HTML (complements html_analysis which is SEO-focused).
   * Extracts: color palette, typography, layout structure, components, CSS custom properties,
   * animations, interaction hints, accessibility patterns.
   * Uses __fetched_html__ or a specified param.
   * Writes: __design_analysis__, __design_info__ (raw object)
   */
  analyze_design: async (args, config, data) => {
    const paramName = config.param;
    let html = paramName ? args[paramName] : null;
    if (!html && data.__fetched_html__) html = data.__fetched_html__;
    if (!html) {
      data.__design_analysis__ = '[No HTML content available for design analysis]';
      return;
    }

    const info = extractDesignInfo(html);
    data.__design_info__ = info;
    data.__design_analysis__ = formatDesignAnalysis(info);
  },
};


// =================== DESIGN EXTRACTION ===================

/**
 * Extract UX/design-relevant information from HTML.
 * Focused on visual patterns, not SEO.
 */
function extractDesignInfo(html) {
  if (!html || typeof html !== 'string') return null;

  // 1. CSS Custom Properties (--var-name: value)
  const cssVarMatches = [...html.matchAll(/--([a-zA-Z0-9-]+)\s*:\s*([^;}{]+)/g)];
  const cssVariables = {};
  for (const m of cssVarMatches) {
    const name = `--${m[1]}`;
    const value = m[2].trim();
    cssVariables[name] = value;
  }

  // 2. Color palette extraction (hex, rgb, hsl)
  const colorMatches = [...html.matchAll(/(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))/g)];
  const colorFreq = {};
  for (const m of colorMatches) {
    const c = m[1].toLowerCase();
    colorFreq[c] = (colorFreq[c] || 0) + 1;
  }
  const colors = Object.entries(colorFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([color, count]) => ({ color, count }));

  // 3. Typography
  const fontFamilyMatches = [...html.matchAll(/font-family\s*:\s*([^;}{]+)/gi)];
  const fonts = [...new Set(fontFamilyMatches.map(m => m[1].trim()))];
  const fontSizeMatches = [...html.matchAll(/font-size\s*:\s*([^;}{]+)/gi)];
  const fontSizes = [...new Set(fontSizeMatches.map(m => m[1].trim()))].sort();

  // 4. Layout patterns
  const hasGrid = /display\s*:\s*grid/i.test(html);
  const hasFlex = /display\s*:\s*flex/i.test(html);
  const gridTemplates = [...html.matchAll(/grid-template-columns\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());
  const hasPosition = /position\s*:\s*(absolute|fixed|sticky)/i.test(html);

  // 5. Breakpoints / media queries
  const mediaQueries = [...html.matchAll(/@media[^{]+/gi)].map(m => m[0].trim());
  const breakpoints = [...new Set(mediaQueries.map(mq => {
    const w = mq.match(/(\d+)px/);
    return w ? parseInt(w[1]) : null;
  }).filter(Boolean))].sort((a, b) => a - b);

  // 6. Animations and transitions
  const keyframes = [...html.matchAll(/@keyframes\s+([a-zA-Z0-9_-]+)/gi)].map(m => m[1]);
  const transitions = [...html.matchAll(/transition\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());
  const hasTransform = /transform\s*:/i.test(html);

  // 7. Interactive elements hints
  const hasEventListeners = /addEventListener/i.test(html);
  const hasDragDrop = /drag(?:start|end|over|enter|leave|drop)|draggable/i.test(html);
  const hasCanvas = /<canvas/i.test(html);
  const hasSVG = /<svg/i.test(html);
  const hasIntersectionObserver = /IntersectionObserver/i.test(html);
  const hasResizeObserver = /ResizeObserver/i.test(html);
  const hasPointerEvents = /pointer-events|pointerdown|pointermove|pointerup/i.test(html);
  const hasWheel = /wheel|mousewheel|onwheel/i.test(html);
  const hasKeyboard = /keydown|keyup|keypress|keyboard/i.test(html);

  // 8. Component detection (common patterns)
  const components = [];
  if (/<(?:button|\.btn)/i.test(html)) components.push('buttons');
  if (/modal|dialog|overlay/i.test(html)) components.push('modals');
  if (/sidebar|drawer|aside/i.test(html)) components.push('sidebar');
  if (/card|panel/i.test(html)) components.push('cards');
  if (/tab[s]?[\s-]/i.test(html)) components.push('tabs');
  if (/tooltip|popover/i.test(html)) components.push('tooltips');
  if (/dropdown|select|menu/i.test(html)) components.push('dropdowns');
  if (/input|textarea|form/i.test(html)) components.push('forms');
  if (/table|thead|tbody/i.test(html)) components.push('tables');
  if (/badge|tag|chip/i.test(html)) components.push('badges');
  if (/avatar|profile-img/i.test(html)) components.push('avatars');
  if (/toast|notification|alert/i.test(html)) components.push('notifications');
  if (/progress|loading|spinner/i.test(html)) components.push('loading');
  if (/breadcrumb/i.test(html)) components.push('breadcrumbs');

  // 9. Spacing patterns
  const gaps = [...html.matchAll(/gap\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());
  const paddings = [...html.matchAll(/padding\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());
  const margins = [...html.matchAll(/margin\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());

  // 10. Shadows and effects
  const shadows = [...html.matchAll(/box-shadow\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());
  const hasBackdropFilter = /backdrop-filter/i.test(html);
  const hasGlassmorphism = hasBackdropFilter && /blur/i.test(html);
  const borderRadius = [...html.matchAll(/border-radius\s*:\s*([^;}{]+)/gi)].map(m => m[1].trim());

  // 11. Accessibility patterns
  const hasAriaLabels = /aria-label/i.test(html);
  const hasRoles = /role=/i.test(html);
  const hasFocusStyles = /(:focus|focus-visible|focus-within)/i.test(html);
  const hasReducedMotion = /prefers-reduced-motion/i.test(html);
  const hasTabIndex = /tabindex/i.test(html);

  return {
    cssVariables,
    colors,
    fonts,
    fontSizes,
    layout: { hasGrid, hasFlex, gridTemplates, hasPosition },
    breakpoints,
    mediaQueries: mediaQueries.slice(0, 10),
    animations: { keyframes, transitions: [...new Set(transitions)].slice(0, 10), hasTransform },
    interactions: {
      hasEventListeners, hasDragDrop, hasCanvas, hasSVG,
      hasIntersectionObserver, hasResizeObserver, hasPointerEvents,
      hasWheel, hasKeyboard,
    },
    components,
    spacing: {
      gaps: [...new Set(gaps)].slice(0, 10),
      paddings: [...new Set(paddings)].slice(0, 10),
    },
    effects: {
      shadows: [...new Set(shadows)].slice(0, 8),
      hasGlassmorphism, hasBackdropFilter,
      borderRadius: [...new Set(borderRadius)].slice(0, 10),
    },
    accessibility: { hasAriaLabels, hasRoles, hasFocusStyles, hasReducedMotion, hasTabIndex },
  };
}

/**
 * Format design analysis into readable markdown for context injection.
 */
function formatDesignAnalysis(info) {
  if (!info) return '[No design data available]';

  let out = '### Design & UX Analysis\n\n';

  // Colors
  out += '**Color Palette:**\n';
  for (const c of (info.colors || []).slice(0, 12)) {
    out += `- ${c.color} (used ${c.count}x)\n`;
  }

  // Typography
  if (info.fonts.length > 0) out += `\n**Fonts:** ${info.fonts.join(', ')}\n`;
  if (info.fontSizes.length > 0) out += `**Font Scale:** ${info.fontSizes.join(', ')}\n`;

  // Layout
  out += `\n**Layout:** ${info.layout.hasGrid ? 'CSS Grid' : ''}${info.layout.hasFlex ? (info.layout.hasGrid ? ' + ' : '') + 'Flexbox' : ''}\n`;
  if (info.layout.gridTemplates.length > 0) {
    out += `**Grid Templates:** ${info.layout.gridTemplates.join(' | ')}\n`;
  }
  if (info.breakpoints.length > 0) {
    out += `**Breakpoints:** ${info.breakpoints.join('px, ')}px\n`;
  }

  // Components
  if (info.components.length > 0) {
    out += `\n**Components Detected:** ${info.components.join(', ')}\n`;
  }

  // Animations
  if (info.animations.keyframes.length > 0) {
    out += `\n**Animations:** ${info.animations.keyframes.join(', ')}\n`;
  }

  // Effects
  if (info.effects.hasGlassmorphism) out += '**Visual Style:** Glassmorphism (backdrop-filter blur)\n';
  if (info.effects.shadows.length > 0) out += `**Shadows:** ${info.effects.shadows.length} shadow styles\n`;
  if (info.effects.borderRadius.length > 0) out += `**Border Radius:** ${[...new Set(info.effects.borderRadius)].slice(0, 5).join(', ')}\n`;

  // Interactions
  const interactionList = [];
  if (info.interactions.hasDragDrop) interactionList.push('drag-and-drop');
  if (info.interactions.hasPointerEvents) interactionList.push('pointer events');
  if (info.interactions.hasWheel) interactionList.push('mouse wheel/zoom');
  if (info.interactions.hasKeyboard) interactionList.push('keyboard handlers');
  if (info.interactions.hasCanvas) interactionList.push('canvas rendering');
  if (info.interactions.hasSVG) interactionList.push('SVG graphics');
  if (info.interactions.hasIntersectionObserver) interactionList.push('scroll-triggered animations');
  if (interactionList.length > 0) {
    out += `\n**Interactions:** ${interactionList.join(', ')}\n`;
  }

  // CSS Variables
  const varCount = Object.keys(info.cssVariables).length;
  if (varCount > 0) {
    out += `\n**CSS Custom Properties:** ${varCount} variables\n`;
    const importantVars = Object.entries(info.cssVariables)
      .filter(([k]) => k.includes('color') || k.includes('bg') || k.includes('primary') || k.includes('accent') || k.includes('radius') || k.includes('font'))
      .slice(0, 15);
    for (const [name, value] of importantVars) {
      out += `  ${name}: ${value}\n`;
    }
  }

  // Accessibility
  const a11y = info.accessibility;
  const a11yScore = [a11y.hasAriaLabels, a11y.hasRoles, a11y.hasFocusStyles, a11y.hasReducedMotion, a11y.hasTabIndex].filter(Boolean).length;
  out += `\n**Accessibility Score:** ${a11yScore}/5 (${a11y.hasAriaLabels ? 'aria-labels' : ''}${a11y.hasFocusStyles ? ', focus styles' : ''}${a11y.hasReducedMotion ? ', reduced-motion' : ''}${a11y.hasKeyboard ? ', keyboard nav' : ''})\n`;

  return out;
}


/**
 * Run all pre-processors for a tool call.
 *
 * @param {Array} processors - Array of processor configs: [{ type, param, ... }]
 * @param {Object} args - Tool call arguments
 * @param {Object} context - Optional context: { agent_name, tool_name }
 * @returns {Object} processorData - accumulated data from all processors
 */
async function runProcessors(processors, args, context) {
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
      await processor(args, config, data, context);
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


// =================== SYSTEM TOOLS ===================
// Tools built into every MCP agent — no LLM needed, direct processor execution.
// These give Claude the ability to FETCH REAL DATA through the MCP.

const SYSTEM_TOOLS = [
  {
    tool_name: 'fetch_web',
    description: 'Fetch a web page and return its full SEO analysis: title, meta tags, headings, schema markup, Open Graph, images, links, word count, and a real SEO score (0-100). Use this FIRST to gather real data before calling other tools.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The full URL to fetch and analyze (must include https://)' },
      },
      required: ['url'],
    },
    is_system_tool: true,
    pre_processors: [
      { type: 'fetch_url', param: 'url' },
      { type: 'html_analysis' },
      { type: 'seo_score' },
      { type: 'check_existing' },
      { type: 'extract_text' },
      { type: 'check_robots_txt', param: 'url' },
      { type: 'check_llms_txt', param: 'url' },
    ],
  },
  {
    tool_name: 'fetch_sitemap',
    description: 'Fetch and parse a website\'s sitemap.xml to discover all indexed pages, grouped by section. Returns URL count, path groups, and sample URLs.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The website URL or direct sitemap URL (e.g. https://example.com or https://example.com/sitemap.xml)' },
      },
      required: ['url'],
    },
    is_system_tool: true,
    pre_processors: [
      { type: 'crawl_sitemap', param: 'url' },
    ],
  },
  {
    tool_name: 'fetch_multi_urls',
    description: 'Fetch and analyze multiple URLs in parallel. Returns per-page SEO score, title, meta, issues, and a comparative summary with common issues across pages. Max 10 URLs.',
    input_schema: {
      type: 'object',
      properties: {
        urls: {
          oneOf: [
            { type: 'array', items: { type: 'string' }, description: 'Array of URLs to fetch and analyze' },
            { type: 'string', description: 'Comma or newline-separated list of URLs' },
          ],
          description: 'URLs to fetch and analyze (max 10)',
        },
      },
      required: ['urls'],
    },
    is_system_tool: true,
    pre_processors: [
      { type: 'fetch_multi', param: 'urls' },
    ],
  },
];

/**
 * Get system tools formatted for MCP tools/list.
 */
function getSystemToolsMcp() {
  return SYSTEM_TOOLS.map(t => ({
    name: t.tool_name,
    description: t.description,
    inputSchema: t.input_schema,
  }));
}

/**
 * Find a system tool by name.
 */
function getSystemTool(toolName) {
  return SYSTEM_TOOLS.find(t => t.tool_name === toolName) || null;
}

/**
 * Execute a system tool (direct response — no LLM call).
 * Runs the pre-processors and returns structured results directly.
 */
async function executeSystemTool(toolDef, args, context) {
  const startTime = Date.now();
  console.log(`[MCP System Tool] Executing ${toolDef.tool_name} with args:`, JSON.stringify(args).slice(0, 200));

  const processorData = await runProcessors(toolDef.pre_processors, args, context);
  const durationMs = Date.now() - startTime;

  console.log(`[MCP System Tool] ${toolDef.tool_name} completed in ${durationMs}ms — keys: ${Object.keys(processorData).join(', ')}`);

  // Build structured response based on tool type
  if (toolDef.tool_name === 'fetch_web') {
    return buildFetchWebResponse(processorData, args, durationMs);
  }
  if (toolDef.tool_name === 'fetch_sitemap') {
    return buildFetchSitemapResponse(processorData, args, durationMs);
  }
  if (toolDef.tool_name === 'fetch_multi_urls') {
    return buildFetchMultiResponse(processorData, args, durationMs);
  }

  // Generic: return all processor formatted outputs
  let text = '';
  for (const [key, value] of Object.entries(processorData)) {
    if (typeof value === 'string' && value.length > 5 && !key.endsWith('__error__') && key !== '__fetched_html__' && key !== '__html_info__' && key !== '__seo_score_data__') {
      text += value + '\n\n';
    }
  }
  return text || JSON.stringify(processorData, null, 2);
}

function buildFetchWebResponse(data, args, durationMs) {
  if (data.__fetch_error__) {
    return JSON.stringify({
      error: data.__fetch_error__,
      url: args.url,
      suggestion: 'Check that the URL is correct and the site is accessible.',
    }, null, 2);
  }

  const info = data.__html_info__ || {};
  const scoreData = data.__seo_score_data__ || {};

  const result = {
    url: data.__fetched_url__ || args.url,
    fetch_status: data.__fetch_status__,
    page_size: data.__fetch_size__,
    duration_ms: durationMs,

    // Core SEO
    seo_score: scoreData.score || 0,
    title: info.title || null,
    title_length: info.title ? info.title.length : 0,
    meta_description: info.metaDescription || null,
    meta_description_length: info.metaDescription ? info.metaDescription.length : 0,
    canonical: info.canonical || null,
    language: info.detectedLang || null,

    // Headings
    h1: info.h1s || [],
    h2: info.h2s || [],
    h3: (info.h3s || []).slice(0, 10),

    // Structured data
    has_schema: info.hasSchema || false,
    schema_types: info.schemaTypes || [],
    existing_schema: info.existingSchema ? info.existingSchema.slice(0, 2000) : null,
    has_open_graph: info.hasOG || false,
    has_twitter_card: info.hasTwitter || false,

    // Hreflang
    has_hreflang: info.hasHreflang || false,
    hreflang_tags: info.hreflangTags || [],

    // Content
    word_count: info.wordCount || 0,
    images_total: info.totalImages || 0,
    images_without_alt: info.imagesWithoutAlt || 0,
    internal_links: info.internalLinks || 0,
    external_links: info.externalLinks || 0,

    // Semantic HTML
    semantic_html: info.semanticHtml || {},

    // Score breakdown
    score_breakdown: scoreData.breakdown || {},
    issues: scoreData.issues || [],
    passed: scoreData.passed || [],

    // Existing elements detail (formatted text)
    existing_elements_report: data.__existing_elements__ || null,

    // Robots.txt
    has_robots_txt: data.__robots_txt_exists__ || false,
    robots_txt: data.__robots_txt_exists__ ? data.__robots_txt__ : null,

    // llms.txt
    has_llms_txt: data.__llms_txt_exists__ || false,
    llms_txt: data.__llms_txt_exists__ ? data.__llms_txt__ : null,

    // Page text excerpt (for content analysis)
    page_text_excerpt: (data.__page_text__ || '').slice(0, 2000),
  };

  return JSON.stringify(result, null, 2);
}

function buildFetchSitemapResponse(data, args, durationMs) {
  if (data.__sitemap_error__) {
    return JSON.stringify({
      error: data.__sitemap_error__,
      url: args.url,
      suggestion: 'Try providing the direct sitemap URL (e.g. /sitemap.xml, /sitemap_index.xml, /wp-sitemap.xml)',
    }, null, 2);
  }

  const urls = data.__sitemap_urls__ || [];

  // Group by path
  const groups = {};
  for (const u of urls) {
    try {
      const p = new URL(u).pathname;
      const parts = p.split('/').filter(Boolean);
      const group = parts.length > 0 ? `/${parts[0]}/` : '/';
      if (!groups[group]) groups[group] = [];
      groups[group].push(u);
    } catch { if (!groups['other']) groups['other'] = []; groups['other'].push(u); }
  }

  return JSON.stringify({
    url: args.url,
    sitemap_type: data.__sitemap_type__ || 'unknown',
    total_urls: urls.length,
    duration_ms: durationMs,
    url_groups: Object.fromEntries(
      Object.entries(groups)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([group, groupUrls]) => [group, { count: groupUrls.length, sample: groupUrls.slice(0, 5) }])
    ),
    all_urls: urls.slice(0, 200), // cap at 200 to avoid huge responses
  }, null, 2);
}

function buildFetchMultiResponse(data, args, durationMs) {
  if (data.__fetch_multi_error__) {
    return JSON.stringify({ error: data.__fetch_multi_error__ }, null, 2);
  }

  const results = data.__multi_results__ || [];
  const successful = results.filter(r => !r.error);
  const avgScore = successful.length > 0
    ? Math.round(successful.reduce((s, r) => s + (r.seoScore || 0), 0) / successful.length)
    : 0;

  // Common issues
  const allIssues = {};
  for (const r of successful) {
    for (const issue of (r.issues || [])) {
      allIssues[issue] = (allIssues[issue] || 0) + 1;
    }
  }
  const commonIssues = Object.entries(allIssues)
    .filter(([, c]) => c > 1)
    .sort((a, b) => b[1] - a[1])
    .map(([issue, count]) => ({ issue, affected_pages: count }));

  return JSON.stringify({
    total_urls: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    average_seo_score: avgScore,
    duration_ms: durationMs,
    pages: results,
    common_issues: commonIssues,
  }, null, 2);
}


module.exports = {
  runProcessors,
  injectProcessorData,
  fetchUrl,
  scoreSeo,
  formatSeoScore,
  extractHtmlInfo,
  extractDesignInfo,
  formatDesignAnalysis,
  PROCESSORS,
  SYSTEM_TOOLS,
  getSystemToolsMcp,
  getSystemTool,
  executeSystemTool,
};
