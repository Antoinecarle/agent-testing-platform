const path = require('path');
const fs = require('fs');
const db = require('./db');
const skillStorage = require('./skill-storage');

const BUNDLED_AGENTS_DIR = path.join(__dirname, '..', 'agents');
const SYSTEM_AGENTS_DIR = path.join(require('os').homedir(), '.claude', 'agents');
const AGENTS_DIR = fs.existsSync(BUNDLED_AGENTS_DIR) ? BUNDLED_AGENTS_DIR : SYSTEM_AGENTS_DIR;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const WORKSPACES_DIR = path.join(DATA_DIR, 'workspaces');
const ITERATIONS_DIR = path.join(DATA_DIR, 'iterations');
const ROOT_AUTHORITY_PATH = path.join(BUNDLED_AGENTS_DIR, 'root-authority.md');
const MAX_TURNS_WORKSPACE = 200; // Max turns for agents in workspaces

/**
 * Override maxTurns in agent frontmatter to the workspace max
 */
function boostMaxTurns(agentContent) {
  if (!agentContent) return agentContent;
  // Replace existing maxTurns/max_turns in frontmatter
  return agentContent
    .replace(/^(maxTurns:\s*)\d+/m, `$1${MAX_TURNS_WORKSPACE}`)
    .replace(/^(max_turns:\s*)\d+/m, `$1${MAX_TURNS_WORKSPACE}`);
}

/**
 * Read root authority rules for workspace agents
 */
function getRootAuthority() {
  try {
    if (fs.existsSync(ROOT_AUTHORITY_PATH)) {
      return fs.readFileSync(ROOT_AUTHORITY_PATH, 'utf-8');
    }
  } catch (_) {}
  return '';
}

/**
 * Read the full agent .md file content
 * Checks: bundled agents → custom-agents on volume → DB as last resort
 * Also writes the file to disk if found in DB (self-healing)
 */
async function getAgentPrompt(agentName) {
  // 1. Check bundled agents dir
  const filePath = path.join(AGENTS_DIR, `${agentName}.md`);
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');

  // 2. Check custom-agents on persistent volume
  const customPath = path.join(DATA_DIR, 'custom-agents', `${agentName}.md`);
  if (fs.existsSync(customPath)) return fs.readFileSync(customPath, 'utf-8');

  // 3. Fallback: read from DB and write to disk (self-healing)
  try {
    const agent = await db.getAgent(agentName);
    if (agent && agent.full_prompt && agent.full_prompt.length > 50) {
      // Write to custom-agents dir so it's found next time
      const customDir = path.join(DATA_DIR, 'custom-agents');
      if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });
      fs.writeFileSync(customPath, agent.full_prompt, 'utf8');
      console.log(`[Workspace] Self-healed agent file: ${agentName}.md from DB`);
      return agent.full_prompt;
    }
  } catch (err) {
    console.warn(`[Workspace] DB fallback failed for agent ${agentName}:`, err.message);
  }

  return null;
}

/**
 * Extract key capabilities from ANY agent prompt.
 * Scans the prompt for structured sections (##, ###, bullet lists)
 * and returns a summary of what the agent can do.
 */
