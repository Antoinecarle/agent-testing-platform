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
const { deepAnalyzeURL, deepAnalyzeImage, synthesizeDesignBrief, callGPT5 } = require('../lib/agent-analysis');
const {
  CONVERSATION_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  AGENT_EXAMPLE_ABBREVIATED,
  REFINEMENT_PROMPT,
  validateAgentQuality,
} = require('../lib/agent-templates');

const GPT5_MODEL = 'gpt-5-mini-2025-08-07';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

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

// ========== HELPER: Build references context for conversation ==========

function buildReferencesContext(references) {
  if (!references || references.length === 0) return '';

  let ctx = '\n\n## Reference Analyses (Structured CSS Data)\n';
  references.forEach((ref, idx) => {
    if (ref.type === 'image') {
      const s = ref.structured_analysis;
      if (s) {
        ctx += `\n### Image ${idx + 1}: ${ref.filename || 'screenshot'}\n`;
        // Pass the full structured JSON — the conversation prompt knows how to use it
        // Truncate to avoid exceeding context, but keep the richest data
        const jsonStr = JSON.stringify(s, null, 1);
        if (jsonStr.length > 6000) {
          // Summarize the key CSS values instead of dumping everything
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
        ctx += `\n### URL ${idx + 1}: ${ref.url}\n`;
        const jsonStr = JSON.stringify(s, null, 1);
        if (jsonStr.length > 4000) {
          ctx += formatURLAnalysis(s);
        } else {
          ctx += '```json\n' + jsonStr + '\n```\n';
        }
      } else if (ref.analysis) {
        try {
          const analysis = typeof ref.analysis === 'string' ? JSON.parse(ref.analysis) : ref.analysis;
          ctx += `\n### URL ${idx + 1}: ${ref.url}\nTitle: ${analysis.title}\n`;
        } catch (_) {
          ctx += `\n### URL ${idx + 1}: ${ref.url}\n${ref.analysis}\n`;
        }
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

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.user.userId || req.user.id;
    const conversation = await db.createAgentConversation(userId, name || 'New Agent');
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

    // Deep URL analysis: fetch HTML, extract CSS/fonts/colors, GPT analysis
    console.log(`[agent-creator] Deep analyzing URL: ${url}`);
    const structuredAnalysis = await deepAnalyzeURL(url);

    const summary = structuredAnalysis.gptAnalysis
      ? `${structuredAnalysis.extracted?.title || url} — ${structuredAnalysis.gptAnalysis.designStyle || 'analyzed'}`
      : JSON.stringify({ title: structuredAnalysis.extracted?.title || 'Unknown', url });

    // If og:image found (LinkedIn, Twitter, etc.), download and save locally as profile pic
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
          await fs.mkdir(UPLOAD_DIR, { recursive: true });
          const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
          await fs.writeFile(path.join(UPLOAD_DIR, filename), imageBuffer);
          profileImageUrl = `/uploads/agent-creator/${filename}`;
          console.log(`[agent-creator] Downloaded og:image for conversation ${id}: ${profileImageUrl} (${imageBuffer.length} bytes)`);
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

// ========== CONVERSATION MESSAGES (with Vision — images sent to GPT-5) ==========

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Load references with structured analysis
    const references = await db.getConversationReferences(id);
    const referencesContext = buildReferencesContext(references);

    // Build the upgraded system prompt — cap total size to avoid context overflow
    let systemPrompt = CONVERSATION_SYSTEM_PROMPT
      + (referencesContext.length > 8000 ? referencesContext.slice(0, 8000) + '\n...(truncated)' : referencesContext)
      + `\n\nCurrent conversation: Creating an agent for "${conversation.name}".`;

    // Save user message
    await db.createConversationMessage(id, 'user', message);

    // Load all messages for GPT context — keep last 20 to avoid token overflow
    const allMessagesRaw = await db.getConversationMessages(id);
    const allMessages = allMessagesRaw.length > 20 ? allMessagesRaw.slice(-20) : allMessagesRaw;

    // Build image content parts for vision — include uploaded images (max 3 to control size)
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

    // Build GPT messages — attach images to first user message (not last, to avoid duplication per turn)
    const gptMessages = [{ role: 'system', content: systemPrompt }];

    let imagesAttached = false;
    for (let i = 0; i < allMessages.length; i++) {
      const m = allMessages[i];
      if (m.role === 'user' && !imagesAttached && imageParts.length > 0) {
        // First user message: attach images for vision context
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

    console.log(`[agent-creator] Chat request: ${allMessages.length} msgs, ${imageParts.length} images, system prompt ${systemPrompt.length} chars`);

    // Call GPT-5 with vision support (with retry + timeout)
    const body = {
      model: GPT5_MODEL,
      messages: gptMessages,
      max_completion_tokens: 16000,
    };

    let assistantResponse;
    const maxRetries = 2;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(180000),
        });

        if (gptRes.ok) {
          const gptData = await gptRes.json();
          const choice = gptData.choices && gptData.choices[0];
          console.log(`[agent-creator] GPT-5 response: choices=${gptData.choices?.length}, finish_reason=${choice?.finish_reason}, content_length=${choice?.message?.content?.length || 0}, usage=${JSON.stringify(gptData.usage || {})}`);
          if (!choice || !choice.message) {
            lastError = new Error('GPT-5 returned empty choices');
            if (attempt < maxRetries) {
              console.warn(`[agent-creator] GPT-5 empty choices, retrying (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            break;
          }
          // Handle refusal (content filter)
          if (choice.message.refusal) {
            lastError = new Error(`GPT-5 refused: ${choice.message.refusal}`);
            break;
          }
          assistantResponse = choice.message.content;
          // If response was cut off but we have partial content, use it anyway
          if (assistantResponse && choice.finish_reason === 'length') {
            console.warn(`[agent-creator] GPT-5 response truncated at token limit but returning partial content (${assistantResponse.length} chars)`);
          }
          if (!assistantResponse && choice.finish_reason === 'length') {
            lastError = new Error('GPT-5 response was cut off (token limit) with no content.');
            break;
          }
          if (!assistantResponse) {
            lastError = new Error('GPT-5 returned null content');
            if (attempt < maxRetries) {
              console.warn(`[agent-creator] GPT-5 null content, retrying (attempt ${attempt + 1}/${maxRetries})`);
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }
            break;
          }
          break;
        }

        const errorText = await gptRes.text().catch(() => 'no body');
        console.error(`[agent-creator] GPT-5 HTTP ${gptRes.status}: ${errorText.slice(0, 500)}`);
        lastError = new Error(`GPT-5 API error ${gptRes.status}: ${errorText.slice(0, 200)}`);

        // 400 = bad request (payload too large, invalid format) — don't retry
        if (gptRes.status === 400) {
          throw lastError;
        }

        if (gptRes.status >= 500 && attempt < maxRetries) {
          const delay = (attempt + 1) * 2000;
          console.warn(`[agent-creator] Chat GPT-5 ${gptRes.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw lastError;
      } catch (err) {
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
          lastError = new Error('GPT-5 API timeout after 180s');
          if (attempt < maxRetries) {
            console.warn(`[agent-creator] Chat GPT-5 timeout, retrying (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
        }
        throw lastError || err;
      }
    }
    if (!assistantResponse) {
      console.error(`[agent-creator] No assistant response after all retries. lastError:`, lastError?.message);
      throw lastError || new Error('GPT-5 returned no response after retries');
    }

    // Save assistant response
    const assistantMessage = await db.createConversationMessage(id, 'assistant', assistantResponse);

    res.json({ message: assistantMessage });
  } catch (err) {
    console.error('[agent-creator] Error sending message:', err);
    res.status(500).json({ error: err.message });
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
      return res.status(400).json({ error: 'Add at least one reference or chat about the design before analyzing' });
    }

    console.log(`[agent-creator] Synthesizing design brief for conversation ${id} (${references.length} refs, ${messages.length} msgs)`);

    // Synthesize design brief from all analyses + conversation
    const brief = await synthesizeDesignBrief(references, messages);

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

// ========== GENERATE — Multi-step agent file generation ==========

router.post('/conversations/:id/generate', async (req, res) => {
  const { id } = req.params;
  try {
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);
    let brief = conversation.design_brief;

    // Auto-analyze if no brief exists
    if (!brief) {
      console.log(`[agent-creator] No brief found, auto-analyzing...`);
      brief = await synthesizeDesignBrief(references, messages);
      await db.updateConversationBrief(id, brief);
    }

    await db.updateConversationGeneratedAgent(id, null, 'generating');

    // Build conversation summary (not raw dump — summarize for token efficiency)
    const recentMessages = messages.slice(-12);
    const conversationSummary = recentMessages.map(m => {
      const content = m.content.length > 600 ? m.content.slice(0, 600) + '...' : m.content;
      return `${m.role}: ${content}`;
    }).join('\n\n');

    // Derive agent name from brief or conversation
    const derivedName = brief.agentIdentity?.aesthetic
      ? brief.agentIdentity.aesthetic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      : conversation.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Build the generation prompt
    const generationUserPrompt = `Create a complete, production-ready agent configuration file.

## Design Brief
${JSON.stringify(brief, null, 2)}

## Conversation Context
${conversationSummary}

## Requirements
- Agent name: ${derivedName}
- Target aesthetic: ${brief.agentIdentity?.aesthetic || 'professional'}
- Primary use case: ${brief.agentIdentity?.role || 'frontend page builder'}
- Model: claude-opus-4-6

## Reference Example (showing expected FORMAT and DEPTH — your content must be DIFFERENT)
${AGENT_EXAMPLE_ABBREVIATED}

## END OF REFERENCE

Now generate the complete agent file. It MUST be 600-900 lines with ALL 10 sections.
Every CSS value, every color, every spacing token must be specific to the design brief above.
Do NOT copy the reference example content — use it only as a format guide.

CRITICAL — Use these EXACT ## section headers in this EXACT order:
## Your Design DNA
## Color System
## Typography
## Layout Architecture
## Core UI Components
## Animation Patterns
## Style Injection Pattern
## Section Templates
## Responsive & Quality

Do NOT rename, rephrase, or skip any of these headers. Validation will FAIL if you use different names.`;

    console.log(`[agent-creator] Generating agent for ${derivedName} (conversation ${id})`);

    const agentFile = await callGPT5(
      [
        { role: 'system', content: GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: generationUserPrompt },
      ],
      { max_completion_tokens: 32000 }
    );

    // Validate quality
    const validation = validateAgentQuality(agentFile);

    // Store generated agent
    await db.updateConversationGeneratedAgent(id, agentFile, 'complete');

    console.log(`[agent-creator] Agent generated: ${validation.totalLines} lines, score ${validation.score}/10`);

    res.json({ agentFile, validation });
  } catch (err) {
    console.error('[agent-creator] Error generating:', err);
    await db.updateConversationGeneratedAgent(id, null, 'error').catch(() => {});
    res.status(500).json({ error: err.message });
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

    const validation = validateAgentQuality(updatedAgent);

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

function buildPreviewPrompt(designBrief, generatedAgent) {
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
      // Include gradients and special effects mentioned
      const gradients = colorSection.match(/(?:linear-gradient|radial-gradient|conic-gradient)\s*\([^)]+\)/g);
      if (gradients) parts.push(`Gradients: ${[...new Set(gradients)].join(' | ')}`);
      // Include raw section for context (shadows, overlays, etc.)
      const colorExtra = colorSection.replace(/```[\s\S]*?```/g, '').slice(0, 600);
      if (colorExtra.length > 50) parts.push(`Color details:\n${colorExtra}`);
    }

    // 3. Typography — FULL extraction
    const typoSection = extractAgentSection(generatedAgent, 'typo');
    if (typoSection) {
      parts.push(`\n## TYPOGRAPHY (use these EXACT fonts and sizes)`);
      // Extract font families
      const fontFamilies = typoSection.match(/font-family\s*:\s*([^;\n]+)/gi);
      if (fontFamilies) parts.push(`Font families: ${[...new Set(fontFamilies)].join(' | ')}`);
      // Extract font sizes
      const fontSizes = typoSection.match(/font-size\s*:\s*([^;\n]+)/gi);
      if (fontSizes) parts.push(`Font sizes: ${[...new Set(fontSizes)].join(', ')}`);
      // Extract font weights
      const fontWeights = typoSection.match(/font-weight\s*:\s*([^;\n]+)/gi);
      if (fontWeights) parts.push(`Font weights: ${[...new Set(fontWeights)].join(', ')}`);
      // Extract line heights, letter spacing
      const lineHeights = typoSection.match(/line-height\s*:\s*([^;\n]+)/gi);
      if (lineHeights) parts.push(`Line heights: ${[...new Set(lineHeights)].join(', ')}`);
      const letterSpacing = typoSection.match(/letter-spacing\s*:\s*([^;\n]+)/gi);
      if (letterSpacing) parts.push(`Letter spacing: ${[...new Set(letterSpacing)].join(', ')}`);
      // Include full typography rules
      parts.push(`Typography specs:\n${typoSection.slice(0, 800)}`);
    }

    // 4. Layout Architecture — FULL extraction
    const layoutSection = extractAgentSection(generatedAgent, 'layout');
    if (layoutSection) {
      parts.push(`\n## LAYOUT ARCHITECTURE`);
      // Extract spacing/padding values
      const spacingVals = extractAllCssVars(layoutSection);
      if (spacingVals.length > 0) parts.push(`Layout variables:\n${spacingVals.join('\n')}`);
      // Extract max-width, grid, gap values
      const maxWidths = layoutSection.match(/max-width\s*:\s*([^;\n]+)/gi);
      if (maxWidths) parts.push(`Max widths: ${[...new Set(maxWidths)].join(', ')}`);
      const gaps = layoutSection.match(/gap\s*:\s*([^;\n]+)/gi);
      if (gaps) parts.push(`Gaps: ${[...new Set(gaps)].join(', ')}`);
      const borderRadius = layoutSection.match(/border-radius\s*:\s*([^;\n]+)/gi);
      if (borderRadius) parts.push(`Border radius: ${[...new Set(borderRadius)].join(', ')}`);
      // Include ASCII wireframes if present (visual layout)
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
      // Extract individual component subsections (### headers)
      const componentNames = compSection.match(/^###\s+(.+)$/gm);
      if (componentNames) parts.push(`Components to show: ${componentNames.map(h => h.replace('### ', '')).join(', ')}`);
      // Include component details (CSS, structure)
      parts.push(`Component specifications:\n${compSection.slice(0, 1500)}`);
    }

    // 6. Animation Patterns — extract visual effects
    const animSection = extractAgentSection(generatedAgent, 'animat');
    if (animSection) {
      parts.push(`\n## VISUAL EFFECTS & ANIMATIONS`);
      // Extract transitions, transforms, effects
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
      // Extract code blocks (actual CSS)
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
      // Include section structure details
      parts.push(`Section details:\n${templateSection.slice(0, 1000)}`);
    }

    // 9. Extract ALL remaining CSS vars and colors from the entire .md
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
async function generatePreviewImageFile(brief, agentContent, filenameBase) {
  if (!GOOGLE_AI_API_KEY) {
    console.warn('[agent-creator] GOOGLE_AI_API_KEY not configured, skipping preview');
    return null;
  }
  const prompt = buildPreviewPrompt(brief, agentContent);
  console.log(`[agent-creator] Generating preview image for ${filenameBase} (prompt ${prompt.length} chars)`);

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

    if (!brief && !agent) {
      return res.status(400).json({ error: 'Generate a design brief or agent first before previewing' });
    }

    const result = await generatePreviewImageFile(brief, agent, `preview-${id}`);
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

    if (ref.type === 'image' && ref.url) {
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

    // Detect category from content
    const lowerContent = (description + ' ' + prompt.slice(0, 500)).toLowerCase();
    let category = 'Custom';
    if (lowerContent.includes('landing page') || lowerContent.includes('marketing')) category = 'Landing Pages';
    else if (lowerContent.includes('dashboard') || lowerContent.includes('saas')) category = 'SaaS';
    else if (lowerContent.includes('portfolio') || lowerContent.includes('creative')) category = 'Creative';
    else if (lowerContent.includes('e-commerce') || lowerContent.includes('shop')) category = 'E-Commerce';

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
          // Copy to agent-specific filename for persistence
          const srcFile = path.join(UPLOAD_DIR, path.basename(sa.profile_image_url));
          const ext = path.extname(sa.profile_image_url) || '.jpg';
          const destFile = path.join(UPLOAD_DIR, `agent-${agentName}${ext}`);
          try {
            await fs.copyFile(srcFile, destFile);
            thumbnailUrl = `/uploads/agent-creator/agent-${agentName}${ext}`;
            console.log(`[agent-creator] Using profile image as thumbnail for ${agentName}: ${thumbnailUrl}`);
          } catch (copyErr) {
            console.warn(`[agent-creator] Failed to copy profile image:`, copyErr.message);
          }
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
        const result = await generatePreviewImageFile(brief, agentContent, `agent-${agentName}`);
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
