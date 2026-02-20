import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

// Category -> icon + color mapping
const categoryConfig = {
  file_read:  { icon: '📖', color: '#3b82f6', label: 'Read' },
  file_write: { icon: '✏️', color: '#22c55e', label: 'Write' },
  file_edit:  { icon: '🔧', color: '#f59e0b', label: 'Edit' },
  command:    { icon: '⚡', color: '#ef4444', label: 'Bash' },
  search:     { icon: '🔍', color: '#8b5cf6', label: 'Search' },
  subagent:   { icon: '🤖', color: '#06b6d4', label: 'Agent' },
  web:        { icon: '🌐', color: '#6366f1', label: 'Web' },
  mcp:        { icon: '🔌', color: '#ec4899', label: 'MCP' },
  tool:       { icon: '🛠️', color: '#a855f7', label: 'Tool' },
  response:   { icon: '💬', color: '#64748b', label: 'Response' },
  user:       { icon: '👤', color: '#f97316', label: 'User' },
  result:     { icon: '📋', color: '#475569', label: 'Result' },
  hook:       { icon: '🪝', color: '#78716c', label: 'Hook' },
  system:     { icon: '⚙️', color: '#52525b', label: 'System' },
  progress:   { icon: '⏳', color: '#a3a3a3', label: 'Progress' },
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatMs(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ToolCallBadge({ name }) {
  // Clean up MCP tool names
  let displayName = name || '';
  if (displayName.startsWith('mcp__')) {
    const parts = displayName.split('__');
    displayName = parts.length >= 3 ? `${parts[1]}/${parts.slice(2).join('.')}` : parts.slice(1).join('/');
  }
  return (
    <span style={{
      padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '600',
      background: 'rgba(139,92,246,0.15)', color: '#a78bfa', fontFamily: 'monospace',
    }}>
      {displayName}
    </span>
  );
}

function EventRow({ event, expanded, onToggle }) {
  const config = categoryConfig[event.category] || categoryConfig.tool;
  const isExpandable = event.type === 'tool_call' || event.type === 'text' || event.type === 'tool_result' || event.type === 'user_message';

  return (
    <div
      onClick={() => isExpandable && onToggle(event.id)}
      style={{
        padding: '6px 12px', borderBottom: `1px solid ${t.border}`,
        cursor: isExpandable ? 'pointer' : 'default',
        background: expanded ? 'rgba(139,92,246,0.04)' : 'transparent',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => { if (!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
      onMouseLeave={e => { if (!expanded) e.currentTarget.style.background = 'transparent'; }}
    >
      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: '24px' }}>
        {/* Time */}
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace', width: '60px', flexShrink: 0 }}>
          {formatTime(event.timestamp)}
        </span>

        {/* Category badge */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '600',
          background: `${config.color}15`, color: config.color, flexShrink: 0, minWidth: '50px',
        }}>
          <span style={{ fontSize: '10px' }}>{config.icon}</span>
          {config.label}
        </span>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '6px' }}>
          {event.type === 'tool_call' && (
            <>
              <ToolCallBadge name={event.toolName} />
              <span style={{
                fontSize: '11px', color: t.ts, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace',
              }}>
                {event.toolInput}
              </span>
            </>
          )}
          {event.type === 'mcp_progress' && (
            <>
              <ToolCallBadge name={`${event.serverName}/${event.toolName}`} />
              <span style={{
                fontSize: '10px', fontWeight: '500',
                color: event.status === 'completed' ? '#22c55e' : '#f59e0b',
              }}>
                {event.status === 'completed' ? 'done' : 'running'}
              </span>
              {event.elapsedMs && (
                <span style={{ fontSize: '10px', color: t.tm }}>{formatMs(event.elapsedMs)}</span>
              )}
            </>
          )}
          {event.type === 'text' && (
            <span style={{
              fontSize: '11px', color: t.ts, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {event.content?.substring(0, 100)}
            </span>
          )}
          {event.type === 'user_message' && (
            <span style={{
              fontSize: '11px', color: '#f97316', overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {event.content}
            </span>
          )}
          {event.type === 'tool_result' && (
            <span style={{
              fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              color: event.isError ? '#ef4444' : t.tm,
            }}>
              {event.isError ? 'Error: ' : ''}{event.content?.substring(0, 80)}
            </span>
          )}
          {event.type === 'hook' && (
            <span style={{ fontSize: '11px', color: t.tm }}>{event.hookName || event.hookEvent}</span>
          )}
          {event.type === 'system' && (
            <span style={{ fontSize: '11px', color: t.tm }}>{event.subtype}: {event.content?.substring(0, 80)}</span>
          )}
        </div>

        {/* Token usage */}
        {event.tokens && (
          <span style={{
            fontSize: '9px', color: t.tm, fontFamily: 'monospace', flexShrink: 0,
            padding: '1px 4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px',
          }}>
            {event.tokens.input + event.tokens.output}t
          </span>
        )}

        {/* Expand indicator */}
        {isExpandable && (
          <span style={{ fontSize: '10px', color: t.tm, flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          marginTop: '6px', marginLeft: '68px', padding: '8px 10px',
          background: t.bg, borderRadius: '6px', border: `1px solid ${t.border}`,
          fontSize: '11px', fontFamily: 'monospace', color: t.ts,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '200px', overflow: 'auto',
        }}>
          {event.type === 'tool_call' && event.rawInput && (
            <pre style={{ margin: 0, fontSize: '10px' }}>{JSON.stringify(event.rawInput, null, 2)}</pre>
          )}
          {event.type === 'text' && event.content}
          {event.type === 'user_message' && event.content}
          {event.type === 'tool_result' && event.content}
        </div>
      )}
    </div>
  );
}

function SessionSelector({ sessions, selectedId, onSelect }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <select
      value={selectedId || ''}
      onChange={e => onSelect(e.target.value)}
      style={{
        background: t.surfaceEl, color: t.ts, border: `1px solid ${t.border}`,
        borderRadius: '4px', padding: '2px 6px', fontSize: '10px', fontFamily: 'monospace',
        outline: 'none', cursor: 'pointer', maxWidth: '180px',
      }}
    >
      {sessions.map(s => (
        <option key={s.sessionId} value={s.sessionId}>
          {s.sessionId.substring(0, 8)}... ({new Date(s.modified).toLocaleTimeString()})
        </option>
      ))}
    </select>
  );
}

export default function ActivityPanel({ projectId }) {
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watching, setWatching] = useState(false);
  const [expanded, setExpanded] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const autoScrollRef = useRef(true);

  // Toggle expanded state
  const toggleExpand = useCallback((id) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Load sessions list
  useEffect(() => {
    if (!projectId) return;
    api(`/api/session-logs/${projectId}/sessions`).then(data => {
      setSessions(data.sessions || []);
      if (data.sessions?.length > 0 && !selectedSession) {
        setSelectedSession(data.sessions[0].sessionId);
      }
    }).catch(() => {});
  }, [projectId]);

  // Load activity for selected session
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const params = selectedSession ? `?sessionId=${selectedSession}&limit=300` : '?limit=300';
    api(`/api/session-logs/${projectId}/activity${params}`).then(data => {
      setEvents(data.events || []);
      if (data.sessionId && !selectedSession) setSelectedSession(data.sessionId);
      setLoading(false);
      // Auto-scroll to bottom
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    }).catch(() => {
      setEvents([]);
      setLoading(false);
    });
  }, [projectId, selectedSession]);

  // Socket.IO live watching
  useEffect(() => {
    if (!projectId) return;

    const token = localStorage.getItem('token');
    const socket = io('/terminal', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('watch-activity', { projectId }, (resp) => {
        if (resp?.watching) setWatching(true);
      });
    });

    socket.on('activity-events', (newEvents) => {
      setEvents(prev => {
        const merged = [...prev, ...newEvents];
        // Keep last 500 events max
        return merged.slice(-500);
      });
      // Auto-scroll if at bottom
      if (autoScrollRef.current && scrollRef.current) {
        setTimeout(() => {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }, 30);
      }
    });

    return () => {
      socket.emit('stop-watch-activity');
      socket.disconnect();
      socketRef.current = null;
      setWatching(false);
    };
  }, [projectId]);

  // Detect if user has scrolled up (disable auto-scroll)
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  // Filter events
  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => {
        if (filter === 'tools') return e.type === 'tool_call';
        if (filter === 'mcp') return e.category === 'mcp' || e.type === 'mcp_progress';
        if (filter === 'files') return ['file_read', 'file_write', 'file_edit'].includes(e.category);
        if (filter === 'commands') return e.category === 'command';
        if (filter === 'messages') return e.type === 'text' || e.type === 'user_message';
        return true;
      });

  // Stats
  const toolCalls = events.filter(e => e.type === 'tool_call').length;
  const totalTokens = events.reduce((sum, e) => sum + (e.tokens ? e.tokens.input + e.tokens.output : 0), 0);

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'tools', label: 'Tools' },
    { key: 'files', label: 'Files' },
    { key: 'commands', label: 'Bash' },
    { key: 'mcp', label: 'MCP' },
    { key: 'messages', label: 'Chat' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.surface }}>
      {/* Header bar */}
      <div style={{
        padding: '6px 12px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        {/* Live indicator */}
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: watching ? '#22c55e' : '#52525b',
          boxShadow: watching ? '0 0 6px #22c55e' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.tp }}>Activity</span>

        {/* Stats */}
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
          {toolCalls} calls
        </span>
        {totalTokens > 0 && (
          <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
            {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} tokens
          </span>
        )}

        <div style={{ flex: 1 }} />

        <SessionSelector sessions={sessions} selectedId={selectedSession} onSelect={setSelectedSession} />

        {/* Refresh */}
        <button
          onClick={() => {
            setLoading(true);
            const params = selectedSession ? `?sessionId=${selectedSession}&limit=300` : '?limit=300';
            api(`/api/session-logs/${projectId}/activity${params}`).then(data => {
              setEvents(data.events || []);
              setLoading(false);
            }).catch(() => setLoading(false));
          }}
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '3px',
            color: t.ts, cursor: 'pointer', padding: '2px 6px', fontSize: '10px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        padding: '4px 12px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', gap: '4px', flexShrink: 0, overflowX: 'auto',
      }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontWeight: '500',
              border: 'none', cursor: 'pointer',
              background: filter === f.key ? t.violetM : 'transparent',
              color: filter === f.key ? '#a78bfa' : t.tm,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflow: 'auto', scrollBehavior: 'smooth', minHeight: 0 }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
            Loading activity...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: t.tm }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔍</div>
            <div style={{ fontSize: '12px' }}>No activity yet</div>
            <div style={{ fontSize: '11px', marginTop: '4px', color: t.tm }}>
              Start a Claude session in the terminal to see actions here
            </div>
          </div>
        ) : (
          filteredEvents.map(event => (
            <EventRow
              key={event.id}
              event={event}
              expanded={expanded.has(event.id)}
              onToggle={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
