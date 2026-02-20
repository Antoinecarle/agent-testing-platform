// Agent Creator Routes — V2
// Deep analysis, design briefs, multi-step generation for 600-900 line agents

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db');

// Import analysis and template modules
const { deepAnalyzeURL, deepAnalyzeContentURL, deepAnalyzeImage, analyzeDocument, classifyURL, synthesizeDesignBrief, callGPT5 } = require('../lib/agent-analysis');
const {
  AGENT_TYPE_CONFIGS,
  getConversationSystemPrompt,
  getGenerationSystemPrompt,
  getGenerationUserPrompt,
  getBriefSynthesisPrompt,
  getAgentExample,
  REFINEMENT_PROMPT,
  validateAgentQuality,
  DOCUMENT_EXTRACTION_MODES,
  resolveExtractionMode,
} = require('../lib/agent-templates');
const { prepareStreamRequest, parseProviderSSELine, PROVIDER_CONFIGS } = require('../lib/llm-providers');
const { resolveUserLLMConfig } = require('../lib/resolve-llm-key');

const GPT5_MODEL = 'gpt-5-mini-2025-08-07';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

// ========== GENERATION QUALITY TIERS ==========
// Calibrated settings per quality tier — same model, different output depth
const GENERATION_QUALITY_TIERS = {
  fast: {
    id: 'fast',
    label: 'Rapide',
    description: 'Agent concis, 200-350 lignes (~15s)',
    maxCompletionTokens: 10000,
    chatTokens: 8000,
    targetLines: { min: 200, max: 350 },
    lineReductionFactor: 0.4,
    model: GPT5_MODEL,
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Bon équilibre qualité/vitesse, 350-550 lignes (~30s)',
    maxCompletionTokens: 18000,
    chatTokens: 12000,
    targetLines: { min: 350, max: 550 },
    lineReductionFactor: 0.7,
    model: GPT5_MODEL,
  },
  full: {
    id: 'full',
    label: 'Complet',
    description: 'Agent exhaustif, 500-900 lignes (~60s)',
    maxCompletionTokens: 32000,
    chatTokens: 16000,
    targetLines: { min: 500, max: 900 },
    lineReductionFactor: 1.0,
    model: GPT5_MODEL,
  },
};

// Multer setup for image uploads
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'agent-creator-uploads');

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (PNG, JPG, WEBP) are allowed'));
    }
  }
});

// Document upload config (PDF, MD, TXT, JSON, YAML, CSV)
const documentUpload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for documents
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/plain', 'text/markdown', 'text/csv',
      'application/json', 'application/x-yaml', 'text/yaml',
    ];
    const allowedExts = ['.pdf', '.md', '.txt', '.json', '.yaml', '.yml', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Allowed: PDF, MD, TXT, JSON, YAML, CSV'));
    }
  }
});

// ========== HELPER: Build references context for conversation ==========

function buildReferencesContext(references) {
  if (!references || references.length === 0) return '';

  let ctx = '\n\n## Reference Analyses\n';
  references.forEach((ref, idx) => {
    if (ref.type === 'image') {
      const s = ref.structured_analysis;
      if (s) {
        ctx += `\n### Image ${idx + 1}: ${ref.filename || 'screenshot'}\n`;
        const jsonStr = JSON.stringify(s, null, 1);
        if (jsonStr.length > 6000) {
          ctx += formatStructuredAnalysis(s);
        } else {
          ctx += '```json\n' + jsonStr + '\n```\n';
        }
      } else if (ref.analysis) {
        ctx += `\n### Image ${idx + 1}: ${ref.filename}\n${ref.analysis}\n`;
      }
    } else if (ref.type === 'url') {
      const s = ref.structured_analysis;
      if (s) {
        // Check if this is a content analysis (has gptAnalysis.keyInsights) vs design analysis
        const isContent = s.extracted?.analysisMode === 'content' || s.gptAnalysis?.keyInsights;
        if (isContent) {
          ctx += `\n### Content URL ${idx + 1}: ${ref.url}\n`;
          ctx += formatContentAnalysis(s);
        } else {
          ctx += `\n### Design URL ${idx + 1}: ${ref.url}\n`;
          const jsonStr = JSON.stringify(s, null, 1);
          if (jsonStr.length > 4000) {
            ctx += formatURLAnalysis(s);
          } else {
            ctx += '```json\n' + jsonStr + '\n```\n';
          }
        }
      } else if (ref.analysis) {
        try {
          const analysis = typeof ref.analysis === 'string' ? JSON.parse(ref.analysis) : ref.analysis;
          ctx += `\n### URL ${idx + 1}: ${ref.url}\nTitle: ${analysis.title}\n`;
        } catch (_) {
          ctx += `\n### URL ${idx + 1}: ${ref.url}\n${ref.analysis}\n`;
        }
      }
    } else if (ref.type === 'document') {
      const s = ref.structured_analysis;
      if (s) {
        ctx += `\n### Document ${idx + 1}: ${ref.filename}\n`;
        ctx += formatDocumentAnalysis(s);
      } else if (ref.analysis) {
        ctx += `\n### Document ${idx + 1}: ${ref.filename}\n${ref.analysis}\n`;
      }
    }
  });
  return ctx;
}

function formatStructuredAnalysis(s) {
  let out = '';
  const c = s.colors;
  if (c) {
    out += '**Colors**:\n';
    if (c.backgroundLayers) out += `- Background layers: ${JSON.stringify(c.backgroundLayers)}\n`;
    if (c.backgroundGradients) out += `- Gradients: ${JSON.stringify(c.backgroundGradients)}\n`;
    if (c.accentColors) out += `- Accents: ${JSON.stringify(c.accentColors)}\n`;
    if (c.textColors) out += `- Text colors: ${JSON.stringify(c.textColors)}\n`;
    if (c.borderColors) out += `- Borders: ${JSON.stringify(c.borderColors)}\n`;
    if (c.shadows) out += `- Shadows: ${JSON.stringify(c.shadows)}\n`;
    if (c.effects) out += `- Effects: ${JSON.stringify(c.effects)}\n`;
  }
  const t = s.typography;
  if (t) {
    out += '**Typography**:\n';
    if (t.fontFamilies) out += `- Fonts: ${JSON.stringify(t.fontFamilies)}\n`;
    if (t.typeScale) out += `- Scale: ${JSON.stringify(t.typeScale)}\n`;
    if (t.typographyRules) out += `- Rules: ${JSON.stringify(t.typographyRules)}\n`;
  }
  const l = s.layout;
  if (l) {
    out += '**Layout**:\n';
    if (l.pageStructure) out += `- Structure: ${l.pageStructure}\n`;
    if (l.spacingSystem) out += `- Spacing: ${JSON.stringify(l.spacingSystem)}\n`;
    if (l.borderRadius) out += `- Radius: ${JSON.stringify(l.borderRadius)}\n`;
    if (l.gridSystem) out += `- Grid: ${JSON.stringify(l.gridSystem)}\n`;
  }
  const comp = s.components;
  if (comp) {
    out += '**Components**:\n';
    if (comp.componentList) {
      for (const c of comp.componentList.slice(0, 10)) {
        out += `- ${c.name}: ${JSON.stringify(c.cssDetails || c.description || '')}\n`;
      }
    } else if (comp.components) {
      for (const c of comp.components.slice(0, 10)) {
        out += `- ${c.type || c.name}: ${JSON.stringify(c.cssDetails || c.description || '')}\n`;
      }
    }
    if (comp.microInteractions) out += `- Micro-interactions: ${JSON.stringify(comp.microInteractions)}\n`;
    if (comp.designInfluences) out += `- Design influences: ${JSON.stringify(comp.designInfluences)}\n`;
  }
  return out;
}

function formatURLAnalysis(s) {
  let out = '';
  if (s.extracted) {
    const e = s.extracted;
    if (e.title) out += `- **Title**: ${e.title}\n`;
    if (e.cssVariableCount > 0) out += `- **CSS vars**: ${e.cssVariableCount} variables\n`;
    if (e.fonts?.length) out += `- **Fonts**: ${e.fonts.join(', ')}\n`;
    if (e.googleFonts?.length) out += `- **Google Fonts**: ${e.googleFonts.join(', ')}\n`;
    if (e.colors?.length) out += `- **Colors**: ${e.colors.slice(0, 20).join(', ')}\n`;
  }
  if (s.gptAnalysis) {
    out += `- **GPT Analysis**: ${JSON.stringify(s.gptAnalysis)}\n`;
  }
  return out;
}

function formatContentAnalysis(s) {
  let out = '';
  if (s.extracted) {
    const e = s.extracted;
    if (e.title) out += `- **Title**: ${e.title}\n`;
    if (e.textPreview) out += `- **Preview**: ${e.textPreview.slice(0, 200)}...\n`;
  }
  if (s.gptAnalysis) {
    const g = s.gptAnalysis;
    if (g.sourceType) out += `- **Type**: ${g.sourceType}\n`;
    if (g.summary) out += `- **Summary**: ${g.summary}\n`;
    if (g.keyTopics?.length) out += `- **Topics**: ${g.keyTopics.join(', ')}\n`;
    if (g.keyInsights?.length) {
      out += `- **Key Insights**:\n`;
      g.keyInsights.slice(0, 8).forEach(i => { out += `  - ${i}\n`; });
    }
    if (g.technicalDetails) {
      const td = g.technicalDetails;
      if (td.technologies?.length) out += `- **Technologies**: ${td.technologies.join(', ')}\n`;
      if (td.patterns?.length) out += `- **Patterns**: ${td.patterns.join(', ')}\n`;
    }
    if (g.recommendations?.length) {
      out += `- **Recommendations**:\n`;
      g.recommendations.slice(0, 5).forEach(r => { out += `  - ${r}\n`; });
    }
  }
  return out;
}

