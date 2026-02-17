const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { ensureUserHome, USERS_DIR } = require('../user-home');
const { validate, createAgentSchema, updateAgentSchema, bulkNamesSchema, bulkCategorizeSchema, importAgentSchema, duplicateAgentSchema, aiGenerateSchema, chatMessageSchema } = require('../middleware/validate');
const { heavyLimiter } = require('../middleware/rate-limit');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');

// Use project-bundled agents as primary, fallback to system ~/.claude/agents
const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');
const SYSTEM_AGENTS_DIR = path.join(require('os').homedir(), '.claude', 'agents');
const AGENTS_DIR = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : SYSTEM_AGENTS_DIR;

// Parse a .md agent file to extract metadata
function parseAgentFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const name = path.basename(filePath, '.md');

  let description = '';
  let model = '';
  let category = 'uncategorized';
  let tools = '';
  let maxTurns = 0;
  let memory = '';
  let permissionMode = '';

  // Extract YAML front matter if present
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const descMatch = fm.match(/description:\s*"([^"]+)"/);
    if (descMatch) description = descMatch[1];
    const modelMatch = fm.match(/model:\s*(\S+)/);
    if (modelMatch) model = modelMatch[1];
    const toolsMatch = fm.match(/tools:\s*\[([^\]]*)\]/);
    if (toolsMatch) tools = toolsMatch[1].replace(/\s/g, '');
    const turnsMatch = fm.match(/max_turns:\s*(\d+)/);
    if (turnsMatch) maxTurns = parseInt(turnsMatch[1], 10);
    const memMatch = fm.match(/memory:\s*"([^"]+)"/);
    if (memMatch) memory = memMatch[1];
    const permMatch = fm.match(/permission_mode:\s*(\S+)/);
    if (permMatch) permissionMode = permMatch[1];
    // Extract category from front matter (personaboarding agents set this)
    const catMatch = fm.match(/category:\s*(\S+)/);
    if (catMatch) category = catMatch[1];
  }

  // Fallback: extract description from body text
  if (!description) {
    const body = fmMatch ? content.slice(fmMatch[0].length) : content;
    const lines = body.split('\n').filter(l => l.trim());
    for (const line of lines) {
      if (line.startsWith('#') || line.startsWith('---')) continue;
      if (line.includes('Use proactively when') || line.includes('Use this')) {
        description = line.trim().replace(/^[-*]\s*/, '');
        break;
      }
      if (!description && !line.startsWith('(') && !line.startsWith('[')) {
        description = line.trim();
      }
    }
  }

  // Auto-detect category from name only if not set from front matter
  if (category === 'uncategorized') {
    if (name.includes('epiminds')) category = 'epiminds';
    else if (name.includes('seo') || name.includes('geo')) category = 'seo';
    else if (name.includes('reviewer') || name.includes('code')) category = 'dev-tools';
    else if (name.includes('builder') || name.includes('architect')) category = 'builders';
    else if (name.includes('animation') || name.includes('scroll')) category = 'animation';
    else if (name.includes('design') || name.includes('theme') || name.includes('stylist')) category = 'design';
    else category = 'style';
  }

  const promptPreview = content.substring(0, 500);
  const fullPrompt = content;

  return { name, description, model, category, promptPreview, fullPrompt, tools, maxTurns, memory, permissionMode };
}

// Sync agents from filesystem to DB (bundled + custom-agents from persistent volume)
async function syncAgents() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
  const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');

  // Collect .md files from both bundled and custom agents dirs
  const agentDirs = [];
  if (fs.existsSync(AGENTS_DIR)) agentDirs.push({ dir: AGENTS_DIR, source: 'filesystem' });
  if (fs.existsSync(CUSTOM_AGENTS_DIR)) agentDirs.push({ dir: CUSTOM_AGENTS_DIR, source: 'manual' });

  console.log(`[Agents] Syncing from ${agentDirs.length} source(s): ${agentDirs.map(d => d.dir).join(', ')}`);

  const synced = [];

  for (const { dir, source } of agentDirs) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
    console.log(`[Agents] Found ${files.length} agent files in ${dir}`);

    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const parsed = parseAgentFile(filePath);
        const existing = await db.getAgent(parsed.name);

        // For custom agents, preserve their source as 'manual'
        const agentSource = source === 'manual' ? 'manual' : 'filesystem';

        await db.upsertAgent(
          parsed.name,
          parsed.description,
          parsed.model,
          parsed.category,
          parsed.promptPreview,
          existing ? existing.screenshot_path : '',
          existing ? existing.rating : 0,
          parsed.fullPrompt,
          agentSource,
          parsed.tools,
          parsed.maxTurns,
          parsed.memory,
          parsed.permissionMode
        );
        synced.push(parsed.name);
      } catch (err) {
        console.error(`[Agents] Error parsing ${file}:`, err.message);
      }
    }
  }

  return synced;
}

