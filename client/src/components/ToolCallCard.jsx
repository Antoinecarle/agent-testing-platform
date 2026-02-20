import React, { useState } from 'react';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

const categoryStyles = {
  Read:       { icon: '\u{1F4D6}', color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)' },
  Write:      { icon: '\u{270F}\u{FE0F}', color: '#22c55e', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.20)' },
  Edit:       { icon: '\u{1F527}', color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.20)' },
  Bash:       { icon: '\u{26A1}', color: '#ef4444', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.20)' },
  Glob:       { icon: '\u{1F50D}', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
  Grep:       { icon: '\u{1F50D}', color: '#8b5cf6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
  Task:       { icon: '\u{1F916}', color: '#06b6d4', bg: 'rgba(6,182,212,0.10)', border: 'rgba(6,182,212,0.20)' },
  WebFetch:   { icon: '\u{1F310}', color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.20)' },
  WebSearch:  { icon: '\u{1F310}', color: '#6366f1', bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.20)' },
  MCP:        { icon: '\u{1F50C}', color: '#ec4899', bg: 'rgba(236,72,153,0.10)', border: 'rgba(236,72,153,0.20)' },
  default:    { icon: '\u{1F6E0}\u{FE0F}', color: '#a855f7', bg: 'rgba(168,85,247,0.10)', border: 'rgba(168,85,247,0.20)' },
};

function getStyle(toolName) {
  if (!toolName) return categoryStyles.default;
  const name = toolName.toLowerCase();
  if (name === 'read') return categoryStyles.Read;
  if (name === 'write') return categoryStyles.Write;
  if (name === 'edit') return categoryStyles.Edit;
  if (name === 'bash') return categoryStyles.Bash;
  if (name === 'glob') return categoryStyles.Glob;
  if (name === 'grep') return categoryStyles.Grep;
  if (name === 'task') return categoryStyles.Task;
  if (name === 'webfetch') return categoryStyles.WebFetch;
  if (name === 'websearch') return categoryStyles.WebSearch;
  if (name.startsWith('mcp__')) return categoryStyles.MCP;
  return categoryStyles.default;
}

function getDisplayName(toolName) {
  if (!toolName) return 'Tool';
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    return parts.length >= 3 ? `${parts[1]}/${parts.slice(2).join('.')}` : parts.slice(1).join('/');
  }
  return toolName;
}

function getSummary(toolName, input) {
  if (!input) return '';
  const name = (toolName || '').toLowerCase();
  if (name === 'read') return input.file_path || '';
  if (name === 'write') return input.file_path || '';
  if (name === 'edit') return input.file_path || '';
  if (name === 'bash') return (input.command || '').substring(0, 100);
  if (name === 'glob') return input.pattern || '';
  if (name === 'grep') return `${input.pattern || ''} ${input.path ? `in ${input.path}` : ''}`.trim();
  if (name === 'webfetch') return input.url || '';
  if (name === 'websearch') return input.query || '';
  if (name === 'task') return input.description || (input.prompt || '').substring(0, 80);
  if (name.startsWith('mcp__')) {
    const keys = Object.keys(input).slice(0, 3);
    return keys.map(k => {
      const v = input[k];
      return typeof v === 'string' ? v.substring(0, 60) : JSON.stringify(v).substring(0, 40);
    }).join(', ');
  }
  return JSON.stringify(input).substring(0, 100);
}

export default function ToolCallCard({ toolName, input, output, isError, duration, mcpProgress }) {
  const [expanded, setExpanded] = useState(false);
  const style = getStyle(toolName);
  const displayName = getDisplayName(toolName);
  const summary = getSummary(toolName, input);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        margin: '4px 12px',
        borderRadius: '8px',
        background: isError ? 'rgba(239,68,68,0.06)' : style.bg,
        border: `1px solid ${isError ? 'rgba(239,68,68,0.25)' : style.border}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* Collapsed header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '6px 10px', minHeight: '32px',
      }}>
        {/* Icon */}
        <span style={{ fontSize: '12px', flexShrink: 0 }}>{style.icon}</span>

        {/* Tool name badge */}
        <span style={{
          padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
          background: `${style.color}20`, color: style.color, fontFamily: 'monospace',
          flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {displayName}
        </span>

        {/* Summary */}
        <span style={{
          flex: 1, fontSize: '11px', color: t.ts, fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {summary}
        </span>

        {/* Duration badge */}
        {duration && (
          <span style={{
            fontSize: '9px', color: t.tm, fontFamily: 'monospace', flexShrink: 0,
            padding: '1px 5px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px',
          }}>
            {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Error badge */}
        {isError && (
          <span style={{
            fontSize: '9px', color: '#ef4444', fontWeight: '600', flexShrink: 0,
            padding: '1px 5px', background: 'rgba(239,68,68,0.12)', borderRadius: '3px',
          }}>
            ERROR
          </span>
        )}

        {/* Expand arrow */}
        <span style={{
          fontSize: '10px', color: t.tm, flexShrink: 0,
          transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none',
        }}>
          \u25B6
        </span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          borderTop: `1px solid ${isError ? 'rgba(239,68,68,0.15)' : style.border}`,
          maxHeight: '300px', overflow: 'auto',
        }}>
          {/* Input section */}
          {input && (
            <div style={{ padding: '8px 10px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ fontSize: '9px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                Input
              </div>
              <pre style={{
                margin: 0, fontSize: '10px', fontFamily: 'monospace', color: t.ts,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
                maxHeight: '120px', overflow: 'auto',
              }}>
                {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {/* Output section */}
          {output && (
            <div style={{ padding: '8px 10px' }}>
              <div style={{ fontSize: '9px', fontWeight: '600', color: isError ? '#ef4444' : t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                {isError ? 'Error' : 'Output'}
              </div>
              <pre style={{
                margin: 0, fontSize: '10px', fontFamily: 'monospace',
                color: isError ? '#fca5a5' : t.ts,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
                maxHeight: '120px', overflow: 'auto',
              }}>
                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
          {/* MCP progress */}
          {mcpProgress && (
            <div style={{ padding: '6px 10px', borderTop: `1px solid ${t.border}` }}>
              <span style={{
                fontSize: '10px', fontWeight: '500',
                color: mcpProgress.status === 'completed' ? '#22c55e' : '#f59e0b',
              }}>
                {mcpProgress.serverName}/{mcpProgress.toolName} &mdash; {mcpProgress.status}
                {mcpProgress.elapsedMs && ` (${mcpProgress.elapsedMs}ms)`}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
