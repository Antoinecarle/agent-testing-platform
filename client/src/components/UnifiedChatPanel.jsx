import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api, getToken, refreshAccessToken } from '../api';
import ToolCallCard from './ToolCallCard';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

function SessionTabs({ sessions, selectedId, onSelect, onNewSession }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 8px',
      borderBottom: `1px solid ${t.border}`, overflowX: 'auto', flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      {sessions.map(s => (
        <button
          key={s.sessionId}
          onClick={() => onSelect(s.sessionId)}
          style={{
            padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
            fontFamily: 'monospace', border: 'none', cursor: 'pointer',
            background: selectedId === s.sessionId ? t.violetM : 'transparent',
            color: selectedId === s.sessionId ? '#a78bfa' : t.tm,
            fontWeight: selectedId === s.sessionId ? '600' : '400',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          {s.sessionId.substring(0, 8)}...
        </button>
      ))}
      {onNewSession && (
        <button onClick={onNewSession} style={{
          padding: '3px 6px', borderRadius: '4px', fontSize: '12px', border: 'none',
          cursor: 'pointer', background: 'transparent', color: t.tm, flexShrink: 0,
        }}>
          +
        </button>
      )}
    </div>
  );
}

function TurnView({ turn }) {
  return (
    <div style={{ marginBottom: '4px' }}>
      {/* User message */}
      {turn.userMessage && (
        <div style={{
          display: 'flex', justifyContent: 'flex-end', padding: '4px 12px',
        }}>
          <div style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 2px 12px',
            background: t.violetM, border: '1px solid rgba(139,92,246,0.3)',
            fontSize: '13px', lineHeight: '1.5', color: t.tp,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {turn.userMessage}
          </div>
        </div>
      )}

      {/* Tool calls as inline cards */}
      {turn.toolCalls && turn.toolCalls.map((tc, i) => (
        <ToolCallCard
          key={tc.id || `tc-${i}`}
          toolName={tc.toolName}
          input={tc.rawInput}
          output={tc.result}
          isError={tc.isError}
          duration={tc.mcpProgress?.elapsedMs}
          mcpProgress={tc.mcpProgress}
        />
      ))}

      {/* Assistant response */}
      {turn.assistantText && (
        <div style={{
          display: 'flex', justifyContent: 'flex-start', padding: '4px 12px',
        }}>
          <div style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`,
            fontSize: '13px', lineHeight: '1.5', color: t.tp, position: 'relative',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {turn.assistantText}
            {/* Token badge */}
            {turn.tokens && (
              <div style={{
                marginTop: '4px', textAlign: 'right', fontSize: '9px',
                color: t.tm, fontFamily: 'monospace',
              }}>
                {turn.tokens.input} in / {turn.tokens.output} out
              </div>
            )}
          </div>
        </div>
      )}

      {turn.streaming && (
        <div style={{ display: 'flex', justifyContent: 'flex-start', padding: '4px 12px' }}>
          <div style={{
            maxWidth: '85%', padding: '8px 12px', borderRadius: '12px 12px 12px 2px',
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${t.border}`,
            fontSize: '13px', lineHeight: '1.5', color: t.tp,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {turn.streamingText || ''}
            <span style={{
              display: 'inline-block', width: '6px', height: '14px',
              background: t.violet, borderRadius: '1px', marginLeft: '2px',
              animation: 'blink 0.8s step-end infinite', verticalAlign: 'text-bottom',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedChatPanel({ projectId }) {
  const [turns, setTurns] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [watching, setWatching] = useState(false);
  const [chatSessionId, setChatSessionId] = useState(null);

  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const autoScrollRef = useRef(true);
  const currentStreamRef = useRef({ text: '', toolCalls: [] });

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

  // Load turns for selected session
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const params = selectedSession ? `?sessionId=${selectedSession}&limit=500` : '?limit=500';
    api(`/api/session-logs/${projectId}/turns${params}`).then(data => {
      setTurns(data.turns || []);
      if (data.sessionId && !selectedSession) setSelectedSession(data.sessionId);
      setLoading(false);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    }).catch(() => {
      setTurns([]);
      setLoading(false);
    });
  }, [projectId, selectedSession]);

  // Socket.IO: live activity watching + chat streaming
  useEffect(() => {
    if (!projectId) return;

    const token = getToken();
    const socket = io('/terminal', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[UnifiedChat] Socket connected');
      socket.emit('watch-activity', { projectId }, (resp) => {
        if (resp?.watching) setWatching(true);
      });
    });

    socket.on('connect_error', (err) => {
      console.error('[UnifiedChat] Socket connect error:', err.message);
      setWatching(false);
      // If auth error, try refreshing token and reconnecting
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        refreshAccessToken().then(newToken => {
          socket.auth = { token: newToken };
          socket.connect();
        }).catch(() => {
          // Refresh failed, redirect to login
          window.location.href = '/login';
        });
      }
    });

    socket.on('disconnect', (reason) => {
      console.warn('[UnifiedChat] Socket disconnected:', reason);
      setWatching(false);
      // If sending, reset
      setSending(false);
    });

    // Live activity events from file watcher
    socket.on('activity-events', (newEvents) => {
      // Re-fetch turns when new activity comes in (simple approach, avoids complex merging)
      const params = selectedSession ? `?sessionId=${selectedSession}&limit=500` : '?limit=500';
      api(`/api/session-logs/${projectId}/turns${params}`).then(data => {
        setTurns(data.turns || []);
        if (autoScrollRef.current && scrollRef.current) {
          setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 30);
        }
      }).catch(() => {});
    });

    // Chat streaming
    socket.on('chat-stream', (data) => {
      if (data.type === 'assistant') {
        const content = data.message?.content || [];
        let text = '';
        let toolUse = null;
        for (const block of content) {
          if (block.type === 'text') {
            text += block.text || '';
          } else if (block.type === 'tool_use') {
            toolUse = {
              id: block.id || `tc-${Date.now()}`,
              toolName: block.name,
              rawInput: block.input,
              toolInput: summarizeTool(block.name, block.input),
              category: 'tool',
              result: null,
              isError: false,
            };
          }
        }

        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;

          if (toolUse) {
            if (lastIdx >= 0 && copy[lastIdx].streaming) {
              copy[lastIdx] = {
                ...copy[lastIdx],
                toolCalls: [...(copy[lastIdx].toolCalls || []), toolUse],
              };
            }
          }

          if (text) {
            if (lastIdx >= 0 && copy[lastIdx].streaming) {
              copy[lastIdx] = {
                ...copy[lastIdx],
                streamingText: text,
              };
            }
          }

          return copy;
        });
      } else if (data.type === 'result') {
        const text = data.result?.trim() || data.message?.content?.find(b => b.type === 'text')?.text || '';
        if (data.session_id) setChatSessionId(data.session_id);
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = {
              ...copy[lastIdx],
              assistantText: text || copy[lastIdx].streamingText || '',
              streaming: false,
              streamingText: undefined,
            };
          }
          return copy;
        });
      } else if (data.type === 'error') {
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = {
              ...copy[lastIdx],
              assistantText: data.text || 'Error occurred',
              streaming: false,
              streamingText: undefined,
              isError: true,
            };
          }
          return copy;
        });
      } else if (data.type === 'raw') {
        if (data.text?.trim()) {
          setTurns(prev => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].streaming) {
              copy[lastIdx] = {
                ...copy[lastIdx],
                streamingText: (copy[lastIdx].streamingText || '') + data.text,
              };
            }
            return copy;
          });
        }
      }

      if (autoScrollRef.current && scrollRef.current) {
        setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 20);
      }
    });

    socket.on('chat-done', (data) => {
      if (data.sessionId) setChatSessionId(data.sessionId);
      setSending(false);
      setTurns(prev => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].streaming) {
          copy[lastIdx] = {
            ...copy[lastIdx],
            assistantText: copy[lastIdx].streamingText || copy[lastIdx].assistantText || '',
            streaming: false,
            streamingText: undefined,
          };
        }
        return copy;
      });
    });

    return () => {
      socket.emit('stop-watch-activity');
      socket.emit('chat-cancel');
      socket.disconnect();
      socketRef.current = null;
      setWatching(false);
    };
  }, [projectId, selectedSession]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  }, []);

  const sendMessage = useCallback(() => {
    if (!input.trim() || sending || !socketRef.current) return;

    const msg = input.trim();
    setInput('');
    setSending(true);

    // Add a new streaming turn
    setTurns(prev => [...prev, {
      id: `turn-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userMessage: msg,
      toolCalls: [],
      assistantText: '',
      streaming: true,
      streamingText: '',
      tokens: null,
    }]);

    socketRef.current.emit('chat-send', {
      projectId,
      message: msg,
      sessionResume: chatSessionId,
    }, (resp) => {
      if (resp?.error) {
        console.error('[Chat] Send error:', resp.error);
        setSending(false);
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = {
              ...copy[lastIdx],
              assistantText: `Error: ${resp.error}`,
              streaming: false,
              streamingText: undefined,
              isError: true,
            };
          }
          return copy;
        });
      }
    });

    // Safety timeout: if no response after 60s, reset sending state
    setTimeout(() => {
      setSending(prev => {
        if (prev) {
          console.warn('[Chat] Send timeout - resetting state');
          return false;
        }
        return prev;
      });
    }, 60000);

    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  }, [input, sending, projectId, chatSessionId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const cancelChat = () => {
    if (socketRef.current) socketRef.current.emit('chat-cancel');
    setSending(false);
    setTurns(prev => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      if (lastIdx >= 0 && copy[lastIdx].streaming) {
        copy[lastIdx] = {
          ...copy[lastIdx],
          assistantText: (copy[lastIdx].streamingText || '') + ' [cancelled]',
          streaming: false,
          streamingText: undefined,
        };
      }
      return copy;
    });
  };

  // Stats
  const totalToolCalls = turns.reduce((sum, t) => sum + (t.toolCalls?.length || 0), 0);
  const totalTokens = turns.reduce((sum, t) => sum + (t.tokens ? t.tokens.input + t.tokens.output : 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.surface }}>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>

      {/* Stats bar */}
      <div style={{
        padding: '4px 12px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0,
      }}>
        <div style={{
          width: '6px', height: '6px', borderRadius: '50%',
          background: watching ? '#22c55e' : '#52525b',
          boxShadow: watching ? '0 0 6px #22c55e' : 'none',
          flexShrink: 0,
        }} />
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
          {totalToolCalls} tools
        </span>
        {totalTokens > 0 && (
          <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
            {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens} tokens
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            const params = selectedSession ? `?sessionId=${selectedSession}&limit=500` : '?limit=500';
            api(`/api/session-logs/${projectId}/turns${params}`).then(data => {
              setTurns(data.turns || []);
            }).catch(() => {});
          }}
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '3px',
            color: t.ts, cursor: 'pointer', padding: '2px 6px', fontSize: '10px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Session tabs */}
      <SessionTabs
        sessions={sessions}
        selectedId={selectedSession}
        onSelect={setSelectedSession}
      />

      {/* Messages / turns area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflow: 'auto', padding: '8px 0', minHeight: 0 }}
      >
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
            Loading conversation...
          </div>
        ) : turns.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: t.tm }}>
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>
              {'\u{1F4AC}'}
            </div>
            <div style={{ fontSize: '12px' }}>Chat with Claude in project context</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Messages are sent via Claude CLI with the workspace CLAUDE.md applied.
              <br />Activity from terminal sessions appears here too.
            </div>
          </div>
        ) : (
          turns.map((turn, i) => <TurnView key={turn.id || `turn-${i}`} turn={turn} />)
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${t.border}`,
        display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={sending ? 'Claude is thinking...' : 'Message Claude...'}
          disabled={sending}
          rows={1}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: '8px', resize: 'none',
            background: t.bg, border: `1px solid ${t.border}`, color: t.tp,
            fontSize: '13px', fontFamily: 'inherit', outline: 'none',
            minHeight: '36px', maxHeight: '120px',
            opacity: sending ? 0.5 : 1,
          }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
        />
        {sending ? (
          <button onClick={cancelChat} style={{
            padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: 'rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '12px', fontWeight: '600',
            flexShrink: 0,
          }}>
            Stop
          </button>
        ) : (
          <button onClick={sendMessage} disabled={!input.trim()} style={{
            padding: '8px 12px', borderRadius: '8px', border: 'none',
            cursor: input.trim() ? 'pointer' : 'not-allowed',
            background: input.trim() ? t.violet : 'rgba(139,92,246,0.2)',
            color: input.trim() ? '#fff' : t.tm, fontSize: '12px', fontWeight: '600',
            flexShrink: 0, opacity: input.trim() ? 1 : 0.5,
          }}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}

function summarizeTool(name, input) {
  if (!input) return '';
  const n = (name || '').toLowerCase();
  if (n === 'read') return input.file_path || '';
  if (n === 'write') return input.file_path || '';
  if (n === 'edit') return input.file_path || '';
  if (n === 'bash') return (input.command || '').substring(0, 80);
  if (n === 'glob') return input.pattern || '';
  if (n === 'grep') return input.pattern || '';
  if (n.startsWith('mcp__')) {
    const parts = n.split('__');
    return parts.slice(1).join('/');
  }
  return '';
}
