/**
 * KB Populator — Auto-generates knowledge base entries using AI.
 *
 * Takes a source config (URL, topic, or brief) and produces structured
 * knowledge entries with embeddings, ready for RAG injection via inject_knowledge.
 *
 * Modes:
 *   - scrape_reference: Fetch a URL, analyze its design/UX, create structured entries
 *   - generate_patterns: Generate UX patterns for a UI type (dashboard, kanban, node-editor...)
 *   - generate_principles: Generate design/UX principles with concrete applications
 *   - generate_interactions: Generate micro-interaction code snippets (drag, zoom, keyboard...)
 *   - generate_states: Generate state design examples (empty, loading, error, overflow...)
 *   - generate_tokens: Extract or generate design tokens (colors, typography, spacing...)
 *   - generate_components: Generate component anatomy breakdowns
 *   - custom: Free-form brief → AI generates structured entries
 *
 * Each mode uses a specialized LLM prompt that outputs a JSON array of entries.
 * Entries are auto-embedded via OpenAI text-embedding-3-small (1536 dims).
 */

const { callGPT5 } = require('./agent-analysis');
const { generateEmbedding, estimateTokens } = require('./embeddings');
const db = require('../db');

// =================== MODE PROMPTS ===================

const MODE_PROMPTS = {

  scrape_reference: {
    system: `You are a UX/design analyst. You extract design patterns, tokens, and interaction details from website HTML/CSS.

Given a website's design analysis, produce structured knowledge entries. Each entry must be:
- Self-contained (understandable without the others)
- Specific (not generic — tied to this particular product/site)
- Actionable (includes code snippets, CSS values, or implementation details)

Categories to extract:
1. Design Tokens — exact CSS values (colors, fonts, spacing, radius, shadows)
2. Layout Patterns — grid structures, responsive behavior, content hierarchy
3. Component Inventory — buttons, cards, modals, forms found on the page
4. Interaction Patterns — hover effects, animations, transitions, click behaviors
5. UX Insights — what this product does well, patterns worth copying`,

    user: (args, designAnalysis) => `Analyze this reference site and create knowledge entries.

URL: ${args.url}
${args.focus ? `Focus: ${args.focus}` : ''}

## Design Analysis
${designAnalysis || '[No design data available]'}

Return JSON: {"entries": [{"title": "category: specific topic", "content": "detailed description with code/values", "tags": ["tag1", "tag2"]}]}
Generate 8-15 entries. Each entry should be 100-500 words.`
  },

  generate_patterns: {
    system: `You are a UX pattern expert with deep knowledge of the best products in every domain.

Generate comprehensive UX pattern entries for a specific UI type. Each entry must include:
- Pattern name and description
- Which reference products use this pattern (with specifics)
- Priority level (must-have / should-have / nice-to-have)
- Implementation details with HTML/CSS/JS code snippets
- Accessibility considerations

Be SPECIFIC — not generic descriptions. Include actual pixel values, timing durations, and code.`,

    user: (args) => `Generate UX pattern entries for: ${args.ui_type}

${args.reference_products ? `Reference products to analyze: ${args.reference_products.join(', ')}` : ''}
${args.focus ? `Focus area: ${args.focus}` : ''}
${args.domain ? `Domain: ${args.domain}` : ''}

Return JSON: {"entries": [{"title": "ui_type: pattern name", "content": "detailed description with code snippets, references, and a11y notes", "tags": ["tag1", "tag2"]}]}
Generate 10-20 entries covering: core interactions, visual patterns, state handling, edge cases, accessibility.`
  },

  generate_principles: {
    system: `You are a UX researcher and design psychologist. You know design principles deeply — not just the names, but the science behind them and how to apply them in real interfaces.

Generate design principle entries. Each entry must include:
- The principle name and scientific basis
- 2-3 concrete UI applications with before/after examples
- CSS/HTML code snippets showing the principle in action
- Common violations and how to fix them
- Metrics/thresholds (e.g., "400ms Doherty threshold", "44px min touch target")`,

    user: (args) => `Generate design principle entries${args.domain ? ` for the ${args.domain} domain` : ''}.

${args.focus ? `Focus area: ${args.focus}` : 'Cover the full spectrum: cognitive, visual, interaction, accessibility.'}
${args.principles ? `Specific principles to cover: ${args.principles.join(', ')}` : ''}

Return JSON: {"entries": [{"title": "principle: Name", "content": "detailed explanation with applications, code, thresholds", "tags": ["tag1", "tag2"]}]}
Generate 10-15 entries.`
  },

  generate_interactions: {
    system: `You are a frontend interaction engineer. You write performant, accessible micro-interaction code.

Generate complete, battle-tested interaction code snippets. Each entry must include:
- Full JavaScript implementation (vanilla, using PointerEvents)
- CSS for all states (idle, active, hover, dragging, disabled)
- Keyboard alternatives for every mouse interaction
- Performance notes (requestAnimationFrame, passive listeners, will-change)
- Touch/mobile considerations

Code must be copy-pasteable and work standalone.`,

    user: (args) => `Generate interaction code entries${args.page_type ? ` for a ${args.page_type}` : ''}.

${args.interactions ? `Interactions to cover: ${args.interactions.join(', ')}` : 'Cover: drag-drop, rubber-band selection, zoom, keyboard navigation, context menu, undo-redo, infinite scroll, snap-to-grid.'}

Return JSON: {"entries": [{"title": "interaction: name", "content": "full JS + CSS code with comments, keyboard alternative, performance notes", "tags": ["tag1", "tag2"]}]}
Generate 8-12 entries. Each entry should be a complete, working implementation.`
  },

  generate_states: {
    system: `You are a UI state design specialist. You design empty states, loading states, error states, and edge cases that delight users.

Generate state design entries with complete HTML/CSS code. Each entry must include:
- The design rationale (WHY this approach works psychologically)
- Complete HTML/CSS code (self-contained, copy-pasteable)
- Reference product that does this well
- Variants for different contexts (compact, full-page, inline)
- Animation/transition details
- Accessibility: ARIA live regions, role, focus management`,

    user: (args) => `Generate state design entries${args.context ? ` for ${args.context}` : ''}.

${args.states ? `States to cover: ${args.states.join(', ')}` : 'Cover: empty (onboarding, no-data, no-results), loading (skeleton, progressive, spinner), error (inline, toast, full-page, field-level), overflow (pagination, virtual scroll, load-more), success (confirmation, celebration).'}
${args.style ? `Style: ${args.style}` : ''}

Return JSON: {"entries": [{"title": "state: type - variant", "content": "rationale + HTML/CSS code + reference + a11y", "tags": ["tag1", "tag2"]}]}
Generate 10-15 entries.`
  },

  generate_tokens: {
    system: `You are a design system architect. You create precise, well-organized design token systems.

Generate design token entries. Each entry must include:
- Exact CSS custom property definitions with values
- Usage guidelines (when to use each token)
- Semantic naming conventions
- Dark/light mode variations if applicable
- Scale reasoning (why these specific values)`,

    user: (args) => `Generate design token entries${args.style ? ` in ${args.style} style` : ''}.

${args.reference ? `Reference product: ${args.reference}` : ''}
${args.categories ? `Categories: ${args.categories.join(', ')}` : 'Cover: colors (primary, secondary, neutral, semantic), typography (scale, weights, line-heights), spacing (scale), radii, shadows/elevation, z-index, transitions/easing, breakpoints.'}

Return JSON: {"entries": [{"title": "tokens: category", "content": "CSS custom properties + usage guidelines + scale reasoning", "tags": ["tag1", "tag2"]}]}
Generate 8-12 entries.`
  },

  generate_components: {
    system: `You are a component architecture expert. You design detailed component breakdowns with every variant, state, and accessibility pattern.

Generate component anatomy entries. Each entry must include:
- Full HTML structure with semantic elements and ARIA
- CSS for all variants (sizes, themes)
- All states (default, hover, focus, active, disabled, loading, error, selected)
- Props/API surface if component-based
- Keyboard interaction model
- Responsive behavior`,

    user: (args) => `Generate component anatomy entries${args.context ? ` for ${args.context}` : ''}.

${args.components ? `Components: ${args.components.join(', ')}` : 'Cover the most useful UI components: button, card, modal, input, select, badge, avatar, toast, tooltip, sidebar, table row, metric card, tab bar.'}
${args.style ? `Style: ${args.style}` : ''}

Return JSON: {"entries": [{"title": "component: name", "content": "HTML structure + CSS states + keyboard + responsive + ARIA", "tags": ["tag1", "tag2"]}]}
Generate 8-12 entries. Each entry should be a complete component specification.`
  },

  custom: {
    system: `You are a knowledge base curator. You create well-structured, specific, actionable knowledge entries from a brief.

Each entry must be:
- Self-contained and specific (not generic)
- 100-500 words with concrete details, code, or examples
- Titled with a clear "category: topic" format
- Tagged for easy retrieval`,

    user: (args) => `Create knowledge base entries from this brief:

${args.brief}

${(() => { const n = parseInt(args.entry_count, 10); return (n > 0 && n <= 50) ? `Generate exactly ${n} entries.` : 'Generate 8-15 entries.'; })()}

Return JSON: {"entries": [{"title": "category: topic", "content": "detailed entry content", "tags": ["tag1", "tag2"]}]}`
  }
};

