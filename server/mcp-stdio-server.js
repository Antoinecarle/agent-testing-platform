#!/usr/bin/env node
/**
 * MCP Stdio Bridge Server for GURU workspace terminals.
 *
 * Spawned by Claude CLI via .mcp.json configuration.
 * Bridges MCP JSON-RPC protocol (stdin/stdout) to GURU's
 * agent-proxy HTTP API for tool discovery and execution.
 *
 * Environment (inherited from terminal):
 *   AGENT_PROXY_URL       — e.g. http://localhost:4000/api/agent-proxy
 *   AGENT_SESSION_TOKEN   — scoped JWT for proxy auth
 *   GURU_PROJECT_ID       — current project ID
 */

const PROXY_URL = process.env.AGENT_PROXY_URL;
const TOKEN = process.env.AGENT_SESSION_TOKEN;

// ── Logging to stderr only (stdout reserved for MCP protocol) ──

function log(...args) {
  process.stderr.write(`[mcp-stdio] ${args.join(' ')}\n`);
}

function logError(...args) {
  process.stderr.write(`[mcp-stdio ERROR] ${args.join(' ')}\n`);
}

// ── Validate environment ──

if (!PROXY_URL || !TOKEN) {
  logError('Missing AGENT_PROXY_URL or AGENT_SESSION_TOKEN in environment');
  process.exit(1);
}

// ── HTTP helper ──

async function proxyRequest(method, path, body = null) {
  const url = `${PROXY_URL}${path}`;
  const opts = {
    method,
    headers: {
      'x-agent-token': TOKEN,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 500)}`);
  }
  return res.json();
}

// ── Tools cache (avoid re-fetching on every call) ──

let cachedTools = null;
let toolsCacheTime = 0;
const TOOLS_CACHE_TTL = 60_000; // 1 minute

async function getTools() {
  if (cachedTools && Date.now() - toolsCacheTime < TOOLS_CACHE_TTL) {
    return cachedTools;
  }
  const data = await proxyRequest('GET', '/mcp-tools');
  cachedTools = data.tools || [];
  toolsCacheTime = Date.now();
  log(`Loaded ${cachedTools.length} tools`);
  return cachedTools;
}

// ── MCP JSON-RPC message handler ──

async function handleMessage(msg) {
  const { method, id, params } = msg;

  // Notifications (no id) — no response needed
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: 'guru-workspace-tools',
            version: '1.0.0',
          },
        },
      };

    case 'notifications/initialized':
      // Client ack — no response needed
      return null;

    case 'tools/list': {
      const tools = await getTools();
      return { jsonrpc: '2.0', id, result: { tools } };
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      log(`Calling tool: ${toolName}`);

      try {
        const result = await proxyRequest('POST', '/mcp-call', {
          tool_name: toolName,
          arguments: toolArgs,
        });

        // Normalize response to MCP format
        const content = result.content || [
          { type: 'text', text: result.text || JSON.stringify(result) },
        ];

        return {
          jsonrpc: '2.0',
          id,
          result: { content, isError: !!result.isError },
        };
      } catch (err) {
        logError(`Tool call failed (${toolName}):`, err.message);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Tool execution failed: ${err.message}` }],
            isError: true,
          },
        };
      }
    }

    case 'resources/list':
      return { jsonrpc: '2.0', id, result: { resources: [] } };

    case 'resources/templates/list':
      return { jsonrpc: '2.0', id, result: { resourceTemplates: [] } };

    case 'prompts/list':
      return { jsonrpc: '2.0', id, result: { prompts: [] } };

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// ── Stdin/stdout JSON-RPC transport ──

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;

  // Process complete lines (newline-delimited JSON)
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    processLine(trimmed);
  }
});

async function processLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    logError('Invalid JSON:', line.slice(0, 200));
    return;
  }

  try {
    const response = await handleMessage(msg);
    if (response) {
      process.stdout.write(JSON.stringify(response) + '\n');
    }
  } catch (err) {
    logError(`Error handling ${msg.method}:`, err.message);
    if (msg.id !== undefined && msg.id !== null) {
      const errResp = {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32603, message: err.message },
      };
      process.stdout.write(JSON.stringify(errResp) + '\n');
    }
  }
}

// ── Graceful shutdown ──

process.stdin.on('end', () => {
  log('stdin closed, shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('SIGINT received, shutting down');
  process.exit(0);
});

log(`Started. Proxy: ${PROXY_URL}`);
