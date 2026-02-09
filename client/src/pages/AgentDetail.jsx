import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Edit3, Trash2, ExternalLink, Plus, Clock, Calendar, Download, Copy } from 'lucide-react';
import { api } from '../api';
import AgentVersionHistory from '../components/AgentVersionHistory';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AgentDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(`/api/agents/${name}`),
      api(`/api/agents/${name}/projects`),
      api('/api/categories'),
    ]).then(([a, p, c]) => {
      setAgent(a);
      setProjects(p || []);
      setCategories(c || []);
    }).catch(err => {
      console.error(err);
    }).finally(() => setLoading(false));
  }, [name]);

  const handleRate = async (rating) => {
    try {
      await api(`/api/agents/${name}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) });
      setAgent(prev => ({ ...prev, rating }));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    try {
      await api(`/api/agents/${name}`, { method: 'DELETE' });
      navigate('/agents');
    } catch (e) { console.error(e); }
  };

  const handleExport = () => {
    if (!agent?.full_prompt) return;
    const blob = new Blob([agent.full_prompt], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDuplicate = async () => {
    const newName = window.prompt('Enter new agent name (kebab-case):', `${name}-copy`);
    if (!newName) return;
    try {
      await api(`/api/agents/${name}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ new_name: newName }),
      });
      navigate(`/agents/${newName}`);
    } catch (e) { console.error(e); }
  };

  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: t.tm, fontSize: '13px' }}>Loading...</span>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
        <span style={{ color: t.ts, fontSize: '14px' }}>Agent not found</span>
        <Link to="/agents" style={{ color: t.violet, fontSize: '13px' }}>Back to agents</Link>
      </div>
    );
  }

  const cat = categories.find(c => c.name === agent.category);
  const toolsList = agent.tools ? agent.tools.split(',').map(t => t.trim()).filter(Boolean) : [];

  return (
    <div style={{ height: 'calc(100vh - 53px)', backgroundColor: t.bg, color: t.tp, overflowY: 'auto' }}>
      {/* Back nav */}
      <div style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link to="/agents" style={{ color: t.tm, display: 'flex', textDecoration: 'none' }}><ArrowLeft size={18} /></Link>
        <span style={{ fontSize: '12px', color: t.tm }}>Agents</span>
        <span style={{ fontSize: '12px', color: t.tm }}>/</span>
        <span style={{ fontSize: '12px', color: t.ts }}>{name}</span>
      </div>

      {/* Header Card */}
      <div style={{ margin: '0 24px 24px', padding: '28px', borderRadius: '12px', border: `1px solid rgba(255,255,255,0.1)`,
        background: 'rgba(26,26,27,0.8)', backdropFilter: 'blur(20px)',
        boxShadow: `0 0 40px ${t.violetG}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 10px 0', letterSpacing: '-0.01em' }}>
              {agent.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h1>
            {/* Badges */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {/* Category */}
              <span style={{
                display: 'inline-flex', padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                textTransform: 'uppercase',
                backgroundColor: cat?.color ? `${cat.color}15` : t.violetM,
                color: cat?.color || t.violet,
              }}>
                {agent.category}
              </span>
              {/* Model */}
              <span style={{
                display: 'inline-flex', padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                backgroundColor: 'rgba(255,255,255,0.05)', color: t.ts, fontFamily: t.mono,
              }}>
                {agent.model || 'unknown'}
              </span>
              {/* Source */}
              <span style={{
                display: 'inline-flex', padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                backgroundColor: agent.source === 'manual' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                color: agent.source === 'manual' ? t.success : t.ts,
              }}>
                {agent.source || 'filesystem'}
              </span>
              {/* Tools */}
              {toolsList.map(tool => (
                <span key={tool} style={{
                  display: 'inline-flex', padding: '3px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '500',
                  backgroundColor: 'rgba(255,255,255,0.04)', color: t.tm,
                }}>
                  {tool}
                </span>
              ))}
            </div>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={16}
                fill={i <= (agent.rating || 0) ? t.warning : 'none'}
                color={i <= (agent.rating || 0) ? t.warning : t.tm}
                style={{ cursor: 'pointer' }}
                onClick={() => handleRate(i)}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <p style={{ fontSize: '13px', color: t.ts, lineHeight: '1.6', margin: '0 0 16px 0', maxWidth: '700px' }}>
          {agent.description || '[No description]'}
        </p>

        {/* Metadata row */}
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {agent.memory && (
            <div style={{ fontSize: '11px', color: t.tm }}>
              <span style={{ color: t.ts, fontWeight: '600' }}>Memory:</span> {agent.memory}
            </div>
          )}
          {agent.permission_mode && (
            <div style={{ fontSize: '11px', color: t.tm }}>
              <span style={{ color: t.ts, fontWeight: '600' }}>Permission:</span> {agent.permission_mode}
            </div>
          )}
          {agent.max_turns > 0 && (
            <div style={{ fontSize: '11px', color: t.tm }}>
              <span style={{ color: t.ts, fontWeight: '600' }}>Max Turns:</span> {agent.max_turns}
            </div>
          )}
          <div style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={10} /> {formatDate(agent.created_at)}
          </div>
          <div style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={10} /> {formatDate(agent.updated_at)}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => navigate(`/agents/${name}/edit`)} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Edit3 size={13} />Edit
          </button>
          <button onClick={() => navigate(`/project/new?agent=${name}`)} style={{
            backgroundColor: t.violetM, color: t.violet, border: 'none',
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <ExternalLink size={13} />Test
          </button>
          <button onClick={handleDuplicate} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Copy size={13} />Duplicate
          </button>
          <button onClick={handleExport} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Download size={13} />Export .md
          </button>
          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)} style={{
              backgroundColor: 'transparent', color: t.danger, border: `1px solid rgba(239,68,68,0.3)`,
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Trash2 size={13} />Delete
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: t.danger }}>Confirm?</span>
              <button onClick={handleDelete} style={{
                backgroundColor: t.danger, color: '#fff', border: 'none',
                padding: '6px 12px', fontSize: '11px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer',
              }}>Yes</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                padding: '6px 12px', fontSize: '11px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              }}>No</button>
            </div>
          )}
        </div>
      </div>

      {/* Content: 2 columns */}
      <div style={{ display: 'flex', padding: '0 24px 24px', gap: '24px' }}>
        {/* LEFT: Prompt + Version History */}
        <div style={{ width: '65%' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Prompt
            {agent.full_prompt && (
              <span style={{ fontSize: '10px', color: t.tm, fontWeight: '400', fontFamily: t.mono }}>
                {agent.full_prompt.split('\n').length} lines
              </span>
            )}
          </h2>
          <div style={{
            backgroundColor: t.bg, border: `1px solid ${t.borderS}`, borderRadius: '8px',
            maxHeight: '600px', overflowY: 'auto',
          }}>
            {agent.full_prompt ? (
              <div style={{ display: 'flex' }}>
                {/* Line numbers */}
                <div style={{
                  padding: '16px 12px 16px 16px', borderRight: `1px solid ${t.border}`,
                  userSelect: 'none', flexShrink: 0,
                }}>
                  {agent.full_prompt.split('\n').map((_, i) => (
                    <div key={i} style={{ fontSize: '11px', fontFamily: t.mono, color: 'rgba(255,255,255,0.15)', lineHeight: '1.7', textAlign: 'right' }}>
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Content */}
                <pre style={{
                  padding: '16px', margin: 0, fontSize: '11px', fontFamily: t.mono,
                  color: t.ts, lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  flex: 1, overflow: 'hidden',
                }}>
                  {agent.full_prompt}
                </pre>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: t.tm, fontSize: '13px' }}>
                [No prompt content]
              </div>
            )}
          </div>

          {/* Version History */}
          <div style={{ marginTop: '24px' }}>
            <AgentVersionHistory
              agentName={name}
              onRevert={() => {
                api(`/api/agents/${name}`).then(setAgent).catch(console.error);
              }}
            />
          </div>
        </div>

        {/* RIGHT: Projects */}
        <div style={{ width: '35%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              Projects
              <span style={{ fontSize: '10px', color: t.tm, fontWeight: '400', backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                {projects.length}
              </span>
            </h2>
            <button onClick={() => navigate(`/project/new?agent=${name}`)} style={{
              backgroundColor: t.violetM, color: t.violet, border: 'none',
              padding: '5px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <Plus size={12} />New
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {projects.map(p => (
              <div key={p.id}
                onClick={() => navigate(`/project/${p.id}`)}
                style={{
                  backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                  padding: '14px', cursor: 'pointer', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{p.name}</span>
                  <span style={{
                    fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '100px',
                    backgroundColor: p.status === 'active' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
                    color: p.status === 'active' ? t.success : t.tm,
                  }}>
                    {p.status}
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={10} /> {formatDate(p.created_at)}
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div style={{
                padding: '40px 20px', textAlign: 'center', borderRadius: '8px',
                border: `1px dashed ${t.borderS}`, color: t.tm, fontSize: '12px',
              }}>
                No projects yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
