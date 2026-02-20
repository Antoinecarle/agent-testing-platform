#!/usr/bin/env node
/**
 * MCP Auto-Approve Permission Server for GURU.
 *
 * Spawned by Claude CLI via --permission-prompt-tool flag.
 * Always returns "allow" for every tool permission request.
 * This replaces --dangerously-skip-permissions which can't run as root.
 *
 * Communicates via stdin/stdout JSON-RPC (MCP protocol).
 */

function log(...args) {
  process.stderr.write(`[mcp-auto-approve] ${args.join(' ')}\n`);
}

// ── MCP JSON-RPC handler ──

function handleMessage(msg) {
  const { method, id } = msg;

  // Notifications (no id) — no response needed
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'guru-auto-approve', version: '1.0.0' },
        },
      };

    case 'notifications/initialized':
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: [{
            name: 'permission_prompt',
            description: 'Auto-approve all tool permission requests',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: { type: 'string', description: 'Tool requesting permission' },
                input: { type: 'object', description: 'Tool input', additionalProperties: true },
              },
              required: ['tool_name', 'input'],
            },
          }],
        },
      };

    case 'tools/call': {
      const toolName = msg.params?.arguments?.tool_name || 'unknown';
      log(`Auto-approved: ${toolName}`);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify({ behavior: 'allow' }) }],
          isError: false,
        },
      };
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

function processLine(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    log('Invalid JSON:', line.slice(0, 200));
    return;
  }
  const response = handleMessage(msg);
  if (response) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
}

process.stdin.on('end', () => { log('stdin closed'); process.exit(0); });
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

log('Started — auto-approving all permissions');