function formatDocumentAnalysis(s) {
  let out = '';
  if (s.filename) out += `- **File**: ${s.filename}\n`;
  if (s.textLength) out += `- **Size**: ${s.textLength} chars\n`;
  if (s.extractionMode) out += `- **Extraction Mode**: ${s.extractionMode}\n`;
  if (s.gptAnalysis) {
    const g = s.gptAnalysis;
    if (g.documentType) out += `- **Type**: ${g.documentType}\n`;
    if (g.summary) out += `- **Summary**: ${g.summary}\n`;

    // Generic fields (all modes)
    if (g.keyTopics?.length) out += `- **Topics**: ${g.keyTopics.join(', ')}\n`;
    if (g.keyInsights?.length) {
      out += `- **Key Insights**:\n`;
      g.keyInsights.slice(0, 8).forEach(i => { out += `  - ${i}\n`; });
    }

    // UX Design mode fields
    if (g.colorSystem) {
      const c = g.colorSystem;
      if (c.primary?.length) out += `- **Colors (Primary)**: ${c.primary.join(', ')}\n`;
      if (c.secondary?.length) out += `- **Colors (Secondary)**: ${c.secondary.join(', ')}\n`;
      if (c.notes) out += `- **Color Notes**: ${c.notes}\n`;
    }
    if (g.typography) {
      const t = g.typography;
      if (t.fontFamilies?.length) out += `- **Fonts**: ${t.fontFamilies.join(', ')}\n`;
      if (t.notes) out += `- **Typography Notes**: ${t.notes}\n`;
    }
    if (g.components) {
      const comp = g.components;
      const allComps = [...(comp.buttons || []), ...(comp.cards || []), ...(comp.forms || []), ...(comp.navigation || []), ...(comp.other || [])];
      if (allComps.length) out += `- **Components**: ${allComps.slice(0, 6).join('; ')}\n`;
    }
    if (g.designPrinciples?.length) {
      out += `- **Design Principles**:\n`;
      g.designPrinciples.slice(0, 5).forEach(p => { out += `  - ${p}\n`; });
    }

    // Data mode fields
    if (g.dataModels?.length) {
      out += `- **Data Models**: ${g.dataModels.map(m => m.name).join(', ')}\n`;
    }
    if (g.apiEndpoints?.length) {
      out += `- **API Endpoints**: ${g.apiEndpoints.length} endpoints\n`;
      g.apiEndpoints.slice(0, 4).forEach(ep => { out += `  - ${ep.method} ${ep.path}: ${ep.description}\n`; });
    }

    // Content mode fields
    if (g.toneOfVoice) {
      const tv = g.toneOfVoice;
      if (tv.personality?.length) out += `- **Tone**: ${tv.personality.join(', ')}\n`;
      if (tv.doUse?.length) out += `- **Do Use**: ${tv.doUse.slice(0, 4).join('; ')}\n`;
      if (tv.dontUse?.length) out += `- **Don't Use**: ${tv.dontUse.slice(0, 4).join('; ')}\n`;
    }
    if (g.contentPrinciples?.length) {
      out += `- **Content Principles**:\n`;
      g.contentPrinciples.slice(0, 5).forEach(p => { out += `  - ${p}\n`; });
    }

    // Technical mode fields
    if (g.techStack) {
      const ts = g.techStack;
      if (ts.languages?.length) out += `- **Languages**: ${ts.languages.join(', ')}\n`;
      if (ts.frameworks?.length) out += `- **Frameworks**: ${ts.frameworks.join(', ')}\n`;
    }
    if (g.codePatterns?.conventions?.length) {
      out += `- **Code Conventions**: ${g.codePatterns.conventions.slice(0, 4).join('; ')}\n`;
    }
    if (g.technicalRules?.length) {
      out += `- **Technical Rules**:\n`;
      g.technicalRules.slice(0, 5).forEach(r => { out += `  - ${r}\n`; });
    }

    // Business mode fields
    if (g.businessRules?.length) {
      out += `- **Business Rules**: ${g.businessRules.length} rules\n`;
      g.businessRules.slice(0, 4).forEach(r => { out += `  - [${r.priority}] ${r.rule}\n`; });
    }
    if (g.processes?.length) {
      out += `- **Processes**: ${g.processes.map(p => p.name).join(', ')}\n`;
    }
    if (g.businessPrinciples?.length) {
      out += `- **Business Principles**:\n`;
      g.businessPrinciples.slice(0, 5).forEach(p => { out += `  - ${p}\n`; });
    }

    // Generic fallbacks
    if (g.structuredData) {
      const sd = g.structuredData;
      if (sd.rules?.length) out += `- **Rules**: ${sd.rules.join('; ')}\n`;
      if (sd.configurations?.length) out += `- **Configs**: ${sd.configurations.join('; ')}\n`;
    }
    if (g.recommendations?.length) {
      out += `- **Recommendations**:\n`;
      g.recommendations.slice(0, 5).forEach(r => { out += `  - ${r}\n`; });
    }
  }
  return out;
}

// ========== ROUTES ==========

// List user's conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const conversations = await db.getUserAgentConversations(userId);
    res.json({ conversations });
  } catch (err) {
    console.error('[agent-creator] Error listing conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get available agent types for the type selector
router.get('/types', (req, res) => {
  const types = Object.values(AGENT_TYPE_CONFIGS).map(t => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    color: t.color,
    description: t.description,
    welcomeMessage: t.welcomeMessage,
  }));
  res.json({ types });
});

// Get available document extraction modes
router.get('/extraction-modes', (req, res) => {
  const modes = [
    { id: 'auto', label: 'Auto', icon: 'Wand2', description: 'Auto-detect from agent type' },
    ...Object.values(DOCUMENT_EXTRACTION_MODES).map(m => ({
      id: m.id,
      label: m.label,
      icon: m.icon,
      description: m.description,
    })),
  ];
  res.json({ modes });
});

// ========== LLM CONFIG — User's available providers ==========