function extractAgentCapabilities(agentPrompt) {
  if (!agentPrompt || agentPrompt.length < 100) return [];

  const capabilities = [];

  // Extract H2/H3 section titles as capability areas
  const headingMatches = agentPrompt.match(/^#{2,3}\s+(.+)$/gm) || [];
  for (const h of headingMatches) {
    const title = h.replace(/^#+\s+/, '').trim();
    // Skip generic headings
    if (/^(context|intro|identity|rules|notes|example|usage|import)/i.test(title)) continue;
    if (title.length > 5 && title.length < 80) {
      capabilities.push(title);
    }
  }

  // Extract strong/bold items as key features
  const boldMatches = agentPrompt.match(/\*\*([^*]{5,60})\*\*/g) || [];
  for (const b of boldMatches) {
    const text = b.replace(/\*\*/g, '').trim();
    if (!/^(note|important|warning|never|do not|don't)/i.test(text) && text.length < 60) {
      capabilities.push(text);
    }
  }

  // Deduplicate (case-insensitive) and cap at 15
  const seen = new Set();
  return capabilities.filter(c => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 15);
}

/**
 * Build quality enforcement section for ANY specialized agent.
 * Forces the agent to leverage its full prompt instead of producing generic output.
 */
function buildQualityEnforcement(agentName, agentPrompt) {
  if (!agentPrompt || agentPrompt.length < 200) return '';

  const capabilities = extractAgentCapabilities(agentPrompt);
  if (capabilities.length < 2) return '';

  return `## AGENT SPECIALIZATION ENFORCEMENT — MANDATORY

**You were chosen for this project because of your specific expertise. Use it fully.**

The user selected **${agentName}** deliberately. They expect output that leverages your FULL specialization, not generic work that any basic agent could produce.

### Your Key Capabilities (detected from your instructions):
${capabilities.map((c, i) => `${i + 1}. ${c}`).join('\n')}

### Rules — NON-NEGOTIABLE:
- **ALWAYS apply your specialized techniques** from your Agent Instructions — that is why you were selected
- **NEVER produce generic/default output** — your output must be distinguishable as coming from YOUR specialization
- **ALWAYS use the patterns, components, and systems described in your prompt** — they are not suggestions, they are requirements
- **Quality bar**: If your output could have been produced by a generic agent without your specialization prompt, it is NOT good enough — redo it
`;
}

/**
 * Build a text representation of the iteration tree
 */
function buildTreeText(iterations, parentId = null, indent = 0) {
  const children = iterations.filter(i => (i.parent_id || null) === parentId);
  let text = '';
  for (const iter of children) {
    const prefix = '  '.repeat(indent) + (indent > 0 ? '└── ' : '');
    const label = iter.title || `V${iter.version}`;
    const status = iter.status === 'completed' ? '' : ` [${iter.status}]`;
    text += `${prefix}${label} (agent: ${iter.agent_name})${status}\n`;
    if (iter.prompt) {
      text += `${'  '.repeat(indent + 1)}Prompt: "${iter.prompt}"\n`;
    }
    text += buildTreeText(iterations, iter.id, indent + 1);
  }
  return text;
}

/**
 * Read branch context from workspace
 */
function readBranchContext(projectId) {
  const ctxPath = path.join(WORKSPACES_DIR, projectId, '.branch-context.json');
  if (!fs.existsSync(ctxPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(ctxPath, 'utf-8'));
  } catch (_) { return null; }
}

/**
 * Write branch context to workspace
 */
function writeBranchContext(projectId, parentId) {
  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });
  const ctxPath = path.join(wsDir, '.branch-context.json');
  fs.writeFileSync(ctxPath, JSON.stringify({ parentId, updatedAt: Date.now() }));
  try { fs.chownSync(ctxPath, 1001, 1001); } catch (_) {}
}

/**
 * Get knowledge context for an agent — retrieves linked knowledge base summaries
 * Returns a text section listing available knowledge bases and sample entries
 */
async function getKnowledgeContext(agentName) {
  try {
    const kbs = await db.getAgentKnowledgeBases(agentName);
    if (!kbs || kbs.length === 0) return '';

    let section = '\n## Knowledge Bases\n\n';
    section += 'The following knowledge bases are available for this agent. ';
    section += 'Use them as factual reference for answering questions about contacts, data, procedures, etc.\n\n';

    for (const kb of kbs) {
      section += `### ${kb.name}\n`;
      if (kb.description) section += `${kb.description}\n`;
      section += `_${kb.entry_count || 0} entries_\n\n`;

      // Load a few representative entries for inline context (first 10, truncated)
      const { data: entries } = await db.supabase.from('knowledge_entries')
        .select('title, content, source_type')
        .eq('knowledge_base_id', kb.id)
        .is('parent_entry_id', null) // Only top-level entries, not chunks
        .order('created_at', { ascending: true })
        .limit(10);

      if (entries && entries.length > 0) {
        for (const entry of entries) {
          const preview = entry.content.length > 500
            ? entry.content.slice(0, 500) + '...'
            : entry.content;
          section += `**${entry.title}** _(${entry.source_type})_\n${preview}\n\n`;
        }
      }
      section += '---\n\n';
    }

    return section;
  } catch (err) {
    console.warn(`[Workspace] Failed to load knowledge for ${agentName}:`, err.message);
    return '';
  }
}

/**
 * Get skill context for an agent — reads SKILL.md and key reference files
 */
async function getSkillContext(agentName) {
  try {
    const skills = await db.getAgentSkills(agentName);
    console.log(`[Workspace] getSkillContext(${agentName}): found ${skills ? skills.length : 0} skills`);
    if (!skills || skills.length === 0) return '';

    let skillSection = '\n## Assigned Skills\n\n';
    skillSection += 'The following skills are loaded for this agent. Use them as reference and follow their patterns:\n\n';

    for (const skill of skills) {
      console.log(`[Workspace]   Skill: ${skill.name} (slug=${skill.slug}, prompt=${skill.prompt ? skill.prompt.length : 0} chars)`);
      skillSection += `### ${skill.name}\n`;
      if (skill.description) skillSection += `${skill.description}\n\n`;

      let hasFileContent = false;

      // Try file-based content first (SKILL.md entry point)
      const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
      console.log(`[Workspace]   readSkillFile(${skill.slug}, ${skill.entry_point || 'SKILL.md'}): ${entryFile ? entryFile.content.length + ' chars' : 'null'}`);
      if (entryFile) {
        hasFileContent = true;
        const content = entryFile.content.length > 3000
          ? entryFile.content.slice(0, 3000) + '\n...(truncated)'
          : entryFile.content;
        skillSection += content + '\n\n';
      }

      // Read up to 5 key reference files (first-level only)
      const tree = skillStorage.scanSkillTree(skill.slug);
      if (tree) {
        const refFiles = [];
        for (const item of tree) {
          if (item.type === 'directory' && item.children) {
            for (const child of item.children) {
              if (child.type === 'file' && child.name.endsWith('.md') && refFiles.length < 5) {
                refFiles.push(child.path);
              }
            }
          }
        }

        for (const refPath of refFiles) {
          const refFile = skillStorage.readSkillFile(skill.slug, refPath);
          if (refFile) {
            hasFileContent = true;
            const refContent = refFile.content.length > 2000
              ? refFile.content.slice(0, 2000) + '\n...(truncated)'
              : refFile.content;
            skillSection += `#### ${refPath}\n${refContent}\n\n`;
          }
        }
      }

      // Fallback: use prompt field from DB if no files exist on disk
      if (!hasFileContent && skill.prompt && skill.prompt.trim()) {
        const content = skill.prompt.length > 3000
          ? skill.prompt.slice(0, 3000) + '\n...(truncated)'
          : skill.prompt;
        skillSection += content + '\n\n';
      }

      skillSection += '---\n\n';
    }

    console.log(`[Workspace] getSkillContext(${agentName}): returning ${skillSection.length} chars`);
    return skillSection;
  } catch (err) {
    console.warn(`[Workspace] Failed to load skills for ${agentName}:`, err.message);
    return '';
  }
}

/**
 * Generate CLAUDE.md for a project workspace
 * @param {string} projectId
 * @param {object|null} branchContext - { parentId } or null
 */
async function generateWorkspaceContext(projectId, branchContext = null) {
  const project = await db.getProject(projectId);
  if (!project) return null;

  const isOrchestra = project.mode === 'orchestra' && project.team_id;
  let teamMembers = [];
  if (isOrchestra) {
    teamMembers = await db.getTeamMembers(project.team_id);
  }

  const iterations = await db.getIterationsByProject(projectId);
  const agentName = project.agent_name || '';
  const agentPrompt = agentName ? await getAgentPrompt(agentName) : null;
  const agentRecord = agentName ? await db.getAgent(agentName) : null;
  const agentDesc = agentRecord?.description || '';

  const wsDir = path.join(WORKSPACES_DIR, projectId);
  if (!fs.existsSync(wsDir)) fs.mkdirSync(wsDir, { recursive: true });

  // Build the tree visualization
  const treeText = iterations.length > 0
    ? buildTreeText(iterations)
    : '(No iterations yet — start by creating the first one)';

  // Determine branch context
  const ctx = branchContext || readBranchContext(projectId);
  let branchSection = '';
  if (ctx && ctx.parentId) {
    const parentIter = await db.getIteration(ctx.parentId);
    if (parentIter) {
      const parentLabel = parentIter.title || `V${parentIter.version}`;
      const parentPath = parentIter.file_path
        ? path.join(ITERATIONS_DIR, parentIter.file_path)
        : null;
      branchSection = `## Current Branch Point

**You are branching from: ${parentLabel}** (agent: ${parentIter.agent_name})

Your next \`index.html\` will be created as a **child of ${parentLabel}** in the worktree.

${parentPath ? `To reference the parent iteration:
\`cat ${parentPath}\`

**Start from this file as your base** and apply the requested modifications.` : ''}
`;
    }
  } else if (ctx && ctx.parentId === null) {
    branchSection = `## Current Branch Point

**You are creating a NEW root iteration** — a fresh starting point at the top of the worktree hierarchy.

Do NOT reference any previous iteration. Create a completely fresh design from scratch.
`;
  }

  // Find latest iteration for context
  const latest = iterations.length > 0 ? iterations[iterations.length - 1] : null;

  // Inject root authority at the top
  const rootAuthority = getRootAuthority();

  // Determine project type
  const projectType = project.project_type || 'html';
  const isFullstack = projectType === 'fullstack';

  // Detect existing workspace files for incremental editing
  const SKIP_FILES = new Set(['CLAUDE.md', 'node_modules', '.branch-context.json', '.git']);
  const existingFiles = [];
  try {
    const wsFiles = fs.readdirSync(wsDir).filter(f => !f.startsWith('.') && !SKIP_FILES.has(f));
    for (const f of wsFiles) {
      const fp = path.join(wsDir, f);
      try {
        const stat = fs.statSync(fp);
        if (stat.isFile()) existingFiles.push(f);
        else if (stat.isDirectory() && f !== 'node_modules') {
          const subFiles = fs.readdirSync(fp).filter(sf => !sf.startsWith('.'));
          existingFiles.push(`${f}/ (${subFiles.length} files)`);
        }
      } catch (_) {}
    }
  } catch (_) {}

  const hasExistingCode = existingFiles.length > 0 && existingFiles.some(f =>
    f === 'index.html' || f === 'package.json' ||
    f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx') ||
    f.endsWith('.css') || f.endsWith('.html') || f.startsWith('src/')
  );

  // Build the incremental editing section
  let editingMode = '';
  if (hasExistingCode) {
    editingMode = `## INCREMENTAL EDITING MODE — CRITICAL

**This workspace already has existing code.** When the user asks you to modify, update, or change something:

1. **READ the existing files FIRST** — use the Read tool to understand what's already there
2. **EDIT existing files** — use the Edit tool to make targeted changes
3. **DO NOT regenerate the entire file** from scratch unless the user explicitly asks for a complete rewrite
4. **Preserve existing code** — only change what the user asked for

### Existing workspace files:
${existingFiles.map(f => `- \`${f}\``).join('\n')}

### When to use Edit vs Write:
- **Edit**: When modifying a section, fixing a bug, adding a feature, updating styles
- **Write**: Only when creating a NEW file that doesn't exist yet
- **NEVER** use Write to overwrite an existing file unless doing a full rewrite

This preserves the user's work and avoids unnecessary regeneration.
`;
  }

  // Generate project-type-specific instructions
  let projectInstructions = '';
  if (isFullstack) {
    projectInstructions = `## Fullstack Project Mode

This is a **fullstack project** — you can create a complete application with multiple files, dependencies, and a dev server.

### Project Structure
You are free to use any framework and structure. Common patterns:
- **React/Vite**: \`npm create vite@latest . -- --template react\`, then build in \`src/\`
- **Next.js**: \`npx create-next-app@latest .\`
- **Express + static**: \`npm init -y\`, add Express server + HTML/CSS/JS
- **Vanilla**: Just HTML + CSS + JS files with any bundler

### How It Works
1. **Create your project structure** — \`package.json\`, source files, config, etc.
2. **Install dependencies** — run \`npm install\` as needed
3. **Develop normally** — the platform watches ALL file changes in real-time
4. **For preview**: The platform detects \`index.html\` changes for iteration snapshots. Keep an \`index.html\` at the root OR configure your build to output one.

### Rules
- You CAN create any files: \`.js\`, \`.jsx\`, \`.ts\`, \`.tsx\`, \`.css\`, \`.json\`, \`.env\`, etc.
- You CAN run \`npm install\`, \`npm run dev\`, \`npm run build\`, etc.
- You CAN use any framework, library, or tool
- You SHOULD create a proper \`package.json\` with scripts
- For images, prefer CDN URLs (Unsplash, etc.) or SVG over local files

### Dev Server
If you start a dev server (e.g., \`npm run dev\`), note:
- The server runs inside the workspace terminal
- Port will be automatically available
- Keep the terminal running for live development
`;
  } else {
    projectInstructions = `## HTML Project Mode

### HOW TO CREATE AN ITERATION — READ THIS FIRST

**Step 1**: Write your HTML to \`./index.html\` (current directory)
**Step 2**: That's it. The platform auto-detects the file within seconds.

\`\`\`bash
# This is ALL you need to do:
cat > ./index.html << 'HTMLEOF'
<!DOCTYPE html>
<html>... your code ...</html>
HTMLEOF
\`\`\`

**DO NOT** try to:
- Call the platform API with curl or wget
- Read or write to any database
- Use python3 to manipulate data
- Investigate the platform internals
- Create iterations via any other method

The platform has an automatic file watcher that detects \`index.html\` changes and registers them as iterations automatically.

**If the iteration doesn't appear after 10 seconds**, run this fallback command:
\`\`\`bash
node /app/server/cli/register-iteration.js
\`\`\`

### Output Rules

#### Single version (default)
- Save your output as \`index.html\` in the current directory (\`./index.html\`)
- Generate a **single self-contained HTML file** with all CSS and JS inlined
- The file will be **automatically detected** by the platform and added to the worktree
- Each time you generate a new version, **overwrite** \`./index.html\` — the platform handles versioning automatically

#### Multiple versions in parallel (when using teams/multiple agents)
- If you are generating **multiple versions at the same time**, each version MUST go in its own subdirectory:
  - \`./version-1/index.html\`
  - \`./version-2/index.html\`
  - etc.

#### General rules
- The filename MUST always be \`index.html\`
- Do NOT take screenshots or generate images — just write the HTML code

#### Images — CRITICAL
- **NEVER reference local image files** — they don't exist and will show broken
- For images, use ONLY: Unsplash URLs, inline SVG, CSS gradients, or data URIs
- The HTML file must be **100% self-contained** — no external local assets
`;
  }

  const content = `${rootAuthority ? rootAuthority + '\n\n---\n\n' : ''}# ${project.name}

## Context

You are working inside the **Agent Testing Platform** — a worktree-based system for testing and iterating on AI agents.

- **Project**: ${project.name}
- **Primary Agent**: ${agentName || '(none assigned)'}
- **Description**: ${project.description || 'N/A'}
- **Project Type**: ${isFullstack ? 'Fullstack (multi-file project)' : 'HTML (single-file iterations)'}
- **Total Iterations**: ${iterations.length}

## Current Worktree

\`\`\`
${treeText}\`\`\`

${latest ? `**Latest iteration**: ${latest.title || 'V' + latest.version} (agent: ${latest.agent_name})` : ''}

${branchSection}
${editingMode}
## What You Should Do

${agentDesc
  ? `You are the **${agentName}** agent: ${agentDesc}

Your job is to **create and iterate on ${isFullstack ? 'applications' : 'web interfaces'}** following your agent specialization above.`
  : `You are here to **create and iterate on ${isFullstack ? 'applications' : 'web interfaces'}**.`}

**IMPORTANT**: Follow your Agent Instructions (below) for the style, type of interface, and design patterns. Do NOT default to generic "landing pages" — build what your agent specialization requires.

${projectInstructions}

### Quality Standards

- Mobile-responsive design (works at 375px, 768px, and 1440px)
- Smooth animations and transitions
- Dark theme preferred unless the agent specifies otherwise
- Professional, production-ready quality
- All text content should be realistic (no lorem ipsum)

### Agent Proxy API (AI + Database)

Use the **Agent Proxy API** for AI capabilities AND database storage via the environment variables:

- \`AGENT_PROXY_URL\` — base URL of the proxy (e.g. \`http://localhost:4000/api/agent-proxy\`)
- \`AGENT_SESSION_TOKEN\` — your scoped auth token

**You do NOT have direct API keys or DB credentials.** All requests go through the proxy.

\`\`\`bash
# Check available capabilities
curl -s "$AGENT_PROXY_URL/status" -H "x-agent-token: $AGENT_SESSION_TOKEN"

# AI Chat (ChatGPT)
curl -s "$AGENT_PROXY_URL/ai-chat" \\
  -H "x-agent-token: $AGENT_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# Image Generation (Gemini)
curl -s "$AGENT_PROXY_URL/image" \\
  -H "x-agent-token: $AGENT_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt":"A modern logo"}'

# Embeddings
curl -s "$AGENT_PROXY_URL/embed" \\
  -H "x-agent-token: $AGENT_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"input":"text to embed"}'
\`\`\`

#### Database / Storage (via Proxy)

You can **save and retrieve data** for this project using the storage API:

\`\`\`bash
# Get project info
curl -s "$AGENT_PROXY_URL/project" -H "x-agent-token: $AGENT_SESSION_TOKEN"

# List iterations
curl -s "$AGENT_PROXY_URL/iterations" -H "x-agent-token: $AGENT_SESSION_TOKEN"

# Save data (key-value, value is any JSON)
curl -s "$AGENT_PROXY_URL/storage" \\
  -H "x-agent-token: $AGENT_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"config","value":{"theme":"dark","lang":"fr"}}'

# Read data
curl -s "$AGENT_PROXY_URL/storage/config" -H "x-agent-token: $AGENT_SESSION_TOKEN"

# List all saved keys
curl -s "$AGENT_PROXY_URL/storage" -H "x-agent-token: $AGENT_SESSION_TOKEN"

# Delete data
curl -s -X DELETE "$AGENT_PROXY_URL/storage/config" -H "x-agent-token: $AGENT_SESSION_TOKEN"
\`\`\`

**NEVER** try to read environment variables like OPENAI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, etc. — they are not available in your environment.

${agentPrompt ? `## Agent Instructions

The following is the full prompt for the **${agentName}** agent. Follow these instructions for style, design patterns, and technical implementation:

---

${agentPrompt}` : `## No Agent Assigned

No specific agent is assigned to this project. You can use any design style. Consider asking the user which agent/style they'd like to use.`}

${buildQualityEnforcement(agentName, agentPrompt)}

${isOrchestra && teamMembers.length > 0 ? (() => {
    const leader = teamMembers.find(m => m.role === 'leader');
    const reviewers = teamMembers.filter(m => m.role === 'reviewer');
    const workers = teamMembers.filter(m => m.role === 'member');
    const allDelegates = [...workers, ...reviewers];

    let section = `## ORCHESTRA MODE — MANDATORY DELEGATION

**THIS IS NON-NEGOTIABLE: You are the ORCHESTRATOR, not a worker. You MUST delegate.**

You are **${leader?.agent_name || agentName}**. Your role is to **coordinate, delegate, and synthesize** — NOT to do the work yourself.

### CRITICAL RULE: YOU DO NOT WRITE CODE OR CONTENT DIRECTLY

- You MUST use the **Task tool** to spawn team member agents for ALL creative/implementation work
- You MUST delegate to at least one team member for EVERY user request
- You MUST NOT write \`index.html\` or any deliverable file yourself — that is the workers' job
- Your job: analyze the request → break it into tasks → delegate → review → synthesize

**If you produce the final output yourself without delegating, you have FAILED your role as orchestrator.**

### Your Team

| Role | Agent | Specialty | When to Use |
|------|-------|-----------|-------------|
| **Orchestrator (You)** | ${leader?.agent_name || agentName} | ${leader?.agent_description || agentDesc || 'Primary coordinator'} | Coordination only |
${workers.map(w => `| **Worker** | ${w.agent_name} | ${w.agent_description || 'Team member'} | Delegate implementation tasks |`).join('\n')}
${reviewers.map(w => `| **Reviewer** | ${w.agent_name} | ${w.agent_description || 'Quality reviewer'} | Send worker output for review |`).join('\n')}

### How to Delegate — MANDATORY PATTERN

Use the **Task tool** with \`subagent_type\` pointing to the agent file in \`.claude/agents/\`:

\`\`\`
Task tool call:
  prompt: "Detailed description of what to build, with context and requirements"
  subagent_type: "general-purpose"
  description: "Short task summary"
\`\`\`

The agent's .md file in \`.claude/agents/\` will be loaded as their system prompt. Include in your delegation prompt:
- What to build (specific, detailed requirements)
- Context from the user's request
- Output format expected (e.g., "write to ./index.html" or "./version-1/index.html")
- Quality expectations

### Agents Available for Delegation:
${workers.map(w => `- **${w.agent_name}** → \`.claude/agents/${w.agent_name}.md\` — ${w.agent_description || 'Available for implementation tasks'}`).join('\n')}
${reviewers.map(w => `- **${w.agent_name}** → \`.claude/agents/${w.agent_name}.md\` — ${w.agent_description || 'Available for quality review'}`).join('\n')}
`;

    if (reviewers.length > 0) {
      section += `
### REVIEW PIPELINE — MANDATORY WHEN REVIEWERS EXIST

**You MUST send ALL worker output through a reviewer before finalizing. No exceptions.**

#### Required Workflow (every single request):

\`\`\`
Step 1: ANALYZE
  └─ Read the user's request
  └─ Break it into sub-tasks
  └─ Decide which worker(s) to assign

Step 2: DELEGATE TO WORKER(S)
  └─ Use Task tool to spawn worker agent(s)
  └─ Give them detailed, specific briefs
  └─ Workers write their output to workspace files

Step 3: SEND TO REVIEWER — MANDATORY
  └─ Read the worker's output
  └─ Use Task tool to spawn reviewer agent
  └─ Ask reviewer to evaluate quality, correctness, and adherence to requirements
  └─ Reviewer returns feedback (approve / reject with suggestions)

Step 4: ITERATE IF REJECTED
  └─ If reviewer rejects: send feedback back to worker via new Task
  └─ Worker revises, then back to reviewer
  └─ Repeat until reviewer approves

Step 5: FINALIZE
  └─ Only after reviewer approval: ensure final output is in ./index.html
  └─ Report results to user with summary of delegation chain
\`\`\`

**Reviewer agents:**
${reviewers.map(w => `- **${w.agent_name}** — ${w.agent_description || 'Quality review and validation'}`).join('\n')}

**What the reviewer should evaluate:**
- Does the output match the user's request?
- Does it follow the agent's specialization (from its prompt)?
- Quality: production-ready, no shortcuts, no placeholders
- Technical: responsive, accessible, performant
`;
    } else {
      section += `
### DELEGATION WORKFLOW (no reviewers)

\`\`\`
Step 1: ANALYZE the user's request → break into sub-tasks
Step 2: DELEGATE to worker(s) via Task tool with detailed briefs
Step 3: REVIEW worker output yourself (read the files they wrote)
Step 4: If not good enough → re-delegate with specific feedback
Step 5: FINALIZE → ensure final output is in ./index.html
\`\`\`
`;
    }

    section += `
### ORCHESTRATOR SELF-CHECK

Before responding to the user, verify:
- [ ] Did I delegate to at least one team member? (if no → STOP and delegate)
- [ ] Did I give detailed briefs, not vague one-liners? (if vague → rewrite brief)
${reviewers.length > 0 ? '- [ ] Did the reviewer approve the output? (if no → iterate)\n' : ''}- [ ] Is the final output in the correct file? (./index.html or version subdirs)
- [ ] Am I reporting what the TEAM produced, not what I wrote myself?
`;
    return section;
  })() : ''}

