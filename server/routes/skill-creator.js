// Skill Creator Routes — Conversations, AI chat, auto-completion, file generation
const express = require('express');
const router = express.Router();
const db = require('../db');
const skillStorage = require('../skill-storage');
const { callGPT5 } = require('../lib/agent-analysis');
const {
  SKILL_CONVERSATION_SYSTEM_PROMPT,
  SKILL_COMPLETION_SYSTEM_PROMPT,
  SKILL_GENERATION_PROMPT,
  SKILL_STRUCTURE_PROMPT,
} = require('../lib/skill-templates');

// ========== CONVERSATIONS ==========

// List user's skill conversations
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const conversations = await db.getUserSkillConversations(userId);
    res.json({ conversations });
  } catch (err) {
    console.error('[skill-creator] List conversations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Create a new conversation
router.post('/conversations', async (req, res) => {
  try {
    const { name, skillId } = req.body;
    const userId = req.user.userId || req.user.id;
    const conversation = await db.createSkillConversation(userId, skillId, name || 'New Skill');
    res.json({ conversation });
  } catch (err) {
    console.error('[skill-creator] Create conversation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Get conversation with messages
router.get('/conversations/:id', async (req, res) => {
  try {
    const conversation = await db.getSkillConversation(req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await db.getSkillConversationMessages(req.params.id);
    res.json({ conversation: { ...conversation, messages } });
  } catch (err) {
    console.error('[skill-creator] Get conversation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Delete conversation
router.delete('/conversations/:id', async (req, res) => {
  try {
    await db.deleteSkillConversation(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('[skill-creator] Delete conversation error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== CHAT — Send message + get AI response ==========

router.post('/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, fileContext } = req.body;
    const conversation = await db.getSkillConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!message) return res.status(400).json({ error: 'Message is required' });

    // Save user message
    await db.createSkillConversationMessage(id, 'user', message, fileContext);

    // Build context
    let systemPrompt = SKILL_CONVERSATION_SYSTEM_PROMPT;
    systemPrompt += `\n\nCurrent skill: "${conversation.name}".`;

    // If linked to a skill, include file tree and entry point content
    if (conversation.skill_id) {
      const skill = await db.getSkill(conversation.skill_id);
      if (skill) {
        systemPrompt += `\nSkill slug: ${skill.slug}`;
        if (skill.file_tree) {
          systemPrompt += `\nFile tree: ${JSON.stringify(skill.file_tree).slice(0, 2000)}`;
        }
        // Read SKILL.md content for context
        const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
        if (entryFile) {
          systemPrompt += `\n\nSKILL.md content:\n${entryFile.content.slice(0, 3000)}`;
        }
        // If editing a specific file, include its content
        if (fileContext) {
          const activeFile = skillStorage.readSkillFile(skill.slug, fileContext);
          if (activeFile) {
            systemPrompt += `\n\nCurrently editing: ${fileContext}\n${activeFile.content.slice(0, 3000)}`;
          }
        }
      }
    }

    // Load recent messages for context
    const allMessages = await db.getSkillConversationMessages(id);
    const recentMessages = allMessages.length > 20 ? allMessages.slice(-20) : allMessages;

    const gptMessages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    const assistantResponse = await callGPT5(gptMessages, { max_completion_tokens: 16000 });

    const assistantMessage = await db.createSkillConversationMessage(id, 'assistant', assistantResponse);
    res.json({ message: assistantMessage });
  } catch (err) {
    console.error('[skill-creator] Chat error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== AI AUTO-COMPLETION ==========

router.post('/conversations/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { fileContext, blocksBefore, currentBlock, cursorPosition, skillContext } = req.body;
    const conversation = await db.getSkillConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // Build completion context
    let contextParts = [];
    if (skillContext?.name) contextParts.push(`Skill: ${skillContext.name}`);
    if (fileContext) contextParts.push(`File: ${fileContext}`);
    if (skillContext?.files) contextParts.push(`Files in skill: ${skillContext.files.join(', ')}`);

    // Read adjacent files for context
    if (conversation.skill_id) {
      const skill = await db.getSkill(conversation.skill_id);
      if (skill) {
        const entryFile = skillStorage.readSkillFile(skill.slug, 'SKILL.md');
        if (entryFile) {
          contextParts.push(`SKILL.md overview:\n${entryFile.content.slice(0, 1500)}`);
        }
      }
    }

    const systemPrompt = SKILL_COMPLETION_SYSTEM_PROMPT
      + '\n\n## Context\n' + contextParts.join('\n');

    const userPrompt = [
      'Previous blocks:',
      ...(blocksBefore || []).slice(-5).map((b, i) => `[${i}] ${b}`),
      '',
      `Current block (cursor at position ${cursorPosition || 'end'}):`,
      currentBlock || '',
      '',
      'Continue writing from the cursor position. Return ONLY the completion text.',
    ].join('\n');

    const completion = await callGPT5(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { max_completion_tokens: 2000 }
    );

    res.json({ completion: completion.trim(), confidence: 0.85 });
  } catch (err) {
    console.error('[skill-creator] Complete error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== GENERATE FILE — AI generates a full file ==========

router.post('/conversations/:id/generate-file', async (req, res) => {
  try {
    const { id } = req.params;
    const { filePath, description } = req.body;
    const conversation = await db.getSkillConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    if (!filePath) return res.status(400).json({ error: 'filePath is required' });

    // Build rich context
    let context = `Skill: ${conversation.name}\nTarget file: ${filePath}`;

    if (conversation.skill_id) {
      const skill = await db.getSkill(conversation.skill_id);
      if (skill) {
        context += `\nCategory: ${skill.category || 'general'}`;
        context += `\nDescription: ${skill.description || 'N/A'}`;

        // Read SKILL.md for context
        const entryFile = skillStorage.readSkillFile(skill.slug, 'SKILL.md');
        if (entryFile) {
          context += `\n\nSKILL.md (overview):\n${entryFile.content.slice(0, 4000)}`;
        } else if (skill.prompt) {
          context += `\n\nSkill prompt:\n${skill.prompt.slice(0, 4000)}`;
        }

        // Read other reference files for cross-referencing
        const tree = skillStorage.scanSkillTree(skill.slug);
        if (tree) {
          context += `\n\nFile tree: ${JSON.stringify(tree).slice(0, 1500)}`;
          // Read sibling files for coherence (up to 3)
          const siblingFiles = [];
          const walkTree = (items) => {
            for (const item of items) {
              if (item.type === 'file' && item.path !== filePath && item.path !== 'SKILL.md' && siblingFiles.length < 3) {
                siblingFiles.push(item.path);
              }
              if (item.children) walkTree(item.children);
            }
          };
          walkTree(tree);
          for (const sibPath of siblingFiles) {
            const sib = skillStorage.readSkillFile(skill.slug, sibPath);
            if (sib) {
              context += `\n\n--- ${sibPath} (sibling reference) ---\n${sib.content.slice(0, 1500)}`;
            }
          }
        }
      }
    }

    // Load conversation messages for context
    const messages = await db.getSkillConversationMessages(id);
    const recentMsgs = messages.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 300)}`).join('\n\n');
    if (recentMsgs) context += `\n\nRecent conversation:\n${recentMsgs}`;

    const prompt = `${SKILL_GENERATION_PROMPT}\n\n## Context\n${context}\n\n## Task\nGenerate the complete content for file: ${filePath}\n${description ? `Description: ${description}` : ''}\n\nRequirements:\n- Write 500-1500 words of DETAILED, actionable content\n- Include concrete examples, code snippets, tables where relevant\n- Cross-reference other files in the skill structure\n- NO placeholders or TODOs — everything must be production-ready\n\nReturn ONLY the markdown content.`;

    const content = await callGPT5(
      [
        { role: 'system', content: 'You generate complete, production-ready skill file content. Write detailed, actionable content with concrete examples. Minimum 500 words per file. Return ONLY the content, no wrapping.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 16000 }
    );

    res.json({ content: content.trim(), filePath });
  } catch (err) {
    console.error('[skill-creator] Generate file error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== GENERATE STRUCTURE — AI generates all files ==========

router.post('/conversations/:id/generate-structure', async (req, res) => {
  try {
    const { id } = req.params;
    const conversation = await db.getSkillConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    if (!conversation.skill_id) {
      return res.status(400).json({ error: 'Conversation must be linked to a skill' });
    }

    const skill = await db.getSkill(conversation.skill_id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });

    // Load existing SKILL.md content (if any) so AI can split it into sub-files
    let existingContent = '';
    const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
    if (entryFile && entryFile.content) {
      existingContent = entryFile.content;
    } else if (skill.prompt && skill.prompt.trim()) {
      existingContent = skill.prompt;
    }

    // Load existing file tree
    const existingTree = skillStorage.scanSkillTree(skill.slug);
    const existingFiles = existingTree ? JSON.stringify(existingTree).slice(0, 1000) : 'none';

    // Load conversation for context
    const messages = await db.getSkillConversationMessages(id);
    const recentMsgs = messages.slice(-10).map(m => `${m.role}: ${m.content.slice(0, 500)}`).join('\n\n');

    const contextParts = [
      `## Skill Info`,
      `Name: ${skill.name}`,
      `Slug: ${skill.slug}`,
      `Description: ${skill.description || 'N/A'}`,
      `Category: ${skill.category || 'general'}`,
      `Current files on disk: ${existingFiles}`,
    ];

    if (existingContent) {
      contextParts.push(
        `\n## Existing Content (SPLIT THIS into focused sub-files)`,
        `The following is the current SKILL.md content. Your job is to REORGANIZE it:`,
        `- Keep SKILL.md as a SHORT overview (200-400 words)`,
        `- Extract each major section (## heading) into its own reference file`,
        `- Expand each reference file with more detail, examples, and concrete patterns`,
        `- Add NEW reference files for topics not yet covered but relevant to this skill`,
        `\n---\n${existingContent.slice(0, 8000)}`
      );
    }

    if (recentMsgs) {
      contextParts.push(`\n## Conversation Context\n${recentMsgs}`);
    }

    const prompt = `${SKILL_STRUCTURE_PROMPT}\n\n${contextParts.join('\n')}\n\nGenerate the complete file structure with 6-12 files. Each reference file must have 500+ words of detailed, actionable content.`;

    const response = await callGPT5(
      [
        { role: 'system', content: 'You generate structured skill file hierarchies as JSON. Return ONLY valid JSON with a "files" array. Each file must have "path" and "content" fields. Generate 6-12 files minimum.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 32000, responseFormat: 'json' }
    );

    let structure;
    try {
      structure = JSON.parse(response);
    } catch (e) {
      console.error('[skill-creator] Failed to parse JSON:', response.slice(0, 500));
      return res.status(500).json({ error: 'Failed to parse AI response as JSON' });
    }

    // Write all files to disk
    const files = structure.files || [];
    if (files.length === 0) {
      return res.status(500).json({ error: 'AI generated 0 files — try again or describe your skill in the chat first' });
    }

    for (const file of files) {
      if (file.path && file.content) {
        skillStorage.writeSkillFile(skill.slug, file.path, file.content);
      }
    }

    // Also update the skill prompt field with the new SKILL.md content
    const skillMdFile = files.find(f => f.path === 'SKILL.md');
    if (skillMdFile) {
      await db.updateSkill(skill.id, { prompt: skillMdFile.content });
    }

    // Sync tree to DB
    const { tree, totalFiles } = await skillStorage.syncSkillTreeToDB(skill.id, skill.slug);

    res.json({ files: files.length, tree, totalFiles });
  } catch (err) {
    console.error('[skill-creator] Generate structure error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== SAVE — Link conversation to skill ==========

router.post('/conversations/:id/save', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, slug, description, category } = req.body;
    const conversation = await db.getSkillConversation(id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    let skill;
    if (conversation.skill_id) {
      // Update existing skill
      skill = await db.getSkill(conversation.skill_id);
      if (skill && name) {
        await db.updateSkill(skill.id, { name, description, category });
        skill = await db.getSkill(skill.id);
      }
    } else {
      // Create new skill from conversation
      const skillSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      skill = await db.createSkill(
        name || conversation.name,
        skillSlug,
        description || '',
        '', // prompt will be read from SKILL.md
        category || 'general',
        '', '',
        req.user.userId || req.user.id
      );
      // Init file structure
      skillStorage.initSkillFromTemplate(skillSlug, 'blank');
      // Link conversation to skill
      await db.updateSkillConversation(id, { skill_id: skill.id, name: name || conversation.name });
      // Sync tree
      await skillStorage.syncSkillTreeToDB(skill.id, skillSlug);
    }

    res.json({ skill });
  } catch (err) {
    console.error('[skill-creator] Save error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ========== TEMPLATES ==========

router.get('/templates', async (req, res) => {
  try {
    const templates = skillStorage.listTemplates();
    res.json({ templates });
  } catch (err) {
    console.error('[skill-creator] Templates error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
