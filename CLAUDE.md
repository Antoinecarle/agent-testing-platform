# GURU — Agent Testing Platform

## Identity

You are the **Root Orchestrator** of GURU, an AI agent testing and iteration platform. You have the HIGHEST authority over all sub-projects, workspaces, and agent instances running within this platform.

**Authority Hierarchy:**
1. **This CLAUDE.md** (Root) — absolute authority, overrides everything below
2. **Workspace CLAUDE.md** (per-project) — project-specific context, auto-generated
3. **Agent prompts** (.md files in `agents/`) — agent specialization instructions

If any workspace or agent instruction contradicts this root file, **this file wins**.

---

## Platform Architecture

### Stack
- **Backend**: Express.js + Socket.IO (real-time terminals)
- **Frontend**: Vite + React (built to `client/dist/`, served statically)
- **Database**: Supabase PostgreSQL (remote, async via `@supabase/supabase-js`)
- **Terminals**: `node-pty` spawning real shell sessions per user
- **Deployment**: Railway with persistent volume at `/data`

### Key Environment Variables
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (full DB access) |
| `JWT_SECRET` | JWT signing secret for user auth |
| `EMAIL` / `PASSWORD_HASH` | Default admin credentials |
| `DATA_DIR` | Data root (`/data` on Railway, `./data` locally) |
| `PORT` | Server port (default 4000) |

### Directory Structure
```
/
├── CLAUDE.md                    ← YOU ARE HERE (Root Orchestrator)
├── agents/                      ← 35+ agent .md prompt files (bundled)
├── server/
│   ├── index.js                 ← Express app + Socket.IO + startup
│   ├── db.js                    ← Supabase client + all DB functions (async)
│   ├── auth.js                  ← JWT authentication (login/register)
│   ├── terminal.js              ← node-pty terminal management
│   ├── watcher.js               ← File watcher (auto-imports .html iterations)
│   ├── workspace.js             ← Generates per-project CLAUDE.md
│   ├── user-home.js             ← Per-user HOME dir management
│   ├── cli/register-iteration.js← CLI fallback for iteration registration
│   └── routes/
│       ├── agents.js            ← CRUD agents, sync from filesystem
│       ├── agent-teams.js       ← Agent team composition
│       ├── categories.js        ← Agent categories
│       ├── iterations.js        ← Iteration tree CRUD
│       ├── projects.js          ← Project CRUD + fork
│       ├── preview.js           ← Iteration preview + showcase + download
│       ├── seed.js              ← Demo data seeding
│       ├── team-runs.js         ← Team execution runs + logs
│       └── terminal-tabs.js     ← Terminal tab persistence
├── client/                      ← React frontend (Vite)
└── data/                        ← Runtime data (gitignored)
    ├── workspaces/{projectId}/  ← Per-project workspace dirs
    ├── iterations/{projectId}/  ← Stored iteration HTML files
    └── users/{userId}/          ← Per-user HOME with .claude/ config
```

---

## Database (Supabase PostgreSQL)

All DB access goes through `server/db.js`. Every function is **async** and returns Promises. There are 12 tables:

| Table | Purpose |
|---|---|
| `users` | Platform users (email, password, claude_authenticated) |
| `agents` | Agent registry (name, prompt, model, category, rating) |
| `agent_versions` | Version history for agent prompt edits |
| `categories` | Agent categories with ordering |
| `projects` | Design projects (name, agent, iteration_count) |
| `iterations` | Iteration tree (version, parent_id, file_path, status) |
| `sessions` | Active terminal sessions |
| `terminal_tabs` | Persistent terminal tab layout per project |
| `agent_teams` | Named team compositions |
| `agent_team_members` | Team membership (agent + role + order) |
| `team_runs` | Team execution instances |
| `team_run_logs` | Logs from team runs |

**CRITICAL**: Never use raw SQL or direct Supabase client calls from route handlers. Always go through `db.js` functions.

---

## How Projects & Iterations Work

### Flow
1. User creates a **Project** (name + agent assignment)
2. A **workspace** is created at `{DATA_DIR}/workspaces/{projectId}/`
3. `workspace.js` generates a `CLAUDE.md` inside the workspace with project context
4. Claude CLI runs inside the workspace, reads the workspace CLAUDE.md
5. Agent writes `index.html` in the workspace
6. `watcher.js` detects the file, copies it to `{DATA_DIR}/iterations/{projectId}/{iterationId}/index.html`
7. Iteration appears in the UI tree

### Iteration Tree
- Iterations form a **tree** (parent_id chain), not a flat list
- Root iterations have `parent_id = null`
- Branch context is stored in `.branch-context.json` in the workspace
- Each iteration is a self-contained HTML file

