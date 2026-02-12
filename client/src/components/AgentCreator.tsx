// Agent Creator V3 — Conversations, vision chat, agent name editing
// Dependencies: framer-motion, lucide-react

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Link as LinkIcon, Send, X, FileCode, Plus,
  Trash2, Bot, User, Sparkles, Zap, CheckCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight, Palette, Type, Layout,
  Layers, Save, MessageSquare, Edit3, Check, Clock
} from 'lucide-react';
import { api } from '../api';

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
  danger: '#ef4444',
  cyan: '#06b6d4',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

interface Conversation {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  design_brief?: any;
  generated_agent?: string;
  generation_status?: string;
}

interface Reference {
  id: string;
  type: 'image' | 'url';
  url?: string;
  filename?: string;
  analysis?: string;
  structured_analysis?: any;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Validation {
  valid: boolean;
  score: number;
  totalLines: number;
  sections: { name: string; found: boolean; required: boolean }[];
  issues: string[];
  stats: { cssVariables: number; codeBlocks: number; componentHeaders: number; checklistItems: number };
}

interface AgentCreatorProps {
  onClose: () => void;
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: "I'm your AI agent architect. I can see your uploaded screenshots directly — upload references and let's discuss the design.\n\nStart by uploading screenshots, adding URLs, or describing the style you want.",
};

const AgentCreator: React.FC<AgentCreatorProps> = ({ onClose }) => {
  // Conversation list
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [convName, setConvName] = useState('');
  const [editingConvName, setEditingConvName] = useState(false);
  const [convNameDraft, setConvNameDraft] = useState('');

  // Current conversation state
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [designBrief, setDesignBrief] = useState<any>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);
  const [refineSection, setRefineSection] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);

  // Agent name editing (for save)
  const [agentNameOverride, setAgentNameOverride] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const convNameInputRef = useRef<HTMLInputElement>(null);

  // Load conversations on mount + auto-select last active
  useEffect(() => {
    loadConversations().then((convs) => {
      if (!convs || convs.length === 0) return;
      const savedId = localStorage.getItem('atp-agent-creator-conv');
      const target = savedId ? convs.find((c: Conversation) => c.id === savedId) : null;
      selectConversation(target || convs[0]);
    });
  }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (editingConvName && convNameInputRef.current) convNameInputRef.current.focus();
  }, [editingConvName]);

  const loadConversations = async (): Promise<Conversation[]> => {
    try {
      const result = await api('/api/agent-creator/conversations');
      const convs = result.conversations || [];
      setConversations(convs);
      return convs;
    } catch (err: any) {
      console.error('Failed to load conversations:', err);
      return [];
    }
  };

  const createConversation = async (name?: string) => {
    try {
      const result = await api('/api/agent-creator/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: name || 'New Agent' }),
      });
      const conv = result.conversation;
      setConversations(prev => [conv, ...prev]);
      selectConversation(conv);
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setConversationId(conv.id);
    setConvName(conv.name);
    localStorage.setItem('atp-agent-creator-conv', conv.id);
    setEditingConvName(false);
    setDesignBrief(null);
    setGeneratedAgent('');
    setValidation(null);
    setIsPreviewOpen(false);
    setRefineSection(null);
    setAgentNameOverride('');

    // Load full conversation data
    try {
      const result = await api(`/api/agent-creator/conversations/${conv.id}`);
      const c = result.conversation;
      const msgs: Message[] = (c.messages || []).map((m: any) => ({
        id: m.id, role: m.role, content: m.content,
      }));
      setMessages(msgs.length > 0 ? msgs : [WELCOME_MSG]);
      setReferences(c.references || []);
      if (c.design_brief) setDesignBrief(c.design_brief);
      if (c.generated_agent) {
        setGeneratedAgent(c.generated_agent);
        setIsPreviewOpen(true);
        // Restore agent name from frontmatter
        const nameMatch = c.generated_agent.match(/^name:\s*(.+)$/m);
        if (nameMatch) setAgentNameOverride(nameMatch[1].trim());
      }
    } catch (err: any) {
      console.error('Failed to load conversation:', err);
      setMessages([WELCOME_MSG]);
      setReferences([]);
    }
  };

  const renameConversation = async () => {
    if (!conversationId || !convNameDraft.trim()) return;
    try {
      await api(`/api/agent-creator/conversations/${conversationId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: convNameDraft.trim() }),
      });
      setConvName(convNameDraft.trim());
      setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, name: convNameDraft.trim() } : c));
      setEditingConvName(false);
    } catch (err: any) {
      console.error('Failed to rename:', err);
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api(`/api/agent-creator/conversations/${id}`, { method: 'DELETE' });
      setConversations(prev => prev.filter(c => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
        setReferences([]);
        setDesignBrief(null);
        setGeneratedAgent('');
        localStorage.removeItem('atp-agent-creator-conv');
      }
    } catch (err: any) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const addUrl = async () => {
    if (!urlInput.trim() || !conversationId || addingUrl) return;
    setAddingUrl(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/urls`, {
        method: 'POST',
        body: JSON.stringify({ url: urlInput }),
      });
      setReferences(prev => [...prev, result.reference]);
      setUrlInput('');
    } catch (err: any) {
      console.error('Failed to add URL:', err);
    } finally {
      setAddingUrl(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !conversationId) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('image', files[i]);
        const res = await fetch(`/api/agent-creator/conversations/${conversationId}/images`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('atp-token')}` },
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw new Error(err.error || 'Upload failed');
        }
        const result = await res.json();
        setReferences(prev => [...prev, result.reference]);
      }
    } catch (err: any) {
      console.error('Failed to upload image:', err);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeReference = async (id: string) => {
    if (!conversationId) return;
    try {
      await api(`/api/agent-creator/conversations/${conversationId}/references/${id}`, { method: 'DELETE' });
      setReferences(prev => prev.filter(r => r.id !== id));
    } catch (err: any) {
      console.error('Failed to remove reference:', err);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !conversationId || isSending) return;
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: inputMessage };
    setMessages(prev => [...prev.filter(m => m.id !== 'welcome'), userMessage]);
    setInputMessage('');
    setIsSending(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: inputMessage }),
      });
      setMessages(prev => [...prev, { id: result.message.id, role: 'assistant', content: result.message.content }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${err.message || 'Failed'}` }]);
    } finally {
      setIsSending(false);
    }
  };

  const analyzeReferences = async () => {
    if (!conversationId || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/analyze`, { method: 'POST' });
      setDesignBrief(result.brief);
      setMessages(prev => [...prev, {
        id: `brief-${Date.now()}`,
        role: 'assistant',
        content: `Design Brief synthesized from ${references.length} reference(s):\n\n` +
          `**Aesthetic**: ${result.brief.agentIdentity?.aesthetic || 'custom'}\n` +
          `**Colors**: ${Object.keys(result.brief.colorSystem?.cssVariables || {}).length} CSS variables\n` +
          `**Fonts**: ${result.brief.typographySystem?.displayFont || '?'} + ${result.brief.typographySystem?.bodyFont || '?'}\n` +
          `**Components**: ${(result.brief.componentInventory || []).map((c: any) => c.name).join(', ')}\n\n` +
          `Ready to generate. Click **Generate Agent**.`
      }]);
    } catch (err: any) {
      console.error('Failed to analyze:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateAgent = async () => {
    if (!conversationId || isGenerating) return;
    setIsGenerating(true);
    setIsPreviewOpen(true);
    setGeneratedAgent('');
    setValidation(null);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/generate`, { method: 'POST' });
      setGeneratedAgent(result.agentFile);
      setValidation(result.validation);
      // Extract agent name from frontmatter for editing
      const nameMatch = result.agentFile.match(/^name:\s*(.+)$/m);
      if (nameMatch) setAgentNameOverride(nameMatch[1].trim());
    } catch (err: any) {
      console.error('Failed to generate:', err);
      setGeneratedAgent(`# Error generating agent\n\n${err.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!conversationId || !refineSection || !refineFeedback.trim() || isRefining) return;
    setIsRefining(true);
    try {
      const result = await api(`/api/agent-creator/conversations/${conversationId}/refine`, {
        method: 'POST',
        body: JSON.stringify({ section: refineSection, feedback: refineFeedback }),
      });
      setGeneratedAgent(result.agentFile);
      setValidation(result.validation);
      setRefineSection(null);
      setRefineFeedback('');
    } catch (err: any) {
      console.error('Failed to refine:', err);
    } finally {
      setIsRefining(false);
    }
  };

  const saveAgent = async () => {
    if (!conversationId || !generatedAgent || isSaving) return;
    setIsSaving(true);
    try {
      // If user edited the agent name, replace it in the frontmatter
      let content = generatedAgent;
      if (agentNameOverride.trim()) {
        content = content.replace(/^name:\s*.+$/m, `name: ${agentNameOverride.trim()}`);
      }
      const result = await api(`/api/agent-creator/conversations/${conversationId}/save`, {
        method: 'POST',
        body: JSON.stringify({ agentContent: content }),
      });
      if (result.success) {
        alert(`Agent "${result.agent.name}" saved to library!`);
        onClose();
      }
    } catch (err: any) {
      alert(`Failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Extract section headers from generated agent for TOC
  const agentSections = generatedAgent
    ? (generatedAgent.match(/^## .+$/gm) || []).map(h => h.replace('## ', ''))
    : [];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div style={{ backgroundColor: t.bg, color: t.tp, position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '10px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.violetM}` }}>
            <Bot size={18} color={t.violet} />
          </div>
          <div>
            {conversationId && !editingConvName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>{convName}</h1>
                <button onClick={() => { setEditingConvName(true); setConvNameDraft(convName); }}
                  style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px' }}>
                  <Edit3 size={12} />
                </button>
              </div>
            ) : conversationId && editingConvName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input ref={convNameInputRef} type="text" value={convNameDraft} onChange={e => setConvNameDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') renameConversation(); if (e.key === 'Escape') setEditingConvName(false); }}
                  style={{ background: t.bg, border: `1px solid ${t.violet}`, borderRadius: '4px', padding: '2px 8px', color: t.tp, fontSize: '14px', fontWeight: 600, outline: 'none', width: '200px' }}
                />
                <button onClick={renameConversation} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', padding: '2px' }}>
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingConvName(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px' }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Agent Architect</h1>
            )}
            <span style={{ fontSize: '11px', color: t.tm }}>
              {conversationId ? `${references.length} refs | ${messages.filter(m => m.id !== 'welcome').length} msgs` : 'Select or create a conversation'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {validation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: validation.score >= 7 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${validation.score >= 7 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              {validation.score >= 7 ? <CheckCircle size={14} color={t.success} /> : <AlertTriangle size={14} color={t.warning} />}
              <span style={{ fontSize: '12px', fontWeight: 600, color: validation.score >= 7 ? t.success : t.warning }}>
                {validation.score}/10 | {validation.totalLines} lines
              </span>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', padding: '6px', borderRadius: '50%' }}>
            <X size={18} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isPreviewOpen ? '220px 260px 1fr 420px' : '220px 260px 1fr', overflow: 'hidden' }}>

        {/* FAR LEFT: Conversation List */}
        <aside style={{ borderRight: `1px solid ${t.border}`, background: t.bg, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px', borderBottom: `1px solid ${t.border}` }}>
            <button onClick={() => createConversation()}
              style={{
                width: '100%', padding: '8px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                background: t.violetG, color: t.violet, border: `1px solid ${t.violetM}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
              <Plus size={14} /> New Conversation
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversations.length === 0 && (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                No conversations yet.<br />Click "New" to start.
              </div>
            )}
            {conversations.map(conv => (
              <div key={conv.id}
                onClick={() => selectConversation(conv)}
                style={{
                  padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                  background: conv.id === conversationId ? t.surfaceEl : 'transparent',
                  borderLeft: conv.id === conversationId ? `2px solid ${t.violet}` : '2px solid transparent',
                  transition: 'all 0.15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: conv.id === conversationId ? t.tp : t.ts, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                      <span style={{ fontSize: '10px', color: t.tm, display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={9} /> {timeAgo(conv.updated_at || conv.created_at)}
                      </span>
                      {conv.generation_status === 'complete' && (
                        <span style={{ fontSize: '9px', color: t.success, padding: '0 4px', background: 'rgba(34,197,94,0.1)', borderRadius: '3px' }}>generated</span>
                      )}
                      {conv.generation_status === 'analyzing' && (
                        <span style={{ fontSize: '9px', color: t.cyan, padding: '0 4px', background: 'rgba(6,182,212,0.1)', borderRadius: '3px' }}>analyzing</span>
                      )}
                      {conv.generation_status === 'briefing' && (
                        <span style={{ fontSize: '9px', color: t.cyan, padding: '0 4px', background: 'rgba(6,182,212,0.1)', borderRadius: '3px' }}>briefing</span>
                      )}
                      {conv.generation_status === 'generating' && (
                        <span style={{ fontSize: '9px', color: t.warning, padding: '0 4px', background: 'rgba(245,158,11,0.1)', borderRadius: '3px' }}>generating</span>
                      )}
                      {conv.generation_status === 'error' && (
                        <span style={{ fontSize: '9px', color: t.danger, padding: '0 4px', background: 'rgba(239,68,68,0.1)', borderRadius: '3px' }}>error</span>
                      )}
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                    style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', opacity: 0.5, flexShrink: 0 }}>
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* LEFT: References Sidebar */}
        <aside style={{ borderRight: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px', overflowY: 'auto' }}>
          {!conversationId ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tm, fontSize: '12px', textAlign: 'center', padding: '20px' }}>
              Select or create a conversation to start
            </div>
          ) : (
            <>
              <div>
                <h3 style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>References</h3>

                {/* Upload — supports multiple files */}
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '16px 10px', border: `1px dashed ${t.borderS}`, borderRadius: '8px', cursor: 'pointer', backgroundColor: t.bg }}>
                  <UploadCloud size={18} color={isUploading ? t.violet : t.ts} />
                  <span style={{ fontSize: '11px', color: t.ts }}>{isUploading ? 'Analyzing...' : 'Upload screenshots'}</span>
                  <input type="file" hidden onChange={handleImageUpload} accept="image/*" multiple disabled={isUploading} />
                </label>

                {/* URL */}
                <div style={{ marginTop: '8px', display: 'flex', gap: '4px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <LinkIcon size={11} color={t.tm} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input type="text" placeholder="URL..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                      style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '7px 8px 7px 26px', color: t.tp, fontSize: '11px', outline: 'none' }}
                    />
                  </div>
                  <button onClick={addUrl} disabled={addingUrl} style={{ padding: '7px', borderRadius: '6px', background: t.violet, border: 'none', color: 'white', cursor: 'pointer' }}>
                    {addingUrl ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                  </button>
                </div>
              </div>

              {/* Reference List */}
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: 700 }}>
                  Context ({references.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {references.length === 0 && <div style={{ padding: '12px', textAlign: 'center', color: t.tm, fontSize: '11px' }}>No references yet</div>}
                  <AnimatePresence initial={false}>
                    {references.map((ref) => (
                      <motion.div key={ref.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                        style={{ padding: '6px', background: t.surfaceEl, borderRadius: '6px', border: `1px solid ${ref.structured_analysis ? 'rgba(34,197,94,0.15)' : t.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {ref.type === 'image' ? (
                            <div style={{ width: '24px', height: '24px', borderRadius: '3px', overflow: 'hidden', background: t.bg, flexShrink: 0 }}>
                              <img src={ref.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ) : (
                            <div style={{ width: '24px', height: '24px', borderRadius: '3px', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <LinkIcon size={10} color={t.ts} />
                            </div>
                          )}
                          <div style={{ flex: 1, overflow: 'hidden' }}>
                            <p style={{ fontSize: '10px', color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                              {ref.filename || ref.url}
                            </p>
                            {ref.structured_analysis && (
                              <span style={{ fontSize: '9px', color: t.success, display: 'flex', alignItems: 'center', gap: '2px', marginTop: '1px' }}>
                                <CheckCircle size={8} /> Analyzed
                              </span>
                            )}
                          </div>
                          <button onClick={() => removeReference(ref.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '2px' }}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                        {ref.structured_analysis && ref.type === 'image' && ref.structured_analysis.colors && (
                          <div style={{ marginTop: '4px', display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
                            {[ref.structured_analysis.colors.dominantBackground, ref.structured_analysis.colors.primaryAccent, ref.structured_analysis.colors.secondaryAccent]
                              .filter(Boolean).map((color: string, i: number) => (
                                <div key={i} style={{ width: '14px', height: '14px', borderRadius: '2px', background: color, border: '1px solid rgba(255,255,255,0.1)' }} title={color} />
                              ))}
                            {ref.structured_analysis.components?.overallAesthetic && (
                              <span style={{ fontSize: '8px', color: t.tm, padding: '1px 4px', background: t.bg, borderRadius: '2px', marginLeft: '2px' }}>
                                {ref.structured_analysis.components.overallAesthetic}
                              </span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Analyze Button */}
              {references.length > 0 && (
                <button onClick={analyzeReferences} disabled={isAnalyzing}
                  style={{
                    width: '100%', padding: '8px', borderRadius: '6px', fontWeight: 600, fontSize: '11px', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                    background: designBrief ? 'rgba(34,197,94,0.1)' : t.violetG,
                    color: designBrief ? t.success : t.violet,
                    border: `1px solid ${designBrief ? 'rgba(34,197,94,0.2)' : t.violetM}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  }}>
                  {isAnalyzing ? <><RefreshCw size={12} /> Synthesizing...</> :
                    designBrief ? <><CheckCircle size={12} /> Brief ready</> :
                      <><Zap size={12} /> Analyze & Brief</>}
                </button>
              )}

              {/* Brief Summary */}
              {designBrief && (
                <div style={{ padding: '8px', borderRadius: '6px', background: t.bg, border: `1px solid ${t.border}`, fontSize: '10px' }}>
                  <div style={{ color: t.tm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', fontSize: '9px' }}>Brief</div>
                  <div style={{ color: t.ts, lineHeight: '1.5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                      <Palette size={9} color={t.cyan} />
                      {Object.keys(designBrief.colorSystem?.cssVariables || {}).length} CSS vars
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                      <Type size={9} color={t.cyan} />
                      {designBrief.typographySystem?.displayFont || '?'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '2px' }}>
                      <Layout size={9} color={t.cyan} />
                      {designBrief.layoutArchitecture?.primaryLayout || '?'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Layers size={9} color={t.cyan} />
                      {(designBrief.componentInventory || []).length} comps
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        {/* CENTER: Chat */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {!conversationId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', color: t.tm }}>
              <Bot size={40} color={t.tm} />
              <span style={{ fontSize: '14px' }}>Create or select a conversation</span>
              <button onClick={() => createConversation()}
                style={{ padding: '10px 20px', borderRadius: '8px', background: t.violet, color: 'white', border: 'none', fontWeight: 600, fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Plus size={14} /> New Conversation
              </button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 6%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ display: 'flex', gap: '10px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: msg.role === 'user' ? t.surfaceEl : t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${msg.role === 'user' ? t.border : t.violetM}` }}>
                      {msg.role === 'user' ? <User size={12} color={t.ts} /> : <Sparkles size={12} color={t.violet} />}
                    </div>
                    <div style={{
                      background: msg.role === 'user' ? t.violet : t.surfaceEl, padding: '9px 13px', borderRadius: '12px',
                      borderTopRightRadius: msg.role === 'user' ? '3px' : '12px', borderTopLeftRadius: msg.role === 'assistant' ? '3px' : '12px',
                      color: msg.role === 'user' ? 'white' : t.tp, fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
                {isSending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '10px', maxWidth: '85%', alignSelf: 'flex-start' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={12} color={t.violet} />
                    </div>
                    <div style={{ background: t.surfaceEl, padding: '9px 13px', borderRadius: '12px', borderTopLeftRadius: '3px', color: t.ts, fontSize: '13px' }}>
                      Analyzing images & thinking...
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input + Actions */}
              <div style={{ padding: '12px 20px', borderTop: `1px solid ${t.border}`, background: t.bg }}>
                <div style={{ maxWidth: '680px', margin: '0 auto', background: t.surface, borderRadius: '10px', border: `1px solid ${t.borderS}`, padding: '3px' }}>
                  <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Describe the design, ask about your screenshots..." disabled={isSending}
                    style={{ width: '100%', background: 'transparent', border: 'none', color: t.tp, padding: '8px 10px', height: '48px', resize: 'none', outline: 'none', fontSize: '13px', fontFamily: 'inherit' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {references.length > 0 && (
                        <span style={{ fontSize: '10px', color: t.tm, display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 8px', background: t.bg, borderRadius: '4px' }}>
                          <UploadCloud size={10} /> {references.filter(r => r.type === 'image').length} images in vision
                        </span>
                      )}
                      <button onClick={generateAgent} disabled={isGenerating || messages.filter(m => m.id !== 'welcome').length < 2}
                        style={{
                          background: isGenerating ? t.surfaceEl : t.violetG, color: isGenerating ? t.tm : t.violet,
                          border: `1px solid ${isGenerating ? t.border : t.violetM}`, borderRadius: '6px', padding: '4px 12px',
                          display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer',
                        }}>
                        {isGenerating ? <><RefreshCw size={11} /> Generating...</> : <><FileCode size={11} /> {isPreviewOpen ? 'Regenerate' : 'Generate'}</>}
                      </button>
                    </div>
                    <button onClick={sendMessage} disabled={!inputMessage.trim() || isSending}
                      style={{
                        background: (inputMessage.trim() && !isSending) ? t.violet : t.surfaceEl, color: (inputMessage.trim() && !isSending) ? 'white' : t.tm,
                        border: 'none', borderRadius: '6px', padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600,
                        cursor: (inputMessage.trim() && !isSending) ? 'pointer' : 'not-allowed',
                      }}>
                      <Send size={11} /> Send
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: Preview Pane */}
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              style={{ borderLeft: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Preview Header with editable agent name */}
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileCode size={13} color={t.ts} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: t.ts }}>agent.md</span>
                  </div>
                  {validation && (
                    <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: t.tm }}>
                      <span>{validation.totalLines}L</span>
                      <span>{validation.stats.cssVariables}vars</span>
                      <span>{validation.sections.filter(s => s.found).length}/{validation.sections.length}sec</span>
                    </div>
                  )}
                </div>
                {/* Agent name editor */}
                {generatedAgent && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '10px', color: t.tm, flexShrink: 0 }}>Name:</span>
                    <input type="text" value={agentNameOverride} onChange={e => setAgentNameOverride(e.target.value)}
                      placeholder="agent-name"
                      style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 8px', color: t.tp, fontSize: '12px', fontWeight: 600, fontFamily: t.mono, outline: 'none' }}
                    />
                  </div>
                )}
              </div>

              {/* Section TOC */}
              {agentSections.length > 0 && (
                <div style={{ padding: '6px 14px', borderBottom: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {agentSections.map((section, i) => {
                    const sectionFound = validation?.sections.find(s => section.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]));
                    return (
                      <button key={i} onClick={() => setRefineSection(refineSection === section ? null : section)}
                        style={{
                          padding: '1px 6px', borderRadius: '3px', fontSize: '9px', fontWeight: 500, cursor: 'pointer', border: 'none',
                          background: refineSection === section ? t.violetM : (sectionFound?.found ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'),
                          color: refineSection === section ? t.violet : (sectionFound?.found ? t.success : t.warning),
                        }}>
                        {section.slice(0, 18)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Refine Input */}
              {refineSection && (
                <div style={{ padding: '8px 14px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                  <div style={{ fontSize: '10px', color: t.violet, fontWeight: 600, marginBottom: '4px' }}>Refine: {refineSection}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="text" value={refineFeedback} onChange={e => setRefineFeedback(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRefine()}
                      placeholder="What to improve..." style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '5px 8px', color: t.tp, fontSize: '11px', outline: 'none' }} />
                    <button onClick={handleRefine} disabled={isRefining || !refineFeedback.trim()}
                      style={{ padding: '5px 10px', borderRadius: '4px', background: t.violet, border: 'none', color: 'white', fontSize: '10px', fontWeight: 600, cursor: 'pointer' }}>
                      {isRefining ? '...' : 'Refine'}
                    </button>
                  </div>
                </div>
              )}

              {/* Agent Content */}
              <div style={{ flex: 1, padding: '14px', fontFamily: t.mono, fontSize: '10px', lineHeight: '1.6', color: t.ts, backgroundColor: t.bg, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {isGenerating ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '14px' }}>
                    <RefreshCw size={22} color={t.violet} style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ color: t.ts, fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>Generating 600-900 line agent...</div>
                    <div style={{ color: t.tm, fontSize: '10px', fontFamily: 'Inter, sans-serif' }}>30-60 seconds</div>
                  </div>
                ) : generatedAgent || 'Generate your agent to preview it here...'}
              </div>

              {/* Validation Issues */}
              {validation && validation.issues.length > 0 && (
                <div style={{ padding: '8px 14px', borderTop: `1px solid ${t.border}`, background: 'rgba(245,158,11,0.05)', maxHeight: '70px', overflowY: 'auto' }}>
                  {validation.issues.map((issue, i) => (
                    <div key={i} style={{ fontSize: '9px', color: t.warning, display: 'flex', alignItems: 'center', gap: '3px', marginBottom: '1px' }}>
                      <AlertTriangle size={8} /> {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Save Button */}
              <div style={{ padding: '10px 14px', background: t.surface, borderTop: `1px solid ${t.border}` }}>
                <button onClick={saveAgent} disabled={!generatedAgent || isSaving || isGenerating}
                  style={{
                    width: '100%', background: (generatedAgent && !isSaving && !isGenerating) ? t.violet : t.surfaceEl,
                    color: (generatedAgent && !isSaving && !isGenerating) ? 'white' : t.tm,
                    border: 'none', padding: '9px', borderRadius: '6px', fontWeight: 600, fontSize: '12px',
                    cursor: (generatedAgent && !isSaving && !isGenerating) ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  }}>
                  <Save size={13} /> {isSaving ? 'Saving...' : `Save${agentNameOverride ? ` "${agentNameOverride}"` : ''} to Library`}
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </main>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default AgentCreator;