router.get('/llm-config', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const userKeys = await db.getUserLlmKeys(userId);

    // Build provider list with status
    const providers = userKeys.map(k => ({
      provider: k.provider,
      model: k.model,
      displayName: k.display_name || PROVIDER_CONFIGS[k.provider]?.name || k.provider,
      isActive: k.is_active,
      lastUsed: k.last_used_at,
      lastError: k.last_error,
    }));

    // Active provider (if any)
    const active = providers.find(p => p.isActive);

    // Server fallback info
    const hasServerKey = !!process.env.OPENAI_API_KEY;

    res.json({
      providers,
      activeProvider: active ? active.provider : null,
      activeModel: active ? active.model : null,
      hasServerFallback: hasServerKey,
      serverFallbackModel: hasServerKey ? GPT5_MODEL : null,
    });
  } catch (err) {
    console.error('[agent-creator] Error fetching LLM config:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { name, agent_type, initial_agent } = req.body;
    const userId = req.user.userId || req.user.id;
    const conversation = await db.createAgentConversation(userId, name || 'New Agent', agent_type || 'custom');
    // If editing an existing agent, store it as generated_agent so preview works immediately
    if (initial_agent) {
      await db.updateConversationGeneratedAgent(conversation.id, initial_agent, 'complete');
    }
    res.json({ conversation });
  } catch (err) {
    console.error('[agent-creator] Error creating conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get conversation by ID (with messages, references, brief, generated agent)
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);

    res.json({
      conversation: {
        ...conversation,
        messages,
        references,
      }
    });
  } catch (err) {
    console.error('[agent-creator] Error fetching conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== DEEP IMAGE UPLOAD + ANALYSIS ==========

router.post('/conversations/:id/images', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = `/uploads/agent-creator/${req.file.filename}`;
    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    // Deep analysis: 4 parallel GPT-5 Vision calls (colors, typography, layout, components)
    console.log(`[agent-creator] Deep analyzing image: ${req.file.originalname}`);
    const structuredAnalysis = await deepAnalyzeImage(filePath, mimeType);

    // Create reference with both human-readable summary and structured JSON
    const reference = await db.createConversationReference(
      id,
      'image',
      imageUrl,
      req.file.originalname,
      structuredAnalysis.summary || 'Deep analysis completed'
    );

    // Store structured analysis separately
    await db.updateReferenceAnalysis(reference.id, structuredAnalysis);

    // Return reference with structured analysis attached
    res.json({
      reference: {
        ...reference,
        structured_analysis: structuredAnalysis,
      }
    });
  } catch (err) {
    console.error('[agent-creator] Error uploading image:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== DEEP URL ANALYSIS ==========

router.post('/conversations/:id/urls', async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Smart URL routing: design vs content analysis based on agent type + domain
    const agentType = conversation.agent_type || 'custom';
    const urlMode = classifyURL(url, agentType);
    console.log(`[agent-creator] Analyzing URL (${urlMode} mode, agent_type=${agentType}): ${url}`);

    const structuredAnalysis = urlMode === 'design'
      ? await deepAnalyzeURL(url)
      : await deepAnalyzeContentURL(url);

    let summary;
    if (urlMode === 'content') {
      summary = structuredAnalysis.gptAnalysis
        ? `${structuredAnalysis.extracted?.title || url} — ${structuredAnalysis.gptAnalysis.summary?.slice(0, 80) || 'content analyzed'}`
        : `${structuredAnalysis.extracted?.title || url} — content extracted`;
    } else {
      summary = structuredAnalysis.gptAnalysis
        ? `${structuredAnalysis.extracted?.title || url} — ${structuredAnalysis.gptAnalysis.designStyle || 'analyzed'}`
        : JSON.stringify({ title: structuredAnalysis.extracted?.title || 'Unknown', url });
    }

    // If og:image found (LinkedIn, Twitter, etc.), download and upload to Supabase Storage
    let profileImageUrl = null;
    const ogImage = structuredAnalysis.extracted?.ogImage;
    if (ogImage) {
      try {
        const imageRes = await fetch(ogImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (imageRes.ok) {
          const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
          const filename = `profile-${id}${ext}`;
          const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
          profileImageUrl = await db.uploadProfilePic(imageBuffer, filename, contentType);
          console.log(`[agent-creator] Downloaded og:image to Supabase: ${profileImageUrl} (${imageBuffer.length} bytes)`);
        }
      } catch (imgErr) {
        console.warn(`[agent-creator] Failed to download og:image from ${ogImage}:`, imgErr.message);
      }
    }

    const reference = await db.createConversationReference(
      id,
      'url',
      url,
      null,
      summary
    );

    // Store structured analysis (include profile_image_url if found)
    if (profileImageUrl) {
      structuredAnalysis.profile_image_url = profileImageUrl;
    }
    await db.updateReferenceAnalysis(reference.id, structuredAnalysis);

    res.json({
      reference: {
        ...reference,
        structured_analysis: structuredAnalysis,
        profile_image_url: profileImageUrl,
      }
    });
  } catch (err) {
    console.error('[agent-creator] Error adding URL:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== DOCUMENT UPLOAD + ANALYSIS ==========

router.post('/conversations/:id/documents', documentUpload.single('document'), async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }

    const filePath = req.file.path;
    const filename = req.file.originalname;
    const mimeType = req.file.mimetype;

    // Resolve extraction mode: from request body, or auto-detect from agent type
    const agentType = conversation.agent_type || 'custom';
    const requestedMode = req.body.extraction_mode || 'auto';
    const extractionMode = resolveExtractionMode(requestedMode, agentType);

    console.log(`[agent-creator] Analyzing document: ${filename} (${mimeType}) mode=${extractionMode} (requested=${requestedMode}, agentType=${agentType})`);
    const structuredAnalysis = await analyzeDocument(filePath, filename, mimeType, extractionMode);

    const summary = structuredAnalysis.gptAnalysis
      ? `${filename} — ${structuredAnalysis.gptAnalysis.summary?.slice(0, 80) || 'analyzed'}`
      : `${filename} — ${structuredAnalysis.textLength} chars extracted`;

    const reference = await db.createConversationReference(
      id,
      'document',
      `/uploads/agent-creator/${req.file.filename}`,
      filename,
      summary
    );

    await db.updateReferenceAnalysis(reference.id, structuredAnalysis);

    res.json({
      reference: {
        ...reference,
        structured_analysis: structuredAnalysis,
      }
    });
  } catch (err) {
    console.error('[agent-creator] Error uploading document:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== UPDATE CONVERSATION (rename etc.) ==========

router.put('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;

    const updated = await db.updateAgentConversation(id, updates);
    res.json({ conversation: updated });
  } catch (err) {
    console.error('[agent-creator] Error updating conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== CONVERSATION MESSAGES — SSE streaming chat ==========

router.post('/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { message, provider: reqProvider, model: reqModel } = req.body || {};

  // SSE headers for streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendSSE = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      sendSSE('error', { message: 'Conversation not found' });
      return res.end();
    }

    if (!message) {
      sendSSE('error', { message: 'Message is required' });
      return res.end();
    }

    // Load references with structured analysis
    const references = await db.getConversationReferences(id);
    const referencesContext = buildReferencesContext(references);

    // Build the upgraded system prompt
    const agentType = conversation.agent_type || 'custom';
    let systemPrompt = getConversationSystemPrompt(agentType)
      + (referencesContext.length > 8000 ? referencesContext.slice(0, 8000) + '\n...(truncated)' : referencesContext)
      + `\n\nCurrent conversation: Creating a ${agentType} agent for "${conversation.name}".`;

    // Save user message
    await db.createConversationMessage(id, 'user', message);

    sendSSE('status', { message: 'Thinking...' });

    // Load all messages for GPT context
    const allMessagesRaw = await db.getConversationMessages(id);
    const allMessages = allMessagesRaw.length > 20 ? allMessagesRaw.slice(-20) : allMessagesRaw;

    // Build image content parts for vision
    const imageRefs = references.filter(r => r.type === 'image' && r.url).slice(0, 3);
    const imageParts = [];
    for (const ref of imageRefs) {
      try {
        const filePath = path.join(UPLOAD_DIR, path.basename(ref.url));
        const imageBuffer = await fs.readFile(filePath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(ref.filename || ref.url).toLowerCase().replace('.', '');
        const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        imageParts.push({
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' }
        });
      } catch (err) {
        console.warn(`[agent-creator] Could not load image ${ref.url}:`, err.message);
      }
    }

    if (imageParts.length > 0) {
      sendSSE('status', { message: 'Analyzing images...' });
    }

    // Build GPT messages
    const gptMessages = [{ role: 'system', content: systemPrompt }];
    let imagesAttached = false;
    for (let i = 0; i < allMessages.length; i++) {
      const m = allMessages[i];
      if (m.role === 'user' && !imagesAttached && imageParts.length > 0) {
        gptMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            ...imageParts,
          ],
        });
        imagesAttached = true;
      } else {
        gptMessages.push({ role: m.role, content: m.content });
      }
    }

    // Resolve LLM provider + key
    const userId = req.user.userId || req.user.id;
    const llmConfig = await resolveUserLLMConfig(userId, reqProvider, reqModel);
    console.log(`[agent-creator] Chat request: ${allMessages.length} msgs, ${imageParts.length} images, provider=${llmConfig.provider}, model=${llmConfig.model}, source=${llmConfig.source}`);

    // Build streaming request for the resolved provider
    const streamReq = prepareStreamRequest(llmConfig.provider, llmConfig.apiKey, llmConfig.model, gptMessages, { maxTokens: 16000 });
    const streamRes = await fetch(streamReq.url, {
      method: 'POST',
      headers: streamReq.headers,
      body: streamReq.body,
      signal: AbortSignal.timeout(180000),
    });

    if (!streamRes.ok) {
      const errorText = await streamRes.text().catch(() => 'no body');
      throw new Error(`${llmConfig.provider} API error ${streamRes.status}: ${errorText.slice(0, 200)}`);
    }

    // Stream response chunks to client
    let fullContent = '';
    let chunkBuffer = '';
    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkBuffer += decoder.decode(value, { stream: true });
      const lines = chunkBuffer.split('\n');
      chunkBuffer = lines.pop() || '';

      for (const line of lines) {
        const delta = parseProviderSSELine(llmConfig.provider, line);
        if (delta) {
          fullContent += delta;
          sendSSE('chunk', { content: delta });
        }
      }
    }

    if (!fullContent) {
      throw new Error(`${llmConfig.provider} returned empty response`);
    }

    // Save assistant response to DB
    const assistantMessage = await db.createConversationMessage(id, 'assistant', fullContent);

    console.log(`[agent-creator] Chat response streamed: ${fullContent.length} chars (${llmConfig.provider}/${llmConfig.model})`);
    sendSSE('done', { messageId: assistantMessage.id, provider: llmConfig.provider, model: llmConfig.model });
    res.end();
  } catch (err) {
    console.error('[agent-creator] Error sending message:', err);
    sendSSE('error', { message: err.message });
    res.end();
  }
});

// ========== NEW: ANALYZE — Synthesize design brief ==========

router.post('/conversations/:id/analyze', async (req, res) => {
  const { id } = req.params;
  try {
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Update status
    await db.updateConversationGeneratedAgent(id, null, 'analyzing');

    // Load references and messages
    const references = await db.getConversationReferences(id);
    const messages = await db.getConversationMessages(id);

    if (references.length === 0 && messages.length < 2) {
      return res.status(400).json({ error: 'Add at least one reference or chat about the agent before analyzing' });
    }

    const agentType = conversation.agent_type || 'custom';
    console.log(`[agent-creator] Synthesizing ${agentType} brief for conversation ${id} (${references.length} refs, ${messages.length} msgs)`);

    // Synthesize brief from all analyses + conversation (type-aware)
    const brief = await synthesizeDesignBrief(references, messages, agentType);

    // Store brief
    await db.updateConversationBrief(id, brief);
    await db.updateConversationGeneratedAgent(id, null, 'briefing');

    console.log(`[agent-creator] Design brief generated for conversation ${id}`);

    res.json({ brief });
  } catch (err) {
    console.error('[agent-creator] Error analyzing:', err);
    await db.updateConversationGeneratedAgent(id, null, 'error').catch(() => {});
    res.status(500).json({ error: err.message });
  }
});

// Get design brief
router.get('/conversations/:id/brief', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ brief: conversation.design_brief || null });
  } catch (err) {
    console.error('[agent-creator] Error fetching brief:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== GET GENERATION QUALITY TIERS ==========

router.get('/generation-tiers', (req, res) => {
  const tiers = Object.values(GENERATION_QUALITY_TIERS).map(t => ({
    id: t.id,
    label: t.label,
    description: t.description,
    targetLines: t.targetLines,
  }));
  res.json({ tiers });
});

// ========== READINESS SCORE — Evaluate how ready the conversation is for generation ==========

router.get('/conversations/:id/readiness', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Not found' });

    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);
    const hasBrief = !!conversation.design_brief;
    const agentType = conversation.agent_type || 'custom';
    const config = AGENT_TYPE_CONFIGS[agentType] || AGENT_TYPE_CONFIGS['custom'];

    // Compute readiness score
    const userMessages = messages.filter(m => m.role === 'user');
    const totalUserChars = userMessages.reduce((sum, m) => sum + m.content.length, 0);
    const imageCount = references.filter(r => r.type === 'image').length;
    const urlCount = references.filter(r => r.type === 'url').length;
    const docCount = references.filter(r => r.type === 'document').length;

    let score = 0;
    const breakdown = [];

    // Content depth (0-55 points) — the most important factor
    if (totalUserChars > 300) { score += 10; breakdown.push({ key: 'content_basic', label: 'Context provided', points: 10 }); }
    if (totalUserChars > 1500) { score += 15; breakdown.push({ key: 'content_detailed', label: 'Detailed instructions', points: 15 }); }
    if (totalUserChars > 4000) { score += 15; breakdown.push({ key: 'content_rich', label: 'Rich specification', points: 15 }); }
    if (totalUserChars > 8000) { score += 15; breakdown.push({ key: 'content_exhaustive', label: 'Exhaustive specification', points: 15 }); }

    // Message count (0-15 points)
    if (userMessages.length >= 1) { score += 5; breakdown.push({ key: 'msg_1', label: 'First message', points: 5 }); }
    if (userMessages.length >= 2) { score += 5; breakdown.push({ key: 'msg_2', label: 'Dialogue started', points: 5 }); }
    if (userMessages.length >= 4) { score += 5; breakdown.push({ key: 'msg_4', label: 'Deep conversation', points: 5 }); }

    // References (0-20 points)
    if (imageCount > 0) { score += 10; breakdown.push({ key: 'images', label: `${imageCount} image(s) analyzed`, points: 10 }); }
    if (urlCount > 0) { score += 5; breakdown.push({ key: 'urls', label: `${urlCount} URL(s) analyzed`, points: 5 }); }
    if (docCount > 0) { score += 5; breakdown.push({ key: 'docs', label: `${docCount} document(s) analyzed`, points: 5 }); }

    // Brief (0-10 points)
    if (hasBrief) { score += 10; breakdown.push({ key: 'brief', label: 'Brief synthesized', points: 10 }); }

    score = Math.min(score, 100);

    // Determine status
    let status = 'needs_input';
    let statusLabel = 'More details needed';
    if (score >= 85) { status = 'excellent'; statusLabel = 'Excellent — ready to generate'; }
    else if (score >= 65) { status = 'good'; statusLabel = 'Good — can generate now'; }
    else if (score >= 40) { status = 'fair'; statusLabel = 'Add more details for better results'; }

    res.json({
      score,
      status,
      statusLabel,
      breakdown,
      stats: { userMessages: userMessages.length, totalUserChars, imageCount, urlCount, docCount, hasBrief },
    });
  } catch (err) {
    console.error('[agent-creator] Readiness error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== GENERATE — SSE streaming agent file generation ==========

router.post('/conversations/:id/generate', async (req, res) => {
  const { id } = req.params;
  const { quality = 'standard', provider: reqProvider, model: reqModel } = req.body || {};
  const tier = GENERATION_QUALITY_TIERS[quality] || GENERATION_QUALITY_TIERS.standard;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sendSSE = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      sendSSE('error', { message: 'Conversation not found' });
      return res.end();
    }

    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);
    let brief = conversation.design_brief;
    const agentType = conversation.agent_type || 'custom';

    // Send initial status
    sendSSE('status', { message: 'Preparing generation...', quality: tier.id, model: tier.model });

    // Auto-analyze if no brief exists
    if (!brief) {
      sendSSE('status', { message: 'Analyzing conversation...' });
      brief = await synthesizeDesignBrief(references, messages, agentType);
      await db.updateConversationBrief(id, brief);
    }

    await db.updateConversationGeneratedAgent(id, null, 'generating');

    // Build FULL conversation content — no truncation for fidelity
    // For fast tier, limit to last 6 messages but keep full content
    // For standard/full, use ALL user messages with complete content
    const msgLimit = tier.id === 'fast' ? 6 : messages.length;
    const recentMessages = messages.slice(-msgLimit);

    // Separate user content (FULL, never truncate) from assistant content (summarize)
    const conversationParts = recentMessages.map(m => {
      if (m.role === 'user') {
        // User content is the source of truth — NEVER truncate
        return `user: ${m.content}`;
      } else {
        // Assistant messages can be summarized (they're our own output)
        const content = m.content.length > 800 ? m.content.slice(0, 800) + '...' : m.content;
        return `assistant: ${content}`;
      }
    });
    const conversationSummary = conversationParts.join('\n\n');

    // Safety: if total context is huge, at least warn but still send
    const totalContextChars = conversationSummary.length;
    if (totalContextChars > 50000) {
      console.warn(`[agent-creator] Large conversation context: ${totalContextChars} chars — may approach token limits`);
    }

    // Derive agent name
    const derivedName = brief.agentIdentity?.aesthetic
      ? brief.agentIdentity.aesthetic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : conversation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Build calibrated prompts
    const agentExample = tier.id === 'fast' ? '' : getAgentExample(agentType); // Skip example for fast mode
    const generationUserPrompt = getGenerationUserPrompt(agentType, brief, conversationSummary, derivedName, agentExample, tier);
    const systemPrompt = getGenerationSystemPrompt(agentType, tier);

    // Resolve LLM provider + key for generation
    const userId = req.user.userId || req.user.id;
    const llmConfig = await resolveUserLLMConfig(userId, reqProvider, reqModel);
    const effectiveModel = llmConfig.model;

    sendSSE('status', { message: `Generating (${tier.label})...`, provider: llmConfig.provider, model: effectiveModel });
    console.log(`[agent-creator] Generating ${agentType} agent for ${derivedName} (quality=${tier.id}, provider=${llmConfig.provider}, model=${effectiveModel}, source=${llmConfig.source})`);

    // Build streaming request for the resolved provider
    const genMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: generationUserPrompt },
    ];
    const streamReq = prepareStreamRequest(llmConfig.provider, llmConfig.apiKey, effectiveModel, genMessages, { maxTokens: tier.maxCompletionTokens });
    const genRes = await fetch(streamReq.url, {
      method: 'POST',
      headers: streamReq.headers,
      body: streamReq.body,
      signal: AbortSignal.timeout(180000),
    });

    if (!genRes.ok) {
      const errorText = await genRes.text().catch(() => 'no body');
      throw new Error(`${llmConfig.provider} API error: ${genRes.status} ${errorText.slice(0, 200)}`);
    }

    // Stream response chunks to client
    let fullContent = '';
    let chunkBuffer = '';
    const reader = genRes.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunkBuffer += decoder.decode(value, { stream: true });
      const lines = chunkBuffer.split('\n');
      chunkBuffer = lines.pop() || '';

      for (const line of lines) {
        const delta = parseProviderSSELine(llmConfig.provider, line);
        if (delta) {
          fullContent += delta;
          sendSSE('chunk', { content: delta });
        }
      }
    }

    // Validate quality
    const validation = validateAgentQuality(fullContent, agentType);

    // Store generated agent + quality metadata
    await db.updateConversationGeneratedAgent(id, fullContent, 'complete');
    await db.updateAgentConversation(id, {
      generation_model: `${llmConfig.provider}:${effectiveModel}`,
      generation_quality: tier.id,
    });

    console.log(`[agent-creator] Agent generated: ${validation.totalLines} lines, score ${validation.score}/10, quality=${tier.id}, provider=${llmConfig.provider}`);

    sendSSE('done', { validation, quality: tier.id, model: effectiveModel, provider: llmConfig.provider, lines: validation.totalLines });
    res.end();
  } catch (err) {
    console.error('[agent-creator] Error generating:', err);
    await db.updateConversationGeneratedAgent(id, null, 'error').catch(() => {});
    sendSSE('error', { message: err.message });
    res.end();
  }
});

