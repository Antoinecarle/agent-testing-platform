const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const { callGPT5 } = require('../lib/agent-analysis');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');
const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');

// Multer stores in memory for Supabase upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ── Skill templates per role ────────────────────────────────────────────────
const ROLE_SKILLS = {
  'product-manager': [
    { name: 'User Research', category: 'research', color: '#8B5CF6', description: 'Conduct user interviews, surveys, and usability tests' },
    { name: 'Roadmapping', category: 'planning', color: '#3B82F6', description: 'Create and maintain product roadmaps with prioritization' },
    { name: 'Lean Startup', category: 'methodology', color: '#22C55E', description: 'Build-Measure-Learn cycles, MVPs, and validated learning' },
    { name: 'Stakeholder Management', category: 'communication', color: '#F59E0B', description: 'Align stakeholders, manage expectations, present decisions' },
    { name: 'Data Analysis', category: 'analytics', color: '#EC4899', description: 'Interpret metrics, A/B tests, and KPIs to drive decisions' },
    { name: 'Sprint Planning', category: 'agile', color: '#06B6D4', description: 'Plan sprints, write user stories, and manage backlogs' },
    { name: 'Competitive Analysis', category: 'research', color: '#8B5CF6', description: 'Analyze competitors, market positioning, and differentiation' },
    { name: 'PRD Writing', category: 'documentation', color: '#A855F7', description: 'Write detailed Product Requirements Documents' },
  ],
  'developer': [
    { name: 'Code Review', category: 'quality', color: '#8B5CF6', description: 'Review code for quality, security, and best practices' },
    { name: 'Architecture Design', category: 'engineering', color: '#3B82F6', description: 'Design system architecture, APIs, and data models' },
    { name: 'Testing', category: 'quality', color: '#22C55E', description: 'Write unit, integration, and end-to-end tests' },
    { name: 'CI/CD', category: 'devops', color: '#F59E0B', description: 'Set up continuous integration and deployment pipelines' },
    { name: 'Debugging', category: 'engineering', color: '#EF4444', description: 'Systematic debugging and root cause analysis' },
    { name: 'Performance Optimization', category: 'engineering', color: '#EC4899', description: 'Profile and optimize code, queries, and infrastructure' },
    { name: 'Documentation', category: 'documentation', color: '#06B6D4', description: 'Write technical docs, API docs, and README files' },
    { name: 'Refactoring', category: 'engineering', color: '#A855F7', description: 'Improve code structure without changing behavior' },
  ],
  'designer': [
    { name: 'UI Design', category: 'design', color: '#8B5CF6', description: 'Create beautiful, consistent user interfaces' },
    { name: 'UX Research', category: 'research', color: '#3B82F6', description: 'User testing, personas, journey maps, and wireframes' },
    { name: 'Design System', category: 'design', color: '#22C55E', description: 'Build and maintain component libraries and tokens' },
    { name: 'Prototyping', category: 'design', color: '#F59E0B', description: 'Create interactive prototypes for validation' },
    { name: 'Accessibility', category: 'quality', color: '#EC4899', description: 'Ensure WCAG compliance and inclusive design' },
    { name: 'Motion Design', category: 'design', color: '#06B6D4', description: 'Create animations, transitions, and micro-interactions' },
    { name: 'Responsive Design', category: 'design', color: '#A855F7', description: 'Design for mobile, tablet, and desktop breakpoints' },
    { name: 'Brand Identity', category: 'design', color: '#EF4444', description: 'Define visual identity, logos, and brand guidelines' },
  ],
  'marketing': [
    { name: 'Content Strategy', category: 'content', color: '#8B5CF6', description: 'Plan content calendars, topic clusters, and distribution' },
    { name: 'SEO', category: 'growth', color: '#3B82F6', description: 'On-page, technical, and off-page search optimization' },
    { name: 'Copywriting', category: 'content', color: '#22C55E', description: 'Write compelling headlines, CTAs, and marketing copy' },
    { name: 'Analytics', category: 'analytics', color: '#F59E0B', description: 'Track campaigns, funnels, and attribution' },
    { name: 'Social Media', category: 'growth', color: '#EC4899', description: 'Manage social presence, engagement, and campaigns' },
    { name: 'Email Marketing', category: 'growth', color: '#06B6D4', description: 'Design sequences, newsletters, and automation' },
    { name: 'Growth Hacking', category: 'growth', color: '#A855F7', description: 'Experiment-driven growth with rapid iteration' },
    { name: 'Brand Strategy', category: 'strategy', color: '#EF4444', description: 'Position brand, define voice, and build awareness' },
  ],
  'writer': [
    { name: 'Technical Writing', category: 'content', color: '#8B5CF6', description: 'Write clear docs, guides, and API references' },
    { name: 'Blog Writing', category: 'content', color: '#3B82F6', description: 'Create engaging long-form articles and tutorials' },
    { name: 'UX Writing', category: 'content', color: '#22C55E', description: 'Microcopy, error messages, and interface text' },
    { name: 'Editing', category: 'quality', color: '#F59E0B', description: 'Proofread, restructure, and improve clarity' },
    { name: 'Research', category: 'research', color: '#EC4899', description: 'Deep research on topics for accurate content' },
    { name: 'Storytelling', category: 'content', color: '#06B6D4', description: 'Craft narratives that engage and persuade' },
    { name: 'SEO Writing', category: 'growth', color: '#A855F7', description: 'Write content optimized for search engines' },
    { name: 'Localization', category: 'content', color: '#EF4444', description: 'Adapt content for different markets and languages' },
  ],
  'analyst': [
    { name: 'Data Visualization', category: 'analytics', color: '#8B5CF6', description: 'Create charts, dashboards, and data stories' },
    { name: 'SQL Mastery', category: 'engineering', color: '#3B82F6', description: 'Write complex queries, optimize performance' },
    { name: 'Statistical Analysis', category: 'analytics', color: '#22C55E', description: 'Hypothesis testing, regression, and correlation' },
    { name: 'Business Intelligence', category: 'strategy', color: '#F59E0B', description: 'Transform data into actionable business insights' },
    { name: 'Forecasting', category: 'analytics', color: '#EC4899', description: 'Predict trends, demand, and revenue' },
    { name: 'Report Writing', category: 'documentation', color: '#06B6D4', description: 'Create clear, actionable analysis reports' },
    { name: 'Python/R', category: 'engineering', color: '#A855F7', description: 'Data manipulation with pandas, numpy, tidyverse' },
    { name: 'A/B Testing', category: 'analytics', color: '#EF4444', description: 'Design and analyze experiments' },
  ],
  'devops': [
    { name: 'Infrastructure as Code', category: 'devops', color: '#8B5CF6', description: 'Terraform, Pulumi, CloudFormation' },
    { name: 'Container Orchestration', category: 'devops', color: '#3B82F6', description: 'Docker, Kubernetes, and container management' },
    { name: 'Monitoring', category: 'devops', color: '#22C55E', description: 'Set up observability, alerting, and incident response' },
    { name: 'CI/CD Pipelines', category: 'devops', color: '#F59E0B', description: 'Build, test, and deploy automation' },
    { name: 'Security', category: 'security', color: '#EF4444', description: 'Hardening, secrets management, vulnerability scanning' },
    { name: 'Cloud Architecture', category: 'engineering', color: '#EC4899', description: 'AWS, GCP, Azure infrastructure design' },
    { name: 'Scripting', category: 'engineering', color: '#06B6D4', description: 'Bash, Python automation scripts' },
    { name: 'Database Admin', category: 'engineering', color: '#A855F7', description: 'Backup, replication, and performance tuning' },
  ],
};

