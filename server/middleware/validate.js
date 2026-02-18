const { z } = require('zod');

// Generic validation middleware factory
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    req[source] = result.data;
    next();
  };
}

// ===================== AUTH SCHEMAS =====================

const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password required').max(128),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  displayName: z.string().max(100).optional().default(''),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

// ===================== PROJECT SCHEMAS =====================

const createProjectSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  description: z.string().max(2000).optional().default(''),
  agent_name: z.string().max(200).optional().default(''),
  mode: z.enum(['solo', 'orchestra']).optional().default('solo'),
  project_type: z.enum(['html', 'fullstack']).optional().default('html'),
  team_config: z.object({
    name: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    orchestrator: z.string().max(200).optional(),
    workers: z.array(z.object({
      agent_name: z.string().max(200),
    })).max(20).optional(),
  }).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  agent_name: z.string().max(200).optional(),
  status: z.enum(['active', 'archived', 'completed']).optional(),
  project_type: z.enum(['html', 'fullstack']).optional(),
});

const forkProjectSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  description: z.string().max(2000).optional().default(''),
  agent_name: z.string().max(200).optional(),
  source_project_id: z.string().uuid().optional(),
  source_iteration_id: z.string().uuid('source_iteration_id required'),
});

// ===================== AGENT SCHEMAS =====================

const kebabCase = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be kebab-case (e.g. my-agent)').max(100);

const createAgentSchema = z.object({
  name: kebabCase,
  description: z.string().max(5000).optional().default(''),
  model: z.string().max(50).optional().default(''),
  category: z.string().max(50).optional().default('uncategorized'),
  prompt: z.string().max(100000).optional().default(''),
  tools: z.string().max(500).optional().default(''),
  max_turns: z.number().int().min(0).max(100).optional().default(0),
  memory: z.string().max(5000).optional().default(''),
  permission_mode: z.string().max(50).optional().default(''),
});

const updateAgentSchema = z.object({
  description: z.string().max(5000).optional(),
  model: z.string().max(50).optional(),
  category: z.string().max(50).optional(),
  full_prompt: z.string().max(100000).optional(),
  tools: z.string().max(500).optional(),
  max_turns: z.number().int().min(0).max(100).optional(),
  memory: z.string().max(5000).optional(),
  permission_mode: z.string().max(50).optional(),
  change_summary: z.string().max(500).optional(),
});

const bulkNamesSchema = z.object({
  names: z.array(z.string().max(100)).min(1).max(100),
});

const bulkCategorizeSchema = z.object({
  names: z.array(z.string().max(100)).min(1).max(100),
  category: z.string().min(1).max(50),
});

const importAgentSchema = z.object({
  filename: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
});

const duplicateAgentSchema = z.object({
  new_name: kebabCase,
});

const aiGenerateSchema = z.object({
  purpose: z.string().min(1, 'purpose is required').max(2000),
  style: z.string().max(200).optional(),
  tools_needed: z.string().max(500).optional(),
  category: z.string().max(50).optional(),
});

// ===================== TEAM SCHEMAS =====================

const createTeamSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  description: z.string().max(2000).optional().default(''),
});

const addTeamMemberSchema = z.object({
  agent_name: z.string().min(1).max(200),
  role: z.enum(['leader', 'member', 'reviewer']).optional().default('member'),
  sort_order: z.number().int().min(0).max(100).optional().default(0),
});

// ===================== KNOWLEDGE SCHEMAS =====================

const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  description: z.string().max(2000).optional().default(''),
});

const createKnowledgeEntrySchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1).max(100000),
  source_type: z.enum(['manual', 'url', 'file', 'api']).optional().default('manual'),
  source_url: z.string().url().max(2000).optional().or(z.literal('')).default(''),
  source_filename: z.string().max(500).optional().default(''),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ===================== SKILL SCHEMAS =====================

const createSkillSchema = z.object({
  name: z.string().min(1, 'Name required').max(200),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100).optional(),
  description: z.string().max(5000).optional().default(''),
  prompt: z.string().max(100000).optional().default(''),
  category: z.string().max(50).optional().default('general'),
  icon: z.string().max(50).optional().default(''),
  color: z.string().max(20).optional().default('#8B5CF6'),
});

// ===================== CHAT SCHEMAS =====================

const chatMessageSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(50000),
  })).min(1).max(100),
});

// ===================== ORCHESTRATOR SCHEMA =====================

const orchestratorSchema = z.object({
  prompt: z.string().min(1, 'Prompt required').max(10000),
});

// ===================== UUID PARAM VALIDATION =====================

const uuidParam = z.object({
  id: z.string().uuid(),
});

const projectIdParam = z.object({
  projectId: z.string().uuid(),
});

module.exports = {
  validate,
  // Auth
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  // Projects
  createProjectSchema,
  updateProjectSchema,
  forkProjectSchema,
  // Agents
  createAgentSchema,
  updateAgentSchema,
  bulkNamesSchema,
  bulkCategorizeSchema,
  importAgentSchema,
  duplicateAgentSchema,
  aiGenerateSchema,
  // Teams
  createTeamSchema,
  addTeamMemberSchema,
  // Knowledge
  createKnowledgeBaseSchema,
  createKnowledgeEntrySchema,
  // Skills
  createSkillSchema,
  // Chat
  chatMessageSchema,
  // Orchestrator
  orchestratorSchema,
  // Params
  uuidParam,
  projectIdParam,
};
