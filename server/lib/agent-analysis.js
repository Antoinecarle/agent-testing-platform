// Agent Analysis - Deep URL/image analysis and design brief synthesis
// Uses GPT-5 Vision for image analysis, GPT-5 for URL/brief synthesis

const fs = require('fs').promises;
const { IMAGE_ANALYSIS_PROMPTS, URL_ANALYSIS_PROMPT, DESIGN_BRIEF_PROMPT } = require('./agent-templates');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT5_MODEL = 'gpt-5-mini-2025-08-07';

/**
 * Call GPT-5 with configurable max_completion_tokens and retry on 5xx
 */
async function callGPT5(messages, options = {}) {
  const body = {
    model: GPT5_MODEL,
    messages,
  };

  if (options.max_completion_tokens) {
    body.max_completion_tokens = options.max_completion_tokens;
  }

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const maxRetries = options.retries || 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000), // 2 min timeout
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }

      const errorText = await res.text();
      lastError = new Error(`GPT-5 API error: ${res.status} ${errorText}`);

      // Retry on 5xx errors
      if (res.status >= 500 && attempt < maxRetries) {
        const delay = (attempt + 1) * 2000;
        console.warn(`[agent-analysis] GPT-5 ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw lastError;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        lastError = new Error(`GPT-5 API timeout after 120s`);
        if (attempt < maxRetries) {
          console.warn(`[agent-analysis] GPT-5 timeout, retrying (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
      throw lastError || err;
    }
  }

  throw lastError;
}

/**
 * Call GPT-5 Vision with image (base64)
 */
async function callGPT5Vision(filePath, mimeType, textPrompt, options = {}) {
  const imageBuffer = await fs.readFile(filePath);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: textPrompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ];

  const body = {
    model: GPT5_MODEL,
    messages,
    max_completion_tokens: options.max_completion_tokens || 1500,
  };

  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const maxRetries = 2;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000), // 2 min timeout for vision (detailed analysis)
      });

      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }

      const errorText = await res.text();
      lastError = new Error(`GPT Vision API error: ${res.status} ${errorText}`);

      if (res.status >= 500 && attempt < maxRetries) {
        const delay = (attempt + 1) * 2000;
        console.warn(`[agent-analysis] GPT Vision ${res.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw lastError;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        lastError = new Error(`GPT Vision API timeout after 120s`);
        if (attempt < maxRetries) {
          console.warn(`[agent-analysis] GPT Vision timeout, retrying (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
      }
      throw lastError || err;
    }
  }

  throw lastError;
}

/**
 * Deep analyze a URL - extracts CSS, fonts, colors, layout patterns
 * @param {string} url
 * @returns {{ extracted: object, gptAnalysis: object }}
 */
