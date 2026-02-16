import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Plus, Trash2, MessageCircle, Bot, User, BookOpen, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
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

export default function AgentChat() {
  const { agentName, chatId } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
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

  // Load agent info
  useEffect(() => {
    if (agentName) {
      api(`/api/agents/${encodeURIComponent(agentName)}`).then(setAgent).catch(console.error);
    }
  }, [agentName]);

  // Load user's chats for this agent
  const loadChats = useCallback(async () => {
    try {
      const all = await api('/api/agent-chat');
      setChats(all.filter(c => c.agent_name === agentName));
    } catch (err) { console.error(err); }
  }, [agentName]);

  useEffect(() => { loadChats(); }, [loadChats]);

  // Load specific chat
  useEffect(() => {
    if (chatId) {
      api(`/api/agent-chat/${chatId}`)
        .then(data => {
          setActiveChat(data);
          setMessages(data.messages || []);
        })
        .catch(console.error);
    } else {
      setActiveChat(null);
      setMessages([]);
    }
  }, [chatId]);

  const createNewChat = async () => {
    try {
      const chat = await api('/api/agent-chat', {
        method: 'POST',
        body: JSON.stringify({ agentName, name: 'New Chat' }),
      });
      await loadChats();
      navigate(`/chat/${encodeURIComponent(agentName)}/${chat.id}`);
    } catch (err) { console.error(err); }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    try {
      await api(`/api/agent-chat/${id}`, { method: 'DELETE' });
      await loadChats();
      if (chatId === id) navigate(`/chat/${encodeURIComponent(agentName)}`);
    } catch (err) { console.error(err); }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending || !chatId) return;
    const msg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg, created_at: new Date().toISOString() }]);
    setSending(true);
    try {
      const res = await api(`/api/agent-chat/${chatId}/messages`, {
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

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  const kbCount = agent?.knowledge_bases_count || 0;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 57px)', background: t.bg, overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '0px', minWidth: sidebarOpen ? '280px' : '0px',
        background: t.surface, borderRight: `1px solid ${t.border}`,
        display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease',
        overflow: 'hidden',
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>Conversations</span>
          <button onClick={createNewChat} style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '600',
            background: t.tp, color: t.bg, border: 'none', cursor: 'pointer',
          }}>
            <Plus size={12} /> New
          </button>
        </div>
        {/* Chat List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {chats.length === 0 ? (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
              No conversations yet
            </div>
          ) : chats.map(c => (
            <div
              key={c.id}
              onClick={() => navigate(`/chat/${encodeURIComponent(agentName)}/${c.id}`)}
              onMouseEnter={() => setHoveredChat(c.id)}
              onMouseLeave={() => setHoveredChat(null)}
              style={{
                padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
                background: chatId === c.id ? t.violetG : hoveredChat === c.id ? t.surfaceEl : 'transparent',
                border: `1px solid ${chatId === c.id ? t.violet + '30' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <MessageCircle size={13} color={chatId === c.id ? t.violet : t.tm} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '12px', fontWeight: '500',
                  color: chatId === c.id ? t.tp : t.ts,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {c.name || 'New Chat'}
                </div>
                <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px' }}>
                  {formatTime(c.updated_at)}
                </div>
              </div>
              {hoveredChat === c.id && (
                <button onClick={(e) => deleteChat(c.id, e)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
                  color: t.tm, display: 'flex',
                }}>
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Bar */}
        <div style={{
          padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
          display: 'flex', alignItems: 'center', gap: '12px', background: t.surface,
        }}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.ts,
            display: 'flex', padding: '4px',
          }}>
            {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <button onClick={() => navigate(`/agents/${encodeURIComponent(agentName)}`)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.ts,
            display: 'flex', padding: '4px',
          }}>
            <ArrowLeft size={16} />
          </button>
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0,
            background: t.violetG, border: `1px solid ${t.violet}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Bot size={15} color={t.violet} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>
              {agent?.name || agentName}
            </div>
            {agent?.description && (
              <div style={{
                fontSize: '11px', color: t.tm, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '400px',
              }}>
                {agent.description}
              </div>
            )}
          </div>
          {kbCount > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '3px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
              background: t.violetM, border: `1px solid ${t.violet}40`, color: t.violet,
            }}>
              <BookOpen size={10} /> {kbCount} KB{kbCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Messages Area */}
        {!chatId ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '12px',
          }}>
            <MessageCircle size={36} color={t.tm} />
            <div style={{ fontSize: '14px', color: t.ts }}>Select or start a new conversation</div>
            <button onClick={createNewChat} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
              background: t.tp, color: t.bg, border: 'none', cursor: 'pointer',
            }}>
              <Plus size={14} /> New Chat
            </button>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {messages.length === 0 && !sending ? (
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', height: '100%', gap: '8px',
                }}>
                  <Bot size={32} color={t.tm} />
                  <div style={{ fontSize: '13px', color: t.ts }}>
                    Start chatting with <span style={{ color: t.violet, fontWeight: '600' }}>{agent?.name || agentName}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: t.tm }}>
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
              padding: '12px 16px', borderTop: `1px solid ${t.border}`,
              background: t.surface,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: '8px',
                background: t.bg, border: `1px solid ${t.borderS}`,
                borderRadius: '10px', padding: '8px 12px',
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message ${agent?.name || agentName}...`}
                  disabled={sending}
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: t.tp, fontSize: '13px', lineHeight: '1.5',
                    resize: 'none', fontFamily: 'inherit', padding: '2px 0',
                    maxHeight: '120px',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  style={{
                    width: '30px', height: '30px', borderRadius: '6px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: input.trim() && !sending ? t.violet : t.surfaceEl,
                    border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'default',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Send size={14} color={input.trim() && !sending ? '#fff' : t.tm} />
                </button>
              </div>
              <div style={{ fontSize: '10px', color: t.tm, textAlign: 'center', marginTop: '6px' }}>
                Enter to send, Shift+Enter for new line
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
