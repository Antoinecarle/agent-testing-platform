import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getToken, refreshAccessToken } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isError = message.type === 'error';

  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 12px',
    }}>
      <div style={{
        maxWidth: '85%', padding: '8px 12px', borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
        background: isUser ? t.violetM : isError ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${isUser ? 'rgba(139,92,246,0.3)' : isError ? 'rgba(239,68,68,0.2)' : t.border}`,
        fontSize: '13px', lineHeight: '1.5',
        color: isError ? '#ef4444' : t.tp,
      }}>
        {/* Tool call rendering */}
        {message.toolUse && (
          <div style={{
            padding: '4px 8px', marginBottom: '6px', borderRadius: '4px',
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.15)',
            fontSize: '11px', fontFamily: 'monospace',
          }}>
            <span style={{ color: '#a78bfa', fontWeight: '600' }}>{message.toolUse.name}</span>
            {message.toolUse.summary && (
              <span style={{ color: t.tm, marginLeft: '8px' }}>{message.toolUse.summary}</span>
            )}
          </div>
        )}
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message.content}
        </div>
        {message.streaming && (
          <span style={{
            display: 'inline-block', width: '6px', height: '14px',
            background: t.violet, borderRadius: '1px', marginLeft: '2px',
            animation: 'blink 0.8s step-end infinite', verticalAlign: 'text-bottom',
          }} />
        )}
      </div>
    </div>
  );
}

export default function ChatPanel({ projectId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const currentAssistantRef = useRef('');

  // Connect Socket.IO
  useEffect(() => {
    const token = getToken();
    const socket = io('/terminal', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        refreshAccessToken().then(newToken => {
          socket.auth = { token: newToken };
          socket.connect();
        }).catch(() => {
          window.location.href = '/login';
        });
      }
    });

    socket.on('chat-stream', (data) => {
      // Handle different stream-json message types
      if (data.type === 'assistant') {
        // Partial or complete assistant message
        const content = data.message?.content || [];
        let text = '';
        let toolUse = null;
        for (const block of content) {
          if (block.type === 'text') {
            text += block.text || '';
          } else if (block.type === 'tool_use') {
            toolUse = {
              name: block.name,
              summary: summarizeTool(block.name, block.input),
            };
          }
        }

        if (text || toolUse) {
          setMessages(prev => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].role === 'assistant' && copy[lastIdx].streaming) {
              // Update existing streaming message
              copy[lastIdx] = {
                ...copy[lastIdx],
                content: text || copy[lastIdx].content,
                toolUse: toolUse || copy[lastIdx].toolUse,
              };
            } else {
              // New assistant message
              copy.push({
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: text,
                toolUse,
                streaming: true,
              });
            }
            return copy;
          });
        }
      } else if (data.type === 'result') {
        // Final result
        const text = data.result?.trim() || data.message?.content?.find(b => b.type === 'text')?.text || '';
        if (data.session_id) setSessionId(data.session_id);
        setMessages(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].role === 'assistant') {
            copy[lastIdx] = { ...copy[lastIdx], content: text || copy[lastIdx].content, streaming: false };
          } else if (text) {
            copy.push({ id: `msg-${Date.now()}`, role: 'assistant', content: text, streaming: false });
          }
          return copy;
        });
      } else if (data.type === 'error') {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`, role: 'assistant', type: 'error',
          content: data.text || 'Unknown error', streaming: false,
        }]);
      } else if (data.type === 'raw') {
        // Raw text fallback
        if (data.text?.trim()) {
          setMessages(prev => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].role === 'assistant' && copy[lastIdx].streaming) {
              copy[lastIdx] = { ...copy[lastIdx], content: copy[lastIdx].content + data.text };
            } else {
              copy.push({ id: `raw-${Date.now()}`, role: 'assistant', content: data.text, streaming: true });
            }
            return copy;
          });
        }
      }

      // Auto-scroll
      if (scrollRef.current) {
        setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 20);
      }
    });

    socket.on('chat-done', (data) => {
      if (data.sessionId) setSessionId(data.sessionId);
      setSending(false);
      // Mark last message as not streaming
      setMessages(prev => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].streaming) {
          copy[lastIdx] = { ...copy[lastIdx], streaming: false };
        }
        return copy;
      });
    });

    return () => {
      socket.emit('chat-cancel');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || sending || !socketRef.current) return;

    const msg = input.trim();
    setInput('');
    setSending(true);

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`, role: 'user', content: msg, streaming: false,
    }]);

    socketRef.current.emit('chat-send', {
      projectId,
      message: msg,
      sessionResume: sessionId,
    });

    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 50);
  }, [input, sending, projectId, sessionId]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const cancelChat = () => {
    if (socketRef.current) socketRef.current.emit('chat-cancel');
    setSending(false);
    setMessages(prev => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      if (lastIdx >= 0 && copy[lastIdx].streaming) {
        copy[lastIdx] = { ...copy[lastIdx], streaming: false, content: copy[lastIdx].content + ' [cancelled]' };
      }
      return copy;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: t.surface }}>
      <style>{`@keyframes blink { 50% { opacity: 0; } }`}</style>

      {/* Messages area */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {messages.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: t.tm }}>
            <div style={{ fontSize: '20px', marginBottom: '8px' }}>💬</div>
            <div style={{ fontSize: '12px' }}>Chat with Claude in project context</div>
            <div style={{ fontSize: '11px', marginTop: '4px' }}>
              Messages are sent via Claude CLI with the workspace CLAUDE.md applied
            </div>
          </div>
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
        )}
      </div>

      {/* Input area */}
      <div style={{
        padding: '8px 12px', borderTop: `1px solid ${t.border}`,
        display: 'flex', gap: '8px', alignItems: 'flex-end',
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
            padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
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
