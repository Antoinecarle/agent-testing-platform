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

  let ctx = '\n\n## Reference Analyses\n';
  references.forEach((ref, idx) => {
    if (ref.type === 'image') {
      const structured = ref.structured_analysis;
      if (structured) {
        ctx += `\n### Image ${idx + 1}: ${ref.filename || 'screenshot'}\n`;
        if (structured.colors) {
          ctx += `- **Colors**: Background ${structured.colors.dominantBackground || '?'}, Accent ${structured.colors.primaryAccent || '?'}, Mood: ${structured.colors.mood || '?'}\n`;
        }
        if (structured.typography) {
          ctx += `- **Typography**: Display "${structured.typography.displayFont || '?'}", Body "${structured.typography.bodyFont || '?'}", Style: ${structured.typography.headlineStyle || '?'}\n`;
        }
        if (structured.layout) {
          ctx += `- **Layout**: ${structured.layout.primaryLayout || '?'}, Cards: ${structured.layout.cardStyle || '?'}, Radius: ${structured.layout.borderRadius || '?'}\n`;
        }
        if (structured.components) {
          ctx += `- **Aesthetic**: ${structured.components.overallAesthetic || '?'}\n`;
          if (structured.components.components) {
            const names = structured.components.components.map(c => c.type).join(', ');
            ctx += `- **Components**: ${names}\n`;
          }
        }
      } else if (ref.analysis) {
        ctx += `\n### Image ${idx + 1}: ${ref.filename}\n${ref.analysis}\n`;
      }
    } else if (ref.type === 'url') {
      const structured = ref.structured_analysis;
      if (structured && structured.gptAnalysis) {
        const gpt = structured.gptAnalysis;
        ctx += `\n### URL ${idx + 1}: ${ref.url}\n`;
        ctx += `- **Site**: ${gpt.siteName || structured.extracted?.title || '?'}\n`;
        ctx += `- **Style**: ${gpt.designStyle || '?'}\n`;
        if (gpt.colorScheme) {
          ctx += `- **Colors**: Primary ${gpt.colorScheme.primary || '?'}, BG ${gpt.colorScheme.background || '?'}, Accent ${gpt.colorScheme.accent || '?'}\n`;
        }
        if (gpt.typography) {
          ctx += `- **Fonts**: Heading "${gpt.typography.headingFont || '?'}", Body "${gpt.typography.bodyFont || '?'}"\n`;
        }
        ctx += `- **Mood**: ${gpt.overallMood || '?'}\n`;
      } else if (ref.analysis) {
        const analysis = typeof ref.analysis === 'string' ? JSON.parse(ref.analysis) : ref.analysis;
        ctx += `\n### URL ${idx + 1}: ${ref.url}\nTitle: ${analysis.title}\n`;
      }
    }
  });
  return ctx;
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

    const reference = await db.createConversationReference(
      id,
      'url',
      url,
      null,
      summary
    );

    // Store structured analysis
    await db.updateReferenceAnalysis(reference.id, structuredAnalysis);

    res.json({
      reference: {
        ...reference,
        structured_analysis: structuredAnalysis,
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

    // Build the upgraded system prompt
    const systemPrompt = CONVERSATION_SYSTEM_PROMPT
      + referencesContext
      + `\n\nCurrent conversation: Creating an agent for "${conversation.name}".`;

    // Save user message
    await db.createConversationMessage(id, 'user', message);

    // Load all messages for GPT context
    const allMessages = await db.getConversationMessages(id);

    // Build image content parts for vision — include all uploaded images
    const imageRefs = references.filter(r => r.type === 'image' && r.url);
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
          image_url: { url: `data:${mimeType};base64,${base64}` }
        });
      } catch (err) {
        console.warn(`[agent-creator] Could not load image ${ref.url}:`, err.message);
      }
    }

    // Build GPT messages — first user message includes images for vision context
    const gptMessages = [{ role: 'system', content: systemPrompt }];

    for (let i = 0; i < allMessages.length; i++) {
      const m = allMessages[i];
      if (m.role === 'user' && i === allMessages.length - 1 && imageParts.length > 0) {
        // Last user message: attach all images as vision content
        gptMessages.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content },
            ...imageParts,
          ],
        });
      } else {
        gptMessages.push({ role: m.role, content: m.content });
      }
    }

    // Call GPT-5 with vision support
    const body = {
      model: GPT5_MODEL,
      messages: gptMessages,
      max_completion_tokens: 2000,
    };

    const gptRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!gptRes.ok) {
      const errorText = await gptRes.text();
      throw new Error(`GPT-5 API error: ${gptRes.status} ${errorText}`);
    }

    const gptData = await gptRes.json();
    const assistantResponse = gptData.choices[0].message.content;

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
Do NOT copy the reference example content — use it only as a format guide.`;

    console.log(`[agent-creator] Generating agent for ${derivedName} (conversation ${id})`);

    const agentFile = await callGPT5(
      [
        { role: 'system', content: GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: generationUserPrompt },
      ],
      { max_completion_tokens: 16000 }
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
      { max_completion_tokens: 4000 }
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

    // Write agent .md file
    const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
    await fs.mkdir(BUNDLED_AGENTS_DIR, { recursive: true });

    const agentFilePath = path.join(BUNDLED_AGENTS_DIR, `${agentName}.md`);
    await fs.writeFile(agentFilePath, agentContent, 'utf8');

    // Create agent in database
    await db.createAgentManual(
      agentName,
      description,
      model,
      category,
      description,
      prompt,
      tools,
      maxTurns,
      memory,
      permissionMode,
      conversation.user_id
    );

    console.log(`[agent-creator] Saved agent: ${agentName} (${model}, ${category})`);

    res.json({
      success: true,
      agent: { name: agentName, description, model, category }
    });
  } catch (err) {
    console.error('[agent-creator] Error saving agent:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
