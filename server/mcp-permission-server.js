#!/usr/bin/env node
/**
 * MCP Permission Prompt Server for GURU chat panel.
 *
 * Spawned by Claude CLI via --permission-prompt-tool flag.
 * When Claude needs permission for a tool, this server:
 * 1. Receives the tool_name and input via MCP protocol
 * 2. HTTP POSTs to the GURU backend (permission-request endpoint)
 * 3. Backend emits socket event to the frontend
 * 4. User approves/rejects in the chat UI
 * 5. Backend responds to our HTTP request
 * 6. We return allow/deny to Claude CLI
 *
 * Environment (inherited from Claude CLI spawn):
 *   PERMISSION_CALLBACK_URL — e.g. http://localhost:4000/api/internal
 *   PERMISSION_CHAT_ID      — unique ID for this chat session
 *   AGENT_SESSION_TOKEN     — scoped JWT for auth
 */

const CALLBACK_URL = process.env.PERMISSION_CALLBACK_URL;
const CHAT_ID = process.env.PERMISSION_CHAT_ID;
const TOKEN = process.env.AGENT_SESSION_TOKEN;

// ── Logging to stderr only (stdout reserved for MCP protocol) ──

function log(...args) {
  process.stderr.write(`[mcp-permission] ${args.join(' ')}\n`);
}

function logError(...args) {
  process.stderr.write(`[mcp-permission ERROR] ${args.join(' ')}\n`);
}

// ── Validate environment ──

if (!CALLBACK_URL || !CHAT_ID || !TOKEN) {
  logError('Missing required env: PERMISSION_CALLBACK_URL, PERMISSION_CHAT_ID, or AGENT_SESSION_TOKEN');
  logError(`  CALLBACK_URL=${CALLBACK_URL || 'unset'}`);
  logError(`  CHAT_ID=${CHAT_ID || 'unset'}`);
  logError(`  TOKEN=${TOKEN ? 'set' : 'unset'}`);
  process.exit(1);
}

// ── HTTP helper ──

async function postPermissionRequest(toolName, toolInput) {
  const url = `${CALLBACK_URL}/permission-request`;
  const body = {
    chatId: CHAT_ID,
    toolName,
    toolInput,
  };

  log(`Requesting permission for tool: ${toolName}`);

  const controller = new AbortController();
  // 5-minute timeout for user to respond
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-token': TOKEN,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      logError(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
      return { behavior: 'deny', message: `Permission server error: HTTP ${res.status}` };
    }

    const result = await res.json();
    log(`Permission result for ${toolName}: ${result.behavior}`);
    return result;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      logError('Permission request timed out (5min)');
      return { behavior: 'deny', message: 'Permission request timed out' };
    }
    logError(`Permission request failed: ${err.message}`);
    return { behavior: 'deny', message: `Permission request error: ${err.message}` };
  }
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
          },
          serverInfo: {
            name: 'guru-permission-prompt',
            version: '1.0.0',
          },
        },
      };

    case 'notifications/initialized':
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'permission_prompt',
              description: 'Prompt the user for tool permission approval',
              inputSchema: {
                type: 'object',
                properties: {
                  tool_name: {
                    type: 'string',
                    description: 'Name of the tool requesting permission',
                  },
                  input: {
                    type: 'object',
                    description: 'The input parameters for the tool',
                    additionalProperties: true,
                  },
                },
                required: ['tool_name', 'input'],
              },
            },
          ],
        },
      };

    case 'tools/call': {
      const toolName = params?.arguments?.tool_name || params?.name || 'unknown';
      const toolInput = params?.arguments?.input || params?.arguments || {};

      try {
        const result = await postPermissionRequest(toolName, toolInput);

        // Return the permission decision as MCP tool result
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              { type: 'text', text: JSON.stringify(result) },
            ],
            isError: false,
          },
        };
      } catch (err) {
        logError(`Permission prompt failed: ${err.message}`);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              { type: 'text', text: JSON.stringify({ behavior: 'deny', message: err.message }) },
            ],
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

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

log(`Started. Callback: ${CALLBACK_URL} | ChatID: ${CHAT_ID}`);
