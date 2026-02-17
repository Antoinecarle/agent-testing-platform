/**
 * MCP Agent Tools — Generic per-agent tool system
 *
 * Each deployed MCP agent can have specialized tools stored in DB
 * (table: mcp_agent_tools). Tools replace the generic `chat` tool
 * with purpose-built tools that have structured parameters and
 * context templates — forcing callers to provide proper context.
 *
 * Context templates use {{param}} placeholders filled from tool args.
 * Special processors (e.g., HTML extraction) enrich context automatically.
 *
 * Pattern: Gemini Design MCP (create_frontend, modify_frontend, etc.)
 * where structured tools >>> generic chat for output quality.
 */

// =================== TEMPLATE PROCESSING ===================

/**
 * Process a context_template by replacing {{param}} placeholders with actual values.
 * Supports:
 *   {{param}}            → direct value substitution
 *   {{#if param}}...{{/if}} → conditional blocks (included only if param is truthy)
 *   {{__html_analysis__}} → auto-extracted HTML SEO data (if html-type param provided)
 *   {{__json_parse:param__}} → parsed JSON summary
 */
function processTemplate(template, args, htmlAnalysis) {
  if (!template) return '';

  let result = template;

  // 1. Handle conditional blocks: {{#if param}}content{{/if}}
  result = result.replace(/\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, param, content) => {
    const value = args[param];
    if (value !== undefined && value !== null && value !== '' &&
        !(Array.isArray(value) && value.length === 0)) {
      // Process inner content for placeholders too
      return content;
    }
    return '';
  });

  // 2. Handle {{__html_analysis__}} special processor
  if (htmlAnalysis && result.includes('{{__html_analysis__}}')) {
    result = result.replace('{{__html_analysis__}}', formatHtmlAnalysis(htmlAnalysis));
  }

  // 3. Handle {{__json_parse:param__}} special processor
  result = result.replace(/\{\{__json_parse:(\w+)__\}\}/g, (match, param) => {
    const value = args[param];
    if (!value) return '';
    try {
      const parsed = JSON.parse(value);
      return formatJsonSummary(param, parsed);
    } catch (_) {
      return `[Could not parse ${param} as JSON]`;
    }
  });

  // 4. Handle {{__array:param__}} for array formatting
  result = result.replace(/\{\{__array:(\w+)__\}\}/g, (match, param) => {
    const value = args[param];
    if (!Array.isArray(value) || value.length === 0) return 'none';
    return value.map(item => {
      if (typeof item === 'object') return JSON.stringify(item);
      return `- ${item}`;
    }).join('\n');
  });

  // 5. Direct param replacement: {{param}}
  result = result.replace(/\{\{(\w+)\}\}/g, (match, param) => {
    const value = args[param];
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  });

  return result;
}


// =================== HTML CONTENT EXTRACTION ===================

/**
 * Extract structured SEO-relevant info from HTML content.
 * Reusable for any tool that receives HTML as a parameter.
 */
function extractHtmlInfo(html) {
  if (!html || typeof html !== 'string') {
    return null;
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
  const title = titleMatch ? titleMatch[1].trim() : null;

  // Meta description
  const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/is)
    || html.match(/<meta[^>]*content=["'](.*?)["'][^>]*name=["']description["']/is);
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : null;

  // Headings
  const h1s = [...html.matchAll(/<h1[^>]*>(.*?)<\/h1>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h2s = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim());
  const h3s = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gis)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

  // Schema markup
  const schemaMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const hasSchema = schemaMatches.length > 0;
  let existingSchema = null;
  if (hasSchema) {
    existingSchema = schemaMatches.map(m => m[1].trim()).join('\n---\n');
  }

  // Meta tags collection
  const metaTags = {};
  const metaMatches = [...html.matchAll(/<meta[^>]+>/gi)];
  for (const m of metaMatches) {
    const tag = m[0];
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']+)["']/i);
    if (nameMatch && contentMatch) {
      metaTags[nameMatch[1]] = contentMatch[1];
    }
  }

  // OG tags
  const hasOG = Object.keys(metaTags).some(k => k.startsWith('og:'));

  // Twitter tags
  const hasTwitter = Object.keys(metaTags).some(k => k.startsWith('twitter:'));

  // Canonical
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1] : null;

  // Images
  const imgTags = [...html.matchAll(/<img[^>]*>/gi)];
  const totalImages = imgTags.length;
  const imagesWithoutAlt = imgTags.filter(img => !(/alt=["'][^"']+["']/i.test(img[0]))).length;

  // Links
  const linkTags = [...html.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>/gi)];
  const internalLinks = linkTags.filter(l => !l[1].startsWith('http') || l[1].includes('{{')).length;
  const externalLinks = linkTags.length - internalLinks;

  // Word count
  const textContent = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ').trim();
  const wordCount = textContent.split(' ').filter(w => w.length > 0).length;

  // Language
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  const detectedLang = langMatch ? langMatch[1] : null;

  // Semantic HTML elements
  const hasMain = /<main/i.test(html);
  const hasNav = /<nav/i.test(html);
  const hasArticle = /<article/i.test(html);
  const hasSection = /<section/i.test(html);
  const hasAside = /<aside/i.test(html);
  const hasFooter = /<footer/i.test(html);

  // Text preview
  const textPreview = textContent.slice(0, 500);

  return {
    title, metaDescription, h1s, h2s, h3s,
    hasSchema, existingSchema,
    metaTags, hasOG, hasTwitter, canonical,
    totalImages, imagesWithoutAlt,
    internalLinks, externalLinks,
    wordCount, detectedLang, textPreview,
    semanticHtml: { hasMain, hasNav, hasArticle, hasSection, hasAside, hasFooter },
  };
}

