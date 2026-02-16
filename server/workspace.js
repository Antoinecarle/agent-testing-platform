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

  const content = `${rootAuthority ? rootAuthority + '\n\n---\n\n' : ''}# ${project.name}

## Context

You are working inside the **Agent Testing Platform** — a worktree-based system for testing and iterating on AI design agents.

- **Project**: ${project.name}
- **Primary Agent**: ${agentName || '(none assigned)'}
- **Description**: ${project.description || 'N/A'}
- **Total Iterations**: ${iterations.length}

## Current Worktree

\`\`\`
${treeText}\`\`\`

${latest ? `**Latest iteration**: ${latest.title || 'V' + latest.version} (agent: ${latest.agent_name})` : ''}

${branchSection}
## What You Should Do

${agentDesc
  ? `You are the **${agentName}** agent: ${agentDesc}

Your job is to **create and iterate on web interfaces** following your agent specialization above. Each time you generate a new version, save it as a single \`index.html\` file in the current directory.`
  : `You are here to **create and iterate on web interfaces**. Each time you generate a new version, save it as a single \`index.html\` file in the current directory.`}

**IMPORTANT**: Follow your Agent Instructions (below) for the style, type of interface, and design patterns. Do NOT default to generic "landing pages" — build what your agent specialization requires.

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
This auto-detects the projectId from your current directory and triggers the save pipeline. This is the ONLY platform command you should run.

### Output Rules

#### Single version (default)
- Save your output as \`index.html\` in the current directory (\`./index.html\`)
- Generate a **single self-contained HTML file** with all CSS and JS inlined
- The file will be **automatically detected** by the platform and added to the worktree
- Each time you generate a new version, **overwrite** \`./index.html\` — the platform handles versioning automatically

#### Multiple versions in parallel (when using teams/multiple agents)
- If you are generating **multiple versions at the same time** (e.g., V1, V2, V3, V4 via parallel agents), each version MUST go in its own subdirectory:
  - \`./version-1/index.html\`
  - \`./version-2/index.html\`
  - \`./version-3/index.html\`
  - etc.
- The platform watcher detects subdirectory-based versions automatically
- Each subdirectory MUST contain a file named \`index.html\` (not any other name)

#### General rules
- The filename MUST always be \`index.html\` (whether at root or in a version subdirectory)
- **NEVER use filenames** like \`version-1.html\`, \`v2.html\`, \`landing.html\` — always use \`index.html\` inside a directory
- Do NOT take screenshots or generate images — just write the HTML code

#### Images — CRITICAL
- **NEVER reference local image files** like \`src="images/hero.png"\` — they don't exist and will show broken
- For images, use ONLY these approaches:
  1. **Unsplash URLs**: \`src="https://images.unsplash.com/photo-xxx?w=800&h=600&fit=crop"\`
  2. **Inline SVG placeholders**: Create decorative SVGs directly in the HTML
  3. **CSS gradients/patterns**: Use CSS for decorative backgrounds
  4. **Data URIs**: For small icons, use inline base64 data URIs
- The HTML file must be **100% self-contained** — no external local assets

### Quality Standards

- Mobile-responsive design (works at 375px, 768px, and 1440px)
- Smooth animations and transitions
- Dark theme preferred unless the agent specifies otherwise
- Professional, production-ready quality
- All text content should be realistic (no lorem ipsum)

${agentPrompt ? `## Agent Instructions

The following is the full prompt for the **${agentName}** agent. Follow these instructions for style, design patterns, and technical implementation:

---

${agentPrompt}` : `## No Agent Assigned

No specific agent is assigned to this project. You can use any design style. Consider asking the user which agent/style they'd like to use.`}

${isOrchestra && teamMembers.length > 0 ? (() => {
    const leader = teamMembers.find(m => m.role === 'leader');
    const workers = teamMembers.filter(m => m.role !== 'leader');
    return `## Orchestra Mode — Team Structure

This project runs in **Orchestra mode**. You are the **orchestrator** (${leader?.agent_name || agentName}).

### Your Team

| Role | Agent | Specialty |
|------|-------|-----------|
| **Orchestrator (You)** | ${leader?.agent_name || agentName} | ${leader?.agent_description || agentDesc || 'Primary coordinator'} |
${workers.map(w => `| Worker | ${w.agent_name} | ${w.agent_description || 'Team member'} |`).join('\n')}

### How to Delegate to Team Members

All team member agents are available in \`.claude/agents/\`. You can delegate work by using the Task tool to spawn a sub-agent:

Available agents you can delegate to:
${workers.map(w => `- **${w.agent_name}** — ${w.agent_description || 'Available for tasks'}`).join('\n')}

### Orchestration Guidelines

1. **You coordinate** — break down the user's request into sub-tasks
2. **Delegate specialized work** to the appropriate team member agents
3. **Synthesize results** — combine outputs into the final \`index.html\`
4. **Each agent writes to its own version subdirectory** when doing parallel work:
   - You write to \`./index.html\` (the final combined version)
   - Sub-agents can write to \`./version-{N}/index.html\` for drafts
5. **Quality control** — review sub-agent outputs before finalizing
`;
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

  // Ensure this agent's .md file exists in the workspace .claude/agents/ too
  // so Claude CLI /agents command shows it
  const wsAgentsDir = path.join(wsDir, '.claude', 'agents');
  if (agentName && agentPrompt) {
    if (!fs.existsSync(wsAgentsDir)) fs.mkdirSync(wsAgentsDir, { recursive: true });
    fs.writeFileSync(path.join(wsAgentsDir, `${agentName}.md`), agentPrompt, 'utf8');
  }

  // Orchestra mode: write ALL team member agent .md files to .claude/agents/
  if (isOrchestra && teamMembers.length > 0) {
    if (!fs.existsSync(wsAgentsDir)) fs.mkdirSync(wsAgentsDir, { recursive: true });
    for (const member of teamMembers) {
      if (member.agent_name === agentName) continue; // already written above
      const memberPrompt = await getAgentPrompt(member.agent_name);
      if (memberPrompt) {
        const memberFilePath = path.join(wsAgentsDir, `${member.agent_name}.md`);
        fs.writeFileSync(memberFilePath, memberPrompt, 'utf8');
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
    }
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  try { fs.chownSync(settingsPath, 1001, 1001); } catch (_) {}
  try { fs.chownSync(claudeSettingsDir, 1001, 1001); } catch (_) {}

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
