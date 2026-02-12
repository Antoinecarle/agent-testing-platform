const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[DB] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: current unix timestamp
function now() { return Math.floor(Date.now() / 1000); }

// ===================== AGENTS =====================

async function upsertAgent(name, description, model, category, promptPreview, screenshotPath, rating, fullPrompt, source, tools, maxTurns, memory, permissionMode) {
  // Check if exists first
  const { data: existing } = await supabase.from('agents').select('source').eq('name', name).single();

  if (existing) {
    // Update - preserve manual source if agent was manually created
    const newSource = (existing.source === 'manual' && (source || 'filesystem') === 'filesystem') ? 'manual' : (source || 'filesystem');
    await supabase.from('agents').update({
      description: description || '',
      model: model || '',
      category: category || 'uncategorized',
      prompt_preview: promptPreview || '',
      full_prompt: fullPrompt || '',
      source: newSource,
      tools: tools || '',
      max_turns: maxTurns || 0,
      memory: memory || '',
      permission_mode: permissionMode || '',
      updated_at: now(),
    }).eq('name', name);
  } else {
    await supabase.from('agents').insert({
      name,
      description: description || '',
      model: model || '',
      category: category || 'uncategorized',
      prompt_preview: promptPreview || '',
      screenshot_path: screenshotPath || '',
      rating: rating || 0,
      full_prompt: fullPrompt || '',
      source: source || 'filesystem',
      tools: tools || '',
      max_turns: maxTurns || 0,
      memory: memory || '',
      permission_mode: permissionMode || '',
      updated_at: now(),
    });
  }
}

async function createAgentManual(name, description, model, category, promptPreview, fullPrompt, tools, maxTurns, memory, permissionMode, createdBy) {
  const row = {
    name,
    description: description || '',
    model: model || '',
    category: category || 'uncategorized',
    prompt_preview: promptPreview || '',
    screenshot_path: '',
    rating: 0,
    full_prompt: fullPrompt || '',
    source: 'manual',
    tools: tools || '',
    max_turns: maxTurns || 0,
    memory: memory || '',
    permission_mode: permissionMode || '',
    updated_at: now(),
  };
  if (createdBy) row.created_by = createdBy;
  await supabase.from('agents').insert(row);
}

async function getAllAgents() {
  const { data: agents } = await supabase.from('agents').select('*').order('name', { ascending: true });
  // Get project counts
  const { data: counts } = await supabase.from('projects').select('agent_name');
  const countMap = {};
  (counts || []).forEach(p => {
    countMap[p.agent_name] = (countMap[p.agent_name] || 0) + 1;
  });
  return (agents || []).map(a => ({ ...a, project_count: countMap[a.name] || 0 }));
}

async function getAgent(name) {
  const { data } = await supabase.from('agents').select('*').eq('name', name).single();
  return data || null;
}

async function getAgentsByCategory(category) {
  const { data: agents } = await supabase.from('agents').select('*').eq('category', category).order('name', { ascending: true });
  const { data: counts } = await supabase.from('projects').select('agent_name');
  const countMap = {};
  (counts || []).forEach(p => {
    countMap[p.agent_name] = (countMap[p.agent_name] || 0) + 1;
  });
  return (agents || []).map(a => ({ ...a, project_count: countMap[a.name] || 0 }));
}

async function updateAgentRating(name, rating) {
  await supabase.from('agents').update({ rating, updated_at: now() }).eq('name', name);
}

async function updateAgentLastUsed(name) {
  const t = now();
  await supabase.from('agents').update({ last_used_at: t, updated_at: t }).eq('name', name);
}

async function updateAgentScreenshot(name, path) {
  await supabase.from('agents').update({ screenshot_path: path, updated_at: now() }).eq('name', name);
}

async function deleteAgent(name) {
  await supabase.from('agents').delete().eq('name', name);
}

async function searchAgents(query) {
  const q = `%${query}%`;
  const { data: agents } = await supabase.from('agents').select('*')
    .or(`name.ilike.${q},description.ilike.${q},category.ilike.${q}`)
    .order('name', { ascending: true });
  const { data: counts } = await supabase.from('projects').select('agent_name');
  const countMap = {};
  (counts || []).forEach(p => {
    countMap[p.agent_name] = (countMap[p.agent_name] || 0) + 1;
  });
  return (agents || []).map(a => ({ ...a, project_count: countMap[a.name] || 0 }));
}