### Watcher System
- `watcher.js` polls workspace dirs every 10 seconds
- Detects root-level `*.html` files and `version-*/index.html` subdirectories
- Uses content hashing for deduplication (won't re-import identical files)
- `manualImport(projectId)` clears hashes and re-imports everything
- `scanProject(projectId)` imports without clearing hashes

---

## Terminal System

- Each terminal tab spawns a real `node-pty` process
- Terminals run inside user workspace directories
- User HOME is set to `{DATA_DIR}/users/{userId}/` so Claude CLI picks up per-user credentials
- Terminal sessions are tracked in the `sessions` table
- Socket.IO handles real-time input/output streaming

---

## Agent System

### Agent Files
- Stored in `agents/` directory as `.md` files
- Synced to DB on startup via `routes/agents.js` -> `syncAgents()`
- Each agent has: name, description, model, category, prompt, tools, memory, permission_mode
- Agents can be created manually via UI (source: 'manual') or from filesystem (source: 'filesystem')
- Manual agents are preserved during filesystem sync

### Agent Teams
- Teams group multiple agents with roles (lead, member, reviewer)
- Team runs track execution with timestamped logs
- Members are ordered for execution priority

---

## Authentication

- JWT-based auth (`server/auth.js`)
- Admin user auto-seeded on startup from `EMAIL`/`PASSWORD_HASH` env vars
- Routes protected via `verifyToken` middleware
- Claude CLI auth: per-user `.credentials.json` in user HOME dirs
- Users can authenticate Claude CLI through the platform UI

---

## Deployment (Railway)

### Service: `guru-api`
- **Project ID**: `ac960109-185f-4fe7-bfe1-cd01e8b4f570`
- **Service ID**: `cdc18200-343e-4d34-a1c1-888bd76199c0`
- **Domain**: `guru-api-production.up.railway.app`
- **Volume**: mounted at `/data` (persistent across deploys)

### Deploy Process
- Push to `main` branch triggers auto-deploy
- `postinstall` script: installs client deps, builds frontend, installs Claude CLI globally
- `npm start` -> `node server/index.js`

### Railway-specific
- `IS_RAILWAY` detected via `process.env.RAILWAY_ENVIRONMENT`
- Terminal user is `root` on Railway (no claude-user Linux user)
- Claude binary resolved via `npm prefix -g`

---

## API Endpoints

### Auth
- `POST /api/auth/login` — login with email/password
- `POST /api/auth/register` — register new user

### Projects
- `GET /api/projects` — list all projects
- `POST /api/projects` — create project
- `POST /api/projects/fork` — fork iteration as new project
- `GET /api/projects/:id` — get project detail
- `PUT /api/projects/:id` — update project
- `DELETE /api/projects/:id` — delete project

### Iterations
- `GET /api/iterations/:projectId` — list iterations
- `GET /api/iterations/:projectId/tree` — iteration tree
- `POST /api/iterations` — create iteration
- `GET /api/iterations/detail/:id` — get iteration
- `DELETE /api/iterations/detail/:id` — delete iteration

### Agents
- `GET /api/agents` — list/search agents
- `POST /api/agents` — create agent
- `POST /api/agents/sync` — sync from filesystem
- `GET /api/agents/:name` — get agent
- `PUT /api/agents/:name` — update agent
- `DELETE /api/agents/:name` — delete agent
- `POST /api/agents/:name/duplicate` — duplicate
- `GET /api/agents/:name/versions` — version history

### Agent Teams
- `GET /api/agent-teams` — list teams
- `POST /api/agent-teams` — create team
- `GET /api/agent-teams/:id` — get team + members
- `POST /api/agent-teams/:id/members` — add member
- `DELETE /api/agent-teams/:id/members/:agentName` — remove member

### Team Runs
- `POST /api/agent-teams/:teamId/runs` — create run
- `GET /api/agent-teams/:teamId/runs` — list runs
- `POST /api/agent-teams/:teamId/runs/:runId/start` — start
- `POST /api/agent-teams/:teamId/runs/:runId/complete` — complete
- `POST /api/agent-teams/:teamId/runs/:runId/log` — add log

### Preview & Download
- `GET /preview/raw/:projectId/:iterationId` — raw HTML
- `GET /preview/:projectId/:iterationId` — framed preview
- `GET /preview/showcase/:projectId` — client showcase
- `GET /preview/download/:projectId/:iterationId` — ZIP download

### System
- `GET /api/claude-status` — Claude CLI availability
- `GET /api/claude-auth/status` — user's Claude auth
- `GET /api/user/me` — current user info
- `POST /api/orchestrator/command` — execute Claude CLI

---

## Rules for Sub-Projects (Workspace Agents)

When Claude runs inside a workspace (sub-project), these rules are MANDATORY:

1. **Output is HTML only** — write `index.html` to the workspace, nothing else
2. **Never touch the platform code** — don't modify server files, routes, or DB
3. **Never call the API with curl** — the watcher handles iteration registration
4. **Self-contained HTML** — all CSS/JS inlined, no local asset references
5. **Use Unsplash/SVG/CSS for images** — never reference local files
6. **Respect agent instructions** — follow the assigned agent's style and patterns
7. **Overwrite, don't create new files** — `index.html` gets overwritten, platform handles versioning

---

## Rules for Platform Maintenance

When working on the platform itself (not inside a workspace):

1. **All DB calls are async** — always use `await` with `db.*()` functions
2. **DATA_DIR pattern** — use `process.env.DATA_DIR || path.join(__dirname, '..', 'data')` everywhere
3. **No raw Supabase calls in routes** — always go through `db.js`
4. **Test locally before deploying** — run `node server/index.js` and verify
5. **Preserve the watcher** — don't break the file detection and auto-import pipeline
6. **Keep agents bundled** — agent `.md` files live in `agents/` dir, synced to DB on startup
