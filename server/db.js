const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'platform.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// --- Agents table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    name TEXT PRIMARY KEY,
    description TEXT DEFAULT '',
    model TEXT DEFAULT '',
    category TEXT DEFAULT 'uncategorized',
    prompt_preview TEXT DEFAULT '',
    screenshot_path TEXT DEFAULT '',
    rating INTEGER DEFAULT 0,
    last_used_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Projects table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    agent_name TEXT DEFAULT '',
    status TEXT DEFAULT 'active',
    iteration_count INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Iterations table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS iterations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT DEFAULT '',
    prompt TEXT DEFAULT '',
    parent_id TEXT REFERENCES iterations(id),
    file_path TEXT DEFAULT '',
    screenshot_path TEXT DEFAULT '',
    status TEXT DEFAULT 'completed',
    metadata TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Sessions table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    project_id TEXT DEFAULT '',
    agent_name TEXT DEFAULT '',
    created_at INTEGER NOT NULL,
    cwd TEXT DEFAULT '/root',
    shell TEXT DEFAULT '/bin/bash'
  )
`);

// --- Terminal tabs table (persists tab-session mapping per project) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS terminal_tabs (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    session_id TEXT DEFAULT '',
    name TEXT DEFAULT '',
    cwd TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Users table (simplified) ---
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`);

// --- Agents table: migration for new columns ---
const agentMigrations = [
  ['full_prompt', "TEXT DEFAULT ''"],
  ['source', "TEXT DEFAULT 'filesystem'"],
  ['tools', "TEXT DEFAULT ''"],
  ['max_turns', 'INTEGER DEFAULT 0'],
  ['memory', "TEXT DEFAULT ''"],
  ['permission_mode', "TEXT DEFAULT ''"],
];
for (const [col, def] of agentMigrations) {
  try { db.exec(`ALTER TABLE agents ADD COLUMN ${col} ${def}`); } catch {}
}

// --- Categories table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT DEFAULT '#8B5CF6',
    icon TEXT DEFAULT '',
    description TEXT DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Agent Teams table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    updated_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Agent Team Members table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL REFERENCES agents(name) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    UNIQUE(team_id, agent_name)
  )