async function getAgentProjectCount(name) {
  const { count } = await supabase.from('projects').select('*', { count: 'exact', head: true }).eq('agent_name', name);
  return count || 0;
}

async function getProjectsByAgent(name) {
  const { data } = await supabase.from('projects').select('*').eq('agent_name', name).order('created_at', { ascending: false });
  return data || [];
}

async function updateAgent(name, fields) {
  const update = {};
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.model !== undefined) update.model = fields.model;
  if (fields.category !== undefined) update.category = fields.category;
  if (fields.prompt_preview !== undefined) update.prompt_preview = fields.prompt_preview;
  if (fields.full_prompt !== undefined) update.full_prompt = fields.full_prompt;
  if (fields.tools !== undefined) update.tools = fields.tools;
  if (fields.max_turns !== undefined) update.max_turns = fields.max_turns;
  if (fields.memory !== undefined) update.memory = fields.memory;
  if (fields.permission_mode !== undefined) update.permission_mode = fields.permission_mode;
  if (Object.keys(update).length === 0) return;
  update.updated_at = now();
  await supabase.from('agents').update(update).eq('name', name);
}

async function bulkDeleteAgents(names) {
  await supabase.from('agents').delete().in('name', names);
}

async function bulkUpdateCategory(names, category) {
  await supabase.from('agents').update({ category, updated_at: now() }).in('name', names);
}

async function getAgentStats() {
  const { data: agents } = await supabase.from('agents').select('category, source, model, rating');
  const all = agents || [];
  const total = all.length;

  const byCategoryMap = {};
  const bySourceMap = {};
  const byModelMap = {};
  let ratingSum = 0, ratingCount = 0;

  all.forEach(a => {
    byCategoryMap[a.category || 'uncategorized'] = (byCategoryMap[a.category || 'uncategorized'] || 0) + 1;
    bySourceMap[a.source || 'filesystem'] = (bySourceMap[a.source || 'filesystem'] || 0) + 1;
    byModelMap[a.model || 'unknown'] = (byModelMap[a.model || 'unknown'] || 0) + 1;
    if (a.rating > 0) { ratingSum += a.rating; ratingCount++; }
  });

  const byCategory = Object.entries(byCategoryMap).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  const bySource = Object.entries(bySourceMap).map(([source, count]) => ({ source, count }));
  const byModel = Object.entries(byModelMap).map(([model, count]) => ({ model, count })).sort((a, b) => b.count - a.count);
  const avgRating = ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0;

  const { count: totalProjects } = await supabase.from('projects').select('*', { count: 'exact', head: true }).neq('agent_name', '');
  return { total, byCategory, bySource, byModel, avgRating, totalProjects: totalProjects || 0 };
}

// ===================== CATEGORIES =====================

async function getAllCategories() {
  const { data } = await supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true });
  return data || [];
}

async function getCategory(id) {
  const { data } = await supabase.from('categories').select('*').eq('id', id).single();
  return data || null;
}

async function getCategoryByName(name) {
  const { data } = await supabase.from('categories').select('*').eq('name', name).single();
  return data || null;
}

async function createCategory(id, name, color, icon, description, sortOrder) {
  await supabase.from('categories').insert({
    id, name, color: color || '#8B5CF6', icon: icon || '', description: description || '', sort_order: sortOrder || 0,
  });
}

async function updateCategory(id, name, color, icon, description, sortOrder) {
  await supabase.from('categories').update({
    name, color: color || '#8B5CF6', icon: icon || '', description: description || '', sort_order: sortOrder || 0, updated_at: now(),
  }).eq('id', id);
}

async function deleteCategory(id) {
  await supabase.from('categories').delete().eq('id', id);
}

async function reorderCategories(orderedIds) {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('categories').update({ sort_order: idx, updated_at: now() }).eq('id', id)
  );
  await Promise.all(updates);
}

// ===================== PROJECTS =====================

async function createProject(id, name, description, agentName) {
  await supabase.from('projects').insert({
    id, name, description: description || '', agent_name: agentName || '', status: 'active',
  });
}