/**
 * Format HTML analysis into readable markdown for context injection.
 */
function formatHtmlAnalysis(analysis) {
  if (!analysis) return '[No HTML content provided]';

  let out = '### Auto-Extracted Page Data\n';
  out += `- Title tag: ${analysis.title || 'MISSING'}\n`;
  out += `- Meta description: ${analysis.metaDescription || 'MISSING'}\n`;
  out += `- Canonical: ${analysis.canonical || 'MISSING'}\n`;
  out += `- H1 tags (${analysis.h1s.length}): ${analysis.h1s.join(', ') || 'NONE'}\n`;
  out += `- H2 tags (${analysis.h2s.length}): ${analysis.h2s.slice(0, 10).join(' | ') || 'NONE'}\n`;
  out += `- Schema markup: ${analysis.hasSchema ? 'YES' : 'NO'}\n`;
  out += `- OG tags: ${analysis.hasOG ? 'YES' : 'NO'}\n`;
  out += `- Twitter tags: ${analysis.hasTwitter ? 'YES' : 'NO'}\n`;
  out += `- Images: ${analysis.totalImages} total, ${analysis.imagesWithoutAlt} without alt\n`;
  out += `- Links: ${analysis.internalLinks} internal, ${analysis.externalLinks} external\n`;
  out += `- Word count: ~${analysis.wordCount}\n`;
  out += `- Detected language: ${analysis.detectedLang || 'unknown'}\n`;

  const sem = analysis.semanticHtml;
  const semanticTags = ['main', 'nav', 'article', 'section', 'aside', 'footer']
    .filter(t => sem[`has${t.charAt(0).toUpperCase() + t.slice(1)}`]);
  out += `- Semantic HTML: ${semanticTags.length ? semanticTags.join(', ') : 'NONE (bad for SEO)'}\n`;

  if (analysis.existingSchema) {
    out += `\n### Existing Schema Markup\n\`\`\`json\n${analysis.existingSchema.slice(0, 3000)}\n\`\`\`\n`;
  }

  return out;
}

/**
 * Format parsed JSON into a readable summary.
 */
function formatJsonSummary(paramName, parsed) {
  if (paramName === 'package_json' || paramName === 'packageJson') {
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    const frameworks = [];
    if (deps.next) frameworks.push(`Next.js ${deps.next}`);
    if (deps.nuxt) frameworks.push(`Nuxt ${deps.nuxt}`);
    if (deps.react) frameworks.push(`React ${deps.react}`);
    if (deps.vue) frameworks.push(`Vue ${deps.vue}`);
    if (deps.astro) frameworks.push(`Astro ${deps.astro}`);
    if (deps.svelte || deps['@sveltejs/kit']) frameworks.push('SvelteKit');
    if (deps.gatsby) frameworks.push('Gatsby');
    if (deps.angular || deps['@angular/core']) frameworks.push('Angular');

    let out = `### package.json Analysis\n`;
    out += `- Name: ${parsed.name || 'N/A'}\n`;
    out += `- Detected frameworks: ${frameworks.join(', ') || 'none detected'}\n`;
    out += `- Total dependencies: ${Object.keys(parsed.dependencies || {}).length}\n`;
    out += `- Total devDependencies: ${Object.keys(parsed.devDependencies || {}).length}\n`;
    return out;
  }

  // Generic JSON summary: show keys and structure
  return `### ${paramName}\n\`\`\`json\n${JSON.stringify(parsed, null, 2).slice(0, 2000)}\n\`\`\`\n`;
}


// =================== TOOL ENRICHMENT ENGINE ===================

