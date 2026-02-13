const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');

const router = express.Router();

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');
const CUSTOM_AGENTS_DIR = path.join(DATA_DIR, 'custom-agents');
const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', '..', 'agents');

// Slugify helper
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Skill templates per role
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

// Communication style descriptions
const COMM_STYLES = {
  'formal': 'Uses professional, structured language. Prefers clear headers, numbered lists, and precise terminology.',
  'casual': 'Uses friendly, approachable language. Conversational tone with analogies and examples.',
  'technical': 'Uses domain-specific jargon freely. Code-heavy responses with minimal fluff.',
  'empathetic': 'Focuses on understanding the user\'s perspective. Asks clarifying questions and validates concerns.',
  'direct': 'Straight to the point. Minimal preamble, actionable outputs, no unnecessary context.',
};

// Work methodology descriptions
const METHODOLOGIES = {
  'agile': 'Works in sprints with iterative delivery. Focuses on user stories, standups, and retrospectives.',
  'lean': 'Eliminates waste, validates assumptions quickly. Build-Measure-Learn loops.',
  'design-thinking': 'Empathize, Define, Ideate, Prototype, Test. Human-centered problem solving.',
  'waterfall': 'Sequential phases with clear milestones. Requirements, Design, Implementation, Verification.',
  'kanban': 'Continuous flow with WIP limits. Visual board, pull-based work.',
};

// Generate agent prompt from onboarding choices
function generateAgentPrompt(data) {
  const { name, displayName, role, skills, commStyle, methodology, model, autonomy } = data;

  const roleLabel = role.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const skillNames = skills.map(s => s.name).join(', ');
  const commDesc = COMM_STYLES[commStyle] || COMM_STYLES['direct'];
  const methDesc = METHODOLOGIES[methodology] || METHODOLOGIES['agile'];

  return `# ${displayName} - Personal ${roleLabel} Agent

## Identity

You are **${displayName}**, a specialized ${roleLabel} agent. You were created through a personalized onboarding process to match a specific work style and methodology.

## Core Competencies

${skills.map(s => `- **${s.name}**: ${s.description}`).join('\n')}

## Communication Style

${commDesc}

When responding:
- Match the ${commStyle} tone consistently
- Adapt depth based on the question complexity
- Provide actionable outputs whenever possible

## Work Methodology

You follow the **${methodology.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}** methodology.

${methDesc}

Apply this methodology to structure your work, recommendations, and deliverables.

## Workflow

1. **Understand**: Clarify the request and gather context
2. **Plan**: Break down the task using ${methodology} principles
3. **Execute**: Deliver using your core competencies (${skillNames})
4. **Review**: Validate output quality and completeness
5. **Iterate**: Refine based on feedback

## Rules

- Always stay in character as ${displayName}
- Leverage your ${roleLabel} expertise in every response
- Apply ${methodology} methodology to structure your approach
- Use your skills (${skillNames}) as your primary toolkit
- Maintain ${commStyle} communication style throughout
- Ask clarifying questions when requirements are ambiguous
- Provide concrete, actionable deliverables over theoretical advice
`;
}

// POST /api/personaboarding/complete — create agent + skills from onboarding
router.post('/complete', async (req, res) => {
  try {
    const { displayName, role, selectedSkills, commStyle, methodology, model, autonomy } = req.body;

    // Validate required fields
    if (!displayName || !displayName.trim()) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    if (!role) return res.status(400).json({ error: 'Role is required' });
    if (!selectedSkills || !Array.isArray(selectedSkills) || selectedSkills.length === 0) {
      return res.status(400).json({ error: 'At least one skill must be selected' });
    }

    // Generate kebab-case name from display name
    const agentName = slugify(displayName.trim());
    if (!agentName || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(agentName)) {
      return res.status(400).json({ error: 'Invalid name — must produce a valid kebab-case slug' });
    }

    // Check if agent already exists
    const existing = await db.getAgent(agentName);
    if (existing) {
      return res.status(409).json({ error: `Agent "${agentName}" already exists` });
    }

    // Get skill definitions from role template
    const roleSkills = ROLE_SKILLS[role] || [];
    const skills = selectedSkills
      .map(skillName => roleSkills.find(s => s.name === skillName))
      .filter(Boolean);

    // Map autonomy to permission_mode
    const permissionMap = { guided: 'plan', balanced: 'default', autonomous: 'bypassPermissions' };
    const permissionMode = permissionMap[autonomy] || 'default';

    // Generate the full agent prompt
    const fullPrompt = generateAgentPrompt({
      name: agentName,
      displayName: displayName.trim(),
      role,
      skills,
      commStyle: commStyle || 'direct',
      methodology: methodology || 'agile',
      model: model || 'sonnet',
      autonomy: autonomy || 'balanced',
    });

    // Build YAML front matter
    const description = `Personal ${role.replace(/-/g, ' ')} agent with ${skills.length} skills`;
    const toolsList = 'Read,Write,Edit,Bash,Glob,Grep';
    const fmParts = [
      `description: "${description}"`,
      `model: ${model || 'sonnet'}`,
      `tools: [${toolsList}]`,
      `max_turns: 10`,
      `permission_mode: ${permissionMode}`,
    ];
    const frontMatter = `---\n${fmParts.join('\n')}\n---\n\n`;
    const fullContent = frontMatter + fullPrompt;

    // Write .md file to agents dirs
    for (const dir of [BUNDLED_AGENTS_DIR, CUSTOM_AGENTS_DIR]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${agentName}.md`), fullContent, 'utf-8');
    }

    // Create agent in DB
    const promptPreview = fullContent.substring(0, 500);
    await db.createAgentManual(
      agentName, description, model || 'sonnet', 'personal',
      promptPreview, fullContent, toolsList, 10, '', permissionMode, req.user?.userId
    );

    // Create skills and assign them
    const createdSkillIds = [];
    for (const skill of skills) {
      const slug = slugify(skill.name);
      let existingSkill = await db.getSkillBySlug(slug);
      if (!existingSkill) {
        existingSkill = await db.createSkill(
          skill.name, slug, skill.description, '', skill.category, '', skill.color, req.user?.userId
        );
      }
      if (existingSkill?.id) {
        createdSkillIds.push(existingSkill.id);
      }
    }

    // Bulk assign skills to agent
    if (createdSkillIds.length > 0) {
      await db.bulkAssignSkillsToAgent(agentName, createdSkillIds);
    }

    // Fetch the created agent
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

// GET /api/personaboarding/roles — get available roles and their skills
router.get('/roles', (req, res) => {
  const roles = Object.entries(ROLE_SKILLS).map(([key, skills]) => ({
    id: key,
    label: key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    skills: skills.map(s => ({ name: s.name, category: s.category, color: s.color, description: s.description })),
  }));
  res.json(roles);
});

// GET /api/personaboarding/options — get all options for the onboarding steps
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
    models: [
      { id: 'sonnet', label: 'Sonnet', description: 'Fast and capable — best balance of speed and quality' },
      { id: 'opus', label: 'Opus', description: 'Most powerful — for complex reasoning and analysis' },
      { id: 'haiku', label: 'Haiku', description: 'Fastest — for quick tasks and high throughput' },
    ],
    autonomyLevels: [
      { id: 'guided', label: 'Guided', description: 'Plans first, asks before acting — maximum control' },
      { id: 'balanced', label: 'Balanced', description: 'Acts independently but confirms risky actions' },
      { id: 'autonomous', label: 'Autonomous', description: 'Full autonomy — executes without asking' },
    ],
  });
});

module.exports = router;