// =================== SCRAPE HELPER ===================

async function scrapeAndAnalyze(url) {
  const { fetchUrl } = require('./mcp-processors');
  const { extractDesignInfo, formatDesignAnalysis } = require('./mcp-processors');

  const fetchResult = await fetchUrl(url, { timeout: 20000 });
  if (fetchResult.error) {
    return { error: fetchResult.error, analysis: null };
  }

  const designInfo = extractDesignInfo(fetchResult.html);
  const analysis = formatDesignAnalysis(designInfo);
  return { error: null, analysis, url: fetchResult.finalUrl || url };
}

// =================== MAIN POPULATE FUNCTION ===================

/**
 * Auto-populate a knowledge base with AI-generated entries.
 *
 * @param {Object} config
 * @param {string} config.mode - One of the MODE_PROMPTS keys
 * @param {string} config.agentName - Agent to link the KB to
 * @param {string} config.kbName - Name for the KB (auto-created if doesn't exist)
 * @param {string} [config.kbId] - Existing KB ID (skip creation)
 * @param {Object} config.args - Mode-specific arguments
 * @param {string} [config.userId] - User ID for KB ownership
 * @param {Function} [config.onProgress] - Progress callback: (step, detail) => void
 * @returns {Object} { kb, entries, stats }
 */
