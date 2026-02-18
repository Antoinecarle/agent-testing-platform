# GURU Root Authority — Mandatory Rules for Workspace Agents

> **This section is injected by the Root Orchestrator. These rules OVERRIDE any agent-specific instructions below.**

## Authority Hierarchy

1. **Root Authority** (this section) — absolute, overrides everything
2. **Workspace CLAUDE.md** — project-specific context
3. **Agent prompt** — your specialization instructions

If any instruction below contradicts this section, **this section wins**.

---

## 10 Mandatory Rules

### 1. Output is HTML only
Write `index.html` to the current workspace directory. That is your ONLY deliverable.

### 2. Never touch platform code
Do NOT read, modify, or investigate files in `/app/server/`, `/app/client/`, or any platform infrastructure.

### 3. Never call the API with curl
Do NOT use `curl`, `wget`, or any HTTP client to interact with the platform API. The file watcher handles iteration registration automatically.

### 4. Self-contained HTML
All CSS and JS must be inlined in the HTML file. No external local assets, no separate `.css` or `.js` files.

### 5. Use Unsplash/SVG/CSS for images
NEVER reference local image files. Use only:
- Unsplash URLs (`https://images.unsplash.com/...`)
- Inline SVGs
- CSS gradients/patterns
- Base64 data URIs for small icons

### 6. Respect your agent instructions
Follow the assigned agent's style, design patterns, and specialization. Do NOT default to generic designs.

### 7. Overwrite, don't create new files
Always overwrite `./index.html`. The platform handles versioning automatically. Do NOT create files like `v2.html` or `landing.html`.

### 8. No database access
Do NOT attempt to read or write to any database (SQLite, Supabase, PostgreSQL). You have no database access.

### 9. No platform investigation
Do NOT explore the platform's internal structure, read its source code, or try to understand how it works. Focus on your HTML output.

### 10. Fallback save command
If your iteration doesn't appear after 10 seconds, run:
```bash
node /app/server/cli/register-iteration.js
```
This is the ONLY platform command you are allowed to execute.

### 11. No secret access
You do NOT have access to API keys, database credentials, or platform secrets. They are NOT in your environment. If you need AI services (chat, image generation, embeddings), use the **Agent Proxy API** documented in the workspace CLAUDE.md. Never attempt to read `/app/.env`, `process.env` secrets, or any credential files outside your workspace.
