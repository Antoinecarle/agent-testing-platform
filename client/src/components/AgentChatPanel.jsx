import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Plus, Trash2, MessageCircle, Bot, User, BookOpen, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: '4px', padding: '8px 0' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%', background: t.ts,
          animation: `bounce 1.2s infinite ${i * 0.2}s`,
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }`}</style>
    </div>
  );
}

function SourceBadge({ source }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
      background: t.violetM, border: `1px solid ${t.violet}40`, color: t.violet,
      letterSpacing: '0.02em',
    }}>
      <BookOpen size={9} />
      {source.title?.slice(0, 30)}{source.title?.length > 30 ? '...' : ''}
      <span style={{ color: t.ts, fontWeight: '400' }}>{Math.round(source.similarity * 100)}%</span>
    </span>
  );
}

function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start',
      padding: '4px 0',
    }}>
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexDirection: isUser ? 'row-reverse' : 'row' }}>
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: isUser ? t.violetM : t.surfaceEl,
            border: `1px solid ${isUser ? t.violet + '40' : t.border}`,
            marginTop: '2px',
          }}>
            {isUser ? <User size={12} color={t.violet} /> : <Bot size={12} color={t.ts} />}
          </div>
          <div style={{
            padding: '10px 14px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.55',
            color: t.tp, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: isUser ? `${t.violet}18` : t.surface,
            border: `1px solid ${isUser ? t.violet + '25' : t.border}`,
          }}>
            {msg.content}
          </div>
        </div>
        {msg.sources && msg.sources.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '4px',
            paddingLeft: '34px',
          }}>
            {msg.sources.map((s, i) => <SourceBadge key={i} source={s} />)}
          </div>
        )}
        {msg.created_at && (
          <div style={{ fontSize: '10px', color: t.tm, paddingLeft: isUser ? 0 : '34px', textAlign: isUser ? 'right' : 'left' }}>
            {formatTime(msg.created_at)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentChatPanel({ agentName, agentDisplayName, height = '500px', isFullScreen = false }) {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredChat, setHoveredChat] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, sending, scrollToBottom]);

  const loadChats = useCallback(async () => {
    try {
      const all = await api('/api/agent-chat');
      setChats(all.filter(c => c.agent_name === agentName));
    } catch (err) { console.error(err); }
  }, [agentName]);

  useEffect(() => { loadChats(); }, [loadChats]);

  const loadChat = useCallback(async (chatId) => {
    if (!chatId) {
      setActiveChatId(null);
      setMessages([]);
      return;
    }
    try {
      const data = await api(`/api/agent-chat/${chatId}`);
      setActiveChatId(chatId);
      setMessages(data.messages || []);
    } catch (err) { console.error(err); }
  }, []);

  const createNewChat = async () => {
    try {
      const chat = await api('/api/agent-chat', {
        method: 'POST',
        body: JSON.stringify({ agentName, name: 'New Chat' }),
      });
      await loadChats();
      loadChat(chat.id);
    } catch (err) { console.error(err); }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await api(`/api/agent-chat/${id}`, { method: 'DELETE' });
      await loadChats();
      if (activeChatId === id) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (err) { console.error(err); }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !activeChatId) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api(`/api/agent-chat/${activeChatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: msg }),
      });
      setMessages(prev => [...prev, res.message]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + (err.message || 'Failed to get response'), created_at: new Date().toISOString() }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const displayName = agentDisplayName || agentName;

  return (
    <div style={{ display: 'flex', height, overflow: 'hidden', borderRadius: '8px', border: `1px solid ${t.border}` }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '220px' : '0px', minWidth: sidebarOpen ? '220px' : '0px',
        background: t.surface, borderRight: sidebarOpen ? `1px solid ${t.border}` : 'none',
        display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 12px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: t.tp }}>Conversations</span>
          <button onClick={createNewChat} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: '600',
            background: t.tp, color: t.bg, border: 'none', cursor: 'pointer',
          }}>
            <Plus size={10} /> New
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
          {chats.length === 0 ? (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: t.tm, fontSize: '11px' }}>
              No conversations yet
            </div>
          ) : chats.map(c => (
            <div
              key={c.id}
              onClick={() => loadChat(c.id)}
              onMouseEnter={() => setHoveredChat(c.id)}
              onMouseLeave={() => setHoveredChat(null)}
              style={{
                padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                background: activeChatId === c.id ? t.violetG : hoveredChat === c.id ? t.surfaceEl : 'transparent',
                border: `1px solid ${activeChatId === c.id ? t.violet + '30' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <MessageCircle size={11} color={activeChatId === c.id ? t.violet : t.tm} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '11px', fontWeight: '500',
                  color: activeChatId === c.id ? t.tp : t.ts,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.name || 'New Chat'}
                </div>
                <div style={{ fontSize: '9px', color: t.tm, marginTop: '1px' }}>
                  {formatTime(c.updated_at)}
                </div>
              </div>
              {hoveredChat === c.id && (
                <button onClick={(e) => deleteChat(c.id, e)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  color: t.tm, display: 'flex',
                }}>
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: t.bg }}>
        {/* Top Bar */}
        <div style={{
          padding: '8px 12px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: '8px', background: t.surface,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.ts,
            display: 'flex', padding: '3px',
          }}>
            {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
          <div style={{
            width: '24px', height: '24px', borderRadius: '6px', flexShrink: 0,
            background: t.violetG, border: `1px solid ${t.violet}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={12} color={t.violet} />
          </div>
          <span style={{ fontSize: '12px', fontWeight: '600', color: t.tp, flex: 1 }}>{displayName}</span>
          {!isFullScreen && (
            <button
              onClick={() => navigate(`/chat/${encodeURIComponent(agentName)}`)}
              title="Open full screen"
              style={{
                background: 'none', border: `1px solid ${t.border}`, borderRadius: '4px',
                cursor: 'pointer', color: t.ts, display: 'flex', alignItems: 'center',
                gap: '4px', padding: '3px 8px', fontSize: '10px', fontWeight: '500',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.target.style.borderColor = t.violet; e.target.style.color = t.violet; }}
              onMouseLeave={e => { e.target.style.borderColor = t.border; e.target.style.color = t.ts; }}
            >
              <Maximize2 size={10} /> Full Screen
            </button>
          )}
        </div>

        {/* Messages Area */}
        {!activeChatId ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '10px',
          }}>
            <MessageCircle size={28} color={t.tm} />
            <div style={{ fontSize: '12px', color: t.ts }}>Select or start a new conversation</div>
            <button onClick={createNewChat} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              background: t.tp, color: t.bg, border: 'none', cursor: 'pointer',
            }}>
              <Plus size={12} /> New Chat
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
              {messages.length === 0 && !sending ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: '8px',
                }}>
                  <Bot size={28} color={t.tm} />
                  <div style={{ fontSize: '12px', color: t.ts }}>
                    Start chatting with <span style={{ color: t.violet, fontWeight: '600' }}>{displayName}</span>
                  </div>
                  <div style={{ fontSize: '10px', color: t.tm }}>
                    Messages are powered by the agent's prompt and linked knowledge bases
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {messages.map((msg, i) => <ChatMessage key={msg.id || i} msg={msg} />)}
                  {sending && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '4px 0' }}>
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: t.surfaceEl, border: `1px solid ${t.border}`,
                      }}>
                        <Bot size={12} color={t.ts} />
                      </div>
                      <div style={{
                        padding: '10px 14px', borderRadius: '12px',
                        background: t.surface, border: `1px solid ${t.border}`,
                      }}>
                        <TypingIndicator />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div style={{
              padding: '10px 12px', borderTop: `1px solid ${t.border}`,
              background: t.surface,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: '8px',
                background: t.bg, border: `1px solid ${t.borderS}`,
                borderRadius: '8px', padding: '6px 10px',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${displayName}...`}
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: t.tp, fontSize: '12px', lineHeight: '1.5',
                    resize: 'none', fontFamily: 'inherit', padding: '2px 0',
                    maxHeight: '100px',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  style={{
                    width: '28px', height: '28px', borderRadius: '6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: input.trim() && !sending ? t.violet : t.surfaceEl,
                    border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Send size={12} color={input.trim() && !sending ? '#fff' : t.tm} />
                </button>
              </div>
              <div style={{ fontSize: '9px', color: t.tm, textAlign: 'center', marginTop: '4px' }}>
                Enter to send, Shift+Enter for new line
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