async function deepAnalyzeURL(url) {
  let html = '';
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    });
    html = await res.text();
  } catch (err) {
    return {
      extracted: { error: err.message, url },
      gptAnalysis: null,
    };
  }

  // Extract CSS custom properties from <style> tags
  const styleBlocks = [];
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styleBlocks.push(match[1]);
  }
  const allStyles = styleBlocks.join('\n');

  const cssVars = {};
  const varRegex = /--([\w-]+)\s*:\s*([^;]+)/g;
  while ((match = varRegex.exec(allStyles)) !== null) {
    cssVars[`--${match[1]}`] = match[2].trim();
  }

  // Extract font families
  const fonts = new Set();
  const fontRegex = /font-family\s*:\s*([^;}"]+)/gi;
  while ((match = fontRegex.exec(html)) !== null) {
    fonts.add(match[1].trim());
  }

  // Extract Google Fonts links
  const googleFonts = [];
  const gfRegex = /fonts\.googleapis\.com\/css2?\?family=([^"&]+)/g;
  while ((match = gfRegex.exec(html)) !== null) {
    googleFonts.push(decodeURIComponent(match[1]).replace(/\+/g, ' '));
  }

  // Extract colors (hex, rgb, rgba, hsl)
  const colors = new Set();
  const hexRegex = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;
  while ((match = hexRegex.exec(allStyles)) !== null) {
    colors.add(match[0]);
  }
  const rgbRegex = /rgba?\s*\([^)]+\)/g;
  while ((match = rgbRegex.exec(allStyles)) !== null) {
    colors.add(match[0]);
  }
  const hslRegex = /hsla?\s*\([^)]+\)/g;
  while ((match = hslRegex.exec(allStyles)) !== null) {
    colors.add(match[0]);
  }

  // Extract layout patterns
  const hasGrid = /display\s*:\s*grid/i.test(allStyles);
  const hasFlex = /display\s*:\s*flex/i.test(allStyles);
  const hasBackdropFilter = /backdrop-filter/i.test(allStyles);

  // Extract meta tags
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["'](.*?)["']/i);
  const themeColorMatch = html.match(/<meta\s+name=["']theme-color["']\s+content=["'](.*?)["']/i);

  const extracted = {
    url,
    title: titleMatch ? titleMatch[1] : null,
    description: descMatch ? descMatch[1] : null,
    ogImage: ogImageMatch ? ogImageMatch[1] : null,
    themeColor: themeColorMatch ? themeColorMatch[1] : null,
    cssVariables: cssVars,
    cssVariableCount: Object.keys(cssVars).length,
    fonts: [...fonts],
    googleFonts,
    colors: [...colors].slice(0, 50), // Cap at 50
    layoutPatterns: {
      usesGrid: hasGrid,
      usesFlex: hasFlex,
      usesBackdropFilter: hasBackdropFilter,
    },
  };

  // Send to GPT-5 for structured analysis
  let gptAnalysis = null;
  try {
    const prompt = URL_ANALYSIS_PROMPT.replace('{extractedData}', JSON.stringify(extracted, null, 2));
    const result = await callGPT5(
      [
        { role: 'system', content: 'You are a design system analyst. Respond ONLY with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      { max_completion_tokens: 3000, responseFormat: 'json' }
    );
    gptAnalysis = JSON.parse(result);
  } catch (err) {
    console.error('[agent-analysis] GPT URL analysis failed:', err.message);
  }

  return { extracted, gptAnalysis };
}

/**
 * Deep analyze an image with 4 parallel GPT-5 Vision calls
 * @param {string} filePath - Path to the image file
 * @param {string} mimeType - MIME type of the image
 * @returns {{ colors: object, typography: object, layout: object, components: object, summary: string }}
 */
async function deepAnalyzeImage(filePath, mimeType) {
  // Run 4 analyses in parallel — 3000 tokens each for pixel-perfect detail
  const [colorsRaw, typographyRaw, layoutRaw, componentsRaw] = await Promise.all([
    callGPT5Vision(filePath, mimeType, IMAGE_ANALYSIS_PROMPTS.colors, {
      max_completion_tokens: 3000,
      responseFormat: 'json',
    }).catch(err => JSON.stringify({ error: err.message })),
    callGPT5Vision(filePath, mimeType, IMAGE_ANALYSIS_PROMPTS.typography, {
      max_completion_tokens: 3000,
      responseFormat: 'json',
    }).catch(err => JSON.stringify({ error: err.message })),
    callGPT5Vision(filePath, mimeType, IMAGE_ANALYSIS_PROMPTS.layout, {
      max_completion_tokens: 3000,
      responseFormat: 'json',
    }).catch(err => JSON.stringify({ error: err.message })),
    callGPT5Vision(filePath, mimeType, IMAGE_ANALYSIS_PROMPTS.components, {
      max_completion_tokens: 3000,
      responseFormat: 'json',
    }).catch(err => JSON.stringify({ error: err.message })),
  ]);

  // Parse JSON results safely
  const parseJSON = (raw, label) => {
    try {
      return typeof raw === 'object' ? raw : JSON.parse(raw);
    } catch (err) {
      console.error(`[agent-analysis] Failed to parse ${label} JSON:`, err.message);
      return { error: `Failed to parse ${label}`, raw: String(raw).slice(0, 200) };
    }
  };

  const colors = parseJSON(colorsRaw, 'colors');
  const typography = parseJSON(typographyRaw, 'typography');
  const layout = parseJSON(layoutRaw, 'layout');
  const components = parseJSON(componentsRaw, 'components');

  // Build a human-readable summary from structured data (handles both old and new field names)
  const summaryParts = [];
  // Colors
  const bgLayers = colors.backgroundLayers;
  if (bgLayers && Array.isArray(bgLayers) && bgLayers.length > 0) {
    summaryParts.push(`Background: ${bgLayers[0]}`);
  } else if (colors.dominantBackground) {
    summaryParts.push(`Background: ${colors.dominantBackground}`);
  }
  if (colors.colorStrategy) summaryParts.push(`Color strategy: ${colors.colorStrategy}`);
  const accents = colors.accentColors;
  if (accents && typeof accents === 'object') {
    const primary = accents.primary || accents.primaryAccent;
    if (primary) summaryParts.push(`Primary accent: ${primary}`);
  } else if (colors.primaryAccent) {
    summaryParts.push(`Primary accent: ${colors.primaryAccent}`);
  }
  // Typography
  const fonts = typography.fontFamilies;
  if (fonts && typeof fonts === 'object') {
    if (fonts.display) summaryParts.push(`Display: ${fonts.display}`);
    if (fonts.body) summaryParts.push(`Body: ${fonts.body}`);
  } else {
    if (typography.displayFont) summaryParts.push(`Display: ${typography.displayFont}`);
    if (typography.bodyFont) summaryParts.push(`Body: ${typography.bodyFont}`);
  }
  // Layout
  const pageStructure = layout.pageStructure;
  if (pageStructure) summaryParts.push(`Layout: ${pageStructure}`);
  else if (layout.primaryLayout) summaryParts.push(`Layout: ${layout.primaryLayout}`);
  // Components aesthetic
  if (components.designInfluences) summaryParts.push(`Influences: ${Array.isArray(components.designInfluences) ? components.designInfluences.join(', ') : components.designInfluences}`);
  else if (components.overallAesthetic) summaryParts.push(`Aesthetic: ${components.overallAesthetic}`);

  const summary = summaryParts.join(' | ');

  return { colors, typography, layout, components, summary };
}

/**
 * Synthesize a Design Brief from all references + conversation context
 * @param {Array} references - Array of reference objects with structured_analysis
 * @param {Array} messages - Conversation messages
 * @returns {object} Design Brief JSON
 */
async function synthesizeDesignBrief(references, messages) {
  // Build analyses summary from references
  const analyses = references.map((ref, idx) => {
    const analysis = ref.structured_analysis;
    if (!analysis) return `Reference ${idx + 1} (${ref.type}): No structured analysis available`;

    if (ref.type === 'image') {
      return `Image Reference ${idx + 1} (${ref.filename || 'screenshot'}):\n${JSON.stringify(analysis, null, 2)}`;
    } else {
      return `URL Reference ${idx + 1} (${ref.url}):\n${JSON.stringify(analysis, null, 2)}`;
    }
  }).join('\n\n---\n\n');

  // Build conversation summary (last 10 messages, truncated)
  const recentMessages = messages.slice(-10);
  const conversationSummary = recentMessages.map(m => {
    const content = m.content.length > 500 ? m.content.slice(0, 500) + '...' : m.content;
    return `${m.role}: ${content}`;
  }).join('\n\n');

  const prompt = DESIGN_BRIEF_PROMPT
    .replace('{analyses}', analyses)
    .replace('{conversationSummary}', conversationSummary);

  const result = await callGPT5(
    [
      { role: 'system', content: 'You are a design system architect. Synthesize reference analyses into a comprehensive Design Brief. Respond ONLY with valid JSON.' },
      { role: 'user', content: prompt }
    ],
    { max_completion_tokens: 6000, responseFormat: 'json' }
  );

  return JSON.parse(result);
}

module.exports = {
  deepAnalyzeURL,
  deepAnalyzeImage,
  synthesizeDesignBrief,
  callGPT5,
  callGPT5Vision,
};