async function getAllProjects() {
  const { data: projects } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
  // Get latest iteration ids
  const { data: iterations } = await supabase.from('iterations').select('id, project_id, created_at').order('created_at', { ascending: false });
  const latestMap = {};
  (iterations || []).forEach(i => {
    if (!latestMap[i.project_id]) latestMap[i.project_id] = i.id;
  });
  return (projects || []).map(p => ({ ...p, latest_iteration_id: latestMap[p.id] || null }));
}

async function getProject(id) {
  const { data } = await supabase.from('projects').select('*').eq('id', id).single();
  return data || null;
}

async function updateProject(id, name, description, agentName, status) {
  await supabase.from('projects').update({
    name, description: description || '', agent_name: agentName || '', status: status || 'active', updated_at: now(),
  }).eq('id', id);
}

async function updateProjectIterationCount(id, count) {
  await supabase.from('projects').update({ iteration_count: count, updated_at: now() }).eq('id', id);
}

async function deleteProject(id) {
  await supabase.from('projects').delete().eq('id', id);
}

// ===================== ITERATIONS =====================

async function createIteration(id, projectId, agentName, version, title, prompt, parentId, filePath, screenshotPath, status, metadata) {
  await supabase.from('iterations').insert({
    id, project_id: projectId, agent_name: agentName, version,
    title: title || '', prompt: prompt || '', parent_id: parentId || null,
    file_path: filePath || '', screenshot_path: screenshotPath || '',
    status: status || 'completed', metadata: metadata || {},
  });
}

async function getAllIterations(projectId) {
  const { data } = await supabase.from('iterations').select('*').eq('project_id', projectId).order('version', { ascending: true });
  return (data || []).map(r => ({ ...r, metadata: r.metadata || {} }));
}

async function getIteration(id) {
  const { data } = await supabase.from('iterations').select('*').eq('id', id).single();
  return data ? { ...data, metadata: data.metadata || {} } : null;
}

async function getIterationsByProject(projectId) {
  const { data } = await supabase.from('iterations').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
  return (data || []).map(r => ({ ...r, metadata: r.metadata || {} }));
}

async function getIterationChildren(parentId) {
  const { data } = await supabase.from('iterations').select('*').eq('parent_id', parentId).order('version', { ascending: true });
  return (data || []).map(r => ({ ...r, metadata: r.metadata || {} }));
}

async function getIterationRoots(projectId) {
  const { data } = await supabase.from('iterations').select('*').eq('project_id', projectId).is('parent_id', null).order('version', { ascending: true });
  return (data || []).map(r => ({ ...r, metadata: r.metadata || {} }));
}

async function getNextVersion(projectId) {
  const { data } = await supabase.from('iterations').select('version').eq('project_id', projectId).order('version', { ascending: false }).limit(1);
  return (data && data.length > 0) ? data[0].version + 1 : 1;
}

async function updateIteration(id, title, prompt, status, metadata) {
  await supabase.from('iterations').update({
    title: title || '', prompt: prompt || '', status: status || 'completed', metadata: metadata || {},
  }).eq('id', id);
}

async function updateIterationFilePath(id, filePath) {
  await supabase.from('iterations').update({ file_path: filePath }).eq('id', id);
}

async function updateIterationScreenshot(id, screenshotPath) {
  await supabase.from('iterations').update({ screenshot_path: screenshotPath }).eq('id', id);
}

async function deleteIteration(id) {
  await supabase.from('iterations').delete().eq('id', id);
}

async function countIterations(projectId) {
  const { count } = await supabase.from('iterations').select('*', { count: 'exact', head: true }).eq('project_id', projectId);
  return count || 0;
}

// ===================== SESSIONS =====================

async function insertSession(id, name, createdAt, projectId, cwd, shell) {
  await supabase.from('sessions').insert({
    id, name, project_id: projectId || '', agent_name: '', created_at: createdAt,
    cwd: cwd || '/root', shell: shell || '/bin/bash',
  });
}

async function getAllSessions() {
  const { data } = await supabase.from('sessions').select('*').order('created_at', { ascending: true });
  return data || [];
}

async function getSession(id) {
  const { data } = await supabase.from('sessions').select('*').eq('id', id).single();
  return data || null;
}

async function getSessionsByProject(projectId) {
  const { data } = await supabase.from('sessions').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
  return data || [];
}

async function renameSession(id, name) {
  await supabase.from('sessions').update({ name }).eq('id', id);
}

async function removeSession(id) {
  await supabase.from('sessions').delete().eq('id', id);
}