/**
 * Detect which args contain HTML content for auto-extraction.
 * Uses the input_schema's x-html-analysis annotation if present,
 * or falls back to heuristic (param name contains 'html' or 'content').
 */
function findHtmlParams(inputSchema, args) {
  const htmlParams = [];
  if (!inputSchema?.properties) return htmlParams;

  for (const [name, schema] of Object.entries(inputSchema.properties)) {
    // Check for explicit annotation
    if (schema['x-html-analysis']) {
      htmlParams.push(name);
      continue;
    }
    // Heuristic: params named *html* or *page_content*
    if (name.includes('html') || name === 'page_content') {
      if (args[name] && typeof args[name] === 'string' && args[name].includes('<')) {
        htmlParams.push(name);
      }
    }
  }
  return htmlParams;
}

/**
 * Build the enriched context for a specialized tool call.
 *
 * @param {Object} toolDef - Tool definition from DB { name, description, input_schema, context_template, output_instructions }
 * @param {Object} args - Tool call arguments
 * @returns {{ contextAddition: string, userMessage: string }}
 */
function buildEnrichedContext(toolDef, args) {
  // 1. Run HTML extraction on any html-type params
  const htmlParams = findHtmlParams(toolDef.input_schema, args);
  let htmlAnalysis = null;
  for (const param of htmlParams) {
    if (args[param]) {
      htmlAnalysis = extractHtmlInfo(args[param]);
      break; // Use first HTML param found
    }
  }

  // 2. Process context template
  let contextAddition = '';
  if (toolDef.context_template) {
    contextAddition = processTemplate(toolDef.context_template, args, htmlAnalysis);
  } else if (htmlAnalysis) {
    // Even without a template, inject HTML analysis if we have it
    contextAddition = `\n\n## Auto-Extracted Context\n${formatHtmlAnalysis(htmlAnalysis)}\n`;
  }

  // 3. Add output instructions
  if (toolDef.output_instructions) {
    contextAddition += `\n\n## Output Format\n${toolDef.output_instructions}\n`;
  }

  // 4. Build user message from structured args (exclude large content params)
  const largeParams = new Set([
    'page_content', 'html_content', 'head_content', 'config_files',
    'existing_robots', 'robots_txt', 'sitemap_content', 'sitemap',
    'existing_schema', 'package_json',
  ]);

  let userMessage = `Execute the "${toolDef.tool_name || toolDef.name}" task with these parameters:\n`;
  for (const [key, value] of Object.entries(args)) {
    if (largeParams.has(key)) continue;
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'object') {
      userMessage += `- ${key}: ${JSON.stringify(value)}\n`;
    } else {
      userMessage += `- ${key}: ${value}\n`;
    }
  }

  // Include raw large content params as context (truncated)
  for (const [key, value] of Object.entries(args)) {
    if (!largeParams.has(key) || !value) continue;
    const truncated = String(value).slice(0, 8000);
    userMessage += `\n### ${key}\n\`\`\`\n${truncated}\n\`\`\`\n`;
  }

  return { contextAddition, userMessage };
}


// =================== DEFAULT TOOLS ===================

/**
 * Default tools returned when an agent has no specialized tools in DB.
 */
function getDefaultTools(agentName) {
  return [
    {
      name: 'chat',
      description: `Send a message to ${agentName} AI agent and get a response. The agent has deep domain knowledge and specialized skills loaded.`,
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Your message to the agent' },
          context: { type: 'string', description: 'Optional context or previous conversation to include' },
        },
        required: ['message'],
      },
    },
    {
      name: 'get_agent_info',
      description: `Get information about the ${agentName} agent including skills, capabilities, and token counts.`,
      inputSchema: { type: 'object', properties: {} },
    },
  ];
}

/**
 * Format DB tool records into MCP tool list format.
 */
function formatToolsForMcp(dbTools, agentName) {
  if (!dbTools || dbTools.length === 0) {
    return getDefaultTools(agentName);
  }

  const tools = dbTools
    .filter(t => t.is_active !== false)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(t => ({
      name: t.tool_name,
      description: t.description,
      inputSchema: typeof t.input_schema === 'string' ? JSON.parse(t.input_schema) : t.input_schema,
    }));

  // Always include get_agent_info
  if (!tools.find(t => t.name === 'get_agent_info')) {
    tools.push({
      name: 'get_agent_info',
      description: `Get information about the ${agentName} agent including skills, capabilities, and token counts.`,
      inputSchema: { type: 'object', properties: {} },
    });
  }

  return tools;
}


module.exports = {
  processTemplate,
  extractHtmlInfo,
  formatHtmlAnalysis,
  buildEnrichedContext,
  getDefaultTools,
  formatToolsForMcp,
  findHtmlParams,
};
