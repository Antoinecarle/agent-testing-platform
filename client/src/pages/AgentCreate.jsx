import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Check, X, Eye, FileText, Sparkles, Wand2, AlertCircle,
  Palette, Code, Settings, Megaphone, BarChart3, Wrench, ChevronRight,
} from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const TYPE_ICONS = { Palette, Code, Settings, Megaphone, BarChart3, Wrench };

const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task'];
const MODELS = ['sonnet', 'opus', 'haiku'];
const PERMISSION_MODES = ['', 'default', 'plan', 'bypassPermissions'];

const inputStyle = {
  backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
  padding: '10px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', display: 'block',
};

export default function AgentCreate() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [agentTypes, setAgentTypes] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  const [form, setForm] = useState({
    name: '', description: '', model: 'sonnet', category: 'uncategorized',
    tools: [], max_turns: 0, memory: '', permission_mode: '', prompt: '',
  });

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiResult(null);
    try {
      const res = await api('/api/agents/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          purpose: aiPrompt,
          style: form.category !== 'uncategorized' ? form.category : '',
          tools_needed: '',
          category: form.category !== 'uncategorized' ? form.category : '',
        }),
      });
      setAiResult(res);
    } catch (e) {
      setAiError(e.message || 'AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    setForm(f => ({
      ...f,
      name: aiResult.name || f.name,
      description: aiResult.description || f.description,
      model: aiResult.model || f.model,
      tools: aiResult.tools || f.tools,
      max_turns: aiResult.max_turns || f.max_turns,
      permission_mode: aiResult.permission_mode || f.permission_mode,
      prompt: aiResult.prompt || f.prompt,
    }));
    setAiResult(null);
    setAiOpen(false);
  };

  useEffect(() => {
    api('/api/categories').then(setCategories).catch(() => {});
    api('/api/agents/types').then(setAgentTypes).catch(() => {});
  }, []);

  function handleTypeSelect(type) {
    setSelectedType(type);
    const d = type.defaults;
    setForm(f => ({
      ...f,
      model: d.model || f.model,
      category: d.category || f.category,
      tools: d.tools || f.tools,
      permission_mode: d.permission_mode || f.permission_mode,
      prompt: d.prompt ? d.prompt.replace(/\{NAME\}/g, f.name || 'AgentName') : f.prompt,
    }));
  }

  const nameValid = form.name.length === 0 ? null : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.name);

  const toggleTool = (tool) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter(x => x !== tool) : [...f.tools, tool],
    }));
  };

  // When name changes and we have a type with template, update {NAME} in prompt
  const handleNameChange = (value) => {
    const name = value.toLowerCase().replace(/\s/g, '-');
    setForm(f => {
      const displayName = name ? name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'AgentName';
      let prompt = f.prompt;
      if (selectedType?.defaults?.prompt) {
        prompt = selectedType.defaults.prompt.replace(/\{NAME\}/g, displayName);
      }
      return { ...f, name, prompt };
    });
  };

  const generatedMd = useMemo(() => {
    const parts = [];
    if (form.description) parts.push(`description: "${form.description.replace(/"/g, '\\"')}"`);
    if (form.model) parts.push(`model: ${form.model}`);
    if (form.tools.length > 0) parts.push(`tools: [${form.tools.join(', ')}]`);
    if (form.max_turns > 0) parts.push(`max_turns: ${form.max_turns}`);
    if (form.memory) parts.push(`memory: "${form.memory.replace(/"/g, '\\"')}"`);
    if (form.permission_mode) parts.push(`permission_mode: ${form.permission_mode}`);
    const fm = parts.length > 0 ? `---\n${parts.join('\n')}\n---\n\n` : '';
    return fm + (form.prompt || '');
  }, [form]);

  const handleSubmit = async () => {
    if (!form.name || !nameValid) return;
    setSaving(true);
    setError('');
    try {
      await api('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          model: form.model,
          category: form.category,
          tools: form.tools.join(', '),
          max_turns: form.max_turns,
          memory: form.memory,
          permission_mode: form.permission_mode,
          prompt: form.prompt,
        }),
      });
      navigate(`/agents/${form.name}`);
    } catch (e) {
      setError(e.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const cat = categories.find(c => c.name === form.category);

  // ── TYPE SELECTOR (step 0) ─────────────────────────────────────────────
  if (!selectedType) {
    return (
      <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <Link to="/agents" style={{ color: t.tm, display: 'flex', textDecoration: 'none' }}><ArrowLeft size={18} /></Link>
          <h1 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Create New Agent</h1>
        </div>

        {/* Type selection */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
          <div style={{ maxWidth: '680px', width: '100%' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                Quel type d'agent voulez-vous creer ?
              </h2>
              <p style={{ fontSize: '14px', color: t.ts, margin: 0, lineHeight: 1.6 }}>
                Chaque type pre-configure le prompt, les outils et le modele adaptes.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {agentTypes.map(type => {
                const IconComp = TYPE_ICONS[type.icon] || Wrench;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type)}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = type.color + '60';
                      e.currentTarget.style.backgroundColor = type.color + '08';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = t.border;
                      e.currentTarget.style.backgroundColor = t.surface;
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      gap: '12px', padding: '20px',
                      backgroundColor: t.surface,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: '12px', cursor: 'pointer',
                      transition: 'all 0.25s ease', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '10px',
                      backgroundColor: type.color + '15',
                      border: `1px solid ${type.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconComp size={20} color={type.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: t.tp, marginBottom: '4px' }}>
                        {type.label}
                      </div>
                      <div style={{ fontSize: '11px', color: t.tm, lineHeight: 1.5 }}>
                        {type.description}
                      </div>
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px',
                      color: type.color, fontWeight: 600, marginTop: 'auto',
                    }}>
                      Choisir <ChevronRight size={12} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM (step 1) ─────────────────────────────────────────────────────
  const typeColor = selectedType.color || t.violet;
  const TypeIcon = TYPE_ICONS[selectedType.icon] || Wrench;

  return (
    <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
        <button
          onClick={() => setSelectedType(null)}
          style={{ color: t.tm, display: 'flex', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Create New Agent</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '8px',
          padding: '3px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 600,
          backgroundColor: typeColor + '18', color: typeColor, border: `1px solid ${typeColor}30`,
        }}>
          <TypeIcon size={12} />
          {selectedType.label}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* LEFT: Form */}
        <div style={{ width: '60%', overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* AI Assistant Panel */}
          <div style={{
            backgroundColor: t.surface, borderRadius: '10px',
            border: `1px solid ${aiOpen ? t.violet : t.border}`,
            overflow: 'hidden', transition: 'border-color 0.2s',
          }}>
            <button onClick={() => setAiOpen(!aiOpen)} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', backgroundColor: 'transparent', border: 'none', color: t.tp,
              cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sparkles size={16} color={t.violet} />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>AI Assistant</span>
                <span style={{ fontSize: '11px', color: t.tm }}>Describe your agent and let AI generate the config</span>
              </div>
              <span style={{ fontSize: '12px', color: t.violet }}>{aiOpen ? 'Close' : 'Open'}</span>
            </button>
            {aiOpen && (
              <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <textarea
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want your agent to do... e.g. 'A code reviewer that focuses on React best practices and security vulnerabilities'"
                  style={{
                    ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit',
                    border: `1px solid ${t.borderS}`,
                  }}
                />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button onClick={handleAiGenerate} disabled={aiLoading || !aiPrompt.trim()} style={{
                    backgroundColor: t.violetM, color: t.violet, border: `1px solid ${t.violet}`,
                    padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    opacity: (aiLoading || !aiPrompt.trim()) ? 0.5 : 1,
                  }}>
                    <Wand2 size={14} />
                    {aiLoading ? 'Generating...' : 'Generate with AI'}
                  </button>
                  {aiError && (
                    <span style={{ fontSize: '12px', color: t.danger, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <AlertCircle size={12} />{aiError}
                    </span>
                  )}
                </div>

                {/* AI Result Preview */}
                {aiResult && (
                  <div style={{
                    backgroundColor: t.bg, border: `1px solid ${t.success}`, borderRadius: '8px',
                    padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: t.success, textTransform: 'uppercase' }}>AI Suggestion</span>
                      <button onClick={applyAiResult} style={{
                        backgroundColor: t.success, color: '#fff', border: 'none',
                        padding: '5px 12px', fontSize: '11px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <Check size={12} />Apply
                      </button>
                    </div>
                    {aiResult.name && <div style={{ fontSize: '12px' }}><strong style={{ color: t.tm }}>Name:</strong> <span style={{ color: t.ts }}>{aiResult.name}</span></div>}
                    {aiResult.description && <div style={{ fontSize: '12px' }}><strong style={{ color: t.tm }}>Description:</strong> <span style={{ color: t.ts }}>{aiResult.description}</span></div>}
                    {aiResult.model && <div style={{ fontSize: '12px' }}><strong style={{ color: t.tm }}>Model:</strong> <span style={{ color: t.ts }}>{aiResult.model}</span></div>}
                    {aiResult.tools && <div style={{ fontSize: '12px' }}><strong style={{ color: t.tm }}>Tools:</strong> <span style={{ color: t.ts }}>{aiResult.tools.join(', ')}</span></div>}
                    {aiResult.prompt && (
                      <pre style={{
                        fontSize: '11px', color: t.ts, fontFamily: t.mono, backgroundColor: 'rgba(255,255,255,0.02)',
                        padding: '10px', borderRadius: '6px', maxHeight: '150px', overflowY: 'auto',
                        whiteSpace: 'pre-wrap', margin: 0, lineHeight: '1.5',
                      }}>
                        {aiResult.prompt.substring(0, 500)}{aiResult.prompt.length > 500 ? '...' : ''}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Name</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: '36px' }} value={form.name} placeholder="my-custom-agent"
                onChange={e => handleNameChange(e.target.value)} />
              {nameValid !== null && (
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex' }}>
                  {nameValid ? <Check size={14} color={t.success} /> : <X size={14} color={t.danger} />}
                </span>
              )}
            </div>
            <p style={{ fontSize: '11px', color: nameValid === false ? t.danger : t.tm, margin: '4px 0 0 0' }}>
              {nameValid === false ? 'Must be kebab-case (e.g. my-agent-name)' : 'Lowercase, hyphens only'}
            </p>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px', fontFamily: 'inherit' }}
              value={form.description} rows={3} placeholder="What does this agent do?"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Model + Category row */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Model</label>
              <select style={inputStyle} value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))}>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Category</label>
              <select style={inputStyle} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="uncategorized">uncategorized</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Tools */}
          <div>
            <label style={labelStyle}>Tools</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
              {TOOLS.map(tool => (
                <label key={tool} style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  backgroundColor: form.tools.includes(tool) ? t.violetM : t.bg,
                  border: `1px solid ${form.tools.includes(tool) ? t.violet : t.border}`,
                  borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                  color: form.tools.includes(tool) ? t.violet : t.ts, transition: 'all 0.15s',
                }}>
                  <input type="checkbox" checked={form.tools.includes(tool)} onChange={() => toggleTool(tool)}
                    style={{ display: 'none' }} />
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '3px', flexShrink: 0,
                    border: `1.5px solid ${form.tools.includes(tool) ? t.violet : t.tm}`,
                    backgroundColor: form.tools.includes(tool) ? t.violet : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {form.tools.includes(tool) && <Check size={10} color="#fff" />}
                  </div>
                  {tool}
                </label>
              ))}
            </div>
          </div>

          {/* Max Turns + Permission Mode + Memory */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ width: '100px' }}>
              <label style={labelStyle}>Max Turns</label>
              <input type="number" min="0" max="100" style={inputStyle} value={form.max_turns}
                onChange={e => setForm(f => ({ ...f, max_turns: parseInt(e.target.value) || 0 }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Permission Mode</label>
              <select style={inputStyle} value={form.permission_mode}
                onChange={e => setForm(f => ({ ...f, permission_mode: e.target.value }))}>
                {PERMISSION_MODES.map(m => <option key={m} value={m}>{m || '(none)'}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Memory</label>
              <input style={inputStyle} value={form.memory} placeholder="Optional..."
                onChange={e => setForm(f => ({ ...f, memory: e.target.value }))} />
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label style={labelStyle}>Prompt / Instructions</label>
            <textarea style={{
              ...inputStyle, resize: 'vertical', minHeight: '280px',
              fontFamily: t.mono, fontSize: '12px', lineHeight: '1.7', whiteSpace: 'pre',
            }}
              value={form.prompt} rows={20} placeholder="Write the agent instructions here..."
              onChange={e => setForm(f => ({ ...f, prompt: e.target.value }))} />
          </div>

          {/* Error + Submit */}
          {error && (
            <div style={{ color: t.danger, fontSize: '12px', padding: '8px 12px', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', paddingBottom: '24px' }}>
            <button onClick={() => setSelectedType(null)} style={{
              backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
              padding: '10px 20px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}>Back</button>
            <button onClick={handleSubmit} disabled={saving || !nameValid} style={{
              backgroundColor: t.tp, color: t.bg, border: 'none',
              padding: '10px 24px', fontSize: '13px', fontWeight: '600', borderRadius: '6px', cursor: 'pointer',
              opacity: (saving || !nameValid) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              {saving ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div style={{ width: '40%', borderLeft: `1px solid ${t.border}`, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Eye size={14} color={t.tm} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Card Preview</span>
            </div>
            <div style={{
              backgroundColor: t.surface, borderRadius: '8px', border: `1px solid ${t.border}`,
              padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 4px 0', color: t.tp }}>
                    {form.name ? form.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Agent Name'}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{
                      display: 'inline-flex', padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                      textTransform: 'uppercase',
                      backgroundColor: cat?.color ? `${cat.color}15` : t.violetM,
                      color: cat?.color || t.violet,
                    }}>
                      {form.category || 'uncategorized'}
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: '3px',
                      padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                      backgroundColor: typeColor + '15', color: typeColor,
                    }}>
                      <TypeIcon size={9} />
                      {selectedType.label}
                    </div>
                  </div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: t.ts, lineHeight: '1.5', margin: 0 }}>
                {form.description || '[No description]'}
              </p>
              <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontFamily: t.mono, color: t.tm }}>{form.model || 'unknown'}</span>
                {form.tools.length > 0 && (
                  <span style={{ fontSize: '10px', color: t.tm }}>{form.tools.length} tools</span>
                )}
              </div>
            </div>
          </div>

          {/* MD Preview */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <FileText size={14} color={t.tm} />
              <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generated .md</span>
            </div>
            <pre style={{
              backgroundColor: t.bg, border: `1px solid ${t.borderS}`, borderRadius: '8px',
              padding: '16px', fontSize: '11px', color: t.ts, fontFamily: t.mono,
              whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', lineHeight: '1.6',
              margin: 0,
            }}>
              {generatedMd || '# Empty agent file'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