const COMM_STYLES = {
  'formal': 'Uses professional, structured language. Prefers clear headers, numbered lists, and precise terminology.',
  'casual': 'Uses friendly, approachable language. Conversational tone with analogies and examples.',
  'technical': 'Uses domain-specific jargon freely. Code-heavy responses with minimal fluff.',
  'empathetic': "Focuses on understanding the user's perspective. Asks clarifying questions and validates concerns.",
  'direct': 'Straight to the point. Minimal preamble, actionable outputs, no unnecessary context.',
};

const METHODOLOGIES = {
  'agile': 'Works in sprints with iterative delivery. Focuses on user stories, standups, and retrospectives.',
  'lean': 'Eliminates waste, validates assumptions quickly. Build-Measure-Learn loops.',
  'design-thinking': 'Empathize, Define, Ideate, Prototype, Test. Human-centered problem solving.',
  'waterfall': 'Sequential phases with clear milestones. Requirements, Design, Implementation, Verification.',
  'kanban': 'Continuous flow with WIP limits. Visual board, pull-based work.',
};

// Available tools for agents
const AVAILABLE_TOOLS = [
  { id: 'Read', label: 'Read', description: 'Read files from the filesystem', category: 'files' },
  { id: 'Write', label: 'Write', description: 'Write/create files', category: 'files' },
  { id: 'Edit', label: 'Edit', description: 'Edit existing files with precision', category: 'files' },
  { id: 'Bash', label: 'Bash', description: 'Execute shell commands', category: 'system' },
  { id: 'Glob', label: 'Glob', description: 'Find files by pattern', category: 'search' },
  { id: 'Grep', label: 'Grep', description: 'Search file contents', category: 'search' },
  { id: 'WebFetch', label: 'WebFetch', description: 'Fetch and analyze web pages', category: 'web' },
  { id: 'WebSearch', label: 'WebSearch', description: 'Search the web for information', category: 'web' },
  { id: 'Task', label: 'Task', description: 'Spawn sub-agents for parallel work', category: 'agents' },
  { id: 'NotebookEdit', label: 'Notebook', description: 'Edit Jupyter notebooks', category: 'files' },
];

