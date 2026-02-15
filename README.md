<div align="center">

# GURU

**AI Agent Testing & Iteration Platform**

Run, test, and iterate on AI agents in real-time with embedded terminals, version trees, and team orchestration.

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com)

[Live Demo](https://guru-api-production.up.railway.app) | [Report Bug](https://github.com/Antoinecarle/agent-testing-platform/issues) | [Request Feature](https://github.com/Antoinecarle/agent-testing-platform/issues)

</div>

---

## What is GURU?

GURU is a self-hosted platform for managing, testing, and iterating on AI coding agents. It provides a complete workspace where agents execute tasks in real terminal sessions, produce HTML iterations that are automatically captured, and build version trees you can branch from.

Think of it as a **mission control for AI agents** -- assign an agent to a project, watch it work in a live terminal, preview results instantly, and fork iterations to explore different directions.

## Key Features

### Agent Library (57+ agents)
Browse, search, and manage a growing library of specialized AI agents. Each agent has a prompt file (`.md`), a model assignment, category, and rating. Create new agents from the UI with AI-powered prompt generation, or write them manually.

### Real-Time Terminals
Every project gets embedded terminal tabs powered by `node-pty` and Socket.IO. Terminals run inside isolated workspace directories with per-user Claude CLI credentials. Full shell access -- not a simulation.

### Iteration Tree
Agents produce HTML files that are automatically detected and versioned into a tree structure. Branch from any iteration to explore alternatives. Compare versions side-by-side. Each iteration is a self-contained, downloadable HTML file.

### Orchestra Mode
Compose teams of multiple agents with defined roles (lead, member, reviewer). Visual team builder powered by ReactFlow. Run orchestrated sessions where agents collaborate on a single project.

### Agent Creator
AI-assisted agent creation with type-aware prompts. Analyze reference URLs to extract design patterns. Upload documents for context. The creator generates structured agent prompts with tools, memory, and permission configurations.

### Client Showcase
Share iteration results with clients via public preview URLs. Download iterations as ZIP files. No login required for viewing.

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Express.js, Socket.IO, node-pty |
| **Frontend** | React, Vite, Framer Motion, ReactFlow |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | JWT (bcryptjs) |
| **Deployment** | Railway (persistent volume) |
| **AI Runtime** | Claude CLI (Anthropic) |

## Screenshots

<div align="center">

| Dashboard | Project View |
|---|---|
| Dark-themed dashboard with project cards, agent stats, and quick actions | Split-pane layout: iteration tree + live preview + terminal |

| Agent Browser | Orchestra Builder |
|---|---|
| Grid/list view with categories, search, ratings, and bulk actions | Visual team composition with ReactFlow node editor |

</div>

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed (optional, for agent execution)

### Installation

```bash
# Clone the repo
git clone https://github.com/Antoinecarle/agent-testing-platform.git
cd agent-testing-platform

# Install all dependencies (server + client)
npm run install-all

# Create .env
cp .env.example .env
```

### Environment Variables

```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
EMAIL=admin@example.com
PASSWORD_HASH=$2a$10$...        # bcrypt hash of admin password
DATA_DIR=./data                  # persistent data directory
```

### Run Locally

```bash
# Build the frontend
npm run build

# Start the server
npm start
```

The app runs at `http://localhost:4000`.

### Seed Demo Data

```bash
npm run seed
```

## Deployment

### Railway (Recommended)

1. Create a new Railway project
2. Add a **Volume** mounted at `/data`
3. Connect your GitHub repo
4. Set the environment variables above (set `DATA_DIR=/data`)
5. Deploy -- Railway auto-builds via the `postinstall` script

The platform auto-detects Railway via `RAILWAY_ENVIRONMENT` and adjusts paths accordingly.

## Project Structure

```
guru/
  agents/              # 57+ agent prompt files (.md)
  server/
    index.js           # Express + Socket.IO server
    db.js              # Supabase client + all DB functions
    auth.js            # JWT authentication
    terminal.js        # node-pty terminal management
    watcher.js         # Auto-import HTML iterations
    workspace.js       # Per-project workspace generator
    routes/            # REST API routes
  client/
    src/
      pages/           # React pages (Dashboard, ProjectView, AgentBrowser...)
      components/      # Shared components (TerminalPanel, OrchestraBuilder...)
  data/                # Runtime data (gitignored)
    workspaces/        # Per-project workspace dirs
    iterations/        # Versioned iteration HTML files
    users/             # Per-user HOME dirs
```

## How It Works

```
1. Create a Project          Assign an agent, create a workspace
         |
2. Agent Runs in Terminal    Real shell session in the workspace dir
         |
3. Agent Writes HTML         index.html in the workspace
         |
4. Watcher Detects Change    Polls every 10s, hashes for dedup
         |
5. Iteration Captured        Copied to iterations dir, added to tree
         |
6. Preview & Branch          View in iframe, fork to explore variants
```

## API

Full REST API with JWT auth. Key endpoints:

- `POST /api/auth/login` -- authenticate
- `GET /api/projects` -- list projects
- `POST /api/projects` -- create project
- `GET /api/iterations/:projectId/tree` -- iteration tree
- `GET /api/agents` -- list agents
- `POST /api/agents` -- create agent
- `GET /preview/raw/:projectId/:iterationId` -- raw HTML preview
- `GET /preview/showcase/:projectId` -- public showcase

See [CLAUDE.md](./CLAUDE.md) for the complete API reference.

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

Distributed under the MIT License.

---

<div align="center">

Built with Claude by [Antoine Carle](https://github.com/Antoinecarle)

</div>