async function populateKnowledgeBase(config) {
  const { mode, agentName, kbName, kbId, args, userId, onProgress } = config;

  const progress = onProgress || (() => {});
  const modeConfig = MODE_PROMPTS[mode];
  if (!modeConfig) {
    throw new Error(`Unknown mode: ${mode}. Available: ${Object.keys(MODE_PROMPTS).join(', ')}`);
  }

  // 1. Get or create KB
  progress('kb', 'Creating or finding knowledge base...');
  let kb;
  if (kbId) {
    kb = await db.getKnowledgeBase(kbId);
    if (!kb) throw new Error(`Knowledge base ${kbId} not found`);
  } else {
    const name = kbName || `${agentName} — ${mode}`;
    // Check if KB already exists with this name
    const allKbs = userId ? await db.getKnowledgeBasesByUser(userId) : await db.getAllKnowledgeBases();
    kb = allKbs.find(k => k.name === name);
    if (!kb) {
      kb = await db.createKnowledgeBase(name, `Auto-generated: ${mode} entries for ${agentName}`, userId);
      progress('kb', `Created KB: ${kb.name} (${kb.id})`);
    } else {
      progress('kb', `Using existing KB: ${kb.name} (${kb.id})`);
    }
  }

  // 2. Link to agent if not already linked
  if (agentName) {
    const existingLinks = await db.getAgentKnowledgeBases(agentName);
    const alreadyLinked = existingLinks.some(k => k.id === kb.id);
    if (!alreadyLinked) {
      await db.assignKnowledgeBaseToAgent(agentName, kb.id);
      progress('link', `Linked KB to agent ${agentName}`);
    }
  }

  // 3. Prepare LLM context (scrape if needed)
  let designAnalysis = null;
  if (mode === 'scrape_reference' && args.url) {
    progress('scrape', `Fetching and analyzing ${args.url}...`);
    const scrapeResult = await scrapeAndAnalyze(args.url);
    if (scrapeResult.error) {
      progress('scrape', `Warning: fetch failed: ${scrapeResult.error}`);
    }
    designAnalysis = scrapeResult.analysis;
  }

  // 4. Call LLM to generate entries
  progress('generate', 'Generating entries with AI...');
  const systemMessage = modeConfig.system;
  const userMessage = mode === 'scrape_reference'
    ? modeConfig.user(args, designAnalysis)
    : modeConfig.user(args);

  let response;
  try {
    response = await callGPT5([
      { role: 'system', content: systemMessage },
      { role: 'user', content: userMessage },
    ], { max_completion_tokens: 16000, responseFormat: 'json' });
  } catch (err) {
    throw new Error(`LLM generation failed: ${err.message}`);
  }

  if (!response || response.length < 10) {
    throw new Error('LLM returned empty response');
  }

  // 5. Parse entries
  let entries;
  try {
    const parsed = JSON.parse(response);
    entries = parsed.entries || parsed;
    if (!Array.isArray(entries)) {
      entries = Object.values(parsed).find(v => Array.isArray(v)) || [];
    }
  } catch (e) {
    // Try to extract JSON from response (object or array)
    const objMatch = response.match(/\{[\s\S]*\}/);
    const arrMatch = response.match(/\[[\s\S]*\]/);
    const raw = objMatch?.[0] || arrMatch?.[0];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        entries = parsed.entries || (Array.isArray(parsed) ? parsed : Object.values(parsed).find(v => Array.isArray(v))) || [];
      } catch { throw new Error('Failed to parse AI response as JSON'); }
    } else {
      throw new Error('AI returned non-JSON response');
    }
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('AI generated no entries');
  }

  progress('generate', `Generated ${entries.length} entries`);

  // 6. Save entries with embeddings
  const savedEntries = [];
  const errors = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const title = entry.title || `Entry ${i + 1}`;
    const content = entry.content || '';
    const tags = entry.tags || [];

    if (!content || content.length < 10) continue;

    progress('embed', `Embedding entry ${i + 1}/${entries.length}: ${title.substring(0, 50)}...`);

    try {
      // Generate embedding
      const textToEmbed = `${title}\n\n${content}`;
      const embedding = await generateEmbedding(textToEmbed);
      const tokenCount = estimateTokens(textToEmbed);

      // Save to DB
      const saved = await db.createKnowledgeEntry(
        kb.id,
        title,
        content,
        mode === 'scrape_reference' ? 'url' : 'manual',
        args.url || '',
        '',
        { mode, tags, source: 'ai-generated', generatedAt: new Date().toISOString() },
        embedding,
        tokenCount
      );

      savedEntries.push(saved);
    } catch (err) {
      console.error(`[KB Populator] Failed to save entry "${title}":`, err.message);
      errors.push({ title, error: err.message });
      progress('error', `Failed: ${title} — ${err.message}`);
    }
  }

  // 7. Update entry count
  await db.updateKnowledgeBaseEntryCount(kb.id);

  const stats = {
    mode,
    generated: entries.length,
    saved: savedEntries.length,
    failed: entries.length - savedEntries.length,
    kbId: kb.id,
    kbName: kb.name,
    agentName,
    errors: errors.length > 0 ? errors : undefined,
  };

  progress('done', `Completed: ${savedEntries.length} entries saved to "${kb.name}"`);

  return { kb, entries: savedEntries, stats };
}

