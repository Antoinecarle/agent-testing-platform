/**
 * Claude CLI Session Log Parser
 *
 * Reads and parses JSONL session logs from ~/.claude/projects/{hash}/{sessionId}.jsonl
 * Extracts structured activity data: tool calls, text outputs, progress events, token usage
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Compute the Claude project hash from a workspace path
 * Claude CLI uses the absolute path with slashes replaced by dashes
 * e.g. /data/workspaces/abc123 -> -data-workspaces-abc123
 */
function computeProjectHash(workspacePath) {
  return workspacePath.replace(/\//g, '-');
}

/**
 * Find the Claude projects dir for a user
 */
function getClaudeProjectsDir(userHomePath) {
  return path.join(userHomePath, '.claude', 'projects');
}

/**
 * List all available session log files for a given workspace
 */
function listSessionFiles(userHomePath, workspacePath) {
  const projectsDir = getClaudeProjectsDir(userHomePath);
  const projectHash = computeProjectHash(workspacePath);
  const sessionDir = path.join(projectsDir, projectHash);

  if (!fs.existsSync(sessionDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(sessionDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => {
        const filePath = path.join(sessionDir, f);
        const stat = fs.statSync(filePath);
        return {
          sessionId: f.replace('.jsonl', ''),
          fileName: f,
          filePath,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.modified) - new Date(a.modified));

    return files;
  } catch (err) {
    console.warn('[SessionParser] Error listing sessions:', err.message);
    return [];
  }
}

/**
 * Parse a single JSONL line into a structured activity event
 */
function parseLogLine(line) {
  try {
    const obj = JSON.parse(line.trim());
    if (!obj.type) return null;

    const base = {
      id: obj.uuid || obj.toolUseID || `${obj.type}-${obj.timestamp}`,
      timestamp: obj.timestamp,
      sessionId: obj.sessionId,
    };

    switch (obj.type) {
      case 'assistant': {
        const content = obj.message?.content || [];
        const model = obj.message?.model;
        const usage = obj.message?.usage;
        const events = [];

        for (const block of content) {
          if (block.type === 'text' && block.text) {
            events.push({
              ...base,
              type: 'text',
              category: 'response',
              content: block.text,
              model,
              tokens: usage ? {
                input: usage.input_tokens || 0,
                output: usage.output_tokens || 0,
                cacheRead: usage.cache_read_input_tokens || 0,
                cacheWrite: usage.cache_creation_input_tokens || 0,
              } : null,
            });
          } else if (block.type === 'tool_use') {
            events.push({
              ...base,
              id: block.id || base.id,
              type: 'tool_call',
              category: categorizeToolCall(block.name),
              toolName: block.name,
              toolInput: summarizeToolInput(block.name, block.input),
              rawInput: block.input,
              model,
              tokens: usage ? {
                input: usage.input_tokens || 0,
                output: usage.output_tokens || 0,
                cacheRead: usage.cache_read_input_tokens || 0,
                cacheWrite: usage.cache_creation_input_tokens || 0,
              } : null,
            });
          }
        }
        return events.length > 0 ? events : null;
      }

      case 'user': {
        const content = obj.message?.content;
        let text = '';
        if (typeof content === 'string') {
          text = content;
        } else if (Array.isArray(content)) {
          // Could contain tool_result blocks
          for (const block of content) {
            if (block.type === 'tool_result') {
              return {
                ...base,
                type: 'tool_result',
                category: 'result',
                toolUseId: block.tool_use_id,
                content: typeof block.content === 'string'
                  ? block.content.substring(0, 500)
                  : Array.isArray(block.content)
                    ? block.content.filter(b => b.type === 'text').map(b => b.text).join('\n').substring(0, 500)
                    : '',
                isError: block.is_error || false,
              };
            } else if (block.type === 'text') {
              text += block.text;
            }
          }
        }
        if (text) {
          return {
            ...base,
            type: 'user_message',
            category: 'user',
            content: text.substring(0, 300),
          };
        }
        return null;
      }

      case 'progress': {
        const data = obj.data || {};
        if (data.type === 'mcp_progress') {
          return {
            ...base,
            id: obj.uuid || `progress-${obj.toolUseID}-${data.status}`,
            type: 'mcp_progress',
            category: 'mcp',
            status: data.status, // started | completed
            serverName: data.serverName,
            toolName: data.toolName,
            elapsedMs: data.elapsedTimeMs || null,
            toolUseId: obj.toolUseID,
          };
        }
        if (data.type === 'hook_progress') {
          return {
            ...base,
            type: 'hook',
            category: 'hook',
            hookEvent: data.hookEvent,
            hookName: data.hookName,
            command: data.command,
          };
        }
        // Tool execution progress
        if (data.type === 'tool_progress') {
          return {
            ...base,
            type: 'tool_progress',
            category: 'progress',
            toolName: data.toolName,
            status: data.status,
          };
        }
        return null;
      }

      case 'system': {
        return {
          ...base,
          type: 'system',
          category: 'system',
          subtype: obj.subtype,
          content: obj.content?.substring(0, 300),
          level: obj.level,
        };
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Categorize a tool call into a human-readable category
 */
function categorizeToolCall(toolName) {
  if (!toolName) return 'unknown';
  const name = toolName.toLowerCase();
  if (name === 'read') return 'file_read';
  if (name === 'write') return 'file_write';
  if (name === 'edit') return 'file_edit';
  if (name === 'bash') return 'command';
  if (name === 'glob' || name === 'grep') return 'search';
  if (name === 'task') return 'subagent';
  if (name === 'webfetch' || name === 'websearch') return 'web';
  if (name.startsWith('mcp__')) return 'mcp';
  return 'tool';
}

/**
 * Create a human-readable summary of tool input
 */
function summarizeToolInput(toolName, input) {
  if (!input) return '';
  const name = toolName?.toLowerCase() || '';

  if (name === 'read') {
    return input.file_path || '';
  }
  if (name === 'write') {
    return input.file_path || '';
  }
  if (name === 'edit') {
    return input.file_path || '';
  }
  if (name === 'bash') {
    const cmd = input.command || '';
    return cmd.length > 120 ? cmd.substring(0, 120) + '...' : cmd;
  }
  if (name === 'glob') {
    return input.pattern || '';
  }
  if (name === 'grep') {
    return `${input.pattern || ''} ${input.path ? `in ${input.path}` : ''}`.trim();
  }
  if (name === 'webfetch') {
    return input.url || '';
  }
  if (name === 'websearch') {
    return input.query || '';
  }
  if (name === 'task') {
    return input.description || input.prompt?.substring(0, 80) || '';
  }
  // MCP tools
  if (name.startsWith('mcp__')) {
    const parts = name.split('__');
    const mcpTool = parts[parts.length - 1] || name;
    const keys = Object.keys(input || {}).slice(0, 3);
    const summary = keys.map(k => {
      const v = input[k];
      return typeof v === 'string' ? v.substring(0, 60) : JSON.stringify(v).substring(0, 40);
    }).join(', ');
    return summary || mcpTool;
  }
  return JSON.stringify(input).substring(0, 100);
}

/**
 * Parse a full JSONL session file and return structured activity events
 * @param {string} filePath - Path to the .jsonl file
 * @param {object} options - { limit, offset, since }
 */
async function parseSessionFile(filePath, options = {}) {
  const { limit = 200, since = null } = options;

  if (!fs.existsSync(filePath)) {
    return { events: [], error: 'Session file not found' };
  }

  return new Promise((resolve) => {
    const events = [];
    const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    rl.on('line', (line) => {
      if (!line.trim()) return;
      const parsed = parseLogLine(line);
      if (!parsed) return;

      // parseLogLine can return an array (for assistant messages with multiple blocks)
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (since && item.timestamp && new Date(item.timestamp) <= new Date(since)) continue;
        events.push(item);
      }
    });

    rl.on('close', () => {
      // Return last N events (most recent)
      const sliced = events.slice(-limit);
      resolve({ events: sliced, total: events.length });
    });

    rl.on('error', (err) => {
      resolve({ events: [], error: err.message });
    });
  });
}

/**
 * Get the latest session file for a workspace
 */
function getLatestSession(userHomePath, workspacePath) {
  const sessions = listSessionFiles(userHomePath, workspacePath);
  return sessions.length > 0 ? sessions[0] : null;
}

/**
 * Watch a session file for new lines (tail -f style)
 * Returns a cleanup function
 */
function watchSessionFile(filePath, onNewEvents) {
  if (!fs.existsSync(filePath)) return () => {};

  let lastSize = fs.statSync(filePath).size;
  let buffer = '';

  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType !== 'change') return;

    try {
      const stat = fs.statSync(filePath);
      if (stat.size <= lastSize) return;

      const stream = fs.createReadStream(filePath, {
        encoding: 'utf8',
        start: lastSize,
        end: stat.size,
      });

      let data = '';
      stream.on('data', chunk => { data += chunk; });
      stream.on('end', () => {
        lastSize = stat.size;
        buffer += data;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete last line in buffer

        const newEvents = [];
        for (const line of lines) {
          if (!line.trim()) continue;
          const parsed = parseLogLine(line);
          if (!parsed) continue;
          const items = Array.isArray(parsed) ? parsed : [parsed];
          newEvents.push(...items);
        }

        if (newEvents.length > 0) {
          onNewEvents(newEvents);
        }
      });
    } catch (err) {
      console.warn('[SessionParser] Watch error:', err.message);
    }
  });

  return () => {
    try { watcher.close(); } catch (_) {}
  };
}

module.exports = {
  computeProjectHash,
  listSessionFiles,
  parseSessionFile,
  getLatestSession,
  watchSessionFile,
  parseLogLine,
};
