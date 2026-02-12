// Agent Creator V2 — Deep analysis, design briefs, 600-900 line agent generation
// Dependencies: framer-motion, lucide-react

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UploadCloud, Link as LinkIcon, Send, X, FileCode, Plus,
  Trash2, Bot, User, Sparkles, Zap, CheckCircle, AlertTriangle,
  RefreshCw, ChevronDown, ChevronRight, Palette, Type, Layout,
  Layers, Save
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [designBrief, setDesignBrief] = useState<any>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);
  const [refineSection, setRefineSection] = useState<string | null>(null);
  const [refineFeedback, setRefineFeedback] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const initConversation = async () => {
    try {
      const result = await api('/api/agent-creator/conversations', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Agent' }),
      });
      setConversationId(result.conversation.id);
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "I'm your AI agent architect. I'll help you create a professional agent configuration (600-900 lines) with complete CSS systems, component specs, animations, and wireframes.\n\nStart by uploading design references (screenshots, URLs) or tell me what kind of pages this agent should build."
      }]);
    } catch (err: any) {
      console.error('Failed to init conversation:', err);
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
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
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
    setMessages(prev => [...prev, userMessage]);
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
        content: `Design Brief synthesized! I've analyzed ${references.length} reference(s) and identified:\n\n` +
          `**Aesthetic**: ${result.brief.agentIdentity?.aesthetic || 'custom'}\n` +
          `**Role**: ${result.brief.agentIdentity?.role || 'frontend builder'}\n` +
          `**Colors**: ${Object.keys(result.brief.colorSystem?.cssVariables || {}).length} CSS variables\n` +
          `**Fonts**: ${result.brief.typographySystem?.displayFont || '?'} + ${result.brief.typographySystem?.bodyFont || '?'}\n` +
          `**Components**: ${(result.brief.componentInventory || []).map((c: any) => c.name).join(', ')}\n\n` +
          `Ready to generate your 600-900 line agent. Click **Generate Agent** when ready.`
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
      const result = await api(`/api/agent-creator/conversations/${conversationId}/save`, {
        method: 'POST',
        body: JSON.stringify({ agentContent: generatedAgent }),
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

  const hasAnalyzedRefs = references.some(r => r.structured_analysis);

  return (
    <div style={{ backgroundColor: t.bg, color: t.tp, position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <header style={{ padding: '12px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: t.surface, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.violetM}` }}>
            <Bot size={18} color={t.violet} />
          </div>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>Agent Architect</h1>
            <span style={{ fontSize: '11px', color: t.tm }}>Deep analysis + 600-900 line generation</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {validation && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '6px', background: validation.score >= 7 ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${validation.score >= 7 ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
              {validation.score >= 7 ? <CheckCircle size={14} color={t.success} /> : <AlertTriangle size={14} color={t.warning} />}
              <span style={{ fontSize: '12px', fontWeight: 600, color: validation.score >= 7 ? t.success : t.warning }}>
                {validation.score}/10 | {validation.totalLines} lines
              </span>
            </div>
          )}
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', padding: '8px', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: isPreviewOpen ? '280px 1fr 420px' : '280px 1fr', overflow: 'hidden' }}>

        {/* LEFT: References Sidebar */}
        <aside style={{ borderRight: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', padding: '16px', gap: '16px', overflowY: 'auto' }}>
          <div>
            <h3 style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontWeight: 700 }}>References</h3>

            {/* Upload */}
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '20px 12px', border: `1px dashed ${t.borderS}`, borderRadius: '10px', cursor: 'pointer', backgroundColor: t.bg, transition: 'all 0.2s' }}>
              <UploadCloud size={20} color={isUploading ? t.violet : t.ts} />
              <span style={{ fontSize: '12px', color: t.ts }}>{isUploading ? 'Analyzing (4 passes)...' : 'Upload screenshot'}</span>
              <input type="file" hidden onChange={handleImageUpload} accept="image/*" disabled={isUploading} />
            </label>

            {/* URL */}
            <div style={{ marginTop: '10px', display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <LinkIcon size={12} color={t.tm} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                <input type="text" placeholder="URL..." value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addUrl()}
                  style={{ width: '100%', background: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '8px 10px 8px 28px', color: t.tp, fontSize: '12px', outline: 'none' }}
                />
              </div>
              <button onClick={addUrl} disabled={addingUrl} style={{ padding: '8px', borderRadius: '6px', background: t.violet, border: 'none', color: 'white', cursor: 'pointer' }}>
                {addingUrl ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              </button>
            </div>
          </div>

          {/* Reference List */}
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '11px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', fontWeight: 700 }}>
              Context ({references.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {references.length === 0 && <div style={{ padding: '16px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>No references yet</div>}
              <AnimatePresence initial={false}>
                {references.map((ref) => (
                  <motion.div key={ref.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
                    style={{ padding: '8px', background: t.surfaceEl, borderRadius: '8px', border: `1px solid ${ref.structured_analysis ? 'rgba(34,197,94,0.2)' : t.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {ref.type === 'image' ? (
                        <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', background: t.bg, flexShrink: 0 }}>
                          <img src={ref.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <LinkIcon size={12} color={t.ts} />
                        </div>
                      )}
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '11px', color: t.tp, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                          {ref.filename || ref.url}
                        </p>
                        {ref.structured_analysis && (
                          <span style={{ fontSize: '10px', color: t.success, display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                            <CheckCircle size={10} /> Deep analyzed
                          </span>
                        )}
                      </div>
                      <button onClick={() => removeReference(ref.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '2px' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {/* Mini analysis preview */}
                    {ref.structured_analysis && ref.type === 'image' && ref.structured_analysis.colors && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                        {[ref.structured_analysis.colors.dominantBackground, ref.structured_analysis.colors.primaryAccent, ref.structured_analysis.colors.secondaryAccent]
                          .filter(Boolean).map((color: string, i: number) => (
                            <div key={i} style={{ width: '16px', height: '16px', borderRadius: '3px', background: color, border: '1px solid rgba(255,255,255,0.1)' }} title={color} />
                          ))}
                        {ref.structured_analysis.components?.overallAesthetic && (
                          <span style={{ fontSize: '9px', color: t.tm, padding: '1px 5px', background: t.bg, borderRadius: '3px', marginLeft: '4px' }}>
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
                width: '100%', padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '12px', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                background: designBrief ? 'rgba(34,197,94,0.1)' : t.violetG,
                color: designBrief ? t.success : t.violet,
                border: `1px solid ${designBrief ? 'rgba(34,197,94,0.2)' : t.violetM}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
              {isAnalyzing ? <><RefreshCw size={14} /> Synthesizing brief...</> :
                designBrief ? <><CheckCircle size={14} /> Brief ready - Re-analyze</> :
                  <><Zap size={14} /> Analyze & Create Brief</>}
            </button>
          )}

          {/* Brief Summary */}
          {designBrief && (
            <div style={{ padding: '10px', borderRadius: '8px', background: t.bg, border: `1px solid ${t.border}`, fontSize: '11px' }}>
              <div style={{ color: t.tm, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontSize: '10px' }}>Design Brief</div>
              <div style={{ color: t.ts, lineHeight: '1.5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <Palette size={10} color={t.cyan} />
                  {Object.keys(designBrief.colorSystem?.cssVariables || {}).length} CSS vars
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <Type size={10} color={t.cyan} />
                  {designBrief.typographySystem?.displayFont || '?'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
                  <Layout size={10} color={t.cyan} />
                  {designBrief.layoutArchitecture?.primaryLayout || '?'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Layers size={10} color={t.cyan} />
                  {(designBrief.componentInventory || []).length} components
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* CENTER: Chat */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 8%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: '12px', maxWidth: '85%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: msg.role === 'user' ? t.surfaceEl : t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${msg.role === 'user' ? t.border : t.violetM}` }}>
                  {msg.role === 'user' ? <User size={14} color={t.ts} /> : <Sparkles size={14} color={t.violet} />}
                </div>
                <div style={{
                  background: msg.role === 'user' ? t.violet : t.surfaceEl, padding: '10px 14px', borderRadius: '14px',
                  borderTopRightRadius: msg.role === 'user' ? '4px' : '14px', borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '14px',
                  color: msg.role === 'user' ? 'white' : t.tp, fontSize: '13px', lineHeight: '1.6', whiteSpace: 'pre-wrap'
                }}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isSending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', gap: '12px', maxWidth: '85%', alignSelf: 'flex-start' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={14} color={t.violet} />
                </div>
                <div style={{ background: t.surfaceEl, padding: '10px 14px', borderRadius: '14px', borderTopLeftRadius: '4px', color: t.ts, fontSize: '13px' }}>Thinking...</div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input + Actions */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${t.border}`, background: t.bg }}>
            <div style={{ maxWidth: '720px', margin: '0 auto', background: t.surface, borderRadius: '12px', border: `1px solid ${t.borderS}`, padding: '4px' }}>
              <textarea value={inputMessage} onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Describe your agent's design style..." disabled={isSending}
                style={{ width: '100%', background: 'transparent', border: 'none', color: t.tp, padding: '10px', height: '52px', resize: 'none', outline: 'none', fontSize: '13px', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={generateAgent} disabled={isGenerating || messages.length < 2}
                    style={{
                      background: isGenerating ? t.surfaceEl : t.violetG, color: isGenerating ? t.tm : t.violet,
                      border: `1px solid ${isGenerating ? t.border : t.violetM}`, borderRadius: '8px', padding: '6px 14px',
                      display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, cursor: isGenerating ? 'not-allowed' : 'pointer',
                    }}>
                    {isGenerating ? <><RefreshCw size={12} /> Generating...</> : <><FileCode size={12} /> {isPreviewOpen ? 'Regenerate' : 'Generate Agent'}</>}
                  </button>
                </div>
                <button onClick={sendMessage} disabled={!inputMessage.trim() || isSending}
                  style={{
                    background: (inputMessage.trim() && !isSending) ? t.violet : t.surfaceEl, color: (inputMessage.trim() && !isSending) ? 'white' : t.tm,
                    border: 'none', borderRadius: '6px', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600,
                    cursor: (inputMessage.trim() && !isSending) ? 'pointer' : 'not-allowed',
                  }}>
                  <Send size={12} /> Send
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: Preview Pane */}
        <AnimatePresence>
          {isPreviewOpen && (
            <motion.aside initial={{ width: 0, opacity: 0 }} animate={{ width: 420, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              style={{ borderLeft: `1px solid ${t.border}`, background: t.surface, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Preview Header */}
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCode size={14} color={t.ts} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: t.ts }}>agent.md</span>
                </div>
                {validation && (
                  <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: t.tm }}>
                    <span>{validation.totalLines} lines</span>
                    <span>{validation.stats.cssVariables} CSS vars</span>
                    <span>{validation.sections.filter(s => s.found).length}/{validation.sections.length} sections</span>
                  </div>
                )}
              </div>

              {/* Section TOC */}
              {agentSections.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${t.border}`, display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {agentSections.map((section, i) => {
                    const sectionFound = validation?.sections.find(s => section.toLowerCase().includes(s.name.toLowerCase().split(' ')[0]));
                    return (
                      <button key={i} onClick={() => setRefineSection(refineSection === section ? null : section)}
                        style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 500, cursor: 'pointer', border: 'none',
                          background: refineSection === section ? t.violetM : (sectionFound?.found ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)'),
                          color: refineSection === section ? t.violet : (sectionFound?.found ? t.success : t.warning),
                        }}>
                        {section.slice(0, 20)}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Refine Input */}
              {refineSection && (
                <div style={{ padding: '10px 16px', borderBottom: `1px solid ${t.border}`, background: t.bg }}>
                  <div style={{ fontSize: '11px', color: t.violet, fontWeight: 600, marginBottom: '6px' }}>Refine: {refineSection}</div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input type="text" value={refineFeedback} onChange={e => setRefineFeedback(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRefine()}
                      placeholder="What to improve..." style={{ flex: 1, background: t.surface, border: `1px solid ${t.border}`, borderRadius: '6px', padding: '6px 10px', color: t.tp, fontSize: '12px', outline: 'none' }} />
                    <button onClick={handleRefine} disabled={isRefining || !refineFeedback.trim()}
                      style={{ padding: '6px 12px', borderRadius: '6px', background: t.violet, border: 'none', color: 'white', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                      {isRefining ? '...' : 'Refine'}
                    </button>
                  </div>
                </div>
              )}

              {/* Agent Content */}
              <div style={{ flex: 1, padding: '16px', fontFamily: t.mono, fontSize: '11px', lineHeight: '1.6', color: t.ts, backgroundColor: t.bg, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                {isGenerating ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
                    <RefreshCw size={24} color={t.violet} style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ color: t.ts, fontSize: '13px', fontFamily: 'Inter, sans-serif' }}>Generating 600-900 line agent...</div>
                    <div style={{ color: t.tm, fontSize: '11px', fontFamily: 'Inter, sans-serif' }}>This takes 30-60 seconds</div>
                  </div>
                ) : generatedAgent || 'Click Generate to create your agent...'}
              </div>

              {/* Validation Issues */}
              {validation && validation.issues.length > 0 && (
                <div style={{ padding: '10px 16px', borderTop: `1px solid ${t.border}`, background: 'rgba(245,158,11,0.05)', maxHeight: '80px', overflowY: 'auto' }}>
                  {validation.issues.map((issue, i) => (
                    <div key={i} style={{ fontSize: '10px', color: t.warning, display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                      <AlertTriangle size={10} /> {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Save Button */}
              <div style={{ padding: '12px 16px', background: t.surface, borderTop: `1px solid ${t.border}` }}>
                <button onClick={saveAgent} disabled={!generatedAgent || isSaving || isGenerating}
                  style={{
                    width: '100%', background: (generatedAgent && !isSaving && !isGenerating) ? t.violet : t.surfaceEl,
                    color: (generatedAgent && !isSaving && !isGenerating) ? 'white' : t.tm,
                    border: 'none', padding: '10px', borderRadius: '8px', fontWeight: 600, fontSize: '13px',
                    cursor: (generatedAgent && !isSaving && !isGenerating) ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  }}>
                  <Save size={14} /> {isSaving ? 'Saving...' : 'Save Agent to Library'}
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