async function removeAllSessions() {
  await supabase.from('sessions').delete().neq('id', '');
}

// ===================== TERMINAL TABS =====================

async function upsertTerminalTab(id, projectId, sessionId, name, cwd) {
  const { data: existing } = await supabase.from('terminal_tabs').select('id').eq('id', id).single();
  if (existing) {
    await supabase.from('terminal_tabs').update({
      session_id: sessionId || '', name: name || '', cwd: cwd || '',
    }).eq('id', id);
  } else {
    await supabase.from('terminal_tabs').insert({
      id, project_id: projectId, session_id: sessionId || '', name: name || '', cwd: cwd || '',
    });
  }
}

async function getTerminalTabsByProject(projectId) {
  const { data } = await supabase.from('terminal_tabs').select('*').eq('project_id', projectId).order('created_at', { ascending: true });
  return data || [];
}

async function getTerminalTab(id) {
  const { data } = await supabase.from('terminal_tabs').select('*').eq('id', id).single();
  return data || null;
}

async function updateTerminalTabSession(id, sessionId) {
  await supabase.from('terminal_tabs').update({ session_id: sessionId || '' }).eq('id', id);
}

async function removeTerminalTab(id) {
  await supabase.from('terminal_tabs').delete().eq('id', id);
}

async function removeTerminalTabsByProject(projectId) {
  await supabase.from('terminal_tabs').delete().eq('project_id', projectId);
}

async function getTerminalTabBySession(sessionId) {
  const { data } = await supabase.from('terminal_tabs').select('*').eq('session_id', sessionId).single();
  return data || null;
}

// ===================== USERS =====================

async function getUserByEmail(email) {
  const { data } = await supabase.from('users').select('*').eq('email', email).single();
  return data || null;
}

async function getUserById(id) {
  const { data } = await supabase.from('users').select('*').eq('id', id).single();
  return data || null;
}

async function getAllUsers() {
  const { data } = await supabase.from('users').select('id, email, display_name, role, claude_connected, claude_subscription, claude_connected_at, claude_home_dir, created_at').order('created_at', { ascending: true });
  return data || [];
}

async function createUser(id, email, passwordHash, role, displayName, homeDir) {
  await supabase.from('users').insert({
    id, email, password_hash: passwordHash || null, role: role || 'user',
    display_name: displayName || '', claude_home_dir: homeDir || '',
  });
}

async function updateUserClaudeStatus(id, connected, subscription, homeDir) {
  await supabase.from('users').update({
    claude_connected: connected ? 1 : 0,
    claude_subscription: subscription || '',
    claude_home_dir: homeDir || '',
    claude_connected_at: connected ? now() : null,
  }).eq('id', id);
}

// --- Seed admin ---
async function seedAdmin() {
  const adminEmail = process.env.EMAIL || 'admin@vps.local';
  const existing = await getUserByEmail(adminEmail);
  if (!existing) {
    const id = crypto.randomUUID();
    const passwordHash = process.env.PASSWORD_HASH || null;
    const homeDir = `/data/users/${id}`;
    await createUser(id, adminEmail, passwordHash, 'admin', 'Admin', homeDir);
    console.log(`[DB] Seeded admin user: ${adminEmail}`);
  }
}

// ===================== AGENT TEAMS =====================

async function createTeam(id, name, description) {
  await supabase.from('agent_teams').insert({ id, name, description: description || '' });
}

async function getAllTeams() {
  const { data: teams } = await supabase.from('agent_teams').select('*').order('created_at', { ascending: false });
  const { data: members } = await supabase.from('agent_team_members').select('team_id, agent_name');
  const memberMap = {};
  (members || []).forEach(m => {
    if (!memberMap[m.team_id]) memberMap[m.team_id] = [];
    memberMap[m.team_id].push(m.agent_name);
  });
  return (teams || []).map(t => ({
    ...t,
    member_count: (memberMap[t.id] || []).length,
    member_names: (memberMap[t.id] || []).join(',') || null,
  }));
}

async function getTeam(id) {
  const { data } = await supabase.from('agent_teams').select('*').eq('id', id).single();
  return data || null;
}

async function updateTeam(id, name, description) {
  await supabase.from('agent_teams').update({ name, description: description || '', updated_at: now() }).eq('id', id);
}

async function deleteTeam(id) {
  await supabase.from('agent_teams').delete().eq('id', id);
}