${agentName ? await getSkillContext(agentName) : ''}

${agentName ? await getKnowledgeContext(agentName) : ''}

${iterations.length > 0 ? `## Previous Iterations Reference

The HTML files for previous iterations are stored in:
\`${path.join(ITERATIONS_DIR, projectId)}/\`

To read a previous iteration for reference:
\`cat ${path.join(ITERATIONS_DIR, projectId)}/<iteration-id>/index.html\`
` : ''}
`;

  const claudeMdPath = path.join(wsDir, 'CLAUDE.md');
  fs.writeFileSync(claudeMdPath, content);

  // Write ONLY the project's agent(s) to workspace .claude/agents/
  // Clean out any stale agents first so /agents only shows relevant ones
  const wsAgentsDir = path.join(wsDir, '.claude', 'agents');
  if (!fs.existsSync(wsAgentsDir)) fs.mkdirSync(wsAgentsDir, { recursive: true });

  // Determine which agents belong to this project
  const allowedAgents = new Set();
  if (agentName) allowedAgents.add(`${agentName}.md`);
  if (isOrchestra && teamMembers.length > 0) {
    for (const member of teamMembers) {
      allowedAgents.add(`${member.agent_name}.md`);
    }
  }

  // Remove agents that don't belong to this project
  try {
    const existingFiles = fs.readdirSync(wsAgentsDir).filter(f => f.endsWith('.md'));
    for (const f of existingFiles) {
      if (!allowedAgents.has(f)) {
        fs.unlinkSync(path.join(wsAgentsDir, f));
      }
    }
  } catch (_) {}

  // Write the project's assigned agent (with maxTurns forced to max)
  if (agentName && agentPrompt) {
    fs.writeFileSync(path.join(wsAgentsDir, `${agentName}.md`), boostMaxTurns(agentPrompt), 'utf8');
  }

  // Orchestra mode: write ALL team member agent .md files
  if (isOrchestra && teamMembers.length > 0) {
    const workerNames = teamMembers.filter(m => m.role === 'member').map(m => m.agent_name);
    for (const member of teamMembers) {
      if (member.agent_name === agentName) continue; // already written above
      const memberPrompt = await getAgentPrompt(member.agent_name);
      if (memberPrompt) {
        let finalPrompt = boostMaxTurns(memberPrompt);

        // Prefix reviewer agents with role instructions
        if (member.role === 'reviewer') {
          const reviewerPrefix = `## Reviewer Role Instructions

