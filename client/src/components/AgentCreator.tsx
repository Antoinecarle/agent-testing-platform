// REQUIRED DEPENDENCIES:
// - framer-motion (npm install framer-motion)
// - lucide-react (npm install lucide-react)

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud,
  Link as LinkIcon,
  Send,
  X,
  FileCode,
  Plus,
  Image as ImageIcon,
  Trash2,
  ChevronRight,
  Bot,
  User,
  Sparkles
} from 'lucide-react';
import { api } from '../api';

// Design System Tokens
const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)',
  borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6',
  violetM: 'rgba(139,92,246,0.2)',
  violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5',
  ts: '#A1A1AA',
  tm: '#52525B',
  success: '#22c55e',
  warning: '#f59e0b',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

interface Reference {
  id: string;
  type: 'image' | 'url';
  url?: string;
  filename?: string;
  analysis?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AgentCreatorProps {
  onClose: () => void;
}

const AgentCreator: React.FC<AgentCreatorProps> = ({ onClose }) => {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [references, setReferences] = useState<Reference[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [generatedAgent, setGeneratedAgent] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation
  useEffect(() => {
    initConversation();
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initConversation = async () => {
    try {
      const result = await api('/api/agent-creator/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Agent' }),
      });
      setConversationId(result.conversation.id);

      // Add welcome message
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "Hello! I'm GPT-5, your AI agent designer. Upload design references or share URLs, and let's create your custom AI agent together. What kind of agent would you like to build?"
      }]);
    } catch (err) {
      console.error('Failed to init conversation:', err);
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !conversationId) return;

    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/urls`, {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setReferences([...references, result.reference]);
      setUrlInput('');
    } catch (err) {
      console.error('Failed to add URL:', err);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch(`/api/agent-creator/conversations/${conversationId}/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('atp-token')}`,
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || 'Upload failed');
      }
      const result = await res.json();

      setReferences([...references, result.reference]);
    } catch (err) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const removeReference = async (id: string) => {
    if (!conversationId) return;

    try {
      await api(`/api/agent-creator/conversations/${conversationId}/references/${id}`, {
        method: 'DELETE',
      });
      setReferences(references.filter(r => r.id !== id));
    } catch (err) {
      console.error('Failed to remove reference:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage
    };
    setMessages([...messages, userMessage]);
    setInputMessage('');
    setIsSending(true);

    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: inputMessage }),
      });

      setMessages(prev => [...prev, {
        id: result.message.id,
        role: 'assistant',
        content: result.message.content,
      }]);
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to send message'}`,
      }]);
    } finally {
      setIsSending(false);
    }
  };

  const generateAgent = async () => {
    if (!conversationId || isGenerating) return;

    setIsGenerating(true);
    setIsPreviewOpen(true);

    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/generate`, {
        method: 'POST',
      });

      setGeneratedAgent(result.agentFile);
    } catch (err) {
      console.error('Failed to generate agent:', err);
      setGeneratedAgent(`# Error generating agent\n\n${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAgent = async () => {
    if (!conversationId || !generatedAgent || isSaving) return;

    setIsSaving(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/save`, {
        method: 'POST',
        body: JSON.stringify({ agentContent: generatedAgent }),
      });

      if (result.success) {
        alert(`✅ Agent "${result.agent.name}" saved successfully!`);
        onClose(); // Close the modal after successful save
      }
    } catch (err) {
      console.error('Failed to save agent:', err);
      alert(`❌ Failed to save agent: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      backgroundColor: t.bg,
      color: t.tp,
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Inter, system-ui, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        padding: '16px 24px',
        borderBottom: `1px solid ${t.border}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: t.surface
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: t.violetG,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `1px solid ${t.violetM}`
          }}>
            <Bot size={18} color={t.violet} />
          </div>
          <h1 style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em' }}>Create Your AI Agent</h1>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: t.ts,
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = t.surfaceEl}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={20} />
        </button>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isPreviewOpen ? '320px 1fr 400px' : '320px 1fr', overflow: 'hidden' }}>

        {/* Left Sidebar: References */}
        <aside style={{
          borderRight: `1px solid ${t.border}`,
          background: t.surface,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          gap: '24px',
          overflowY: 'auto'
        }}>
          <div>
            <h3 style={{ fontSize: '12px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 700 }}>Design References</h3>

            {/* Upload Zone */}
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '24px 16px',
              border: `1px dashed ${t.borderS}`,
              borderRadius: '12px',
              cursor: 'pointer',
              backgroundColor: t.bg,
              transition: 'all 0.2s',
            }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = t.violet}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = t.borderS}
            >
              <UploadCloud size={24} color={isUploading ? t.violet : t.ts} />
              <span style={{ fontSize: '13px', color: t.ts }}>
                {isUploading ? 'Uploading...' : 'Drop images or click to upload'}
              </span>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                onChange={handleImageUpload}
                accept="image/*"
                disabled={isUploading}
              />
            </label>

            {/* URL Input */}
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <LinkIcon size={14} color={t.tm} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Reference URL..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                  style={{
                    width: '100%',
                    background: t.bg,
                    border: `1px solid ${t.border}`,
                    borderRadius: '8px',
                    padding: '10px 12px 10px 34px',
                    color: t.tp,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={addUrl}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  background: t.violet,
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          {/* References List */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '12px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', fontWeight: 700 }}>
              Added Context ({references.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <AnimatePresence initial={false}>
                {references.length === 0 && (
                  <div style={{ padding: '20px', textAlign: 'center', color: t.tm, fontSize: '13px' }}>
                    No references added yet.
                  </div>
                )}
                {references.map((ref) => (
                  <motion.div
                    key={ref.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    style={{
                      padding: '8px',
                      background: t.surfaceEl,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      border: `1px solid ${t.border}`
                    }}
                  >
                    {ref.type === 'image' ? (
                      <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', background: t.bg }}>
                        <img src={ref.url} alt={ref.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : (
                      <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <LinkIcon size={14} color={t.ts} />
                      </div>
                    )}
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <p style={{ fontSize: '12px', color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                        {ref.filename || ref.url}
                      </p>
                    </div>
                    <button
                      onClick={() => removeReference(ref.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </aside>

        {/* Center: Chat Interface */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px 10%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  gap: '16px',
                  maxWidth: '85%',
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: msg.role === 'user' ? t.surfaceEl : t.violetM,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: `1px solid ${msg.role === 'user' ? t.border : t.violetM}`
                }}>
                  {msg.role === 'user' ? <User size={16} color={t.ts} /> : <Sparkles size={16} color={t.violet} />}
                </div>
                <div style={{
                  background: msg.role === 'user' ? t.violet : t.surfaceEl,
                  padding: '12px 16px',
                  borderRadius: '16px',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                  borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                  color: msg.role === 'user' ? 'white' : t.tp,
                  fontSize: '14px',
                  lineHeight: '1.5',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isSending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', gap: '16px', maxWidth: '85%', alignSelf: 'flex-start' }}
              >
                <div style={{
                  width: '32px', height: '32px', borderRadius: '10px',
                  background: t.violetM, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0, border: `1px solid ${t.violetM}`
                }}>
                  <Sparkles size={16} color={t.violet} />
                </div>
                <div style={{
                  background: t.surfaceEl, padding: '12px 16px', borderRadius: '16px',
                  borderTopLeftRadius: '4px', color: t.ts, fontSize: '14px', fontStyle: 'italic'
                }}>
                  Thinking...
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div style={{ padding: '24px', borderTop: `1px solid ${t.border}`, background: t.bg }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto',
              position: 'relative',
              background: t.surface,
              borderRadius: '16px',
              border: `1px solid ${t.borderS}`,
              padding: '6px'
            }}>
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Talk to GPT-5 to define your agent..."
                disabled={isSending}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: t.tp,
                  padding: '12px 12px',
                  height: '60px',
                  resize: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  fontFamily: 'inherit'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  style={{
                    background: (inputMessage.trim() && !isSending) ? t.violet : t.surfaceEl,
                    color: (inputMessage.trim() && !isSending) ? 'white' : t.tm,
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: (inputMessage.trim() && !isSending) ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSending ? 'Sending...' : 'Send'}
                  <Send size={14} />
                </button>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={generateAgent}
                disabled={isGenerating || messages.length < 2}
                style={{
                  background: isGenerating ? t.surfaceEl : t.violetG,
                  color: isGenerating ? t.tm : t.violet,
                  border: `1px solid ${isGenerating ? t.border : t.violetM}`,
                  borderRadius: '10px',
                  padding: '12px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? 'Generating...' : (isPreviewOpen ? 'Regenerate' : 'Generate Agent')}
                <FileCode size={18} />
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Preview Pane */}
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              style={{
                borderLeft: `1px solid ${t.border}`,
                background: t.surface,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              <div style={{ padding: '20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={16} color={t.ts} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: t.ts }}>agent_manifest.md</span>
                </div>
                <span style={{ fontSize: '11px', color: t.success, background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px' }}>Draft</span>
              </div>
              <div style={{
                flex: 1,
                padding: '24px',
                fontFamily: t.mono,
                fontSize: '12px',
                lineHeight: '1.6',
                color: t.ts,
                backgroundColor: t.bg,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {generatedAgent || 'Waiting for generation...'}
              </div>
              <div style={{ padding: '20px', background: t.surface, borderTop: `1px solid ${t.border}` }}>
                <button
                  onClick={saveAgent}
                  disabled={!generatedAgent || isSaving}
                  style={{
                    width: '100%',
                    background: (generatedAgent && !isSaving) ? t.violet : t.surfaceEl,
                    color: (generatedAgent && !isSaving) ? 'white' : t.tm,
                    border: 'none',
                    padding: '12px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: (generatedAgent && !isSaving) ? 'pointer' : 'not-allowed',
                    boxShadow: (generatedAgent && !isSaving) ? `0 8px 24px ${t.violetM}` : 'none',
                    transition: 'all 0.2s'
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save Agent to Library'}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AgentCreator;