async function addTeamMember(id, teamId, agentName, role, sortOrder) {
  await supabase.from('agent_team_members').insert({
    id, team_id: teamId, agent_name: agentName, role: role || 'member', sort_order: sortOrder || 0,
  });
}

async function removeTeamMember(teamId, agentName) {
  await supabase.from('agent_team_members').delete().eq('team_id', teamId).eq('agent_name', agentName);
}

async function getTeamMembers(teamId) {
  const { data: members } = await supabase.from('agent_team_members').select('*').eq('team_id', teamId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
  // Join agent info
  const agentNames = (members || []).map(m => m.agent_name);
  if (agentNames.length === 0) return [];
  const { data: agents } = await supabase.from('agents').select('name, description, model, category, rating, screenshot_path').in('name', agentNames);
  const agentMap = {};
  (agents || []).forEach(a => { agentMap[a.name] = a; });
  return (members || []).map(m => ({
    ...m,
    agent_description: agentMap[m.agent_name]?.description || '',
    model: agentMap[m.agent_name]?.model || '',
    category: agentMap[m.agent_name]?.category || '',
    rating: agentMap[m.agent_name]?.rating || 0,
    screenshot_path: agentMap[m.agent_name]?.screenshot_path || '',
  }));
}

async function updateTeamMemberRole(teamId, agentName, role) {
  await supabase.from('agent_team_members').update({ role }).eq('team_id', teamId).eq('agent_name', agentName);
}

async function reorderTeamMembers(teamId, orderedAgentNames) {
  const updates = orderedAgentNames.map((name, idx) =>
    supabase.from('agent_team_members').update({ sort_order: idx }).eq('team_id', teamId).eq('agent_name', name)
  );
  await Promise.all(updates);
}

// ===================== AGENT VERSIONS =====================

async function createAgentVersion(id, agentName, versionNumber, fullPrompt, description, model, tools, maxTurns, memory, permissionMode, changeSummary) {
  await supabase.from('agent_versions').insert({
    id, agent_name: agentName, version_number: versionNumber,
    full_prompt: fullPrompt || '', description: description || '', model: model || '',
    tools: tools || '', max_turns: maxTurns || 0, memory: memory || '',
    permission_mode: permissionMode || '', change_summary: changeSummary || '',
  });
}

async function getAgentVersions(agentName) {
  const { data } = await supabase.from('agent_versions').select('*').eq('agent_name', agentName).order('version_number', { ascending: false });
  return data || [];
}

async function getAgentVersion(id) {
  const { data } = await supabase.from('agent_versions').select('*').eq('id', id).single();
  return data || null;
}

async function getNextAgentVersionNumber(agentName) {
  const { data } = await supabase.from('agent_versions').select('version_number').eq('agent_name', agentName).order('version_number', { ascending: false }).limit(1);
  return (data && data.length > 0) ? data[0].version_number + 1 : 1;
}

async function getLatestAgentVersion(agentName) {
  const { data } = await supabase.from('agent_versions').select('*').eq('agent_name', agentName).order('version_number', { ascending: false }).limit(1).single();
  return data || null;
}

// ===================== TEAM RUNS =====================

async function createTeamRun(id, teamId, projectId, config) {
  await supabase.from('team_runs').insert({
    id, team_id: teamId, project_id: projectId || null, status: 'pending', config: config || {},
  });
}

async function getTeamRun(id) {
  const { data } = await supabase.from('team_runs').select('*').eq('id', id).single();
  return data ? { ...data, config: data.config || {} } : null;
}

async function getTeamRuns(teamId) {
  const { data } = await supabase.from('team_runs').select('*').eq('team_id', teamId).order('created_at', { ascending: false });
  return (data || []).map(r => ({ ...r, config: r.config || {} }));
}

async function getTeamRunsByProject(projectId) {
  const { data } = await supabase.from('team_runs').select('*').eq('project_id', projectId).order('created_at', { ascending: false });
  return (data || []).map(r => ({ ...r, config: r.config || {} }));
}

async function updateTeamRunStatus(id, status) {
  const run = await getTeamRun(id);
  if (!run) return;
  const t = now();
  const startedAt = status === 'running' ? t : (run.started_at || null);
  const completedAt = (status === 'completed' || status === 'failed') ? t : (run.completed_at || null);
  await supabase.from('team_runs').update({ status, started_at: startedAt, completed_at: completedAt }).eq('id', id);
}

async function addTeamRunLog(id, runId, agentName, message, logType) {
  await supabase.from('team_run_logs').insert({
    id, run_id: runId, agent_name: agentName || '', message: message || '', log_type: logType || 'info',
  });
}

async function getTeamRunLogs(runId) {
  const { data } = await supabase.from('team_run_logs').select('*').eq('run_id', runId).order('created_at', { ascending: true });
  return data || [];
}

// ===================== MARKETPLACE / SHOWCASES =====================

async function getMarketplaceAgents({ search, category, sortBy, limit, offset } = {}) {
  let query = supabase.from('agents').select('*');
  if (search) {
    const q = `%${search}%`;
    query = query.or(`name.ilike.${q},description.ilike.${q},category.ilike.${q}`);
  }
  if (category) query = query.eq('category', category);
  if (sortBy === 'popular') query = query.order('download_count', { ascending: false });
  else if (sortBy === 'rating') query = query.order('rating', { ascending: false });
  else if (sortBy === 'name') query = query.order('name', { ascending: true });
  else query = query.order('updated_at', { ascending: false });
  if (limit) query = query.limit(limit);
  if (offset) query = query.range(offset, offset + (limit || 50) - 1);

  const { data: agents } = await query;

  // Enrich with project counts
  const { data: projectCounts } = await supabase.from('projects').select('agent_name');
  const pcMap = {};
  (projectCounts || []).forEach(p => { pcMap[p.agent_name] = (pcMap[p.agent_name] || 0) + 1; });

  // Enrich with showcase counts + featured showcase (need project_id for iframe URL)
  const { data: showcases } = await supabase.from('agent_showcases').select('agent_name, project_id, iteration_id, sort_order').order('sort_order', { ascending: true });
  const scMap = {};
  const featuredMap = {};
  (showcases || []).forEach(s => {
    scMap[s.agent_name] = (scMap[s.agent_name] || 0) + 1;
    if (!featuredMap[s.agent_name]) featuredMap[s.agent_name] = { project_id: s.project_id, iteration_id: s.iteration_id };
  });

  // Enrich with creator info
  const creatorIds = [...new Set((agents || []).map(a => a.created_by).filter(Boolean))];
  const creatorMap = {};
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, email, display_name').in('id', creatorIds);
    (users || []).forEach(u => { creatorMap[u.id] = { email: u.email, display_name: u.display_name }; });
  }

  const result = (agents || []).map(a => ({
    ...a,
    project_count: pcMap[a.name] || 0,
    showcase_count: scMap[a.name] || 0,
    featured_project_id: featuredMap[a.name]?.project_id || null,
    featured_iteration_id: featuredMap[a.name]?.iteration_id || null,
    creator: a.created_by ? (creatorMap[a.created_by] || null) : null,
  }));

  // Sort: agents with showcases first
  result.sort((a, b) => (b.showcase_count > 0 ? 1 : 0) - (a.showcase_count > 0 ? 1 : 0));

  return result;
}