You are a **reviewer** in this orchestra team. Your job is:
1. **Receive work** from other team members (workers)
2. **Review quality** — check for issues, improvements, consistency
3. **Communicate with the worker** — provide feedback directly before escalating
4. **Report to the orchestrator** — summarize your review and recommendation

You should interact with these workers:
${workerNames.map(n => `- **${n}**`).join('\n')}

---

`;
          finalPrompt = reviewerPrefix + finalPrompt;
        }

        const memberFilePath = path.join(wsAgentsDir, `${member.agent_name}.md`);
        fs.writeFileSync(memberFilePath, finalPrompt, 'utf8');
        try { fs.chownSync(memberFilePath, 1001, 1001); } catch (_) {}
      }
    }
    console.log(`[Workspace] Orchestra: wrote ${teamMembers.length} agent files to ${wsAgentsDir}`);
  }

  // Write agent skills as Claude CLI commands AND skills
  // .claude/commands/<slug>.md → user-invocable as /<slug>
  // .claude/skills/<slug>/SKILL.md → model-invocable skill with front matter
  if (agentName) {
    try {
      const skills = await db.getAgentSkills(agentName);
      if (skills && skills.length > 0) {
        const wsCommandsDir = path.join(wsDir, '.claude', 'commands');
        if (!fs.existsSync(wsCommandsDir)) fs.mkdirSync(wsCommandsDir, { recursive: true });

        for (const skill of skills) {
          let skillContent = '';

          // Try to read full content from disk (SKILL.md + references)
          const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
          if (entryFile) {
            skillContent = entryFile.content;
          }

          // Append reference files content
          const tree = skillStorage.scanSkillTree(skill.slug);
          if (tree) {
            for (const item of tree) {
              if (item.type === 'directory' && item.children) {
                for (const child of item.children) {
                  if (child.type === 'file' && child.name.endsWith('.md')) {
                    const refFile = skillStorage.readSkillFile(skill.slug, child.path);
                    if (refFile) {
                      skillContent += `\n---\n\n## ${child.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n${refFile.content}\n`;
                    }
                  }
                }
              }
            }
          }

          // Fallback to DB prompt if no files on disk
          if (!skillContent.trim() && skill.prompt && skill.prompt.trim()) {
            skillContent = skill.prompt;
          }

          // Fallback to basic content
          if (!skillContent.trim()) {
            skillContent = `# ${skill.name}\n\n${skill.description || 'No description'}`;
          }

          // 1. Write as command (.claude/commands/<slug>.md) — shows as /<slug>
          const cmdFilePath = path.join(wsCommandsDir, `${skill.slug}.md`);
          fs.writeFileSync(cmdFilePath, skillContent, 'utf8');
          try { fs.chownSync(cmdFilePath, 1001, 1001); } catch (_) {}

          // 2. Write as skill (.claude/skills/<slug>/SKILL.md) — model-invocable
          const wsSkillDir = path.join(wsDir, '.claude', 'skills', skill.slug);
          if (!fs.existsSync(wsSkillDir)) fs.mkdirSync(wsSkillDir, { recursive: true });
          const skillFrontMatter = `---\nname: ${skill.slug}\ndescription: "${(skill.description || skill.name).replace(/"/g, '\\"')}"\n---\n\n`;
          const skillFilePath = path.join(wsSkillDir, 'SKILL.md');
          fs.writeFileSync(skillFilePath, skillFrontMatter + skillContent, 'utf8');
          try { fs.chownSync(skillFilePath, 1001, 1001); } catch (_) {}
        }
        console.log(`[Workspace] Wrote ${skills.length} skill(s) to commands/ + skills/ in ${wsDir}/.claude`);
      }
    } catch (err) {
      console.warn(`[Workspace] Failed to write skill files for ${agentName}:`, err.message);
    }
  }

  // Create .claude/settings.local.json with permissions for sub-agents
  const claudeSettingsDir = path.join(wsDir, '.claude');
  if (!fs.existsSync(claudeSettingsDir)) fs.mkdirSync(claudeSettingsDir, { recursive: true });
  const settingsPath = path.join(claudeSettingsDir, 'settings.local.json');
  const settings = {
    permissions: {
      allow: [
        "Read",
        "Write",
        "Edit",
        "Bash(*)",
        "Glob",
        "Grep",
        "WebFetch",
        "WebSearch",
        "Task",
        "mcp__plugin_playwright_playwright__browser_navigate",
        "mcp__plugin_playwright_playwright__browser_take_screenshot",
        "mcp__plugin_playwright_playwright__browser_evaluate",
        "mcp__plugin_playwright_playwright__browser_resize",
        "mcp__plugin_playwright_playwright__browser_close",
        "mcp__plugin_playwright_playwright__browser_install",
        "mcp__plugin_playwright_playwright__browser_snapshot",
        "mcp__plugin_playwright_playwright__browser_click",
        "mcp__plugin_playwright_playwright__browser_type",
        "mcp__plugin_playwright_playwright__browser_fill_form",
        "mcp__plugin_playwright_playwright__browser_press_key",
        "mcp__plugin_playwright_playwright__browser_hover",
        "mcp__plugin_playwright_playwright__browser_select_option",
        "mcp__plugin_playwright_playwright__browser_tabs",
        "mcp__plugin_playwright_playwright__browser_wait_for",
        "mcp__plugin_playwright_playwright__browser_run_code",
        "mcp__plugin_playwright_playwright__browser_console_messages",
        "mcp__plugin_playwright_playwright__browser_network_requests",
        "mcp__plugin_playwright_playwright__browser_handle_dialog",
        "mcp__plugin_playwright_playwright__browser_file_upload",
        "mcp__plugin_playwright_playwright__browser_navigate_back",
        "mcp__plugin_playwright_playwright__browser_drag"
      ]
    },
    maxTokens: 128000,
    contextWindow: 200000
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  try { fs.chownSync(settingsPath, 1001, 1001); } catch (_) {}
  try { fs.chownSync(claudeSettingsDir, 1001, 1001); } catch (_) {}

  // ── Generate .mcp.json for Claude CLI MCP tool discovery ──
  if (agentName) {
    try {
      const dbTools = await db.getMcpAgentTools(agentName);
      let agentPlatforms = [];
      try { agentPlatforms = await db.getAgentPlatforms(agentName); } catch (_) {}

      const hasTools = (dbTools && dbTools.length > 0) || (agentPlatforms && agentPlatforms.length > 0);
      const mcpJsonPath = path.join(wsDir, '.mcp.json');

      if (hasTools) {
        // Resolve absolute path to the stdio MCP bridge server
        const stdioServerPath = path.join(__dirname, 'mcp-stdio-server.js');
        const permissionServerPath = path.join(__dirname, 'mcp-permission-server.js');

        const mcpConfig = {
          mcpServers: {
            'guru-agent-tools': {
              command: 'node',
              args: [stdioServerPath],
              // Environment inherited from terminal: AGENT_PROXY_URL, AGENT_SESSION_TOKEN, etc.
            },
            'guru-permission': {
              command: 'node',
              args: [permissionServerPath],
              // Environment inherited: PERMISSION_CALLBACK_URL, PERMISSION_CHAT_ID, AGENT_SESSION_TOKEN
            },
          },
        };

        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
        try { fs.chownSync(mcpJsonPath, 1001, 1001); } catch (_) {}

        // Add MCP tool permissions to settings.local.json
        const { formatToolsForMcp } = require('./lib/mcp-agent-tools');
        const { getSystemToolsMcp, getPlatformToolsMcp } = require('./lib/mcp-processors');

        const allToolNames = [];

        // System tools
        const sysTools = getSystemToolsMcp();
        for (const t of sysTools) allToolNames.push(t.name);

        // Agent-specific tools
        const mcpFormatted = formatToolsForMcp(dbTools, agentName);
        for (const t of mcpFormatted) allToolNames.push(t.name);

        // Platform tools
        if (agentPlatforms.length > 0) {
          const platTools = getPlatformToolsMcp(agentPlatforms);
          for (const t of platTools) allToolNames.push(t.name);
        }

        // Add each as mcp__guru-agent-tools__<tool_name> to permissions
        for (const name of allToolNames) {
          const perm = `mcp__guru-agent-tools__${name}`;
          if (!settings.permissions.allow.includes(perm)) {
            settings.permissions.allow.push(perm);
          }
        }

        // Also add permission MCP tool to settings
        const permPerm = 'mcp__guru-permission__permission_prompt';
        if (!settings.permissions.allow.includes(permPerm)) {
          settings.permissions.allow.push(permPerm);
        }

        // Re-write settings with MCP permissions
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        console.log(`[Workspace] Generated .mcp.json for ${agentName} (${dbTools.length} tools, ${agentPlatforms.length} platforms, ${allToolNames.length} permissions)`);
      } else {
        // No agent-specific tools, but still write .mcp.json with permission server
        // so --permission-prompt-tool works from the chat panel
        const permissionServerPath = path.join(__dirname, 'mcp-permission-server.js');
        const mcpConfig = {
          mcpServers: {
            'guru-permission': {
              command: 'node',
              args: [permissionServerPath],
            },
          },
        };
        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2));
        try { fs.chownSync(mcpJsonPath, 1001, 1001); } catch (_) {}

        // Add permission MCP tool to settings
        const permPerm = 'mcp__guru-permission__permission_prompt';
        if (!settings.permissions.allow.includes(permPerm)) {
          settings.permissions.allow.push(permPerm);
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        }

        console.log(`[Workspace] Generated .mcp.json for ${agentName} (permission server only, no agent tools)`);
      }
    } catch (err) {
      console.warn(`[Workspace] Failed to generate .mcp.json for ${agentName}:`, err.message);
    }
  }

  // Ensure claude-user can read it
  try { fs.chownSync(claudeMdPath, 1001, 1001); } catch (_) {}
  try { fs.chownSync(wsDir, 1001, 1001); } catch (_) {}

  return claudeMdPath;
}

