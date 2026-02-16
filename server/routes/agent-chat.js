const express = require('express');
const router = express.Router();
const db = require('../db');
const { generateEmbedding } = require('../lib/embeddings');
const { callGPT5 } = require('../lib/agent-analysis');

// GET / — list user's agent chats
router.get('/', async (req, res) => {
  try {
    const chats = await db.getUserAgentChats(req.user.id);
    res.json(chats);
  } catch (err) {
    console.error('[agent-chat] list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST / — create new chat
router.post('/', async (req, res) => {
  try {
    const { agentName, name } = req.body;
    if (!agentName) return res.status(400).json({ error: 'agentName required' });
    const chat = await db.createAgentChat(req.user.id, agentName, name);
    res.json(chat);
  } catch (err) {
    console.error('[agent-chat] create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id — get chat + messages
router.get('/:id', async (req, res) => {
  try {
    const chat = await db.getAgentChat(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    const messages = await db.getAgentChatMessages(req.params.id, 100);
    res.json({ ...chat, messages });
  } catch (err) {
    console.error('[agent-chat] get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id — delete chat
router.delete('/:id', async (req, res) => {
  try {
    await db.deleteAgentChat(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[agent-chat] delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/messages — send message (RAG + GPT-5)
router.post('/:id/messages', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message required' });

    const chat = await db.getAgentChat(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    // Load agent
    const agent = await db.getAgent(chat.agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Get linked knowledge bases
    const kbs = await db.getAgentKnowledgeBases(chat.agent_name);
    const kbIds = kbs.map(kb => kb.id);

    // RAG: search knowledge if KBs exist
    let knowledgeContext = '';
    let sources = [];
    if (kbIds.length > 0) {
      try {
        const queryEmbedding = await generateEmbedding(message);
        const results = await db.searchKnowledge(queryEmbedding, {
          threshold: 0.25,
          limit: 5,
          knowledgeBaseIds: kbIds,
        });
        if (results.length > 0) {
          sources = results.map(r => ({
            title: r.title,
            similarity: Math.round(r.similarity * 100) / 100,
            kbName: kbs.find(kb => kb.id === r.knowledge_base_id)?.name || 'Unknown',
            entryId: r.id,
          }));
          knowledgeContext = '\n\n## Knowledge Context\nUse the following knowledge to answer accurately:\n\n' +
            results.map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`).join('\n\n');
        }
      } catch (embErr) {
        console.warn('[agent-chat] embedding/search error (continuing without RAG):', embErr.message);
      }
    }

    // Build system prompt
    const agentPrompt = agent.full_prompt || agent.description || '';
    const systemContent = agentPrompt + knowledgeContext;

    // Load conversation history (last 20 messages)
    const history = await db.getAgentChatMessages(req.params.id, 20);
    const historyMessages = history.map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Build messages array for GPT
    const gptMessages = [
      { role: 'system', content: systemContent },
      ...historyMessages,
      { role: 'user', content: message },
    ];

    // Call GPT-5
    const assistantContent = await callGPT5(gptMessages, { max_completion_tokens: 4000 });

    // Save user message
    await db.createAgentChatMessage(req.params.id, 'user', message, null);

    // Save assistant message with sources
    const assistantMsg = await db.createAgentChatMessage(
      req.params.id, 'assistant', assistantContent, sources.length > 0 ? sources : null
    );

    res.json({
      message: {
        id: assistantMsg.id,
        role: 'assistant',
        content: assistantContent,
        sources: sources.length > 0 ? sources : null,
        created_at: assistantMsg.created_at,
      },
    });
  } catch (err) {
    console.error('[agent-chat] message error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