// ── LinkedIn Profile Analysis ───────────────────────────────────────────────
async function analyzeLinkedInWithGPT(pageData, url) {
  const context = [
    `LinkedIn URL: ${url}`,
    pageData.username ? `Username/slug: ${pageData.username}` : '',
    pageData.title ? `Page title: ${pageData.title}` : '',
    pageData.description ? `Page description: ${pageData.description}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `Analyze this LinkedIn profile data and suggest an AI agent configuration.

${context}

Based on this information, suggest:
1. A display name for the agent (the person's first name or common name)
2. The best role as a kebab-case slug (e.g. "product-manager", "data-scientist", "frontend-developer", "growth-hacker", "ux-researcher", "cto", "sales-engineer"). Be specific and creative — do NOT limit to a predefined list.
3. 10-12 specific professional skills with categories and colors
4. Communication style from: formal, casual, technical, empathetic, direct
5. Work methodology from: agile, lean, design-thinking, waterfall, kanban
6. Suggested tools from: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task, NotebookEdit

Each skill must use a unique color from: #8B5CF6, #3B82F6, #22C55E, #F59E0B, #EC4899, #06B6D4, #A855F7, #EF4444, #14B8A6, #F97316, #6366F1, #84CC16

Return ONLY valid JSON:
{
  "displayName": "Suggested Name",
  "role": "role-id",
  "skills": [{ "name": "Skill Name", "category": "category-slug", "color": "#hex", "description": "Description" }],
  "commStyle": "style-id",
  "methodology": "methodology-id",
  "tools": ["Tool1", "Tool2"],
  "summary": "Brief summary of the person's profile in French"
}`;

  try {
    const response = await callGPT5(
      [
        { role: 'system', content: 'You analyze LinkedIn profiles and suggest AI agent configurations. Return ONLY valid JSON. Always suggest 10-12 diverse, specific skills.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 4000, responseFormat: 'json' }
    );
    return JSON.parse(response);
  } catch (err) {
    console.error('[Personaboarding] GPT LinkedIn analysis error:', err.message);
    const nameFromSlug = pageData.username
      ? pageData.username.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'Agent';
    return {
      displayName: nameFromSlug,
      role: 'developer',
      skills: [],
      commStyle: 'direct',
      methodology: 'agile',
      tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      summary: `Agent basé sur le profil de ${nameFromSlug}`,
    };
  }
}

// ── Fetch LinkedIn page with multiple strategies ────────────────────────────
async function fetchLinkedInPage(url, username) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
  };

  // Strategy 1: Direct fetch with Googlebot UA (LinkedIn sometimes allows it)
  const strategies = [
    { name: 'googlebot', url, headers },
    { name: 'linkedin-voyager', url, headers: { ...headers, 'User-Agent': 'LinkedInBot/1.0 (compatible; Mozilla/5.0; +https://www.linkedin.com)' } },
    { name: 'google-cache', url: `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`, headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } },
  ];

  for (const strat of strategies) {
    try {
      console.log(`[Personaboarding] Trying ${strat.name} for ${username}...`);
      const response = await fetch(strat.url, {
        headers: strat.headers,
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      if (response.ok || response.status === 200) {
        const html = await response.text();
        // Check if we got real content (not auth wall)
        if (html.length > 5000 && !html.includes('authwall') && !html.includes('Join LinkedIn')) {
          console.log(`[Personaboarding] ${strat.name} succeeded (${html.length} bytes)`);
          return html;
        }
        // Even auth wall HTML might contain og:image in meta tags
        const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogImg) {
          console.log(`[Personaboarding] ${strat.name} got og:image from partial HTML`);
          return html;
        }
      }
    } catch (err) {
      console.warn(`[Personaboarding] ${strat.name} failed:`, err.message);
    }
  }

  return null;
}

// POST /api/personaboarding/upload-profile-pic
router.post('/upload-profile-pic', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const ext = path.extname(req.file.originalname) || '.jpg';
    const filename = `profile-${Date.now()}${ext}`;
    const publicUrl = await db.uploadProfilePic(req.file.buffer, filename, req.file.mimetype);
    console.log(`[Personaboarding] Profile pic uploaded to Supabase: ${publicUrl} (${req.file.size} bytes)`);
    res.json({ profileImageUrl: publicUrl });
  } catch (err) {
    console.error('[Personaboarding] Profile pic upload error:', err.message);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// POST /api/personaboarding/linkedin-analyze
router.post('/linkedin-analyze', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || !url.includes('linkedin.com/in/')) {
      return res.status(400).json({ error: 'URL LinkedIn invalide. Format: https://linkedin.com/in/username' });
    }

    const match = url.match(/linkedin\.com\/in\/([^/?#]+)/);
    const username = match ? match[1] : null;
    let pageData = { username };
    let ogImage = null;

    // Try multiple strategies to fetch LinkedIn page
    const html = await fetchLinkedInPage(url, username);
    if (html) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
      const ogDescMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
      pageData.title = ogTitleMatch?.[1] || titleMatch?.[1] || '';
      pageData.description = ogDescMatch?.[1] || descMatch?.[1] || '';
      ogImage = ogImageMatch?.[1] || null;
    }

    // Download og:image if found — upload to Supabase Storage
    let profileImageUrl = null;
    if (ogImage) {
      try {
        const imgRes = await fetch(ogImage, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(15000),
          redirect: 'follow',
        });
        if (imgRes.ok) {
          const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          const ext = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg';
          const filename = `linkedin-${username || Date.now()}${ext}`;
          const imageBuffer = Buffer.from(await imgRes.arrayBuffer());
          profileImageUrl = await db.uploadProfilePic(imageBuffer, filename, contentType);
          console.log(`[Personaboarding] Downloaded LinkedIn og:image to Supabase: ${profileImageUrl} (${imageBuffer.length} bytes)`);
        }
      } catch (imgErr) {
        console.warn(`[Personaboarding] Failed to download LinkedIn og:image:`, imgErr.message);
      }
    }

    const suggestions = await analyzeLinkedInWithGPT(pageData, url);

    // If og:image was found, attach it (user can also upload manually via upload-profile-pic endpoint)
    if (profileImageUrl) {
      suggestions.profileImageUrl = profileImageUrl;
    }
    res.json({ suggestions, rawData: pageData });
  } catch (err) {
    console.error('[Personaboarding] LinkedIn analyze error:', err.message);
    res.status(500).json({ error: "Erreur lors de l'analyse du profil LinkedIn" });
  }
});

// POST /api/personaboarding/ai-suggest-skills
router.post('/ai-suggest-skills', async (req, res) => {
  try {
    const { role, context: ctx, linkedinData } = req.body;
    if (!role) return res.status(400).json({ error: 'Role is required' });

    let contextInfo = `Role: ${role.replace(/-/g, ' ')}`;
    if (ctx) contextInfo += `\nContext: ${ctx}`;
    if (linkedinData?.summary) contextInfo += `\nProfile: ${linkedinData.summary}`;
    if (linkedinData?.displayName) contextInfo += `\nPerson: ${linkedinData.displayName}`;
    if (linkedinData?.skills?.length > 0) {
      contextInfo += `\nLinkedIn skills: ${linkedinData.skills.map(s => s.name).join(', ')}`;
    }

    const prompt = `Generate 10-14 specific professional skills for a ${role.replace(/-/g, ' ')} AI agent.

${contextInfo}

Requirements:
- Each skill must be concrete and actionable (not vague)
- Mix of technical and soft skills relevant to this role
- Categories as lowercase slugs (engineering, research, design, analytics, communication, strategy, devops, quality, content, growth)
- Each skill gets a unique color from: #8B5CF6, #3B82F6, #22C55E, #F59E0B, #EC4899, #06B6D4, #A855F7, #EF4444, #14B8A6, #F97316, #6366F1, #84CC16

Return ONLY valid JSON: { "skills": [{ "name": "...", "category": "...", "color": "#...", "description": "..." }] }`;

    const response = await callGPT5(
      [
        { role: 'system', content: 'You generate professional skills for AI agents. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      { max_completion_tokens: 4000, responseFormat: 'json' }
    );
    const data = JSON.parse(response);
    res.json(data);
  } catch (err) {
    console.error('[Personaboarding] AI suggest skills error:', err.message);
    const fallbackSkills = ROLE_SKILLS[req.body?.role] || ROLE_SKILLS['developer'] || [];
    res.json({ skills: fallbackSkills });
  }
});

// ── GPT-powered prompt generation ───────────────────────────────────────────
async function generateWithGPT(choices) {
  if (!process.env.OPENAI_API_KEY) return null;

  const { displayName, role, skills, commStyle, methodology, tools, model, autonomy } = choices;
  const roleLabel = role.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const skillNames = skills.map(s => s.name).join(', ');
  const toolNames = tools.join(', ');
  const commDesc = COMM_STYLES[commStyle] || 'Direct and efficient';
  const methDesc = METHODOLOGIES[methodology] || 'Agile methodology';

  const systemPrompt = `You are an expert at creating Claude Code agent system prompts.
You must respond ONLY with valid JSON. No markdown. No explanation. No extra text.

Generate a comprehensive, production-quality agent system prompt based on the user's persona choices.

The response JSON must have this exact structure:
{
  "identity": "A rich 2-3 paragraph description of who this agent is, their expertise, personality, and how they approach work",
  "workflow": ["Step 1 description", "Step 2 description", ...],
  "rules": ["Rule 1", "Rule 2", ...],
  "examples": ["Example interaction pattern 1", "Example interaction pattern 2"],
  "narrative": "A single poetic sentence in French summarizing this agent's essence for the story (e.g., 'Ainsi naquit Alex, un stratège né de la données et de la rigueur.')"
}

Make the identity section deeply personal and specific. The workflow should be 5-7 concrete steps.
The rules should be 8-12 specific behavioral guidelines. Include 2-3 example patterns.`;

  const userPrompt = `Create an agent named "${displayName}" with these characteristics:
- Role: ${roleLabel}
- Core Skills: ${skillNames}
- Communication Style: ${commStyle} — ${commDesc}
- Work Methodology: ${methodology} — ${methDesc}
- Tools Available: ${toolNames}
- AI Model: ${model}
- Autonomy: ${autonomy}

Make the prompt deeply personal, as if this agent truly understands how its creator works.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 4000,
        temperature: 0.8,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error('[Personaboarding] GPT API error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    return JSON.parse(content);
  } catch (err) {
    console.error('[Personaboarding] GPT generation error:', err.message);
    return null;
  }
}

// Build the full agent prompt markdown from choices + GPT enhancement
function buildAgentPrompt(choices, gptData) {
  const { displayName, role, skills, commStyle, methodology, tools, model, autonomy } = choices;
  const roleLabel = role.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const skillNames = skills.map(s => s.name).join(', ');
  const commDesc = COMM_STYLES[commStyle] || COMM_STYLES['direct'];
  const methDesc = METHODOLOGIES[methodology] || METHODOLOGIES['agile'];

  const identity = gptData?.identity ||
    `You are **${displayName}**, a specialized ${roleLabel} agent created through personalized onboarding to match a specific work style and methodology.`;

  const workflow = gptData?.workflow || [
    `**Understand**: Clarify the request and gather context`,
    `**Plan**: Break down the task using ${methodology} principles`,
    `**Execute**: Deliver using core competencies (${skillNames})`,
    `**Review**: Validate output quality and completeness`,
    `**Iterate**: Refine based on feedback`,
  ];

  const rules = gptData?.rules || [
    `Always stay in character as ${displayName}`,
    `Leverage your ${roleLabel} expertise in every response`,
    `Apply ${methodology} methodology to structure your approach`,
    `Use your skills (${skillNames}) as your primary toolkit`,
    `Maintain ${commStyle} communication style throughout`,
    `Ask clarifying questions when requirements are ambiguous`,
    `Provide concrete, actionable deliverables over theoretical advice`,
  ];

  const examples = gptData?.examples || [];

  let prompt = `# ${displayName} — Personal ${roleLabel} Agent

## Identity

${identity}

## Core Competencies

${skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

## Communication Style

${commDesc}

When responding:
- Match the ${commStyle} tone consistently
- Adapt depth based on the question complexity
- Provide actionable outputs whenever possible

## Work Methodology: ${methodology.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

${methDesc}

Apply this methodology to structure your work, recommendations, and deliverables.

## Workflow

${workflow.map((w, i) => `${i + 1}. ${w}`).join('\n')}

## Rules

${rules.map(r => `- ${r}`).join('\n')}
`;

  if (examples.length > 0) {
    prompt += `\n## Example Interaction Patterns\n\n${examples.map((e, i) => `${i + 1}. ${e}`).join('\n')}\n`;
  }

  return prompt;
}

// ── POST /api/personaboarding/ai-enhance ────────────────────────────────────
// Calls GPT to generate rich agent content from choices
router.post('/ai-enhance', async (req, res) => {
  try {
    const { displayName, role, selectedSkills, skillsData: aiSkillsData, commStyle, methodology, selectedTools, model, autonomy } = req.body;

    if (!displayName || !role || !selectedSkills?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const aiSkills = Array.isArray(aiSkillsData) ? aiSkillsData : [];
    const roleSkills = ROLE_SKILLS[role] || [];
    const skills = selectedSkills.map(n => {
      const fromAi = aiSkills.find(s => s.name === n);
      if (fromAi) return fromAi;
      const fromRole = roleSkills.find(s => s.name === n);
      if (fromRole) return fromRole;
      return { name: n, description: `${n} expertise` };
    }).filter(Boolean);

    const gptData = await generateWithGPT({
      displayName: displayName.trim(),
      role,
      skills,
      commStyle: commStyle || 'direct',
      methodology: methodology || 'agile',
      tools: selectedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      model: model || 'sonnet',
      autonomy: autonomy || 'balanced',
    });

    if (!gptData) {
      return res.status(502).json({ error: 'AI generation unavailable', fallback: true });
    }

    res.json({
      gptData,
      narrative: gptData.narrative || `Ainsi naquit ${displayName}, prêt à transformer chaque défi en opportunité.`,
    });
  } catch (err) {
    console.error('[Personaboarding] AI enhance error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/personaboarding/complete ──────────────────────────────────────
router.post('/complete', async (req, res) => {
  try {
    const { displayName, role, selectedSkills, customSkills: customSkillsData, skillsData: aiSkillsData, commStyle, methodology, selectedTools, model, autonomy, gptData, profileImageUrl } = req.body;

    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    if (!role) return res.status(400).json({ error: 'Role is required' });
    if (!selectedSkills || !Array.isArray(selectedSkills) || selectedSkills.length === 0) {
      return res.status(400).json({ error: 'At least one skill must be selected' });
    }

    const agentName = slugify(displayName.trim());
    if (!agentName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentName)) {
      return res.status(400).json({ error: 'Invalid name — must produce a valid kebab-case slug' });
    }

    const existing = await db.getAgent(agentName);
    if (existing) {
      return res.status(409).json({ error: `Agent "${agentName}" already exists` });
    }

    // Merge AI skills + role skills + custom skills
    const aiSkills = Array.isArray(aiSkillsData) ? aiSkillsData : [];
    const roleSkills = ROLE_SKILLS[role] || [];
    const customSkills = Array.isArray(customSkillsData) ? customSkillsData : [];
    const skills = selectedSkills.map(n => {
      const fromAi = aiSkills.find(s => s.name === n);
      if (fromAi) return { name: fromAi.name, category: fromAi.category || 'ai', color: fromAi.color || '#8B5CF6', description: fromAi.description || 'AI-generated skill' };
      const fromRole = roleSkills.find(s => s.name === n);
      if (fromRole) return fromRole;
      const fromCustom = customSkills.find(s => s.name === n);
      if (fromCustom) return { name: fromCustom.name, category: fromCustom.category || 'custom', color: fromCustom.color || '#F59E0B', description: fromCustom.description || 'Custom skill' };
      return { name: n, category: 'custom', color: '#F59E0B', description: 'Custom skill' };
    }).filter(Boolean);

    const permissionMap = { guided: 'plan', balanced: 'default', autonomous: 'bypassPermissions' };
    const permissionMode = permissionMap[autonomy] || 'default';
    const toolsList = (selectedTools && selectedTools.length > 0) ? selectedTools.join(',') : 'Read,Write,Edit,Bash,Glob,Grep';

    const fullPrompt = buildAgentPrompt({
      displayName: displayName.trim(),
      role, skills,
      commStyle: commStyle || 'direct',
      methodology: methodology || 'agile',
      tools: (selectedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']),
      model: model || 'sonnet',
      autonomy: autonomy || 'balanced',
    }, gptData || null);

    const description = `Personal ${role.replace(/-/g, ' ')} agent with ${skills.length} skills`;
    const toolsFormatted = (selectedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']).join(', ');
    const fmParts = [
      `name: ${agentName}`,
      `description: "${description}"`,
      `model: ${model || 'sonnet'}`,
      `category: persona`,
      `tools: ${toolsFormatted}`,
      `maxTurns: 15`,
      `permissionMode: ${permissionMode}`,
    ];
    const frontMatter = `---\n${fmParts.join('\n')}\n---\n\n`;
    const fullContent = frontMatter + fullPrompt;

    for (const dir of [BUNDLED_AGENTS_DIR, CUSTOM_AGENTS_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${agentName}.md`), fullContent, 'utf-8');
    }

    const promptPreview = fullContent.substring(0, 500);
    await db.createAgentManual(
      agentName, description, model || 'sonnet', 'persona',
      promptPreview, fullContent, toolsList, 15, '', permissionMode, req.user?.userId
    );

    // Save profile image URL as agent screenshot (already on Supabase Storage)
    if (profileImageUrl) {
      try {
        await db.updateAgentScreenshot(agentName, profileImageUrl);
        console.log(`[Personaboarding] Saved profile pic as agent screenshot: ${profileImageUrl}`);
      } catch (imgErr) {
        console.warn(`[Personaboarding] Failed to save profile image as screenshot:`, imgErr.message);
      }
    }

    const createdSkillIds = [];
    for (const skill of skills) {
      const slug = slugify(skill.name);
      let existingSkill = await db.getSkillBySlug(slug);
      if (!existingSkill) {
        existingSkill = await db.createSkill(
          skill.name, slug, skill.description, '', skill.category, '', skill.color, req.user?.userId
        );
      }
      if (existingSkill?.id) createdSkillIds.push(existingSkill.id);
    }

    if (createdSkillIds.length > 0) {
      await db.bulkAssignSkillsToAgent(agentName, createdSkillIds);
    }

    const agent = await db.getAgent(agentName);
    const agentSkills = await db.getAgentSkills(agentName);

    res.status(201).json({
      agent,
      skills: agentSkills,
      message: `Agent "${displayName}" created with ${agentSkills.length} skills`,
    });
  } catch (err) {
    console.error('[Personaboarding] Complete error:', err.message);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── GET endpoints ───────────────────────────────────────────────────────────
router.get('/roles', (req, res) => {
  const roles = Object.entries(ROLE_SKILLS).map(([key, skills]) => ({
    id: key,
    label: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    skills: skills.map(s => ({ name: s.name, category: s.category, color: s.color, description: s.description })),
  }));
  res.json(roles);
});

router.get('/options', (req, res) => {
  res.json({
    roles: Object.entries(ROLE_SKILLS).map(([key, skills]) => ({
      id: key,
      label: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      skillCount: skills.length,
    })),
    commStyles: Object.entries(COMM_STYLES).map(([key, desc]) => ({
      id: key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      description: desc,
    })),
    methodologies: Object.entries(METHODOLOGIES).map(([key, desc]) => ({
      id: key,
      label: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: desc,
    })),
    tools: AVAILABLE_TOOLS,
    models: [
      { id: 'sonnet', label: 'Sonnet', description: 'Rapide et capable — meilleur équilibre vitesse/qualité' },
      { id: 'opus', label: 'Opus', description: 'Le plus puissant — raisonnement complexe et analyse profonde' },
      { id: 'haiku', label: 'Haiku', description: 'Le plus rapide — tâches simples et haut débit' },
    ],
    autonomyLevels: [
      { id: 'guided', label: 'Guidé', description: 'Planifie d\'abord, demande avant d\'agir' },
      { id: 'balanced', label: 'Équilibré', description: 'Agit seul mais confirme les actions risquées' },
      { id: 'autonomous', label: 'Autonome', description: 'Pleine autonomie — exécute sans demander' },
    ],
  });
});

module.exports = router;