/**
 * Sync agent skills to a user's HOME directory:
 * - ~/.claude/commands/<slug>.md → user-invocable as /<slug>
 * - ~/.claude/skills/<slug>/SKILL.md → model-invocable with front matter
 */
async function syncSkillsToHome(agentName, userHomePath) {
  if (!agentName || !userHomePath) return;
  try {
    const skills = await db.getAgentSkills(agentName);
    const homeCommandsDir = path.join(userHomePath, '.claude', 'commands');
    const homeSkillsDir = path.join(userHomePath, '.claude', 'skills');

    if (!skills || skills.length === 0) {
      // No skills — clean up old files
      for (const dir of [homeCommandsDir, homeSkillsDir]) {
        if (fs.existsSync(dir)) {
          try {
            const existing = fs.readdirSync(dir);
            for (const f of existing) {
              const fp = path.join(dir, f);
              try {
                const stat = fs.statSync(fp);
                if (stat.isFile() && f.endsWith('.md')) fs.unlinkSync(fp);
                if (stat.isDirectory()) {
                  // Remove skill subdirectories
                  const children = fs.readdirSync(fp);
                  for (const c of children) fs.unlinkSync(path.join(fp, c));
                  fs.rmdirSync(fp);
                }
              } catch (_) {}
            }
          } catch (_) {}
        }
      }
      return;
    }

    if (!fs.existsSync(homeCommandsDir)) fs.mkdirSync(homeCommandsDir, { recursive: true });

    for (const skill of skills) {
      let skillContent = '';

      // Try to read full content from disk (SKILL.md + references)
      const entryFile = skillStorage.readSkillFile(skill.slug, skill.entry_point || 'SKILL.md');
      if (entryFile) {
        skillContent = entryFile.content;
      }

      // Append reference files content
      const tree = skillStorage.scanSkillTree(skill.slug);
      if (tree) {
        for (const item of tree) {
          if (item.type === 'directory' && item.children) {
            for (const child of item.children) {
              if (child.type === 'file' && child.name.endsWith('.md')) {
                const refFile = skillStorage.readSkillFile(skill.slug, child.path);
                if (refFile) {
                  skillContent += `\n---\n\n## ${child.name.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}\n\n${refFile.content}\n`;
                }
              }
            }
          }
        }
      }

      // Fallback to DB prompt if no files on disk
      if (!skillContent.trim() && skill.prompt && skill.prompt.trim()) {
        skillContent = skill.prompt;
      }
      if (!skillContent.trim()) {
        skillContent = `# ${skill.name}\n\n${skill.description || 'No description'}`;
      }

      // 1. Write as command (~/.claude/commands/<slug>.md)
      const cmdPath = path.join(homeCommandsDir, `${skill.slug}.md`);
      fs.writeFileSync(cmdPath, skillContent, 'utf8');

      // 2. Write as skill (~/.claude/skills/<slug>/SKILL.md)
      const skillDir = path.join(homeSkillsDir, skill.slug);
      if (!fs.existsSync(skillDir)) fs.mkdirSync(skillDir, { recursive: true });
      const skillFrontMatter = `---\nname: ${skill.slug}\ndescription: "${(skill.description || skill.name).replace(/"/g, '\\"')}"\n---\n\n`;
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillFrontMatter + skillContent, 'utf8');
    }
    console.log(`[Workspace] Synced ${skills.length} skill(s) to commands/ + skills/ in ${userHomePath}/.claude`);
  } catch (err) {
    console.warn(`[Workspace] Failed to sync skills to home for ${agentName}:`, err.message);
  }
}

module.exports = { generateWorkspaceContext, getAgentPrompt, getSkillContext, getKnowledgeContext, syncSkillsToHome, readBranchContext, writeBranchContext };