// ========== NEW: REFINE — Improve a specific section ==========

router.post('/conversations/:id/refine', async (req, res) => {
  try {
    const { id } = req.params;
    const { section, feedback } = req.body;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!section || !feedback) {
      return res.status(400).json({ error: 'section and feedback are required' });
    }

    const currentAgent = conversation.generated_agent;
    if (!currentAgent) {
      return res.status(400).json({ error: 'No generated agent to refine. Generate first.' });
    }

    // Extract the target section
    const sectionRegex = new RegExp(`(## .*${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?)(?=\\n## |$)`, 'i');
    const sectionMatch = currentAgent.match(sectionRegex);

    if (!sectionMatch) {
      return res.status(400).json({ error: `Section "${section}" not found in the generated agent` });
    }

    const sectionContent = sectionMatch[1];

    // Build refinement prompt
    const refinementPrompt = REFINEMENT_PROMPT
      .replace('{fullAgent}', currentAgent.slice(0, 2000) + '\n...[truncated]...')
      .replace('{sectionName}', section)
      .replace('{sectionContent}', sectionContent)
      .replace('{feedback}', feedback);

    console.log(`[agent-creator] Refining section "${section}" for conversation ${id}`);

    const refinedSection = await callGPT5(
      [
        { role: 'system', content: 'You are refining a section of an AI agent configuration file. Output ONLY the refined section content with its ## header. No explanations.' },
        { role: 'user', content: refinementPrompt },
      ],
      { max_completion_tokens: 12000 }
    );

    // Replace the section in the full agent
    const updatedAgent = currentAgent.replace(sectionMatch[1], refinedSection.trim() + '\n\n');

    // Store updated agent
    await db.updateConversationGeneratedAgent(id, updatedAgent, 'complete');

    const agentType = conversation.agent_type || 'custom';
    const validation = validateAgentQuality(updatedAgent, agentType);

    res.json({ agentFile: updatedAgent, refinedSection: section, validation });
  } catch (err) {
    console.error('[agent-creator] Error refining:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== PREVIEW IMAGE — Gemini Image Generation ==========

function extractAgentSection(agentMd, sectionPattern) {
  const regex = new RegExp(`(## [^\\n]*${sectionPattern}[^\\n]*\\n)([\\s\\S]*?)(?=\\n## |$)`, 'i');
  const match = agentMd.match(regex);
  return match ? match[2].trim() : null;
}

function extractAllCssVars(text) {
  const vars = [];
  const regex = /--([\w-]+)\s*:\s*([^;\n]+)/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    vars.push(`--${m[1]}: ${m[2].trim()}`);
  }
  return vars;
}

function extractHexColors(text) {
  return [...new Set((text.match(/#[0-9a-fA-F]{3,8}\b/g) || []))];
}

function extractRgbaColors(text) {
  return [...new Set((text.match(/rgba?\s*\([^)]+\)/g) || []))];
}

// ===== IMAGE STYLE CONFIGS (for non-UX agent types) =====
const IMAGE_STYLE_OPTIONS = {
  // Persona / avatar styles
  'cartoon': { label: 'Cartoon', description: 'Fun cartoon character style' },
  '3d-render': { label: '3D Render', description: 'Pixar/3D rendered character' },
  'flat-vector': { label: 'Flat Vector', description: 'Clean flat illustration style' },
  'anime': { label: 'Anime', description: 'Japanese anime art style' },
  'realistic': { label: 'Realistic', description: 'Photorealistic portrait' },
  'pixel-art': { label: 'Pixel Art', description: 'Retro pixel art style' },
  'watercolor': { label: 'Watercolor', description: 'Soft watercolor painting' },
  'minimalist': { label: 'Minimalist', description: 'Clean, minimal line art' },
  // Data / technical styles
  'infographic': { label: 'Infographic', description: 'Data visualization poster' },
  'dashboard': { label: 'Dashboard', description: 'Analytics dashboard screenshot' },
  'schema-diagram': { label: 'Schema', description: 'Technical schema/diagram' },
  'terminal': { label: 'Terminal', description: 'Terminal/CLI dark theme' },
  'blueprint': { label: 'Blueprint', description: 'Technical blueprint style' },
  // Abstract styles
  'abstract-gradient': { label: 'Gradient', description: 'Abstract gradient art' },
  'geometric': { label: 'Geometric', description: 'Geometric pattern composition' },
  'neon': { label: 'Neon', description: 'Neon glow cyberpunk style' },
};

// Recommended styles per agent type
const AGENT_TYPE_IMAGE_STYLES = {
  'ux-design': ['screenshot'],   // UX keeps the old behavior
  'development': ['terminal', 'dashboard', 'schema-diagram', 'blueprint', '3d-render', 'geometric'],
  'orchestration': ['infographic', 'schema-diagram', 'geometric', '3d-render', 'neon', 'blueprint'],
  'workflow': ['infographic', 'dashboard', 'schema-diagram', 'blueprint', 'geometric', 'flat-vector'],
  'operational': ['terminal', 'dashboard', 'blueprint', 'schema-diagram', '3d-render', 'neon'],
  'persona': ['cartoon', '3d-render', 'flat-vector', 'anime', 'realistic', 'pixel-art', 'watercolor', 'minimalist'],
  'content': ['watercolor', 'flat-vector', 'minimalist', 'abstract-gradient', 'cartoon', '3d-render'],
  'data': ['infographic', 'dashboard', 'schema-diagram', 'terminal', 'blueprint', 'geometric'],
};

function buildPreviewPrompt(designBrief, generatedAgent, agentType, imageStyle) {
  // For UX design type with no override, use the original detailed prompt
  if ((agentType === 'ux-design' || !agentType) && (!imageStyle || imageStyle === 'screenshot')) {
    return buildUxDesignPreviewPrompt(designBrief, generatedAgent);
  }
  // For other types, build a type-specific prompt
  return buildTypeAwarePreviewPrompt(designBrief, generatedAgent, agentType, imageStyle);
}

// Extract agent metadata from .md content
function extractAgentMeta(agentContent) {
  if (!agentContent) return {};
  const nameMatch = agentContent.match(/^name:\s*(.+)$/m);
  const descMatch = agentContent.match(/^description:\s*["']?(.+?)["']?$/m);
  const identity = extractAgentSection(agentContent, '(?:identity|design dna|core identity|your design|orchestration identity|operations identity|workflow identity)');
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : null,
    identity: identity ? identity.slice(0, 600) : null,
  };
}

// Build prompt for non-UX agent types
function buildTypeAwarePreviewPrompt(designBrief, generatedAgent, agentType, imageStyle) {
  const parts = [];
  const meta = extractAgentMeta(generatedAgent);
  const style = imageStyle || 'auto';

  // Common agent context
  const agentName = meta.name || 'AI Agent';
  const agentDesc = meta.description || '';

  switch (agentType) {
    case 'development':
    case 'operational': {
      const effectiveStyle = (style === 'auto') ? 'terminal' : style;
      if (effectiveStyle === 'terminal') {
        parts.push(`Generate a visually striking image of a developer workspace / terminal environment.`);
        parts.push(`Theme: Dark terminal/IDE aesthetic with syntax-highlighted code.`);
        parts.push(`Show: A sleek dark terminal or code editor with code snippets, command output, and status indicators.`);
        parts.push(`The code/commands should relate to: "${agentDesc || agentName}"`);
        parts.push(`Colors: Dark background (#0d1117), green/cyan/amber terminal text, subtle line numbers.`);
        parts.push(`Feel: Hacker aesthetic, productive, powerful. Like a senior dev's setup.`);
      } else if (effectiveStyle === 'dashboard') {
        parts.push(`Generate a photorealistic screenshot of a modern developer dashboard/monitoring interface.`);
        parts.push(`Show: Charts, metrics, status indicators, deployment logs relevant to "${agentName}".`);
        parts.push(`Theme: Dark mode, clean typography, data-rich. Think GitHub Actions + Vercel dashboard.`);
      } else if (effectiveStyle === 'schema-diagram') {
        parts.push(`Generate a clean, professional technical architecture diagram.`);
        parts.push(`Show: System components, data flows, APIs, and connections for "${agentName}".`);
        parts.push(`Style: Clean white/dark background, rounded boxes, colored connection lines, modern look.`);
      } else {
        parts.push(`Generate a ${effectiveStyle} style illustration representing a ${agentType} AI agent.`);
        parts.push(`Agent: "${agentName}" — ${agentDesc}`);
      }
      break;
    }

    case 'orchestration': {
      const effectiveStyle = (style === 'auto') ? 'infographic' : style;
      if (effectiveStyle === 'infographic' || effectiveStyle === 'schema-diagram') {
        parts.push(`Generate a visually stunning orchestration/workflow diagram.`);
        parts.push(`Show: A central orchestrator node connected to multiple agent nodes in a beautiful graph layout.`);
        parts.push(`Agent: "${agentName}" — ${agentDesc}`);
        parts.push(`Style: Dark background, glowing nodes with colored borders, animated-looking connection lines, modern SaaS aesthetic.`);
        parts.push(`Think: A premium node graph editor like Langflow, n8n, or Zapier but more futuristic.`);
      } else {
        parts.push(`Generate a ${effectiveStyle} style illustration of an AI orchestration system.`);
        parts.push(`Agent: "${agentName}" — ${agentDesc}`);
      }
      break;
    }

    case 'workflow': {
      const effectiveStyle = (style === 'auto') ? 'infographic' : style;
      if (effectiveStyle === 'infographic' || effectiveStyle === 'dashboard') {
        parts.push(`Generate a professional workflow/process visualization.`);
        parts.push(`Show: A clear process flow with steps, decision points, and status indicators.`);
        parts.push(`Agent: "${agentName}" — ${agentDesc}`);
        parts.push(`Style: Clean, modern Kanban/flowchart aesthetic. Think Linear, Notion, or Monday.com.`);
        parts.push(`Colors: Subtle color coding per status, dark or light theme, clean grid.`);
      } else {
        parts.push(`Generate a ${effectiveStyle} style illustration of a workflow automation agent.`);
        parts.push(`Agent: "${agentName}" — ${agentDesc}`);
      }
      break;
    }

    case 'content': {
      const effectiveStyle = (style === 'auto') ? 'flat-vector' : style;
      parts.push(`Generate a ${effectiveStyle} style illustration representing a content/writing AI agent.`);
      parts.push(`Agent: "${agentName}" — ${agentDesc}`);
      parts.push(`Show: Visual elements related to writing, editing, content strategy. Could include: a stylized pen, text blocks, editorial layout, word clouds.`);
      parts.push(`Mood: Creative, editorial, premium. Think Notion AI or Jasper branding.`);
      break;
    }

    default: {
      // Persona / generic — character-based
      const effectiveStyle = (style === 'auto') ? '3d-render' : style;

      if (['cartoon', '3d-render', 'flat-vector', 'anime', 'realistic', 'pixel-art', 'watercolor', 'minimalist'].includes(effectiveStyle)) {
        parts.push(`Generate a ${effectiveStyle} style CHARACTER PORTRAIT / AVATAR for an AI agent persona.`);
        parts.push(`Character name: "${agentName}"`);
        parts.push(`Character description: ${agentDesc || 'A friendly, intelligent AI assistant'}`);

        if (meta.identity) {
          parts.push(`\nPersonality & traits:\n${meta.identity.slice(0, 400)}`);
        }

        // Style-specific instructions
        if (effectiveStyle === 'cartoon') {
          parts.push(`Style: Vibrant cartoon character, expressive face, bold outlines, bright colors. Think Pixar concept art or Slack/Notion mascot.`);
        } else if (effectiveStyle === '3d-render') {
          parts.push(`Style: High-quality 3D rendered character, soft lighting, subsurface scattering, Pixar/Disney quality. Friendly and approachable.`);
        } else if (effectiveStyle === 'flat-vector') {
          parts.push(`Style: Clean flat vector illustration, geometric shapes, limited color palette, modern tech company mascot.`);
        } else if (effectiveStyle === 'anime') {
          parts.push(`Style: Japanese anime character, clean lines, vibrant colors, expressive eyes, dynamic pose.`);
        } else if (effectiveStyle === 'realistic') {
          parts.push(`Style: Photorealistic portrait, professional headshot quality, studio lighting, neutral background.`);
        } else if (effectiveStyle === 'pixel-art') {
          parts.push(`Style: Detailed pixel art character, retro game aesthetic, 32-bit era quality, on a clean background.`);
        } else if (effectiveStyle === 'watercolor') {
          parts.push(`Style: Soft watercolor painting, flowing edges, dreamy colors, artistic and elegant.`);
        } else if (effectiveStyle === 'minimalist') {
          parts.push(`Style: Clean single-line or minimal stroke illustration, lots of white space, elegant simplicity.`);
        }

        parts.push(`\nBackground: Simple, non-distracting. Subtle gradient or solid color that complements the character.`);
        parts.push(`Resolution: Square format, centered character, suitable for a profile picture / avatar.`);
      } else {
        // Non-character styles for persona (infographic, terminal, etc.)
        parts.push(`Generate a ${effectiveStyle} style illustration representing the AI agent "${agentName}".`);
        parts.push(`Description: ${agentDesc || 'An intelligent AI assistant'}`);
        if (meta.identity) parts.push(`Context:\n${meta.identity.slice(0, 400)}`);
      }
      break;
    }
  }

  // Add brief context if available (for all types)
  if (designBrief) {
    const identity = designBrief.agentIdentity;
    if (identity) {
      if (identity.aesthetic) parts.push(`\nAesthetic direction: ${identity.aesthetic}`);
      if (identity.mood) parts.push(`Mood: ${identity.mood}`);
    }
    const colors = designBrief.colorSystem;
    if (colors?.cssVariables) {
      const mainColors = Object.entries(colors.cssVariables).slice(0, 6).map(([k, v]) => `${k}: ${v}`).join(', ');
      parts.push(`Brand colors: ${mainColors}`);
    }
  }

  parts.push(`\nIMPORTANT: Make it visually stunning, professional, and polished. High resolution. No text artifacts or spelling errors.`);
  return parts.join('\n');
}

// Original UX design prompt (landing page screenshot)
function buildUxDesignPreviewPrompt(designBrief, generatedAgent) {
  const parts = [];

  parts.push(`You are a UI mockup generator. Create a STUNNING, pixel-perfect, photorealistic screenshot of a complete landing page as it would appear in a web browser. Desktop view, 1440x900 resolution. This must look like a real website screenshot — not a wireframe, not a sketch. Every detail matters.`);

  // ===== EXTRACT FROM GENERATED AGENT (.md) — PRIMARY SOURCE =====
  if (generatedAgent) {
    // 1. Identity / Design DNA
    const identity = extractAgentSection(generatedAgent, '(?:identity|design dna|core identity|your design)');
    if (identity) {
      parts.push(`\n## DESIGN IDENTITY\n${identity.slice(0, 800)}`);
    }

    // 2. Color System — FULL extraction
    const colorSection = extractAgentSection(generatedAgent, 'color');
    if (colorSection) {
      const cssVars = extractAllCssVars(colorSection);
      const hexCols = extractHexColors(colorSection);
      const rgbaCols = extractRgbaColors(colorSection);
      parts.push(`\n## COLOR SYSTEM (use these EXACT colors)`);
      if (cssVars.length > 0) parts.push(`CSS Variables:\n${cssVars.join('\n')}`);
      if (hexCols.length > 0) parts.push(`Hex palette: ${hexCols.join(', ')}`);
      if (rgbaCols.length > 0) parts.push(`RGBA values: ${rgbaCols.join(', ')}`);
      const gradients = colorSection.match(/(?:linear-gradient|radial-gradient|conic-gradient)\s*\([^)]+\)/g);
      if (gradients) parts.push(`Gradients: ${[...new Set(gradients)].join(' | ')}`);
      const colorExtra = colorSection.replace(/```[\s\S]*?```/g, '').slice(0, 600);
      if (colorExtra.length > 50) parts.push(`Color details:\n${colorExtra}`);
    }

    // 3. Typography — FULL extraction
    const typoSection = extractAgentSection(generatedAgent, 'typo');
    if (typoSection) {
      parts.push(`\n## TYPOGRAPHY (use these EXACT fonts and sizes)`);
      const fontFamilies = typoSection.match(/font-family\s*:\s*([^;\n]+)/gi);
      if (fontFamilies) parts.push(`Font families: ${[...new Set(fontFamilies)].join(' | ')}`);
      const fontSizes = typoSection.match(/font-size\s*:\s*([^;\n]+)/gi);
      if (fontSizes) parts.push(`Font sizes: ${[...new Set(fontSizes)].join(', ')}`);
      const fontWeights = typoSection.match(/font-weight\s*:\s*([^;\n]+)/gi);
      if (fontWeights) parts.push(`Font weights: ${[...new Set(fontWeights)].join(', ')}`);
      const lineHeights = typoSection.match(/line-height\s*:\s*([^;\n]+)/gi);
      if (lineHeights) parts.push(`Line heights: ${[...new Set(lineHeights)].join(', ')}`);
      const letterSpacing = typoSection.match(/letter-spacing\s*:\s*([^;\n]+)/gi);
      if (letterSpacing) parts.push(`Letter spacing: ${[...new Set(letterSpacing)].join(', ')}`);
      parts.push(`Typography specs:\n${typoSection.slice(0, 800)}`);
    }

    // 4. Layout Architecture — FULL extraction
    const layoutSection = extractAgentSection(generatedAgent, 'layout');
    if (layoutSection) {
      parts.push(`\n## LAYOUT ARCHITECTURE`);
      const spacingVals = extractAllCssVars(layoutSection);
      if (spacingVals.length > 0) parts.push(`Layout variables:\n${spacingVals.join('\n')}`);
      const maxWidths = layoutSection.match(/max-width\s*:\s*([^;\n]+)/gi);
      if (maxWidths) parts.push(`Max widths: ${[...new Set(maxWidths)].join(', ')}`);
      const gaps = layoutSection.match(/gap\s*:\s*([^;\n]+)/gi);
      if (gaps) parts.push(`Gaps: ${[...new Set(gaps)].join(', ')}`);
      const borderRadius = layoutSection.match(/border-radius\s*:\s*([^;\n]+)/gi);
      if (borderRadius) parts.push(`Border radius: ${[...new Set(borderRadius)].join(', ')}`);
      const asciiBlocks = layoutSection.match(/```[\s\S]*?```/g);
      if (asciiBlocks) {
        parts.push(`Layout wireframes:\n${asciiBlocks.slice(0, 3).join('\n')}`);
      }
      parts.push(`Layout details:\n${layoutSection.replace(/```[\s\S]*?```/g, '[wireframe]').slice(0, 600)}`);
    }

    // 5. Core UI Components — FULL extraction
    const compSection = extractAgentSection(generatedAgent, '(?:component|ui component|core ui)');
    if (compSection) {
      parts.push(`\n## UI COMPONENTS (render ALL of these)`);
      const componentNames = compSection.match(/^###\s+(.+)$/gm);
      if (componentNames) parts.push(`Components to show: ${componentNames.map(h => h.replace('### ', '')).join(', ')}`);
      parts.push(`Component specifications:\n${compSection.slice(0, 1500)}`);
    }

    // 6. Animation Patterns — extract visual effects
    const animSection = extractAgentSection(generatedAgent, 'animat');
    if (animSection) {
      parts.push(`\n## VISUAL EFFECTS & ANIMATIONS`);
      const transitions = animSection.match(/transition\s*:\s*([^;\n]+)/gi);
      if (transitions) parts.push(`Transitions: ${[...new Set(transitions)].join(', ')}`);
      const transforms = animSection.match(/transform\s*:\s*([^;\n]+)/gi);
      if (transforms) parts.push(`Transforms: ${[...new Set(transforms)].join(', ')}`);
      const boxShadows = animSection.match(/box-shadow\s*:\s*([^;\n]+)/gi);
      if (boxShadows) parts.push(`Shadows: ${[...new Set(boxShadows)].join(' | ')}`);
      parts.push(`Animation details:\n${animSection.slice(0, 500)}`);
    }

    // 7. Style Injection — global CSS patterns
    const styleSection = extractAgentSection(generatedAgent, '(?:style inject|injection)');
    if (styleSection) {
      const codeBlocks = styleSection.match(/```(?:css)?\s*([\s\S]*?)```/g);
      if (codeBlocks) {
        parts.push(`\n## GLOBAL CSS STYLES\n${codeBlocks.slice(0, 3).join('\n').slice(0, 800)}`);
      }
    }

    // 8. Section Templates — what sections to render
    const templateSection = extractAgentSection(generatedAgent, '(?:section template|template)');
    if (templateSection) {
      parts.push(`\n## PAGE SECTIONS TO RENDER`);
      const sectionNames = templateSection.match(/^###\s+(.+)$/gm);
      if (sectionNames) parts.push(`Sections: ${sectionNames.map(h => h.replace('### ', '')).join(', ')}`);
      parts.push(`Section details:\n${templateSection.slice(0, 1000)}`);
    }

    // 9. Extract ALL remaining CSS vars and colors
    const allCssVars = extractAllCssVars(generatedAgent);
    const allHex = extractHexColors(generatedAgent);
    const allRgba = extractRgbaColors(generatedAgent);
    const allShadows = [...new Set((generatedAgent.match(/box-shadow\s*:\s*([^;\n]+)/gi) || []))];
    const allBackdrops = [...new Set((generatedAgent.match(/backdrop-filter\s*:\s*([^;\n]+)/gi) || []))];

    if (allCssVars.length > 0 || allHex.length > 0) {
      parts.push(`\n## COMPLETE DESIGN TOKENS`);
      if (allCssVars.length > 0) parts.push(`All CSS variables (${allCssVars.length}):\n${allCssVars.slice(0, 60).join('\n')}`);
      if (allHex.length > 0) parts.push(`All hex colors: ${allHex.join(', ')}`);
      if (allRgba.length > 0) parts.push(`All rgba: ${allRgba.slice(0, 20).join(', ')}`);
      if (allShadows.length > 0) parts.push(`All shadows: ${allShadows.join(' | ')}`);
      if (allBackdrops.length > 0) parts.push(`Backdrop effects: ${allBackdrops.join(', ')}`);
    }

    // 10. Frontmatter metadata
    const nameMatch = generatedAgent.match(/^name:\s*(.+)$/m);
    const descMatch = generatedAgent.match(/^description:\s*["']?(.+?)["']?$/m);
    if (nameMatch) parts.push(`\nAgent name: ${nameMatch[1].trim()}`);
    if (descMatch) parts.push(`Agent description: ${descMatch[1].trim()}`);
  }

  // ===== SUPPLEMENT FROM DESIGN BRIEF =====
  if (designBrief) {
    parts.push(`\n## DESIGN BRIEF CONTEXT`);

    const colors = designBrief.colorSystem;
    if (colors) {
      const vars = colors.cssVariables || {};
      const allVars = Object.entries(vars).map(([k, v]) => `${k}: ${v}`);
      if (allVars.length > 0) parts.push(`Brief CSS variables:\n${allVars.join('\n')}`);
      if (colors.darkMode !== undefined) parts.push(`Theme mode: ${colors.darkMode ? 'DARK theme (dark backgrounds, light text)' : 'LIGHT theme (light backgrounds, dark text)'}`);
      if (colors.gradients) parts.push(`Brief gradients: ${JSON.stringify(colors.gradients)}`);
      if (colors.shadows) parts.push(`Brief shadows: ${JSON.stringify(colors.shadows)}`);
      if (colors.effects) parts.push(`Brief effects: ${JSON.stringify(colors.effects)}`);
    }

    const typo = designBrief.typographySystem;
    if (typo) {
      parts.push(`Brief typography:`);
      if (typo.displayFont) parts.push(`- Display: ${typo.displayFont}`);
      if (typo.bodyFont) parts.push(`- Body: ${typo.bodyFont}`);
      if (typo.monoFont) parts.push(`- Mono: ${typo.monoFont}`);
      if (typo.typeScale) parts.push(`- Scale: ${JSON.stringify(typo.typeScale)}`);
      if (typo.fontWeights) parts.push(`- Weights: ${JSON.stringify(typo.fontWeights)}`);
    }

    const layout = designBrief.layoutArchitecture;
    if (layout) {
      parts.push(`Brief layout:`);
      if (layout.primaryLayout) parts.push(`- Primary: ${layout.primaryLayout}`);
      if (layout.sectionCount) parts.push(`- Section count: ${layout.sectionCount}`);
      if (layout.spacing) parts.push(`- Spacing: ${JSON.stringify(layout.spacing)}`);
      if (layout.borderRadius) parts.push(`- Border radius: ${JSON.stringify(layout.borderRadius)}`);
      if (layout.gridSystem) parts.push(`- Grid: ${JSON.stringify(layout.gridSystem)}`);
    }

    const components = designBrief.componentInventory;
    if (components && components.length > 0) {
      parts.push(`Brief components:`);
      for (const comp of components.slice(0, 15)) {
        const desc = comp.cssDetails ? JSON.stringify(comp.cssDetails) : (comp.description || '');
        parts.push(`- ${comp.name || comp.type}: ${desc}`);
      }
    }

    const identity = designBrief.agentIdentity;
    if (identity) {
      if (identity.aesthetic) parts.push(`Aesthetic: ${identity.aesthetic}`);
      if (identity.mood) parts.push(`Mood: ${identity.mood}`);
      if (identity.role) parts.push(`Role: ${identity.role}`);
      if (identity.influences) parts.push(`Influences: ${JSON.stringify(identity.influences)}`);
    }

    if (designBrief.microInteractions) {
      parts.push(`Micro-interactions: ${JSON.stringify(designBrief.microInteractions)}`);
    }
  }

  // ===== RENDERING INSTRUCTIONS =====
  parts.push(`\n## RENDERING INSTRUCTIONS
- Create a PHOTOREALISTIC browser screenshot, not a wireframe or sketch
- Show a COMPLETE landing page: navigation bar, hero section with headline + CTA, feature sections, cards/grids, testimonials or social proof, and footer
- Use the EXACT colors, fonts, spacing, and border-radius specified above
- Apply the shadows, gradients, and backdrop effects specified
- If dark theme: use dark backgrounds (#0a0a0a-#1a1a1a range), light text, subtle borders
- If light theme: use white/cream backgrounds, dark text, soft shadows
- Include realistic placeholder text (not lorem ipsum — real headlines and descriptions)
- Show realistic UI elements: buttons with hover states, input fields, cards with subtle shadows
- The design should feel premium, modern, and production-ready
- Resolution: 1440x900 desktop viewport`);

  return parts.join('\n');
}

// Reusable: generate preview image via Gemini and save to disk
// Returns { previewUrl, filename } or null on failure
async function generatePreviewImageFile(brief, agentContent, filenameBase, agentType, imageStyle) {
  if (!GOOGLE_AI_API_KEY) {
    console.warn('[agent-creator] GOOGLE_AI_API_KEY not configured, skipping preview');
    return null;
  }
  const prompt = buildPreviewPrompt(brief, agentContent, agentType, imageStyle);
  console.log(`[agent-creator] Generating preview image for ${filenameBase} (type=${agentType}, style=${imageStyle || 'auto'}, prompt ${prompt.length} chars)`);

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
      }),
      signal: AbortSignal.timeout(120000),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text().catch(() => 'no body');
    console.error(`[agent-creator] Gemini API error ${geminiRes.status}: ${errText.slice(0, 500)}`);
    return null;
  }

  const geminiData = await geminiRes.json();
  const geminiParts = geminiData.candidates?.[0]?.content?.parts || [];
  const imagePart = geminiParts.find(p => p.inlineData);

  if (!imagePart || !imagePart.inlineData?.data) {
    console.error('[agent-creator] Gemini returned no image data');
    return null;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${filenameBase}.png`;
  const filePath = path.join(UPLOAD_DIR, filename);
  const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
  await fs.writeFile(filePath, imageBuffer);

  const previewUrl = `/uploads/agent-creator/${filename}`;
  console.log(`[agent-creator] Preview image saved: ${previewUrl} (${imageBuffer.length} bytes)`);
  return { previewUrl, filename };
}

// Get available image styles for a given agent type
router.get('/image-styles', (req, res) => {
  const { agent_type } = req.query;
  const recommended = AGENT_TYPE_IMAGE_STYLES[agent_type] || AGENT_TYPE_IMAGE_STYLES['persona'] || [];
  const allStyles = Object.entries(IMAGE_STYLE_OPTIONS).map(([id, s]) => ({
    id,
    label: s.label,
    description: s.description,
    recommended: recommended.includes(id),
  }));
  // Sort: recommended first, then alphabetical
  allStyles.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0) || a.label.localeCompare(b.label));
  res.json({
    styles: [
      { id: 'auto', label: 'Auto', description: 'Best style for this agent type', recommended: true },
      ...(agent_type === 'ux-design' ? [{ id: 'screenshot', label: 'Screenshot', description: 'Landing page screenshot', recommended: true }] : []),
      ...allStyles,
    ],
  });
});

router.post('/conversations/:id/preview-image', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!GOOGLE_AI_API_KEY) {
      return res.status(500).json({ error: 'GOOGLE_AI_API_KEY not configured' });
    }

    const brief = conversation.design_brief || null;
    const agent = conversation.generated_agent || null;
    const agentType = conversation.agent_type || 'custom';
    const imageStyle = req.body?.image_style || 'auto';

    if (!brief && !agent) {
      return res.status(400).json({ error: 'Generate a design brief or agent first before previewing' });
    }

    const result = await generatePreviewImageFile(brief, agent, `preview-${id}`, agentType, imageStyle);
    if (!result) {
      return res.status(502).json({ error: 'Failed to generate preview image' });
    }

    res.json({ previewUrl: result.previewUrl });
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[agent-creator] Gemini API timeout');
      return res.status(504).json({ error: 'Gemini API timeout' });
    }
    console.error('[agent-creator] Error generating preview image:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== DELETE REFERENCE ==========

router.delete('/conversations/:id/references/:refId', async (req, res) => {
  try {
    const { id, refId } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const references = await db.getConversationReferences(id);
    const ref = references.find(r => r.id === refId);

    if (!ref) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    if ((ref.type === 'image' || ref.type === 'document') && ref.url) {
      const filePath = path.join(UPLOAD_DIR, path.basename(ref.url));
      try {
        await fs.unlink(filePath);
      } catch (err) {
        console.warn('[agent-creator] Could not delete file:', err.message);
      }
    }

    await db.deleteConversationReference(refId);

    res.json({ success: true });
  } catch (err) {
    console.error('[agent-creator] Error deleting reference:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== DELETE CONVERSATION ==========

router.delete('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await db.deleteAgentConversation(id);

    res.json({ success: true });
  } catch (err) {
    console.error('[agent-creator] Error deleting conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// ========== SAVE AGENT — Parse all frontmatter fields ==========

router.post('/conversations/:id/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { agentContent } = req.body;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!agentContent) {
      return res.status(400).json({ error: 'Agent content is required' });
    }

    // Parse frontmatter
    const frontmatterMatch = agentContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return res.status(400).json({ error: 'Invalid agent format. Expected frontmatter with ---' });
    }

    const [, frontmatter, prompt] = frontmatterMatch;

    // Parse all frontmatter fields
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descriptionMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?$/m);
    const modelMatch = frontmatter.match(/^model:\s*(.+)$/m);
    const toolsMatch = frontmatter.match(/^tools:\s*\[?(.+?)\]?$/m);
    const maxTurnsMatch = frontmatter.match(/^max_turns:\s*(\d+)$/m);
    const memoryMatch = frontmatter.match(/^memory:\s*(.+)$/m);
    const permissionMatch = frontmatter.match(/^permission_mode:\s*(.+)$/m);

    if (!nameMatch) {
      return res.status(400).json({ error: 'Agent name is required in frontmatter' });
    }

    const agentName = nameMatch[1].trim();
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    const model = modelMatch ? modelMatch[1].trim() : 'claude-opus-4-6';
    const tools = toolsMatch ? toolsMatch[1].trim() : 'Read,Write,Edit,Bash,Grep,Glob,WebFetch,WebSearch';
    const maxTurns = maxTurnsMatch ? parseInt(maxTurnsMatch[1]) : 0;
    const memory = memoryMatch ? memoryMatch[1].trim() : 'true';
    const permissionMode = permissionMatch ? permissionMatch[1].trim() : 'default';

    // Detect category from agent_type + content
    const convAgentType = conversation.agent_type || 'custom';
    const lowerContent = (description + ' ' + prompt.slice(0, 500)).toLowerCase();
    let category = 'Custom';
    // Map agent_type to category first
    const TYPE_CATEGORY_MAP = {
      'ux-design': null, // Fall through to content-based detection
      'persona': 'Persona',
      'development': 'Development',
      'orchestration': 'Orchestration',
      'workflow': 'Workflow',
      'operational': 'Operational',
      'marketing': 'Marketing',
      'data-ai': 'Data / AI',
      'custom': 'Custom',
    };
    if (TYPE_CATEGORY_MAP[convAgentType]) {
      category = TYPE_CATEGORY_MAP[convAgentType];
    } else {
      // UX-design: detect from content
      if (lowerContent.includes('landing page') || lowerContent.includes('marketing')) category = 'Landing Pages';
      else if (lowerContent.includes('dashboard') || lowerContent.includes('saas')) category = 'SaaS';
      else if (lowerContent.includes('portfolio') || lowerContent.includes('creative')) category = 'Creative';
      else if (lowerContent.includes('e-commerce') || lowerContent.includes('shop')) category = 'E-Commerce';
    }

    // Write agent .md file to BOTH bundled dir AND persistent DATA_DIR
    const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
    const PERSISTENT_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');
    await fs.mkdir(BUNDLED_AGENTS_DIR, { recursive: true });
    await fs.mkdir(PERSISTENT_AGENTS_DIR, { recursive: true });

    // Save to bundled agents (works at runtime, lost on redeploy)
    const agentFilePath = path.join(BUNDLED_AGENTS_DIR, `${agentName}.md`);
    await fs.writeFile(agentFilePath, agentContent, 'utf8');

    // Save to persistent volume (survives redeploys on Railway)
    const persistentPath = path.join(PERSISTENT_AGENTS_DIR, `${agentName}.md`);
    await fs.writeFile(persistentPath, agentContent, 'utf8');

    // Copy to current user's .claude/agents/ so Claude CLI sees it immediately
    const userId = req.user.userId || req.user.id;
    const userAgentsDir = path.join(DATA_DIR, 'users', userId, '.claude', 'agents');
    try {
      await fs.mkdir(userAgentsDir, { recursive: true });
      await fs.writeFile(path.join(userAgentsDir, `${agentName}.md`), agentContent, 'utf8');
      console.log(`[agent-creator] Copied agent to user ${userId} .claude/agents/`);
    } catch (err) {
      console.warn(`[agent-creator] Could not copy agent to user home:`, err.message);
    }

    // Upsert in database (handles both create and update)
    const existing = await db.getAgent(agentName);
    if (existing) {
      await db.updateAgent(agentName, {
        description,
        model,
        category,
        prompt_preview: description,
        full_prompt: agentContent,
        tools,
        max_turns: maxTurns,
        memory,
        permission_mode: permissionMode,
      });
    } else {
      await db.createAgentManual(
        agentName,
        description,
        model,
        category,
        description,
        agentContent,
        tools,
        maxTurns,
        memory,
        permissionMode,
        userId
      );
    }

    console.log(`[agent-creator] Saved agent: ${agentName} (${model}, ${category})`);

    // Check if any reference has a profile image (from LinkedIn, etc.)
    let thumbnailUrl = null;
    try {
      const refs = await db.getConversationReferences(id);
      for (const ref of refs) {
        const sa = ref.structured_analysis;
        if (sa && sa.profile_image_url) {
          // Profile image is already on Supabase Storage — use directly
          thumbnailUrl = sa.profile_image_url;
          console.log(`[agent-creator] Using profile image as thumbnail for ${agentName}: ${thumbnailUrl}`);
          break;
        }
      }
    } catch (err) {
      console.warn(`[agent-creator] Reference profile image check failed:`, err.message);
    }

    // Fallback: auto-generate thumbnail via Gemini if no profile image found
    if (!thumbnailUrl) {
      try {
        const brief = conversation.design_brief || null;
        const saveAgentType = conversation.agent_type || 'custom';
        const result = await generatePreviewImageFile(brief, agentContent, `agent-${agentName}`, saveAgentType);
        if (result) {
          thumbnailUrl = result.previewUrl;
          console.log(`[agent-creator] Gemini thumbnail saved for agent ${agentName}: ${thumbnailUrl}`);
        }
      } catch (err) {
        console.warn(`[agent-creator] Thumbnail generation failed (non-fatal):`, err.message);
      }
    }

    // Update screenshot in DB
    if (thumbnailUrl) {
      await db.updateAgentScreenshot(agentName, thumbnailUrl);
    }

    res.json({
      success: true,
      agent: { name: agentName, description, model, category, screenshot_path: thumbnailUrl }
    });
  } catch (err) {
    console.error('[agent-creator] Error saving agent:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