async function incrementAgentDownloads(name) {
  const agent = await getAgent(name);
  if (!agent) return;
  await supabase.from('agents').update({ download_count: (agent.download_count || 0) + 1 }).eq('name', name);
}

async function createShowcase(id, agentName, projectId, iterationId, title, description, sortOrder) {
  await supabase.from('agent_showcases').insert({
    id, agent_name: agentName, project_id: projectId, iteration_id: iterationId,
    title: title || '', description: description || '', sort_order: sortOrder || 0,
  });
}

async function getShowcasesByAgent(agentName) {
  const { data: showcases } = await supabase.from('agent_showcases').select('*').eq('agent_name', agentName).order('sort_order', { ascending: true });
  if (!showcases || showcases.length === 0) return [];

  // Enrich with project + iteration info
  const projectIds = [...new Set(showcases.map(s => s.project_id))];
  const iterationIds = [...new Set(showcases.map(s => s.iteration_id))];
  const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds);
  const { data: iterations } = await supabase.from('iterations').select('id, version, title').in('id', iterationIds);
  const pMap = {};
  (projects || []).forEach(p => { pMap[p.id] = p; });
  const iMap = {};
  (iterations || []).forEach(i => { iMap[i.id] = i; });

  return showcases.map(s => ({
    ...s,
    project_name: pMap[s.project_id]?.name || '',
    iteration_version: iMap[s.iteration_id]?.version || 0,
    iteration_title: iMap[s.iteration_id]?.title || '',
  }));
}