/**
 * Auto-populate ALL recommended KBs for a design agent.
 * Creates 6 KBs with ~70-100 entries total.
 */
async function populateDesignAgentFull(agentName, options = {}) {
  const { userId, onProgress, style } = options;
  const progress = onProgress || (() => {});
  const results = [];

  const batches = [
    {
      mode: 'generate_patterns',
      kbName: `${agentName} — UX Patterns`,
      args: { ui_type: 'dashboard kanban node-editor chat form table', domain: style || 'saas' },
    },
    {
      mode: 'generate_principles',
      kbName: `${agentName} — Design Principles`,
      args: { domain: style || 'web applications' },
    },
    {
      mode: 'generate_interactions',
      kbName: `${agentName} — Interaction Snippets`,
      args: { page_type: style || 'web application' },
    },
    {
      mode: 'generate_states',
      kbName: `${agentName} — State Design`,
      args: { style: style || 'modern dark theme' },
    },
    {
      mode: 'generate_tokens',
      kbName: `${agentName} — Design Tokens`,
      args: { style: style || 'modern dark SaaS' },
    },
    {
      mode: 'generate_components',
      kbName: `${agentName} — Component Anatomy`,
      args: { style: style || 'modern web application' },
    },
  ];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    progress('batch', `[${i + 1}/${batches.length}] ${batch.mode}...`);

    try {
      const result = await populateKnowledgeBase({
        mode: batch.mode,
        agentName,
        kbName: batch.kbName,
        args: batch.args,
        userId,
        onProgress: (step, detail) => progress(step, `[${i + 1}/${batches.length}] ${detail}`),
      });
      results.push(result.stats);
    } catch (err) {
      console.error(`[KB Populator] Batch ${batch.mode} failed:`, err.message);
      results.push({ mode: batch.mode, error: err.message });
    }
  }

  const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
  const totalFailed = results.reduce((sum, r) => sum + (r.failed || 0) + (r.error ? 1 : 0), 0);

  return {
    agentName,
    batches: results,
    totalSaved,
    totalFailed,
  };
}

module.exports = {
  populateKnowledgeBase,
  populateDesignAgentFull,
  AVAILABLE_MODES: Object.keys(MODE_PROMPTS),
};