// GET /api/agents — list agents (filtered by user, admin sees all)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let agents;

    if (search) {
      agents = await db.searchAgentsForUser(search, req.user.userId);
    } else if (category) {
      agents = await db.getAgentsByCategoryForUser(category, req.user.userId);
    } else {
      agents = await db.getAllAgentsForUser(req.user.userId);
    }

    res.json(agents);
  } catch (err) {
    console.error('[Agents] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/sync — sync agents from filesystem
router.post('/sync', async (req, res) => {
  try {
    const synced = await syncAgents();
    // Also sync custom agents from DB to filesystem
    await syncCustomAgentsFromDB();
    res.json({ synced: synced.length, agents: synced });
  } catch (err) {
    console.error('[Agents] Sync error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Sync custom/manual agents FROM DB TO filesystem + all user homes
 * This ensures agents created via Agent Creator survive redeploys
 * and are available to Claude CLI in all user terminals.
 */
async function syncCustomAgentsFromDB() {
  try {
    const allAgents = await db.getAllAgents();
    const manualAgents = allAgents.filter(a => a.source === 'manual' && a.full_prompt);

    if (manualAgents.length === 0) return 0;

    // Ensure custom-agents dir exists
    if (!fs.existsSync(CUSTOM_AGENTS_DIR)) {
      fs.mkdirSync(CUSTOM_AGENTS_DIR, { recursive: true });
    }

    let written = 0;
    for (const agent of manualAgents) {
      const fileName = `${agent.name}.md`;
      const filePath = path.join(CUSTOM_AGENTS_DIR, fileName);

      // Write to custom-agents dir (persistent volume)
      const content = agent.full_prompt;
      if (!content || content.length < 50) continue;

      // Always write (overwrite) to ensure latest version
      fs.writeFileSync(filePath, content, 'utf8');
      written++;

      // Also write to bundled agents dir (for workspace.js fallback)
      try {
        const bundledPath = path.join(BUNDLED_AGENTS_DIR, fileName);
        fs.writeFileSync(bundledPath, content, 'utf8');
      } catch (_) {}
    }

    // Copy to ALL existing user homes
    if (fs.existsSync(USERS_DIR)) {
      const userDirs = fs.readdirSync(USERS_DIR).filter(d => {
        try { return fs.statSync(path.join(USERS_DIR, d)).isDirectory(); }
        catch (_) { return false; }
      });

      for (const userId of userDirs) {
        const userAgentsDir = path.join(USERS_DIR, userId, '.claude', 'agents');
        if (!fs.existsSync(userAgentsDir)) {
          fs.mkdirSync(userAgentsDir, { recursive: true });
        }
        for (const agent of manualAgents) {
          if (!agent.full_prompt || agent.full_prompt.length < 50) continue;
          const dest = path.join(userAgentsDir, `${agent.name}.md`);
          fs.writeFileSync(dest, agent.full_prompt, 'utf8');
        }
      }
      console.log(`[Agents] Synced ${written} custom agents to ${userDirs.length} user home(s)`);
    } else {
      console.log(`[Agents] Synced ${written} custom agents to filesystem`);
    }

    return written;
  } catch (err) {
    console.error('[Agents] syncCustomAgentsFromDB error:', err.message);
    return 0;
  }
}

// ── Agent Types with prompt templates ────────────────────────────────────────
const AGENT_TYPES = [
  {
    id: 'ux-design',
    label: 'UX / Design',
    description: 'Landing pages, composants UI, design systems',
    icon: 'Palette',
    color: '#EC4899',
    defaults: {
      model: 'sonnet',
      category: 'design',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
      permission_mode: 'bypassPermissions',
      prompt: `# {NAME} — UX/Design Agent

You are {NAME}, an expert UX/UI design agent specialized in creating beautiful, modern web interfaces.

## Core Expertise
- Landing page design (dark themes, glassmorphism, gradients)
- Component libraries and design systems
- Responsive layouts (mobile-first)
- Micro-interactions and animations (CSS/JS)
- Accessibility (WCAG 2.1 AA)

## Output Rules
- Output a single self-contained \`index.html\` file
- All CSS and JS must be inlined (no external dependencies except CDN fonts/icons)
- Use modern CSS (grid, flexbox, custom properties, clamp())
- Images: use Unsplash URLs, SVG inline, or CSS gradients — never local files
- Mobile-responsive by default

## Design Principles
- Clean typography with clear hierarchy
- Generous whitespace and breathing room
- Subtle animations (no flashy effects)
- High contrast for readability
- Consistent spacing scale (4px base)

## Workflow
1. Analyze the user's request
2. Plan the layout structure
3. Write the complete HTML file
4. Overwrite \`index.html\` in the workspace`,
    },
  },
  {
    id: 'development',
    label: 'Développement',
    description: 'Code, architecture, testing, APIs',
    icon: 'Code',
    color: '#3B82F6',
    defaults: {
      model: 'opus',
      category: 'dev-tools',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      permission_mode: 'default',
      prompt: `# {NAME} — Development Agent

You are {NAME}, an expert software development agent.

## Core Expertise
- Full-stack development (Node.js, React, Python, etc.)
- API design (REST, GraphQL)
- Database design and optimization
- Testing strategies (unit, integration, e2e)
- Code review and refactoring

## Working Principles
- Write clean, maintainable code
- Follow SOLID principles and DRY
- Add meaningful error handling
- Use TypeScript types where applicable
- Write tests alongside implementation

## Code Style
- Prefer functional patterns over classes
- Use descriptive variable names
- Keep functions small and focused
- Document complex logic with comments
- Follow existing project conventions

## Workflow
1. Read and understand existing codebase
2. Plan changes before implementing
3. Implement incrementally
4. Test after each change
5. Refactor for clarity`,
    },
  },
  {
    id: 'operational',
    label: 'Opérationnel',
    description: 'DevOps, CI/CD, infrastructure, monitoring',
    icon: 'Settings',
    color: '#F59E0B',
    defaults: {
      model: 'sonnet',
      category: 'operations',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      permission_mode: 'default',
      prompt: `# {NAME} — Operations Agent

You are {NAME}, an expert DevOps and infrastructure agent.

## Core Expertise
- Infrastructure as Code (Terraform, Docker, K8s)
- CI/CD pipelines (GitHub Actions, GitLab CI)
- Cloud platforms (AWS, GCP, Railway, Vercel)
- Monitoring and observability
- Security hardening and secrets management

## Working Principles
- Infrastructure changes must be reproducible
- Always use environment variables for secrets
- Prefer declarative over imperative configs
- Document all infrastructure decisions
- Plan rollback strategies

## Security Rules
- Never hardcode credentials
- Use least-privilege access
- Encrypt data at rest and in transit
- Audit logs for all critical operations
- Regular dependency updates

## Workflow
1. Assess current infrastructure state
2. Plan changes with rollback strategy
3. Implement in staging first
4. Validate with monitoring
5. Document changes`,
    },
  },
  {
    id: 'marketing',
    label: 'Marketing & Contenu',
    description: 'SEO, copywriting, growth, réseaux sociaux',
    icon: 'Megaphone',
    color: '#22C55E',
    defaults: {
      model: 'sonnet',
      category: 'marketing',
      tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch'],
      permission_mode: 'default',
      prompt: `# {NAME} — Marketing & Content Agent

You are {NAME}, an expert marketing and content creation agent.

## Core Expertise
- SEO-optimized content writing
- Copywriting (headlines, CTAs, landing pages)
- Content strategy and editorial planning
- Social media content
- Email marketing sequences

## Content Principles
- Write for humans first, search engines second
- Use clear, compelling language
- Strong hooks and headlines
- Data-backed claims when possible
- Consistent brand voice

## SEO Guidelines
- Natural keyword integration
- Proper heading hierarchy (H1 > H2 > H3)
- Meta descriptions under 160 characters
- Internal linking strategy
- Schema markup where relevant

## Workflow
1. Research topic and audience
2. Outline content structure
3. Write first draft
4. Optimize for SEO
5. Review and polish`,
    },
  },
  {
    id: 'data-ai',
    label: 'Data & IA',
    description: 'Analyse, ML, pipelines, business intelligence',
    icon: 'BarChart3',
    color: '#A855F7',
    defaults: {
      model: 'opus',
      category: 'data',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch'],
      permission_mode: 'default',
      prompt: `# {NAME} — Data & AI Agent

You are {NAME}, an expert data and AI agent.

## Core Expertise
- Data analysis and visualization
- Machine learning model development
- Data pipeline architecture
- SQL optimization and database design
- Business intelligence dashboards

## Working Principles
- Data quality checks before analysis
- Reproducible analysis pipelines
- Clear documentation of methodology
- Statistical rigor in conclusions
- Privacy-first data handling

## Analysis Standards
- Always validate data sources
- Use appropriate statistical methods
- Visualize results clearly
- Quantify uncertainty
- Separate correlation from causation

## Workflow
1. Understand the business question
2. Explore and clean data
3. Analyze and model
4. Visualize results
5. Present actionable insights`,
    },
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Agent vierge — configurez tout manuellement',
    icon: 'Wrench',
    color: '#6B7280',
    defaults: {
      model: 'sonnet',
      category: 'uncategorized',
      tools: [],
      permission_mode: '',
      prompt: '',
    },
  },
];

// GET /api/agents/types — list agent types with defaults
router.get('/types', (req, res) => {
  res.json(AGENT_TYPES.map(t => ({
    id: t.id,
    label: t.label,
    description: t.description,
    icon: t.icon,
    color: t.color,
    defaults: t.defaults,
  })));
});

// POST /api/agents/ai-generate — generate agent config using ChatGPT
router.post('/ai-generate', heavyLimiter, validate(aiGenerateSchema), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: 'OpenAI API key not configured' });
    }

    const { purpose, style, tools_needed, category } = req.body;

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        input: [
          {
            role: 'system',
            content: `You are an expert at creating Claude Code agent prompts. Generate a complete agent configuration.
You must respond ONLY with valid JSON. No markdown. No explanation. No extra text.

Response format:
{
  "name": "kebab-case-name",
  "description": "One line description",
  "model": "sonnet|opus|haiku",
  "tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
  "max_turns": 10,
  "permission_mode": "default",
  "prompt": "Full agent instructions/prompt text..."
}`
          },
          {
            role: 'user',
            content: `Create an agent for: ${purpose}\nStyle: ${style || 'professional'}\nTools needed: ${tools_needed || 'all'}\nCategory: ${category || 'uncategorized'}`
          }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Agents] AI generate API error:', response.status, errBody);
      return res.status(502).json({ error: 'OpenAI API request failed' });
    }

    const data = await response.json();

    // Parse response object format: output[0].content[0].text
    const outputText = data.output?.[0]?.content?.[0]?.text;
    if (!outputText) {
      console.error('[Agents] AI generate: unexpected response format', JSON.stringify(data));
      return res.status(502).json({ error: 'Unexpected response format from OpenAI' });
    }

    const agentConfig = JSON.parse(outputText);
    res.json(agentConfig);
  } catch (err) {
    console.error('[Agents] AI generate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/import — import agent from .md file content
router.post('/import', validate(importAgentSchema), async (req, res) => {
  try {
    const { filename, content } = req.body;

    const name = filename.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
      return res.status(400).json({ error: 'Invalid filename. Must produce a valid kebab-case name.' });
    }

    const existing = await db.getAgent(name);
    if (existing) return res.status(409).json({ error: `Agent "${name}" already exists` });

    // Write .md file
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${name}.md`), content, 'utf-8');

    // Parse and insert
    const parsed = parseAgentFile(path.join(AGENTS_DIR, `${name}.md`));
    await db.createAgentManual(name, parsed.description, parsed.model, parsed.category, parsed.promptPreview, parsed.fullPrompt, parsed.tools, parsed.maxTurns, parsed.memory, parsed.permissionMode, req.user?.userId);

    const created = await db.getAgent(name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Import error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/delete — delete multiple agents
router.post('/bulk/delete', validate(bulkNamesSchema), async (req, res) => {
  try {
    const { names } = req.body;
    await db.bulkDeleteAgents(names);
    res.json({ ok: true, deleted: names.length });
  } catch (err) {
    console.error('[Agents] Bulk delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/categorize — update category for multiple agents
router.post('/bulk/categorize', validate(bulkCategorizeSchema), async (req, res) => {
  try {
    const { names, category } = req.body;
    await db.bulkUpdateCategory(names, category);
    res.json({ ok: true, updated: names.length });
  } catch (err) {
    console.error('[Agents] Bulk categorize error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/bulk/export — export multiple agents as .md content
router.post('/bulk/export', async (req, res) => {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ error: 'names array is required' });
    }
    const results = [];
    for (const name of names) {
      const agent = await db.getAgent(name);
      if (agent) {
        results.push({ name: agent.name, content: agent.full_prompt || '' });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('[Agents] Bulk export error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/stats — get aggregate agent statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getAgentStats();
    res.json(stats);
  } catch (err) {
    console.error('[Agents] Stats error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

const RESERVED_NAMES = ['sync', 'import', 'ai-generate', 'categories', 'stats', 'bulk'];

// POST /api/agents — create agent manually
router.post('/', validate(createAgentSchema), async (req, res) => {
  try {
    const { name, description, model, category, prompt, tools, max_turns, memory, permission_mode } = req.body;
    if (RESERVED_NAMES.includes(name)) {
      return res.status(400).json({ error: `Name "${name}" is reserved` });
    }
    const existing = await db.getAgent(name);
    if (existing) return res.status(409).json({ error: 'Agent already exists' });

    // Build YAML front matter
    const fmParts = [];
    if (description) fmParts.push(`description: "${description.replace(/"/g, '\\"')}"`);
    if (model) fmParts.push(`model: ${model}`);
    if (tools) fmParts.push(`tools: [${tools}]`);
    if (max_turns) fmParts.push(`max_turns: ${max_turns}`);
    if (memory) fmParts.push(`memory: "${memory.replace(/"/g, '\\"')}"`);
    if (permission_mode) fmParts.push(`permission_mode: ${permission_mode}`);
    const frontMatter = fmParts.length > 0 ? `---\n${fmParts.join('\n')}\n---\n\n` : '';
    const fullContent = frontMatter + (prompt || '');

    // Write .md file
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${name}.md`), fullContent, 'utf-8');

    // Insert in DB
    const promptPreview = fullContent.substring(0, 500);
    await db.createAgentManual(name, description || '', model || '', category || 'uncategorized', promptPreview, fullContent, tools || '', max_turns || 0, memory || '', permission_mode || '', req.user?.userId);

    const created = await db.getAgent(name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/export — export agent as .md file content
router.get('/:name/export', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const content = agent.full_prompt || '';
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${agent.name}.md"`);
    res.send(content);
  } catch (err) {
    console.error('[Agents] Export error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name — get single agent (enriched)
router.get('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    agent.project_count = await db.getAgentProjectCount(req.params.name);
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/projects — projects using this agent
router.get('/:name/projects', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const projects = await db.getProjectsByAgent(req.params.name);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/versions — list all versions for an agent
router.get('/:name/versions', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    const versions = await db.getAgentVersions(req.params.name);
    res.json(versions);
  } catch (err) {
    console.error('[Agents] Versions list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/agents/:name/versions/:versionId — get specific version
router.get('/:name/versions/:versionId', async (req, res) => {
  try {
    const version = await db.getAgentVersion(req.params.versionId);
    if (!version || version.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Version not found' });
    }
    res.json(version);
  } catch (err) {
    console.error('[Agents] Version get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/versions/:versionId/revert — revert agent to this version
router.post('/:name/versions/:versionId/revert', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const version = await db.getAgentVersion(req.params.versionId);
    if (!version || version.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // Snapshot current state before reverting
    const nextVersion = await db.getNextAgentVersionNumber(req.params.name);
    await db.createAgentVersion(
      crypto.randomUUID(),
      agent.name,
      nextVersion,
      agent.full_prompt || '',
      agent.description || '',
      agent.model || '',
      agent.tools || '',
      agent.max_turns || 0,
      agent.memory || '',
      agent.permission_mode || '',
      `Reverted to version ${version.version_number}`
    );

    // Apply the version's state to the agent
    const fields = {
      full_prompt: version.full_prompt,
      prompt_preview: (version.full_prompt || '').substring(0, 500),
      description: version.description,
      model: version.model,
      tools: version.tools,
      max_turns: version.max_turns,
      memory: version.memory,
      permission_mode: version.permission_mode,
    };
    await db.updateAgent(req.params.name, fields);

    // Write reverted content to .md file on disk
    const AGENTS_DIR_LOCAL = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : SYSTEM_AGENTS_DIR;
    if (!fs.existsSync(AGENTS_DIR_LOCAL)) fs.mkdirSync(AGENTS_DIR_LOCAL, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR_LOCAL, `${req.params.name}.md`), version.full_prompt || '', 'utf-8');

    res.json(await db.getAgent(req.params.name));
  } catch (err) {
    console.error('[Agents] Revert error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agents/:name — update agent fields
router.put('/:name', validate(updateAgentSchema), async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Ownership checks
    if (agent.source === 'filesystem') return res.status(403).json({ error: 'Platform agents are read-only' });
    if (agent.created_by && agent.created_by !== req.user.userId)
      return res.status(403).json({ error: 'Only the creator can edit this agent' });

    // Auto-version: snapshot current state before applying update
    const versionNumber = await db.getNextAgentVersionNumber(req.params.name);
    const changeSummary = req.body.change_summary || '';
    await db.createAgentVersion(
      crypto.randomUUID(),
      agent.name,
      versionNumber,
      agent.full_prompt || '',
      agent.description || '',
      agent.model || '',
      agent.tools || '',
      agent.max_turns || 0,
      agent.memory || '',
      agent.permission_mode || '',
      changeSummary
    );

    const { description, model, category, full_prompt, tools, max_turns, memory, permission_mode } = req.body;
    const fields = { description, model, category, tools, max_turns, memory, permission_mode };

    // If full_prompt is updated, also update prompt_preview and write .md file
    if (full_prompt !== undefined) {
      fields.full_prompt = full_prompt;
      fields.prompt_preview = full_prompt.substring(0, 500);

      // Write updated content to .md file on disk
      if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
      fs.writeFileSync(path.join(AGENTS_DIR, `${req.params.name}.md`), full_prompt, 'utf-8');
    }

    await db.updateAgent(req.params.name, fields);
    res.json(await db.getAgent(req.params.name));
  } catch (err) {
    console.error('[Agents] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/:name/rating — update rating
router.patch('/:name/rating', async (req, res) => {
  try {
    const { rating } = req.body;
    await db.updateAgentRating(req.params.name, rating);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/agents/:name/screenshot — update agent screenshot
router.patch('/:name/screenshot', async (req, res) => {
  try {
    const { screenshot_path } = req.body;
    if (!screenshot_path) return res.status(400).json({ error: 'screenshot_path required' });
    await db.updateAgentScreenshot(req.params.name, screenshot_path);
    res.json({ ok: true, screenshot_path });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/duplicate — duplicate an agent
router.post('/:name/duplicate', validate(duplicateAgentSchema), async (req, res) => {
  try {
    const source = await db.getAgent(req.params.name);
    if (!source) return res.status(404).json({ error: 'Source agent not found' });

    const { new_name } = req.body;
    const existing = await db.getAgent(new_name);
    if (existing) return res.status(409).json({ error: 'Agent with that name already exists' });

    // Copy all fields to new agent
    const fullPrompt = source.full_prompt || '';
    const promptPreview = fullPrompt.substring(0, 500);
    await db.createAgentManual(
      new_name,
      source.description || '',
      source.model || '',
      source.category || 'uncategorized',
      promptPreview,
      fullPrompt,
      source.tools || '',
      source.max_turns || 0,
      source.memory || '',
      source.permission_mode || '',
      req.user?.userId
    );

    // Write .md file to disk
    if (!fs.existsSync(AGENTS_DIR)) fs.mkdirSync(AGENTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(AGENTS_DIR, `${new_name}.md`), fullPrompt, 'utf-8');

    const created = await db.getAgent(new_name);
    res.status(201).json(created);
  } catch (err) {
    console.error('[Agents] Duplicate error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agents/:name — delete agent
router.delete('/:name', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // Ownership checks
    if (agent.source === 'filesystem') return res.status(403).json({ error: 'Platform agents cannot be deleted' });
    if (agent.created_by && agent.created_by !== req.user.userId)
      return res.status(403).json({ error: 'Only the creator can delete this agent' });

    await db.deleteAgent(req.params.name);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Agents] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== MCP AGENT TOOLS — Per-agent specialized tool definitions ====================

// GET /api/agents/:name/mcp-tools — list all MCP tools for an agent
router.get('/:name/mcp-tools', async (req, res) => {
  try {
    const tools = await db.getMcpAgentTools(req.params.name);
    res.json(tools);
  } catch (err) {
    console.error('[MCP Tools] List error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/mcp-tools — create a new MCP tool
router.post('/:name/mcp-tools', async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { tool_name, description, input_schema, context_template, output_instructions, pre_processors, sort_order } = req.body;
    if (!tool_name || !description) {
      return res.status(400).json({ error: 'tool_name and description are required' });
    }

    const tool = await db.createMcpAgentTool(req.params.name, {
      tool_name,
      description,
      input_schema: input_schema || { type: 'object', properties: {} },
      context_template: context_template || null,
      output_instructions: output_instructions || null,
      pre_processors: pre_processors || [],
      sort_order: sort_order || 0,
    });
    res.status(201).json(tool);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: `Tool "${req.body.tool_name}" already exists for this agent` });
    }
    console.error('[MCP Tools] Create error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/agents/:name/mcp-tools/:toolId — update a MCP tool
router.put('/:name/mcp-tools/:toolId', async (req, res) => {
  try {
    const existing = await db.getMcpAgentTool(req.params.toolId);
    if (!existing || existing.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    await db.updateMcpAgentTool(req.params.toolId, req.body);
    const updated = await db.getMcpAgentTool(req.params.toolId);
    res.json(updated);
  } catch (err) {
    console.error('[MCP Tools] Update error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/agents/:name/mcp-tools/:toolId — delete a MCP tool
router.delete('/:name/mcp-tools/:toolId', async (req, res) => {
  try {
    const existing = await db.getMcpAgentTool(req.params.toolId);
    if (!existing || existing.agent_name !== req.params.name) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    await db.deleteMcpAgentTool(req.params.toolId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[MCP Tools] Delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/agents/:name/mcp-tools/reorder — reorder MCP tools
router.post('/:name/mcp-tools/reorder', async (req, res) => {
  try {
    const { toolIds } = req.body;
    if (!Array.isArray(toolIds)) return res.status(400).json({ error: 'toolIds array required' });

    await db.reorderMcpAgentTools(req.params.name, toolIds);
    res.json({ ok: true });
  } catch (err) {
    console.error('[MCP Tools] Reorder error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== GENERATE MCP TOOLS FROM AI ====================

router.post('/:name/mcp-tools/generate', heavyLimiter, async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    // 1. Build full agent context: prompt + skills + knowledge
    let agentContext = '';

    // Agent prompt
    agentContext += `# Agent: ${agent.name}\n`;
    agentContext += `Description: ${agent.description || 'N/A'}\n`;
    agentContext += `Category: ${agent.category || 'N/A'}\n\n`;
    agentContext += `## Full Agent Prompt\n${agent.full_prompt || agent.prompt_preview || '[No prompt]'}\n\n`;

    // Skills (deep — including file content)
    try {
      const skills = await db.getAgentSkills(req.params.name);
      if (skills && skills.length > 0) {
        const skillStorage = require('../skill-storage');
        agentContext += '## Assigned Skills\n\n';
        for (const skill of skills) {
          agentContext += `### ${skill.name}\n`;
          if (skill.description) agentContext += `${skill.description}\n\n`;
          try {
            const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
            if (entryFile && entryFile.content) {
              agentContext += entryFile.content.slice(0, 8000) + '\n\n';
            } else if (skill.prompt) {
              agentContext += skill.prompt.slice(0, 8000) + '\n\n';
            }
          } catch (_) {
            if (skill.prompt) agentContext += skill.prompt.slice(0, 8000) + '\n\n';
          }
          // Reference files
          try {
            const tree = skillStorage.scanSkillTree(skill.slug);
            if (tree) {
              const refFiles = [];
              const walkTree = (items) => {
                for (const item of items) {
                  if (item.type === 'file' && item.path !== 'SKILL.md' && item.path !== (skill.entry_point || 'SKILL.md') && refFiles.length < 4) {
                    refFiles.push(item.path);
                  }
                  if (item.children) walkTree(item.children);
                }
              };
              walkTree(tree);
              for (const refPath of refFiles) {
                const refFile = skillStorage.readSkillFile(skill.slug, refPath);
                if (refFile && refFile.content) {
                  agentContext += `#### ${refPath}\n${refFile.content.slice(0, 4000)}\n\n`;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[MCP Generate] Failed to load skills:', err.message);
    }

    // Knowledge bases
    try {
      const { getKnowledgeContext } = require('../workspace');
      const kbContext = await getKnowledgeContext(req.params.name);
      if (kbContext) agentContext += kbContext;
    } catch (err) {
      console.warn('[MCP Generate] Failed to load knowledge:', err.message);
    }

    // 2. Truncate context to stay within token limits (~40K chars max)
    const MAX_CONTEXT = 40000;
    if (agentContext.length > MAX_CONTEXT) {
      console.log(`[MCP Generate] Truncating context from ${agentContext.length} to ${MAX_CONTEXT} chars`);
      agentContext = agentContext.slice(0, MAX_CONTEXT) + '\n\n[... context truncated for token limit ...]';
    }

    // 3. Call AI to generate tool definitions
    const { callGPT5 } = require('../lib/agent-analysis');

    const systemPrompt = `You are an MCP tool architect. You design specialized tools for AI agents exposed via the Model Context Protocol (MCP).

Given an agent's full context (prompt, skills, knowledge), you must create a set of specialized MCP tools that:
1. Replace the generic "chat" tool with purpose-built operations
2. Have structured input parameters (JSON Schema) that force callers to provide proper context
3. Include context_template strings that inject the agent's deep knowledge into every call
4. Include pre_processors that give tools REAL capabilities (fetching URLs, analyzing HTML, scoring)
5. Cover ALL the agent's capabilities — every skill should map to 1+ tools

## SYSTEM TOOLS (ALREADY EXIST — DO NOT RECREATE)
The following tools are automatically available to every agent. Do NOT generate tools that duplicate them:
- "fetch_web" — fetches a URL and returns full SEO analysis (score, title, meta, headings, schema, OG, images, links). Returns structured JSON, no LLM.
- "fetch_sitemap" — fetches and parses sitemap.xml, discovers all indexed pages. Returns structured JSON, no LLM.
- "fetch_multi_urls" — fetches up to 10 URLs in parallel with per-page SEO scores and comparative summary. Returns structured JSON, no LLM.

Your generated tools should COMPLEMENT these system tools by providing EXPERT ANALYSIS on top of the raw data.
For example: the caller can use fetch_web first to get raw data, then pass it to your specialized tools for deep expert analysis.
Your tools with a URL parameter should STILL use pre_processors — so they work standalone too, without needing fetch_web first.

## PRE-PROCESSORS (gives tools real capabilities)
Pre-processors run server-side BEFORE the LLM call. They fetch real data and inject it into context.
Available processors:
- {"type": "fetch_url", "param": "url"} — fetches a URL, stores HTML. The "param" is the input_schema param name containing the URL.
- {"type": "html_analysis"} — extracts SEO data (title, meta, headings, schema, OG, images, links, word count) from fetched HTML. Writes {{__html_analysis__}}
- {"type": "seo_score"} — scores the page 0-100 with real breakdown. Requires html_analysis first. Writes {{__seo_score__}}
- {"type": "check_existing"} — checks what SEO elements exist vs missing. Requires html_analysis. Writes {{__existing_elements__}}
- {"type": "extract_text"} — extracts visible page text for content analysis. Writes {{__page_text__}}
- {"type": "crawl_sitemap", "param": "url"} — fetches sitemap.xml and extracts all URLs. Writes {{__sitemap_summary__}}
- {"type": "fetch_multi", "param": "urls"} — fetches multiple URLs in parallel with analysis. Writes {{__multi_summary__}}

Chain them: ["fetch_url", "html_analysis", "seo_score", "check_existing"] = full pipeline.
Use pre_processors for ANY tool that takes a URL parameter.

## context_template RULES
- Injected into the LLM system prompt ALONGSIDE the agent's base prompt
- MUST contain relevant skill/knowledge content INLINED — not references
- Use {{param}} for caller-provided values, {{#if param}}...{{/if}} for optionals
- Use {{__html_analysis__}}, {{__seo_score__}}, {{__existing_elements__}}, {{__page_text__}}, {{__sitemap_summary__}}, {{__multi_summary__}} for processor output
- The goal: LLM has ALL context (skills + real page data) to produce expert output

## TOOL NAMING
- snake_case only (e.g. audit_site, generate_schema)
- Clear, action-oriented names

## OUTPUT FORMAT
Return a JSON object: {"tools": [tool1, tool2, ...]}
Each tool:
{
  "tool_name": "snake_case_name",
  "description": "What this tool does (max 200 chars)",
  "input_schema": { "type": "object", "properties": { ... }, "required": [...] },
  "pre_processors": [{"type": "fetch_url", "param": "url"}, {"type": "html_analysis"}, ...],
  "context_template": "Template with {{params}} and {{__processor_output__}} and inlined knowledge",
  "output_instructions": "How the output should be formatted"
}

Generate 5-12 tools. Include "chat" as last for freeform queries. Tools with URL params MUST use pre_processors.`;

    const userMessage = `Here is the full agent context. Analyze it and generate specialized MCP tools.\n\n${agentContext}`;

    console.log(`[MCP Generate] Generating tools for ${req.params.name} (context: ${agentContext.length} chars)`);

    let response;
    try {
      response = await callGPT5([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], { max_completion_tokens: 16000, responseFormat: 'json' });
    } catch (llmErr) {
      console.error(`[MCP Generate] LLM call failed:`, llmErr.message);
      return res.status(502).json({ error: `LLM call failed: ${llmErr.message}` });
    }

    if (!response || response.length < 10) {
      console.error(`[MCP Generate] Empty LLM response`);
      return res.status(502).json({ error: 'LLM returned empty response' });
    }

    console.log(`[MCP Generate] Got LLM response (${response.length} chars)`);

    // 4. Parse the response
    let generatedTools;
    try {
      const parsed = JSON.parse(response);
      generatedTools = Array.isArray(parsed) ? parsed : (parsed.tools || Object.values(parsed).find(v => Array.isArray(v)) || []);
    } catch (e) {
      // Try to extract JSON array from response
      const match = response.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          generatedTools = JSON.parse(match[0]);
        } catch (e2) {
          console.error(`[MCP Generate] JSON extraction failed:`, e2.message, 'Raw:', response.slice(0, 500));
          return res.status(500).json({ error: 'AI returned unparseable JSON', raw: response.slice(0, 1000) });
        }
      } else {
        console.error(`[MCP Generate] No JSON array in response. Raw:`, response.slice(0, 500));
        return res.status(500).json({ error: 'AI returned invalid format', raw: response.slice(0, 1000) });
      }
    }

    if (!Array.isArray(generatedTools) || generatedTools.length === 0) {
      console.error(`[MCP Generate] No tools in parsed response`);
      return res.status(500).json({ error: 'AI generated no tools', raw: response.slice(0, 1000) });
    }

    console.log(`[MCP Generate] Parsed ${generatedTools.length} tools, saving to DB...`);

    // 4. Delete existing tools and save new ones
    const existingTools = await db.getMcpAgentTools(req.params.name);
    for (const existing of existingTools) {
      await db.deleteMcpAgentTool(existing.id);
    }

    const savedTools = [];
    for (let i = 0; i < generatedTools.length; i++) {
      const t = generatedTools[i];
      if (!t.tool_name || !t.description) continue;

      const saved = await db.createMcpAgentTool(req.params.name, {
        tool_name: t.tool_name.replace(/[^a-z0-9_]/g, ''),
        description: t.description.slice(0, 500),
        input_schema: t.input_schema || { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
        context_template: t.context_template || null,
        output_instructions: t.output_instructions || null,
        pre_processors: t.pre_processors || [],
        sort_order: t.tool_name === 'chat' ? 99 : i,
      });
      savedTools.push(saved);
    }

    console.log(`[MCP Generate] Created ${savedTools.length} tools for ${req.params.name}`);

    res.json({
      tools: savedTools,
      context_size: agentContext.length,
      generated_count: generatedTools.length,
      saved_count: savedTools.length,
    });
  } catch (err) {
    console.error('[MCP Generate] Error:', err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(500).json({ error: err.message || 'Generation failed' });
  }
});

// ==================== TEST CHAT — Simulate MCP chat with full agent context ====================

router.post('/:name/test-chat', heavyLimiter, validate(chatMessageSchema), async (req, res) => {
  try {
    const agent = await db.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const { messages } = req.body;

    // Build rich system prompt: agent prompt + all skills with file content
    let systemPrompt = agent.full_prompt || agent.prompt_preview || '';

    // Inject assigned skills (deep — including skill file content from disk)
    try {
      const skills = await db.getAgentSkills(req.params.name);
      if (skills && skills.length > 0) {
        const skillStorage = require('../skill-storage');
        systemPrompt += '\n\n## Assigned Skills\n\n';
        systemPrompt += 'The following skills are loaded. Use them as reference and follow their patterns:\n\n';
        for (const skill of skills) {
          systemPrompt += `### ${skill.name}\n`;
          if (skill.description) systemPrompt += `${skill.description}\n\n`;
          // Try to read SKILL.md from disk for richer context
          try {
            const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
            if (entryFile && entryFile.content) {
              systemPrompt += entryFile.content.slice(0, 6000) + '\n\n';
            } else if (skill.prompt) {
              systemPrompt += skill.prompt.slice(0, 6000) + '\n\n';
            }
          } catch (_) {
            if (skill.prompt) systemPrompt += skill.prompt.slice(0, 6000) + '\n\n';
          }
          // Also read reference files for deeper knowledge
          try {
            const tree = skillStorage.scanSkillTree(skill.slug);
            if (tree) {
              const refFiles = [];
              const walkTree = (items) => {
                for (const item of items) {
                  if (item.type === 'file' && item.path !== 'SKILL.md' && item.path !== (skill.entry_point || 'SKILL.md') && refFiles.length < 4) {
                    refFiles.push(item.path);
                  }
                  if (item.children) walkTree(item.children);
                }
              };
              walkTree(tree);
              for (const refPath of refFiles) {
                const refFile = skillStorage.readSkillFile(skill.slug, refPath);
                if (refFile && refFile.content) {
                  systemPrompt += `#### ${refPath}\n${refFile.content.slice(0, 3000)}\n\n`;
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn('[TestChat] Failed to load skills for', req.params.name, err.message);
    }

    // Call GPT
    const { callGPT5 } = require('../lib/agent-analysis');
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const response = await callGPT5(fullMessages, { max_completion_tokens: 8000 });

    res.json({
      role: 'assistant',
      content: response,
      context: {
        systemPromptLength: systemPrompt.length,
        systemPromptTokens: Math.round(systemPrompt.length / 4),
      },
    });
  } catch (err) {
    console.error('[TestChat] Error:', err.message);
    res.status(500).json({ error: err.message || 'Chat failed' });
  }
});

// Auto-sync on first load
let synced = false;
function ensureSynced() {
  if (!synced) {
    syncAgents().catch(err => console.error('[Agents] Auto-sync error:', err.message));
    synced = true;
  }
}

module.exports = router;
module.exports.syncAgents = syncAgents;
module.exports.ensureSynced = ensureSynced;
module.exports.syncCustomAgentsFromDB = syncCustomAgentsFromDB;