async function getShowcase(id) {
  const { data } = await supabase.from('agent_showcases').select('*').eq('id', id).single();
  return data || null;
}

async function deleteShowcase(id) {
  await supabase.from('agent_showcases').delete().eq('id', id);
}

async function reorderShowcases(agentName, orderedIds) {
  const updates = orderedIds.map((id, idx) =>
    supabase.from('agent_showcases').update({ sort_order: idx, updated_at: new Date().toISOString() }).eq('id', id).eq('agent_name', agentName)
  );
  await Promise.all(updates);
}

async function countShowcases(agentName) {
  const { count } = await supabase.from('agent_showcases').select('*', { count: 'exact', head: true }).eq('agent_name', agentName);
  return count || 0;
}

// ===================== AGENT CONVERSATIONS =====================

async function createAgentConversation(userId, name) {
  const { data } = await supabase.from('agent_conversations').insert({
    user_id: userId,
    name: name || 'New Agent',
  }).select('*').single();
  return data;
}

async function getAgentConversation(conversationId) {
  const { data } = await supabase.from('agent_conversations').select('*').eq('id', conversationId).single();
  return data || null;
}

async function getUserAgentConversations(userId) {
  const { data } = await supabase.from('agent_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  return data || [];
}

async function updateAgentConversation(conversationId, updates) {
  await supabase.from('agent_conversations').update({
    ...updates,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId);
}

async function deleteAgentConversation(conversationId) {
  await supabase.from('agent_conversations').delete().eq('id', conversationId);
}

// Conversation Messages

async function createConversationMessage(conversationId, role, content) {
  const { data } = await supabase.from('agent_conversation_messages').insert({
    conversation_id: conversationId,
    role,
    content,
  }).select('*').single();

  // Update conversation updated_at
  await updateAgentConversation(conversationId, {});

  return data;
}

async function getConversationMessages(conversationId) {
  const { data } = await supabase.from('agent_conversation_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
}

// Conversation References

async function createConversationReference(conversationId, type, url, filename, analysis) {
  const { data } = await supabase.from('agent_conversation_references').insert({
    conversation_id: conversationId,
    type,
    url,
    filename,
    analysis,
  }).select('*').single();

  // Update conversation updated_at
  await updateAgentConversation(conversationId, {});

  return data;
}

async function getConversationReferences(conversationId) {
  const { data } = await supabase.from('agent_conversation_references')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  return data || [];
}

async function deleteConversationReference(referenceId) {
  const { data } = await supabase.from('agent_conversation_references')
    .select('conversation_id')
    .eq('id', referenceId)
    .single();

  if (data) {
    await supabase.from('agent_conversation_references').delete().eq('id', referenceId);
    // Update conversation updated_at
    await updateAgentConversation(data.conversation_id, {});
  }
}

// Update reference with structured analysis JSON
async function updateReferenceAnalysis(referenceId, structuredAnalysis) {
  await supabase.from('agent_conversation_references').update({
    structured_analysis: structuredAnalysis,
  }).eq('id', referenceId);
}

// Store design brief on conversation
async function updateConversationBrief(conversationId, brief) {
  await supabase.from('agent_conversations').update({
    design_brief: brief,
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId);
}

// Store generated agent and generation status
async function updateConversationGeneratedAgent(conversationId, agent, status) {
  await supabase.from('agent_conversations').update({
    generated_agent: agent || null,
    generation_status: status || 'completed',
    updated_at: new Date().toISOString(),
  }).eq('id', conversationId);
}

// ===================== EXPORTS =====================

module.exports = {
  supabase,
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
  // Marketplace / Showcases
  getMarketplaceAgents, incrementAgentDownloads,
  createShowcase, getShowcasesByAgent, getShowcase, deleteShowcase,
  reorderShowcases, countShowcases,
  // Agent Conversations
  createAgentConversation, getAgentConversation, getUserAgentConversations,
  updateAgentConversation, deleteAgentConversation,
  createConversationMessage, getConversationMessages,
  createConversationReference, getConversationReferences, deleteConversationReference,
  updateReferenceAnalysis, updateConversationBrief, updateConversationGeneratedAgent,
};
