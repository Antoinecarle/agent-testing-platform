import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ChevronLeft, Save, Copy, Sparkles, Trash2,
  Eye, Info, Check, AlertCircle, Clock, Layout, Cpu,
  Zap, Plus, X, Search
} from 'lucide-react';
import { api } from '../api';
import McpToolsManager from '../components/McpToolsManager';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task'];
const MODELS = ['sonnet', 'opus', 'haiku'];
const PERMISSION_MODES = ['', 'default', 'plan', 'bypassPermissions'];

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm,
  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px',
};
const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

function formatDate(ts) {
  if (!ts) return '--';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AgentEdit() {
  const { name } = useParams();
  const navigate = useNavigate();
  const textareaRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [agentSkills, setAgentSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');

  const [form, setForm] = useState({
    description: '', model: 'sonnet', category: 'uncategorized',
    full_prompt: '', tools: [], max_turns: 0, memory: '', permission_mode: '',
    created_at: null, updated_at: null, project_count: 0,
  });

  useEffect(() => {
    Promise.all([
      api(`/api/agents/${name}`),
      api('/api/categories'),
      api(`/api/skills/agent/${name}`),
    ]).then(([agent, cats, skills]) => {
      const toolsList = agent.tools ? agent.tools.split(',').map(s => s.trim()).filter(Boolean) : [];
      setForm({
        description: agent.description || '',
        model: agent.model || 'sonnet',
        category: agent.category || 'uncategorized',
        full_prompt: agent.full_prompt || '',
        tools: toolsList,
        max_turns: agent.max_turns || 0,
        memory: agent.memory || '',
        permission_mode: agent.permission_mode || '',
        created_at: agent.created_at,
        updated_at: agent.updated_at,
        project_count: agent.project_count || 0,
      });
      setCategories(cats || []);
      setAgentSkills(skills || []);
    }).catch(err => {
      showToast('Error loading agent', 'danger');
    }).finally(() => setLoading(false));
  }, [name]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleTool = (tool) => {
    setForm(f => ({
      ...f,
      tools: f.tools.includes(tool) ? f.tools.filter(x => x !== tool) : [...f.tools, tool],
    }));
  };

  const lineNumbers = useMemo(() => {
    const count = (form.full_prompt || '').split('\n').length;
    return Array.from({ length: Math.max(count, 1) }, (_, i) => i + 1);
  }, [form.full_prompt]);

  const generatedMd = useMemo(() => {
    const parts = [];
    if (form.description) parts.push(`description: "${form.description.replace(/"/g, '\\"')}"`);
    if (form.model) parts.push(`model: ${form.model}`);
    if (form.tools.length > 0) parts.push(`tools: [${form.tools.join(', ')}]`);
    if (form.max_turns > 0) parts.push(`max_turns: ${form.max_turns}`);
    if (form.memory) parts.push(`memory: "${form.memory.replace(/"/g, '\\"')}"`);
    if (form.permission_mode) parts.push(`permission_mode: ${form.permission_mode}`);
    const fm = parts.length > 0 ? `---\n${parts.join('\n')}\n---\n\n` : '';
    return fm + (form.full_prompt || '');
  }, [form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api(`/api/agents/${name}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: form.description,
          model: form.model,
          category: form.category,
          full_prompt: form.full_prompt,
          tools: form.tools.join(', '),
          max_turns: form.max_turns,
          memory: form.memory,
          permission_mode: form.permission_mode,
        }),
      });
      showToast('Agent saved successfully');
      setTimeout(() => navigate(`/agents/${name}`), 800);
    } catch (err) {
      showToast(err.message || 'Failed to save', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    const newName = window.prompt('Enter new agent name (kebab-case):', `${name}-copy`);
    if (!newName) return;
    try {
      await api(`/api/agents/${name}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName }),
      });
      showToast('Agent duplicated');
      navigate(`/agents/${newName}/edit`);
    } catch (err) {
      showToast(err.message || 'Duplicate failed', 'danger');
    }
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    try {
      const res = await api('/api/agents/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          purpose: form.description || 'Improve this agent prompt',
          style: form.category,
          tools_needed: form.tools.join(', '),
          category: form.category,
          existing_prompt: form.full_prompt,
        }),
      });
      if (res.prompt) {
        setForm(f => ({ ...f, full_prompt: res.prompt }));
        showToast('Prompt enhanced by AI');
      }
    } catch (err) {
      showToast(err.message || 'AI enhancement failed', 'danger');
    } finally {
      setEnhancing(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api(`/api/agents/${name}`, { method: 'DELETE' });
      navigate('/agents');
    } catch (err) {
      showToast('Delete failed', 'danger');
      setShowDeleteModal(false);
    }
  };

  const openSkillPicker = async () => {
    try {
      const all = await api('/api/skills');
      setAllSkills(all || []);
      setSkillSearch('');
      setShowSkillPicker(true);
    } catch (err) {
      showToast('Failed to load skills', 'danger');
    }
  };

  const assignSkill = async (skill) => {
    try {
      await api(`/api/skills/${skill.id}/assign/${name}`, { method: 'POST' });
      setAgentSkills(prev => [...prev, skill]);
      showToast(`Skill "${skill.name}" assigned`);
    } catch (err) {
      showToast(err.message || 'Assign failed', 'danger');
    }
  };

  const unassignSkill = async (skill) => {
    try {
      await api(`/api/skills/${skill.id}/unassign/${name}`, { method: 'DELETE' });
      setAgentSkills(prev => prev.filter(s => s.id !== skill.id));
      showToast(`Skill "${skill.name}" removed`);
    } catch (err) {
      showToast(err.message || 'Unassign failed', 'danger');
    }
  };

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: t.tm, fontSize: '13px' }}>Loading agent...</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, paddingBottom: '80px' }}>
      {/* Breadcrumb */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${t.border}` }}>
        <Link to={`/agents/${name}`} style={{ color: t.tm, display: 'flex', textDecoration: 'none' }}><ChevronLeft size={18} /></Link>
        <span style={{ fontSize: '12px', color: t.tm }}>Agents</span>
        <span style={{ fontSize: '12px', color: t.tm }}>/</span>
        <Link to={`/agents/${name}`} style={{ fontSize: '12px', color: t.ts, textDecoration: 'none' }}>{name}</Link>
        <span style={{ fontSize: '12px', color: t.tm }}>/</span>
        <span style={{ fontSize: '12px', color: t.tp, fontWeight: 600 }}>Edit</span>
      </div>

      {/* Two columns */}
      <div style={{ display: 'flex', padding: '24px', gap: '24px' }}>
        {/* LEFT: Form */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '70px' }}
              value={form.description} placeholder="What does this agent do?"
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          {/* Model + Category */}
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
                  <input type="checkbox" checked={form.tools.includes(tool)} onChange={() => toggleTool(tool)} style={{ display: 'none' }} />
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

          {/* Max Turns + Permission + Memory */}
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ width: '100px' }}>
              <label style={labelStyle}>Max Turns</label>
              <input type="number" min="0" max="100" style={inputStyle} value={form.max_turns}
                onChange={e => setForm(f => ({ ...f, max_turns: parseInt(e.target.value) || 0 }))} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Permission Mode</label>
              <select style={inputStyle} value={form.permission_mode} onChange={e => setForm(f => ({ ...f, permission_mode: e.target.value }))}>
                {PERMISSION_MODES.map(m => <option key={m} value={m}>{m || '(none)'}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Memory</label>
              <input style={inputStyle} value={form.memory} placeholder="Optional..."
                onChange={e => setForm(f => ({ ...f, memory: e.target.value }))} />
            </div>
          </div>

          {/* Prompt Editor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>System Prompt</label>
              <span style={{ fontSize: '11px', color: t.tm, fontFamily: t.mono }}>{form.full_prompt.length} chars / {lineNumbers.length} lines</span>
            </div>
            <div style={{
              display: 'flex', backgroundColor: t.bg, border: `1px solid ${t.borderS}`,
              borderRadius: '8px', minHeight: '500px', overflow: 'hidden',
            }}>
              {/* Line numbers */}
              <div style={{
                padding: '16px 8px 16px 12px', borderRight: `1px solid ${t.border}`,
                userSelect: 'none', flexShrink: 0, backgroundColor: t.surface,
              }}>
                {lineNumbers.map(n => (
                  <div key={n} style={{ fontSize: '11px', fontFamily: t.mono, color: 'rgba(255,255,255,0.15)', lineHeight: '20px', textAlign: 'right' }}>
                    {n}
                  </div>
                ))}
              </div>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={form.full_prompt}
                onChange={e => setForm(f => ({ ...f, full_prompt: e.target.value }))}
                spellCheck="false"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: t.tp, fontSize: '13px', lineHeight: '20px', padding: '16px',
                  resize: 'none', fontFamily: t.mono, width: '100%',
                }}
                placeholder="Write the agent instructions here..."
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Preview */}
        <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Card Preview */}
          <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Layout size={14} color={t.violet} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Preview</span>
            </div>
            <div style={{
              backgroundColor: t.surface, borderRadius: '8px', border: `1px solid ${t.borderS}`,
              padding: '16px', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: `radial-gradient(circle at top right, ${t.violetG}, transparent)` }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{
                  display: 'inline-flex', padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                  fontWeight: 600, textTransform: 'uppercase', backgroundColor: t.violetM, color: t.violet,
                }}>{form.category}</span>
                <span style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono, fontWeight: 600 }}>{form.model}</span>
              </div>
              <h4 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 6px 0' }}>
                {name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </h4>
              <p style={{ fontSize: '12px', color: t.ts, lineHeight: '1.5', margin: '0 0 10px 0' }}>
                {form.description || '[No description]'}
              </p>
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                {form.tools.slice(0, 5).map(tool => (
                  <span key={tool} style={{ fontSize: '10px', backgroundColor: t.surfaceEl, padding: '2px 6px', borderRadius: '4px', border: `1px solid ${t.border}`, color: t.tm }}>{tool}</span>
                ))}
                {form.tools.length > 5 && <span style={{ fontSize: '10px', color: t.tm }}>+{form.tools.length - 5}</span>}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Info size={14} color={t.violet} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Stats</span>
            </div>
            {[
              { icon: <Clock size={12} color={t.tm} />, label: 'Created', value: formatDate(form.created_at) },
              { icon: <Cpu size={12} color={t.tm} />, label: 'Updated', value: formatDate(form.updated_at) },
              { icon: <Layout size={12} color={t.tm} />, label: 'Projects', value: `${form.project_count}` },
            ].map((stat, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < 2 ? `1px solid ${t.border}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {stat.icon}
                  <span style={{ fontSize: '12px', color: t.ts }}>{stat.label}</span>
                </div>
                <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: t.mono, color: t.tp }}>{stat.value}</span>
              </div>
            ))}
          </div>

          {/* Skills */}
          <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} color={t.violet} />
                <span style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Skills ({agentSkills.length})
                </span>
              </div>
              <button onClick={openSkillPicker} style={{
                background: 'none', border: 'none', color: t.violet, cursor: 'pointer',
                fontSize: '11px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Plus size={12} /> Add
              </button>
            </div>
            {agentSkills.length === 0 ? (
              <div style={{
                padding: '16px', textAlign: 'center', color: t.tm, fontSize: '11px',
                border: `1px dashed ${t.border}`, borderRadius: '6px',
              }}>
                No skills assigned. Skills inject context into workspace CLAUDE.md when running projects.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {agentSkills.map(skill => (
                  <div key={skill.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', backgroundColor: t.surface, borderRadius: '6px',
                    border: `1px solid ${t.border}`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: skill.color || t.violet, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
                      {skill.total_files > 0 && (
                        <span style={{ fontSize: '9px', color: t.tm, backgroundColor: 'rgba(255,255,255,0.04)', padding: '1px 5px', borderRadius: '100px' }}>
                          {skill.total_files} files
                        </span>
                      )}
                    </div>
                    <button onClick={() => unassignSkill(skill)} style={{
                      background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex',
                    }} title="Remove skill">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* MCP Tools */}
          <McpToolsManager agentName={name} />

          {/* MD Preview */}
          <div style={{ backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px', flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Eye size={14} color={t.violet} />
              <span style={{ fontSize: '11px', fontWeight: 600, color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Generated .md</span>
            </div>
            <pre style={{
              backgroundColor: '#0a0a0a', border: `1px solid ${t.borderS}`, borderRadius: '8px',
              padding: '16px', fontSize: '11px', color: t.ts, fontFamily: t.mono,
              whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto', lineHeight: '1.6', margin: 0,
            }}>
              {generatedMd || '# Empty agent file'}
            </pre>
          </div>
        </div>
      </div>

      {/* Sticky Action Bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: t.bg, borderTop: `1px solid ${t.borderS}`,
        padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <button onClick={() => setShowDeleteModal(true)} style={{
          backgroundColor: 'transparent', color: t.danger, border: `1px solid rgba(239,68,68,0.3)`,
          padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <Trash2 size={14} />Delete
        </button>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleEnhance} disabled={enhancing} style={{
            backgroundColor: t.violetM, color: t.violet, border: `1px solid ${t.violet}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', opacity: enhancing ? 0.6 : 1,
          }}>
            <Sparkles size={14} />{enhancing ? 'Enhancing...' : 'AI Enhance'}
          </button>
          <button onClick={handleDuplicate} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Copy size={14} />Duplicate
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            backgroundColor: t.tp, color: t.bg, border: 'none',
            padding: '8px 20px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px', opacity: saving ? 0.6 : 1,
          }}>
            <Save size={14} />{saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
          backgroundColor: toast.type === 'danger' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          border: `1px solid ${toast.type === 'danger' ? t.danger : t.success}`,
          padding: '10px 20px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {toast.type === 'danger' ? <AlertCircle size={14} color={t.danger} /> : <Check size={14} color={t.success} />}
          <span style={{ fontSize: '13px', fontWeight: 500, color: t.tp }}>{toast.message}</span>
        </div>
      )}

      {/* Skill Picker Modal */}
      {showSkillPicker && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }} onClick={() => setShowSkillPicker(false)}>
          <div style={{
            width: '420px', backgroundColor: t.surface, border: `1px solid ${t.borderS}`,
            borderRadius: '12px', overflow: 'hidden',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Add Skills to {name}</h3>
              <button onClick={() => setShowSkillPicker(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${t.border}` }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
                <input style={{ ...inputStyle, paddingLeft: '30px', fontSize: '12px' }} placeholder="Search skills..."
                  value={skillSearch} onChange={e => setSkillSearch(e.target.value)} autoFocus />
              </div>
            </div>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              {allSkills
                .filter(s => !agentSkills.find(as => as.id === s.id))
                .filter(s => !skillSearch || s.name.toLowerCase().includes(skillSearch.toLowerCase()) || (s.category || '').toLowerCase().includes(skillSearch.toLowerCase()))
                .map(skill => (
                  <div key={skill.id} onClick={() => assignSkill(skill)} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px',
                    borderBottom: `1px solid ${t.border}`, cursor: 'pointer', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: skill.color || t.violet, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', fontWeight: 500 }}>{skill.name}</div>
                      {skill.description && <div style={{ fontSize: '10px', color: t.tm, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.description}</div>}
                    </div>
                    {skill.category && (
                      <span style={{ fontSize: '9px', color: skill.color || t.violet, backgroundColor: `${skill.color || t.violet}15`, padding: '2px 6px', borderRadius: '100px', flexShrink: 0 }}>
                        {skill.category}
                      </span>
                    )}
                  </div>
                ))}
              {allSkills.filter(s => !agentSkills.find(as => as.id === s.id)).length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                  No more skills available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000,
        }}>
          <div style={{
            width: '400px', backgroundColor: t.surface, border: `1px solid ${t.borderS}`,
            borderRadius: '12px', padding: '24px',
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>Delete Agent?</h3>
            <p style={{ fontSize: '13px', color: t.ts, lineHeight: '1.5', margin: '0 0 20px 0' }}>
              This will permanently delete <strong style={{ color: t.tp }}>{name}</strong> and cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowDeleteModal(false)} style={{
                backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                padding: '8px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={handleDelete} style={{
                backgroundColor: t.danger, color: '#fff', border: 'none',
                padding: '8px 16px', fontSize: '12px', fontWeight: 700, borderRadius: '4px', cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