`);

// --- Team Runs table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS team_runs (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL REFERENCES agent_teams(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending',
    config TEXT DEFAULT '{}',
    started_at INTEGER,
    completed_at INTEGER,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Team Run Logs table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS team_run_logs (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES team_runs(id) ON DELETE CASCADE,
    agent_name TEXT DEFAULT '',
    message TEXT DEFAULT '',
    log_type TEXT DEFAULT 'info',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// --- Agent Versions table ---
db.exec(`
  CREATE TABLE IF NOT EXISTS agent_versions (
    id TEXT PRIMARY KEY,
    agent_name TEXT NOT NULL REFERENCES agents(name) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    full_prompt TEXT DEFAULT '',
    description TEXT DEFAULT '',
    model TEXT DEFAULT '',
    tools TEXT DEFAULT '',
    max_turns INTEGER DEFAULT 0,
    memory TEXT DEFAULT '',
    permission_mode TEXT DEFAULT '',
    change_summary TEXT DEFAULT '',
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )
`);

// Seed default categories if table is empty
const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
if (catCount.c === 0) {
  const seedCats = db.prepare('INSERT OR IGNORE INTO categories (id, name, color, icon, sort_order) VALUES (?, ?, ?, ?, ?)');
  const defaults = [
    ['cat-builders', 'builders', '#8B5CF6', 'hammer', 1],
    ['cat-design', 'design', '#ec4899', 'palette', 2],
    ['cat-dev-tools', 'dev-tools', '#22c55e', 'code', 3],
    ['cat-seo', 'seo', '#f59e0b', 'search', 4],
    ['cat-animation', 'animation', '#06b6d4', 'sparkles', 5],
    ['cat-epiminds', 'epiminds', '#a855f7', 'brain', 6],
    ['cat-style', 'style', '#f97316', 'brush', 7],
    ['cat-uncategorized', 'uncategorized', '#52525B', 'folder', 99],
  ];
  const insertMany = db.transaction((cats) => {
    for (const c of cats) seedCats.run(...c);
  });
  insertMany(defaults);
}

// ===================== PREPARED STATEMENTS =====================

// --- Agent statements ---
const agentStmts = {
  upsert: db.prepare(`
    INSERT INTO agents (name, description, model, category, prompt_preview, screenshot_path, rating, full_prompt, source, tools, max_turns, memory, permission_mode, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s','now'))
    ON CONFLICT(name) DO UPDATE SET
      description = excluded.description,
      model = excluded.model,
      category = excluded.category,
      prompt_preview = excluded.prompt_preview,
      full_prompt = excluded.full_prompt,
      source = CASE WHEN agents.source = 'manual' AND excluded.source = 'filesystem' THEN agents.source ELSE excluded.source END,
      tools = excluded.tools,
      max_turns = excluded.max_turns,
      memory = excluded.memory,
      permission_mode = excluded.permission_mode,
      updated_at = excluded.updated_at
  `),
  create: db.prepare(`
    INSERT INTO agents (name, description, model, category, prompt_preview, screenshot_path, rating, full_prompt, source, tools, max_turns, memory, permission_mode, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'manual', ?, ?, ?, ?, strftime('%s','now'))
  `),
  getAll: db.prepare(`
    SELECT a.*, COALESCE(pc.count, 0) as project_count
    FROM agents a
    LEFT JOIN (SELECT agent_name, COUNT(*) as count FROM projects GROUP BY agent_name) pc ON pc.agent_name = a.name
    ORDER BY a.name ASC
  `),
  getByName: db.prepare('SELECT * FROM agents WHERE name = ?'),
  getByCategory: db.prepare(`
    SELECT a.*, COALESCE(pc.count, 0) as project_count
    FROM agents a
    LEFT JOIN (SELECT agent_name, COUNT(*) as count FROM projects GROUP BY agent_name) pc ON pc.agent_name = a.name
    WHERE a.category = ? ORDER BY a.name ASC
  `),
  updateRating: db.prepare("UPDATE agents SET rating = ?, updated_at = strftime('%s','now') WHERE name = ?"),
  updateLastUsed: db.prepare("UPDATE agents SET last_used_at = strftime('%s','now'), updated_at = strftime('%s','now') WHERE name = ?"),
  updateScreenshot: db.prepare("UPDATE agents SET screenshot_path = ?, updated_at = strftime('%s','now') WHERE name = ?"),
  delete: db.prepare('DELETE FROM agents WHERE name = ?'),
  search: db.prepare(`
    SELECT a.*, COALESCE(pc.count, 0) as project_count
    FROM agents a
    LEFT JOIN (SELECT agent_name, COUNT(*) as count FROM projects GROUP BY agent_name) pc ON pc.agent_name = a.name
    WHERE a.name LIKE ? OR a.description LIKE ? OR a.category LIKE ? ORDER BY a.name ASC
  `),
  getProjectCount: db.prepare('SELECT COUNT(*) as count FROM projects WHERE agent_name = ?'),
  getProjectsByAgent: db.prepare('SELECT * FROM projects WHERE agent_name = ? ORDER BY created_at DESC'),
};

function upsertAgent(name, description, model, category, promptPreview, screenshotPath, rating, fullPrompt, source, tools, maxTurns, memory, permissionMode) {
  agentStmts.upsert.run(name, description || '', model || '', category || 'uncategorized', promptPreview || '', screenshotPath || '', rating || 0, fullPrompt || '', source || 'filesystem', tools || '', maxTurns || 0, memory || '', permissionMode || '');
}
function createAgentManual(name, description, model, category, promptPreview, fullPrompt, tools, maxTurns, memory, permissionMode) {
  agentStmts.create.run(name, description || '', model || '', category || 'uncategorized', promptPreview || '', '', fullPrompt || '', tools || '', maxTurns || 0, memory || '', permissionMode || '');
}
function getAllAgents() { return agentStmts.getAll.all(); }
function getAgent(name) { return agentStmts.getByName.get(name); }
function getAgentsByCategory(category) { return agentStmts.getByCategory.all(category); }
function updateAgentRating(name, rating) { agentStmts.updateRating.run(rating, name); }
function updateAgentLastUsed(name) { agentStmts.updateLastUsed.run(name); }
function updateAgentScreenshot(name, path) { agentStmts.updateScreenshot.run(path, name); }
function deleteAgent(name) { agentStmts.delete.run(name); }
function searchAgents(query) {
  const q = `%${query}%`;
  return agentStmts.search.all(q, q, q);
}
function getAgentProjectCount(name) {
  const row = agentStmts.getProjectCount.get(name);
  return row ? row.count : 0;
}
function getProjectsByAgent(name) { return agentStmts.getProjectsByAgent.all(name); }
function updateAgent(name, fields) {
  const sets = [];
  const vals = [];
  if (fields.description !== undefined) { sets.push('description = ?'); vals.push(fields.description); }
  if (fields.model !== undefined) { sets.push('model = ?'); vals.push(fields.model); }
  if (fields.category !== undefined) { sets.push('category = ?'); vals.push(fields.category); }
  if (fields.prompt_preview !== undefined) { sets.push('prompt_preview = ?'); vals.push(fields.prompt_preview); }
  if (fields.full_prompt !== undefined) { sets.push('full_prompt = ?'); vals.push(fields.full_prompt); }
  if (fields.tools !== undefined) { sets.push('tools = ?'); vals.push(fields.tools); }
  if (fields.max_turns !== undefined) { sets.push('max_turns = ?'); vals.push(fields.max_turns); }
  if (fields.memory !== undefined) { sets.push('memory = ?'); vals.push(fields.memory); }
  if (fields.permission_mode !== undefined) { sets.push('permission_mode = ?'); vals.push(fields.permission_mode); }
  if (sets.length === 0) return;
  sets.push("updated_at = strftime('%s','now')");
  vals.push(name);
  db.prepare(`UPDATE agents SET ${sets.join(', ')} WHERE name = ?`).run(...vals);
}

// --- Category statements ---
const catStmts = {
  getAll: db.prepare('SELECT * FROM categories ORDER BY sort_order ASC, name ASC'),
  getById: db.prepare('SELECT * FROM categories WHERE id = ?'),
  getByName: db.prepare('SELECT * FROM categories WHERE name = ?'),
  create: db.prepare('INSERT INTO categories (id, name, color, icon, description, sort_order) VALUES (?, ?, ?, ?, ?, ?)'),
  update: db.prepare("UPDATE categories SET name = ?, color = ?, icon = ?, description = ?, sort_order = ?, updated_at = strftime('%s','now') WHERE id = ?"),
  delete: db.prepare('DELETE FROM categories WHERE id = ?'),
};

function getAllCategories() { return catStmts.getAll.all(); }
function getCategory(id) { return catStmts.getById.get(id); }
function getCategoryByName(name) { return catStmts.getByName.get(name); }
function createCategory(id, name, color, icon, description, sortOrder) {
  catStmts.create.run(id, name, color || '#8B5CF6', icon || '', description || '', sortOrder || 0);
}
function updateCategory(id, name, color, icon, description, sortOrder) {
  catStmts.update.run(name, color || '#8B5CF6', icon || '', description || '', sortOrder || 0, id);
}
function deleteCategory(id) { catStmts.delete.run(id); }
function reorderCategories(orderedIds) {
  const stmt = db.prepare("UPDATE categories SET sort_order = ?, updated_at = strftime('%s','now') WHERE id = ?");
  const txn = db.transaction((ids) => {
    ids.forEach((id, idx) => stmt.run(idx, id));
  });
  txn(orderedIds);
}

// --- Project statements ---
const projectStmts = {
  create: db.prepare('INSERT INTO projects (id, name, description, agent_name, status) VALUES (?, ?, ?, ?, ?)'),
  getAll: db.prepare(`
    SELECT p.*,
      (SELECT i.id FROM iterations i WHERE i.project_id = p.id ORDER BY i.created_at DESC LIMIT 1) as latest_iteration_id
    FROM projects p ORDER BY p.created_at DESC
  `),
  getById: db.prepare('SELECT * FROM projects WHERE id = ?'),
  update: db.prepare("UPDATE projects SET name = ?, description = ?, agent_name = ?, status = ?, updated_at = strftime('%s','now') WHERE id = ?"),
  updateIterationCount: db.prepare("UPDATE projects SET iteration_count = ?, updated_at = strftime('%s','now') WHERE id = ?"),
  delete: db.prepare('DELETE FROM projects WHERE id = ?'),
};

function createProject(id, name, description, agentName) {
  projectStmts.create.run(id, name, description || '', agentName || '', 'active');
}
function getAllProjects() { return projectStmts.getAll.all(); }
function getProject(id) { return projectStmts.getById.get(id); }
function updateProject(id, name, description, agentName, status) {
  projectStmts.update.run(name, description || '', agentName || '', status || 'active', id);
}
function updateProjectIterationCount(id, count) { projectStmts.updateIterationCount.run(count, id); }
function deleteProject(id) { projectStmts.delete.run(id); }

// --- Iteration statements ---
const iterStmts = {
  create: db.prepare('INSERT INTO iterations (id, project_id, agent_name, version, title, prompt, parent_id, file_path, screenshot_path, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getAll: db.prepare('SELECT * FROM iterations WHERE project_id = ? ORDER BY version ASC'),
  getById: db.prepare('SELECT * FROM iterations WHERE id = ?'),
  getByProject: db.prepare('SELECT * FROM iterations WHERE project_id = ? ORDER BY created_at ASC'),
  getChildren: db.prepare('SELECT * FROM iterations WHERE parent_id = ? ORDER BY version ASC'),
  getRoots: db.prepare('SELECT * FROM iterations WHERE project_id = ? AND parent_id IS NULL ORDER BY version ASC'),
  getMaxVersion: db.prepare('SELECT MAX(version) as max_version FROM iterations WHERE project_id = ?'),
  update: db.prepare("UPDATE iterations SET title = ?, prompt = ?, status = ?, metadata = ? WHERE id = ?"),
  updateFilePath: db.prepare('UPDATE iterations SET file_path = ? WHERE id = ?'),
  updateScreenshot: db.prepare('UPDATE iterations SET screenshot_path = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM iterations WHERE id = ?'),
  countByProject: db.prepare('SELECT COUNT(*) as count FROM iterations WHERE project_id = ?'),
};

function createIteration(id, projectId, agentName, version, title, prompt, parentId, filePath, screenshotPath, status, metadata) {
  iterStmts.create.run(id, projectId, agentName, version, title || '', prompt || '', parentId || null, filePath || '', screenshotPath || '', status || 'completed', JSON.stringify(metadata || {}));
}
function getAllIterations(projectId) { return iterStmts.getAll.all(projectId).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })); }
function getIteration(id) {
  const r = iterStmts.getById.get(id);
  return r ? { ...r, metadata: JSON.parse(r.metadata || '{}') } : null;
}
function getIterationsByProject(projectId) { return iterStmts.getByProject.all(projectId).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })); }
function getIterationChildren(parentId) { return iterStmts.getChildren.all(parentId).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })); }
function getIterationRoots(projectId) { return iterStmts.getRoots.all(projectId).map(r => ({ ...r, metadata: JSON.parse(r.metadata || '{}') })); }
function getNextVersion(projectId) {
  const row = iterStmts.getMaxVersion.get(projectId);
  return (row && row.max_version != null) ? row.max_version + 1 : 1;
}
function updateIteration(id, title, prompt, status, metadata) {
  iterStmts.update.run(title || '', prompt || '', status || 'completed', JSON.stringify(metadata || {}), id);
}
function updateIterationFilePath(id, filePath) { iterStmts.updateFilePath.run(filePath, id); }
function updateIterationScreenshot(id, screenshotPath) { iterStmts.updateScreenshot.run(screenshotPath, id); }
function deleteIteration(id) { iterStmts.delete.run(id); }
function countIterations(projectId) {
  const row = iterStmts.countByProject.get(projectId);
  return row ? row.count : 0;
}

// --- Session statements ---
const sessionStmts = {
  insert: db.prepare('INSERT INTO sessions (id, name, project_id, agent_name, created_at, cwd, shell) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  getAll: db.prepare('SELECT * FROM sessions ORDER BY created_at ASC'),
  get: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  rename: db.prepare('UPDATE sessions SET name = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM sessions WHERE id = ?'),
  removeAll: db.prepare('DELETE FROM sessions'),
};

function insertSession(id, name, createdAt, projectId, cwd, shell) {
  sessionStmts.insert.run(id, name, projectId || '', '', createdAt, cwd || '/root', shell || '/bin/bash');
}
function getAllSessions() { return sessionStmts.getAll.all(); }
function getSession(id) { return sessionStmts.get.get(id); }
function renameSession(id, name) { sessionStmts.rename.run(name, id); }
function removeSession(id) { sessionStmts.remove.run(id); }
function removeAllSessions() { sessionStmts.removeAll.run(); }

// --- Terminal tabs statements ---
const tabStmts = {
  upsert: db.prepare(`
    INSERT INTO terminal_tabs (id, project_id, session_id, name, cwd)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET session_id = excluded.session_id, name = excluded.name, cwd = excluded.cwd
  `),
  getByProject: db.prepare('SELECT * FROM terminal_tabs WHERE project_id = ? ORDER BY created_at ASC'),
  get: db.prepare('SELECT * FROM terminal_tabs WHERE id = ?'),
  updateSession: db.prepare('UPDATE terminal_tabs SET session_id = ? WHERE id = ?'),
  remove: db.prepare('DELETE FROM terminal_tabs WHERE id = ?'),
  removeByProject: db.prepare('DELETE FROM terminal_tabs WHERE project_id = ?'),
  getBySession: db.prepare('SELECT * FROM terminal_tabs WHERE session_id = ?'),
};

function upsertTerminalTab(id, projectId, sessionId, name, cwd) {
  tabStmts.upsert.run(id, projectId, sessionId || '', name || '', cwd || '');
}
function getTerminalTabsByProject(projectId) { return tabStmts.getByProject.all(projectId); }
function getTerminalTab(id) { return tabStmts.get.get(id); }
function updateTerminalTabSession(id, sessionId) { tabStmts.updateSession.run(sessionId || '', id); }
function removeTerminalTab(id) { tabStmts.remove.run(id); }
function removeTerminalTabsByProject(projectId) { tabStmts.removeByProject.run(projectId); }
function getTerminalTabBySession(sessionId) { return tabStmts.getBySession.get(sessionId); }

// --- Session statements (add getByProject) ---
const sessionsByProjectStmt = db.prepare('SELECT * FROM sessions WHERE project_id = ? ORDER BY created_at ASC');
function getSessionsByProject(projectId) { return sessionsByProjectStmt.all(projectId); }

// --- Users table: migration for new columns ---
const userMigrations = [
  ['display_name', "TEXT DEFAULT ''"],
  ['claude_connected', 'INTEGER DEFAULT 0'],
  ['claude_subscription', "TEXT DEFAULT ''"],
  ['claude_connected_at', 'INTEGER'],
  ['claude_home_dir', "TEXT DEFAULT ''"],
];
for (const [col, def] of userMigrations) {
  try { db.exec(`ALTER TABLE users ADD COLUMN ${col} ${def}`); } catch {}
}

// --- User statements ---
const userStmts = {
  getByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  getById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getAll: db.prepare('SELECT id, email, display_name, role, claude_connected, claude_subscription, claude_connected_at, claude_home_dir, created_at FROM users ORDER BY created_at ASC'),
  create: db.prepare('INSERT INTO users (id, email, password_hash, role, display_name, claude_home_dir) VALUES (?, ?, ?, ?, ?, ?)'),
  updateClaudeStatus: db.prepare('UPDATE users SET claude_connected = ?, claude_subscription = ?, claude_home_dir = ?, claude_connected_at = ? WHERE id = ?'),
};

function getUserByEmail(email) { return userStmts.getByEmail.get(email); }
function getUserById(id) { return userStmts.getById.get(id); }
function getAllUsers() { return userStmts.getAll.all(); }
function createUser(id, email, passwordHash, role, displayName, homeDir) {
  userStmts.create.run(id, email, passwordHash || null, role || 'user', displayName || '', homeDir || '');
}
function updateUserClaudeStatus(id, connected, subscription, homeDir) {
  userStmts.updateClaudeStatus.run(connected ? 1 : 0, subscription || '', homeDir || '', connected ? Math.floor(Date.now() / 1000) : null, id);
}

// --- Seed admin ---
function seedAdmin() {
  const adminEmail = process.env.EMAIL || 'admin@vps.local';
  const existing = getUserByEmail(adminEmail);
  if (!existing) {
    const id = crypto.randomUUID();
    const passwordHash = process.env.PASSWORD_HASH || null;
    const homeDir = `/data/users/${id}`;
    createUser(id, adminEmail, passwordHash, 'admin', 'Admin', homeDir);
    console.log(`[DB] Seeded admin user: ${adminEmail}`);
  }
}

// --- Agent Team statements ---
const teamStmts = {
  create: db.prepare('INSERT INTO agent_teams (id, name, description) VALUES (?, ?, ?)'),
  getAll: db.prepare(`
    SELECT t.*, COUNT(m.id) as member_count,
      GROUP_CONCAT(m.agent_name) as member_names
    FROM agent_teams t
    LEFT JOIN agent_team_members m ON m.team_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `),
  getById: db.prepare('SELECT * FROM agent_teams WHERE id = ?'),
  update: db.prepare("UPDATE agent_teams SET name = ?, description = ?, updated_at = strftime('%s','now') WHERE id = ?"),
  delete: db.prepare('DELETE FROM agent_teams WHERE id = ?'),
};

const teamMemberStmts = {
  add: db.prepare('INSERT INTO agent_team_members (id, team_id, agent_name, role, sort_order) VALUES (?, ?, ?, ?, ?)'),
  remove: db.prepare('DELETE FROM agent_team_members WHERE team_id = ? AND agent_name = ?'),
  getByTeam: db.prepare(`
    SELECT m.*, a.description as agent_description, a.model, a.category, a.rating, a.screenshot_path
    FROM agent_team_members m
    LEFT JOIN agents a ON a.name = m.agent_name
    WHERE m.team_id = ?
    ORDER BY m.sort_order ASC, m.created_at ASC
  `),
  updateOrder: db.prepare('UPDATE agent_team_members SET sort_order = ? WHERE team_id = ? AND agent_name = ?'),
  updateRole: db.prepare('UPDATE agent_team_members SET role = ? WHERE team_id = ? AND agent_name = ?'),
};

function createTeam(id, name, description) {
  teamStmts.create.run(id, name, description || '');
}
function getAllTeams() { return teamStmts.getAll.all(); }
function getTeam(id) { return teamStmts.getById.get(id); }
function updateTeam(id, name, description) {
  teamStmts.update.run(name, description || '', id);
}
function deleteTeam(id) { teamStmts.delete.run(id); }
function addTeamMember(id, teamId, agentName, role, sortOrder) {
  teamMemberStmts.add.run(id, teamId, agentName, role || 'member', sortOrder || 0);
}
function removeTeamMember(teamId, agentName) {
  teamMemberStmts.remove.run(teamId, agentName);
}
function getTeamMembers(teamId) { return teamMemberStmts.getByTeam.all(teamId); }
function updateTeamMemberRole(teamId, agentName, role) {
  teamMemberStmts.updateRole.run(role, teamId, agentName);
}
function reorderTeamMembers(teamId, orderedAgentNames) {
  const txn = db.transaction((names) => {
    names.forEach((name, idx) => teamMemberStmts.updateOrder.run(idx, teamId, name));
  });
  txn(orderedAgentNames);
}

// --- Agent Version statements ---
const versionStmts = {
  create: db.prepare('INSERT INTO agent_versions (id, agent_name, version_number, full_prompt, description, model, tools, max_turns, memory, permission_mode, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getByAgent: db.prepare('SELECT * FROM agent_versions WHERE agent_name = ? ORDER BY version_number DESC'),
  getById: db.prepare('SELECT * FROM agent_versions WHERE id = ?'),
  getMaxVersion: db.prepare('SELECT MAX(version_number) as max_version FROM agent_versions WHERE agent_name = ?'),
  getLatest: db.prepare('SELECT * FROM agent_versions WHERE agent_name = ? ORDER BY version_number DESC LIMIT 1'),
};

function createAgentVersion(id, agentName, versionNumber, fullPrompt, description, model, tools, maxTurns, memory, permissionMode, changeSummary) {
  versionStmts.create.run(id, agentName, versionNumber, fullPrompt || '', description || '', model || '', tools || '', maxTurns || 0, memory || '', permissionMode || '', changeSummary || '');
}
function getAgentVersions(agentName) { return versionStmts.getByAgent.all(agentName); }
function getAgentVersion(id) { return versionStmts.getById.get(id); }
function getNextAgentVersionNumber(agentName) {
  const row = versionStmts.getMaxVersion.get(agentName);
  return (row && row.max_version != null) ? row.max_version + 1 : 1;
}
function getLatestAgentVersion(agentName) { return versionStmts.getLatest.get(agentName); }

// --- Team Run statements ---
const teamRunStmts = {
  create: db.prepare('INSERT INTO team_runs (id, team_id, project_id, status, config) VALUES (?, ?, ?, ?, ?)'),
  getById: db.prepare('SELECT * FROM team_runs WHERE id = ?'),
  getByTeam: db.prepare('SELECT * FROM team_runs WHERE team_id = ? ORDER BY created_at DESC'),
  getByProject: db.prepare('SELECT * FROM team_runs WHERE project_id = ? ORDER BY created_at DESC'),
  updateStatus: db.prepare('UPDATE team_runs SET status = ?, started_at = ?, completed_at = ? WHERE id = ?'),
};

const teamRunLogStmts = {
  add: db.prepare('INSERT INTO team_run_logs (id, run_id, agent_name, message, log_type) VALUES (?, ?, ?, ?, ?)'),
  getByRun: db.prepare('SELECT * FROM team_run_logs WHERE run_id = ? ORDER BY created_at ASC'),
};

function createTeamRun(id, teamId, projectId, config) {
  teamRunStmts.create.run(id, teamId, projectId || null, 'pending', JSON.stringify(config || {}));
}
function getTeamRun(id) {
  const r = teamRunStmts.getById.get(id);
  return r ? { ...r, config: JSON.parse(r.config || '{}') } : null;
}
function getTeamRuns(teamId) {
  return teamRunStmts.getByTeam.all(teamId).map(r => ({ ...r, config: JSON.parse(r.config || '{}') }));
}
function getTeamRunsByProject(projectId) {
  return teamRunStmts.getByProject.all(projectId).map(r => ({ ...r, config: JSON.parse(r.config || '{}') }));
}
function updateTeamRunStatus(id, status) {
  const run = teamRunStmts.getById.get(id);
  if (!run) return;
  const now = Math.floor(Date.now() / 1000);
  const startedAt = status === 'running' ? now : (run.started_at || null);
  const completedAt = (status === 'completed' || status === 'failed') ? now : (run.completed_at || null);
  teamRunStmts.updateStatus.run(status, startedAt, completedAt, id);
}
function addTeamRunLog(id, runId, agentName, message, logType) {
  teamRunLogStmts.add.run(id, runId, agentName || '', message || '', logType || 'info');
}
function getTeamRunLogs(runId) {
  return teamRunLogStmts.getByRun.all(runId);
}

// --- Bulk operations & stats ---
function bulkDeleteAgents(names) {
  const placeholders = names.map(() => '?').join(',');
  db.prepare(`DELETE FROM agents WHERE name IN (${placeholders})`).run(...names);
}

function bulkUpdateCategory(names, category) {
  const placeholders = names.map(() => '?').join(',');
  db.prepare(`UPDATE agents SET category = ?, updated_at = strftime('%s','now') WHERE name IN (${placeholders})`).run(category, ...names);
}

function getAgentStats() {
  const total = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM agents GROUP BY category ORDER BY count DESC').all();
  const bySource = db.prepare("SELECT COALESCE(source, 'filesystem') as source, COUNT(*) as count FROM agents GROUP BY source").all();
  const byModel = db.prepare("SELECT COALESCE(model, 'unknown') as model, COUNT(*) as count FROM agents GROUP BY model ORDER BY count DESC").all();
  const avgRating = db.prepare('SELECT AVG(CASE WHEN rating > 0 THEN rating ELSE NULL END) as avg FROM agents').get().avg || 0;
  const totalProjects = db.prepare('SELECT COUNT(DISTINCT project_id) as count FROM (SELECT p.id as project_id FROM projects p INNER JOIN agents a ON p.agent_name = a.name)').get().count;
  return { total, byCategory, bySource, byModel, avgRating: Math.round(avgRating * 10) / 10, totalProjects };
}

module.exports = {
  seedAdmin,
  // Agents
  upsertAgent, createAgentManual, getAllAgents, getAgent, getAgentsByCategory,
  updateAgentRating, updateAgentLastUsed, updateAgentScreenshot,
  deleteAgent, searchAgents, updateAgent, getAgentProjectCount, getProjectsByAgent,
  bulkDeleteAgents, bulkUpdateCategory, getAgentStats,
  // Categories
  getAllCategories, getCategory, getCategoryByName,
  createCategory, updateCategory, deleteCategory, reorderCategories,
  // Projects
  createProject, getAllProjects, getProject, updateProject,
  updateProjectIterationCount, deleteProject,
  // Iterations
  createIteration, getAllIterations, getIteration,
  getIterationsByProject, getIterationChildren, getIterationRoots,
  getNextVersion, updateIteration, updateIterationFilePath,
  updateIterationScreenshot, deleteIteration, countIterations,
  // Sessions
  insertSession, getAllSessions, getSession, getSessionsByProject, renameSession,
  removeSession, removeAllSessions,
  // Terminal Tabs
  upsertTerminalTab, getTerminalTabsByProject, getTerminalTab,
  updateTerminalTabSession, removeTerminalTab, removeTerminalTabsByProject,
  getTerminalTabBySession,
  // Users
  getUserByEmail, getUserById, getAllUsers, createUser, updateUserClaudeStatus,
  // Agent Teams
  createTeam, getAllTeams, getTeam, updateTeam, deleteTeam,
  addTeamMember, removeTeamMember, getTeamMembers, reorderTeamMembers, updateTeamMemberRole,
  // Agent Versions
  createAgentVersion, getAgentVersions, getAgentVersion, getNextAgentVersionNumber, getLatestAgentVersion,
  // Team Runs
  createTeamRun, getTeamRun, getTeamRuns, getTeamRunsByProject,
  updateTeamRunStatus, addTeamRunLog, getTeamRunLogs,
};
