// Agent Creator Routes
// Handles GPT-5 conversations, image/URL analysis, and agent file generation

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;

// OpenAI GPT-5 client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GPT5_MODEL = 'gpt-5-mini-2025-08-07'; // MANDATORY per CLAUDE.md

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
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images (PNG, JPG, WEBP) are allowed'));
    }
  }
});

// Helper: Call GPT-5
async function callGPT5(messages, responseFormat = null) {
  const body = {
    model: GPT5_MODEL,
    messages,
  };

  if (responseFormat === 'json') {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GPT-5 API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// Helper: Analyze image with GPT-5 Vision (base64)
async function analyzeImageBase64(filePath, mimeType, prompt = 'Describe this design in detail, including colors, layout, typography, and style.') {
  const imageBuffer = await fs.readFile(filePath);
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } }
      ]
    }
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GPT5_MODEL,
      messages,
      max_completion_tokens: 1000,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GPT Vision API error: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// Helper: Fetch and analyze URL
async function analyzeURL(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);

    const title = titleMatch ? titleMatch[1] : 'No title';
    const description = descMatch ? descMatch[1] : 'No description';

    return { title, description, url, type: 'webpage' };
  } catch (err) {
    return { title: 'Error loading URL', description: err.message, url, type: 'error' };
  }
}

// ========== ROUTES ==========
// Note: verifyToken is applied at the mount level in index.js

const db = require('../db');

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

// Get conversation by ID (with messages and references)
router.get('/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Load messages and references
    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);

    res.json({
      conversation: {
        ...conversation,
        messages,
        references
      }
    });
  } catch (err) {
    console.error('[agent-creator] Error fetching conversation:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload and analyze image (uses base64 for GPT Vision)
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

    // Analyze image with GPT Vision using base64
    const analysis = await analyzeImageBase64(filePath, mimeType);

    const reference = await db.createConversationReference(
      id,
      'image',
      imageUrl,
      req.file.originalname,
      analysis
    );

    res.json({ reference });
  } catch (err) {
    console.error('[agent-creator] Error uploading image:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add URL reference
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

    const analysis = await analyzeURL(url);

    const reference = await db.createConversationReference(
      id,
      'url',
      url,
      null,
      JSON.stringify(analysis)
    );

    res.json({ reference });
  } catch (err) {
    console.error('[agent-creator] Error adding URL:', err);
    res.status(500).json({ error: err.message });
  }
});

// Send message to GPT-5
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

    // Load references
    const references = await db.getConversationReferences(id);

    // Build context from references
    let referencesContext = '';
    if (references.length > 0) {
      referencesContext = '\n\nReferences provided by the user:\n';
      references.forEach((ref, idx) => {
        if (ref.type === 'image') {
          referencesContext += `\n[Image ${idx + 1}]: ${ref.filename}\nAnalysis: ${ref.analysis}\n`;
        } else if (ref.type === 'url') {
          const analysis = typeof ref.analysis === 'string' ? JSON.parse(ref.analysis) : ref.analysis;
          referencesContext += `\n[URL ${idx + 1}]: ${ref.url}\nTitle: ${analysis.title}\nDescription: ${analysis.description}\n`;
        }
      });
    }

    const systemPrompt = `You are an expert AI agent designer. Your goal is to help the user create a specialized AI agent configuration file in markdown format.

An agent file has this structure:

---
name: agent-name
description: "Brief description of the agent's purpose"
model: claude-opus-4-6
---
[Agent system prompt goes here - this is the full instruction set for the agent]

Guidelines:
1. Ask clarifying questions to understand the agent's purpose
2. Use references (images, URLs) to inform design decisions
3. Be specific about colors, typography, layout patterns
4. Generate complete, production-ready agent prompts
5. Follow the format exactly

${referencesContext}

Current conversation goal: Create an agent configuration for "${conversation.name}".`;

    // Add user message to database
    await db.createConversationMessage(id, 'user', message);

    // Load all messages for GPT-5 context
    const messages = await db.getConversationMessages(id);
    const gptMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ];

    const assistantResponse = await callGPT5(gptMessages);

    // Save assistant response
    const assistantMessage = await db.createConversationMessage(id, 'assistant', assistantResponse);

    res.json({ message: assistantMessage });
  } catch (err) {
    console.error('[agent-creator] Error sending message:', err);
    res.status(500).json({ error: err.message });
  }
});

// Generate final agent file
router.post('/conversations/:id/generate', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getAgentConversation(id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await db.getConversationMessages(id);
    const references = await db.getConversationReferences(id);

    const referencesContext = references.map((ref, idx) => {
      if (ref.type === 'image') {
        return `Image ${idx + 1}: ${ref.analysis}`;
      } else {
        const analysis = typeof ref.analysis === 'string' ? JSON.parse(ref.analysis) : ref.analysis;
        return `URL ${idx + 1}: ${ref.url} - ${analysis.title}`;
      }
    }).join('\n');

    const generationPrompt = `Based on our conversation, generate a complete agent configuration file.

Conversation summary:
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

References:
${referencesContext}

Generate a complete markdown agent file with:
1. Frontmatter (name, description, model)
2. Full system prompt (detailed instructions)

Output ONLY the markdown file content, nothing else.`;

    const gptMessages = [
      { role: 'system', content: 'You are an expert AI agent file generator. Output ONLY the markdown content, no explanations.' },
      { role: 'user', content: generationPrompt },
    ];

    const agentFile = await callGPT5(gptMessages);

    res.json({ agentFile });
  } catch (err) {
    console.error('[agent-creator] Error generating agent:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete reference
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

// Delete conversation
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

// Save generated agent to library
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

    // Parse frontmatter from markdown
    const frontmatterMatch = agentContent.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      return res.status(400).json({ error: 'Invalid agent format. Expected frontmatter with ---' });
    }

    const [, frontmatter, prompt] = frontmatterMatch;

    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descriptionMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?$/m);
    const modelMatch = frontmatter.match(/^model:\s*(.+)$/m);

    if (!nameMatch) {
      return res.status(400).json({ error: 'Agent name is required in frontmatter' });
    }

    const agentName = nameMatch[1].trim();
    const description = descriptionMatch ? descriptionMatch[1].trim() : '';
    const model = modelMatch ? modelMatch[1].trim() : 'claude-sonnet-4-5';

    // Create agent file in bundled agents directory
    const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
    await fs.mkdir(BUNDLED_AGENTS_DIR, { recursive: true });

    const agentFilePath = path.join(BUNDLED_AGENTS_DIR, `${agentName}.md`);
    await fs.writeFile(agentFilePath, agentContent, 'utf8');

    // Create agent in database
    await db.createAgentManual(
      agentName,
      description,
      model,
      'Custom',
      description,
      prompt,
      'Read,Write,Edit,Bash,Grep,Glob',
      0,
      'true',
      'default',
      conversation.user_id
    );

    console.log(`[agent-creator] Saved agent: ${agentName}`);

    res.json({
      success: true,
      agent: { name: agentName, description, model }
    });
  } catch (err) {
    console.error('[agent-creator] Error saving agent:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
