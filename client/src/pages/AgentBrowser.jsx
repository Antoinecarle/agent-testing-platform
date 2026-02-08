import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Plus, Trash2, Edit3, Star, Layers,
  LayoutGrid, List, RefreshCw, X, Check, Save,
  ChevronRight, AlertCircle, ExternalLink, Settings
} from 'lucide-react';
import { api } from '../api';
import CategoryModal from '../components/CategoryModal';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const PRESET_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06b6d4', '#f97316'];

// ─── Inline Category Form ────────────────────────────────────
function InlineCategoryForm({ initial, onCancel, onSave, onChange }) {
  return (
    <div style={{ padding: '10px', backgroundColor: t.surfaceEl, borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        style={{ background: t.bg, border: `1px solid ${t.border}`, color: '#fff', fontSize: '12px', padding: '6px 8px', borderRadius: '4px', outline: 'none' }}
        value={initial.name}
        placeholder="Category name..."
        onChange={e => onChange({ name: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: '4px' }}>
        {PRESET_COLORS.map(c => (
          <button key={c} onClick={() => onChange({ color: c })} style={{
            width: '16px', height: '16px', borderRadius: '50%', backgroundColor: c, padding: 0, cursor: 'pointer',
            border: initial.color === c ? '2px solid #fff' : '2px solid transparent',
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={14} /></button>
        <button onClick={onSave} style={{ background: 'none', border: 'none', color: t.success, cursor: 'pointer', padding: '4px', display: 'flex' }}><Check size={14} /></button>
      </div>
    </div>
  );
}

// ─── Category Item ───────────────────────────────────────────
function CategoryItem({ cat, isActive, count, onClick, onEdit, onDelete }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px',
        cursor: 'pointer', transition: 'all 0.2s', fontSize: '13px', gap: '10px',
        backgroundColor: isActive ? t.surfaceEl : hovered ? 'rgba(255,255,255,0.02)' : 'transparent',
        color: isActive ? t.tp : t.ts,
        border: isActive ? `1px solid ${t.borderS}` : '1px solid transparent',
      }}
    >
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: cat.color || t.violet, flexShrink: 0 }} />
      <span style={{ flex: 1, textTransform: 'capitalize' }}>{cat.name}</span>
      {hovered && (
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex' }}><Edit3 size={11} /></button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex' }}><Trash2 size={11} /></button>
        </div>
      )}
      <span style={{ fontSize: '11px', color: t.tm, backgroundColor: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>{count}</span>
    </div>
  );
}

// ─── Agent Card ──────────────────────────────────────────────
function AgentCard({ agent, viewType, categories, onEdit, onDelete, onRate, onTest, onClick }) {
  const [hovered, setHovered] = useState(false);
  const cat = categories.find(c => c.name === agent.category);
  const isGrid = viewType === 'grid';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: 'pointer',
        backgroundColor: t.surface, borderRadius: isGrid ? '8px' : '4px',
        border: `1px solid ${hovered ? t.violet : t.border}`,
        padding: isGrid ? '16px' : '10px 16px',
        transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: hovered ? `0 0 20px ${t.violetG}` : 'none',
        display: isGrid ? 'flex' : 'flex', flexDirection: isGrid ? 'column' : 'row',
        alignItems: isGrid ? 'stretch' : 'center', gap: isGrid ? '0' : '16px',
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: t.tp }}>
              {agent.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h4>
            <div style={{
              display: 'inline-flex', padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
              textTransform: 'uppercase', width: 'fit-content',
              backgroundColor: cat?.color ? `${cat.color}15` : t.violetM,
              color: cat?.color || t.violet,
            }}>
              {agent.category || 'uncategorized'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} size={12}
                fill={i <= (agent.rating || 0) ? t.warning : 'none'}
                color={i <= (agent.rating || 0) ? t.warning : t.tm}
                style={{ cursor: 'pointer' }}
                onClick={e => { e.stopPropagation(); onRate(i); }}
              />
            ))}
          </div>
        </div>

        {isGrid && (
          <p style={{
            fontSize: '12px', color: t.ts, lineHeight: '1.5', margin: '0 0 12px 0',
            display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {agent.description || '[No description]'}
          </p>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingTop: isGrid ? '12px' : '0', borderTop: isGrid ? `1px solid ${t.border}` : 'none',
        }}>
          <span style={{ fontSize: '11px', fontFamily: t.mono, color: t.tm }}>{agent.model || 'unknown'}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={e => { e.stopPropagation(); onTest(); }} style={{
              backgroundColor: t.violetM, color: t.violet, border: 'none', padding: '4px 10px',
              fontSize: '11px', fontWeight: '700', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center',
            }}>
              <ExternalLink size={10} style={{ marginRight: 4 }} />TEST
            </button>
            <button onClick={e => { e.stopPropagation(); onEdit(); }} style={{
              background: 'none', border: `1px solid ${t.border}`, color: t.ts, padding: '4px',
              borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Edit3 size={13} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
              background: 'none', border: `1px solid ${t.border}`, color: t.ts, padding: '4px',
              borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}><Trash2 size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Agent Drawer Editor ─────────────────────────────────────
function AgentDrawer({ agent, categories, onClose, onSave }) {
  const [data, setData] = useState({ ...agent });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(data); } finally { setSaving(false); }
  };

  const inputStyle = {
    backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
    padding: '10px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', justifyContent: 'flex-end', zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '450px', height: '100%', backgroundColor: t.surface,
        borderLeft: `1px solid ${t.borderS}`, display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 4px 0' }}>Edit Agent</h2>
            <p style={{ fontSize: '12px', fontFamily: t.mono, color: t.tm, margin: 0 }}>{agent.name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
            <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', minHeight: '80px' }}
              value={data.description || ''} rows={4}
              onChange={e => setData({ ...data, description: e.target.value })} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Model</label>
            <input style={inputStyle} value={data.model || ''}
              onChange={e => setData({ ...data, model: e.target.value })} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
            <select style={inputStyle} value={data.category || ''}
              onChange={e => setData({ ...data, category: e.target.value })}>
              <option value="">uncategorized</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt Preview</label>
            <div style={{
              backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
              padding: '12px', fontSize: '11px', color: t.ts, fontFamily: t.mono,
              whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto', lineHeight: '1.6',
            }}>
              {agent.prompt_preview || '[No prompt content]'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 24px', borderTop: `1px solid ${t.border}`, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button onClick={onClose} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            backgroundColor: t.tp, color: t.bg, border: 'none',
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', opacity: saving ? 0.6 : 1,
          }}>
            <Save size={14} style={{ marginRight: 6 }} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function AgentBrowser() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('rating');
  const [viewType, setViewType] = useState('grid');
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [categoryForm, setCategoryForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [a, c] = await Promise.all([
        api('/api/agents'),
        api('/api/categories'),
      ]);
      setAgents(a || []);
      setCategories(c || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSync = async () => {
    setIsSyncing(true);
    try { await api('/api/agents/sync', { method: 'POST' }); await fetchData(); }
    catch (e) { console.error(e); }
    finally { setIsSyncing(false); }
  };

  const handleRate = async (name, rating) => {
    try {
      await api(`/api/agents/${name}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) });
      setAgents(prev => prev.map(a => a.name === name ? { ...a, rating } : a));
    } catch (e) { console.error(e); }
  };

  const handleDeleteAgent = async (name) => {
    try {
      await api(`/api/agents/${name}`, { method: 'DELETE' });
      setAgents(prev => prev.filter(a => a.name !== name));
      setConfirmDelete(null);
    } catch (e) { console.error(e); }
  };

  const handleSaveAgent = async (data) => {
    try {
      const updated = await api(`/api/agents/${data.name}`, { method: 'PUT', body: JSON.stringify(data) });
      setAgents(prev => prev.map(a => a.name === data.name ? { ...a, ...updated } : a));
      setEditingAgent(null);
    } catch (e) { console.error(e); }
  };

  const handleCategorySubmit = async (form) => {
    if (!form.name?.trim()) return;
    try {
      if (form.id) {
        await api(`/api/categories/${form.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await api('/api/categories', { method: 'POST', body: JSON.stringify(form) });
      }
      setCategoryForm(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteCategory = async (id) => {
    try {
      await api(`/api/categories/${id}`, { method: 'DELETE' });
      if (categories.find(c => c.id === id)?.name === activeCategory) setActiveCategory(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleReorderCategories = async (ids) => {
    try {
      await api('/api/categories/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleCategoryModalSave = async (form) => {
    if (!form.name?.trim()) return;
    try {
      if (form.id) {
        await api(`/api/categories/${form.id}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await api('/api/categories', { method: 'POST', body: JSON.stringify(form) });
      }
      fetchData();
    } catch (e) { console.error(e); }
  };

  const agentCounts = useMemo(() => {
    const counts = {};
    agents.forEach(a => { counts[a.category] = (counts[a.category] || 0) + 1; });
    return counts;
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents
      .filter(a => {
        const matchesCat = !activeCategory || a.category === activeCategory;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q || a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
        return matchesCat && matchesSearch;
      })
      .sort((a, b) => {
        if (sortOrder === 'rating') return (b.rating || 0) - (a.rating || 0);
        if (sortOrder === 'name') return a.name.localeCompare(b.name);
        return (b.updated_at || 0) - (a.updated_at || 0);
      });
  }, [agents, activeCategory, searchQuery, sortOrder]);

  const getCount = (catName) => agents.filter(a => a.category === catName).length;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 53px)', width: '100%', backgroundColor: t.bg, color: t.tp, overflow: 'hidden' }}>

      {/* ─── SIDEBAR ─────────────────────────────── */}
      <aside style={{ width: '260px', borderRight: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0b', flexShrink: 0 }}>
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${t.border}` }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Categories</span>
          <button onClick={() => setCategoryModalOpen(true)} title="Manage categories" style={{
            background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex',
          }}><Settings size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {/* All agents */}
          <div
            onClick={() => setActiveCategory(null)}
            style={{
              display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '13px', gap: '10px', marginBottom: '2px',
              backgroundColor: activeCategory === null ? t.surfaceEl : 'transparent',
              color: activeCategory === null ? t.tp : t.ts,
              border: activeCategory === null ? `1px solid ${t.borderS}` : '1px solid transparent',
            }}
          >
            <Layers size={12} color={t.tm} />
            <span style={{ flex: 1 }}>All Agents</span>
            <span style={{ fontSize: '11px', color: t.tm, backgroundColor: 'rgba(255,255,255,0.03)', padding: '2px 6px', borderRadius: '4px' }}>{agents.length}</span>
          </div>

          {/* Category list */}
          {categories.map(cat => (
            <div key={cat.id} style={{ marginBottom: '2px' }}>
              {categoryForm?.id === cat.id ? (
                <InlineCategoryForm
                  initial={categoryForm}
                  onCancel={() => setCategoryForm(null)}
                  onSave={() => handleCategorySubmit(categoryForm)}
                  onChange={val => setCategoryForm(prev => ({ ...prev, ...val }))}
                />
              ) : (
                <CategoryItem
                  cat={cat}
                  isActive={activeCategory === cat.name}
                  count={getCount(cat.name)}
                  onClick={() => setActiveCategory(cat.name)}
                  onEdit={() => setCategoryForm({ ...cat })}
                  onDelete={() => handleDeleteCategory(cat.id)}
                />
              )}
            </div>
          ))}

          {/* New category form */}
          {categoryForm && !categoryForm.id && (
            <InlineCategoryForm
              initial={categoryForm}
              onCancel={() => setCategoryForm(null)}
              onSave={() => handleCategorySubmit(categoryForm)}
              onChange={val => setCategoryForm(prev => ({ ...prev, ...val }))}
            />
          )}
        </div>
      </aside>

      {/* ─── MAIN ────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <header style={{
          height: '52px', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', backgroundColor: t.surface,
            border: `1px solid ${t.border}`, borderRadius: '6px', padding: '0 12px', width: '300px',
          }}>
            <Search size={14} color={t.tm} />
            <input
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search agents..."
              style={{ background: 'none', border: 'none', color: '#fff', padding: '8px 10px', fontSize: '13px', width: '100%', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={{
              backgroundColor: t.surface, border: `1px solid ${t.border}`, color: t.ts,
              fontSize: '12px', padding: '6px 10px', borderRadius: '4px', outline: 'none',
            }}>
              <option value="rating">Top Rated</option>
              <option value="name">Alphabetical</option>
              <option value="recent">Recent</option>
            </select>

            <div style={{ display: 'flex', backgroundColor: t.surface, padding: '3px', borderRadius: '6px', border: `1px solid ${t.border}` }}>
              <button onClick={() => setViewType('grid')} style={{
                padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px',
                backgroundColor: viewType === 'grid' ? t.surfaceEl : 'transparent',
                color: viewType === 'grid' ? t.violet : t.tm, display: 'flex', alignItems: 'center',
              }}><LayoutGrid size={14} /></button>
              <button onClick={() => setViewType('compact')} style={{
                padding: '4px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px',
                backgroundColor: viewType === 'compact' ? t.surfaceEl : 'transparent',
                color: viewType === 'compact' ? t.violet : t.tm, display: 'flex', alignItems: 'center',
              }}><List size={14} /></button>
            </div>

            <button onClick={handleSync} disabled={isSyncing} style={{
              backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
              padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <RefreshCw size={14} style={isSyncing ? { animation: 'spin 1s linear infinite' } : {}} />
              Sync
            </button>

            <button onClick={() => navigate('/agents/new')} style={{
              backgroundColor: t.violet, color: '#fff', border: 'none',
              padding: '6px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Plus size={14} />
              Create Agent
            </button>
          </div>
        </header>

        {/* Title */}
        <div style={{ padding: '20px 24px 0 24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '12px', textTransform: 'capitalize' }}>
            {activeCategory || 'All Agents'}
            <span style={{ fontSize: '12px', fontWeight: '400', color: t.tm, backgroundColor: t.border, padding: '2px 8px', borderRadius: '100px' }}>
              {filteredAgents.length}
            </span>
          </h1>
        </div>

        {/* Grid / List */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px 24px',
          display: viewType === 'grid' ? 'grid' : 'flex',
          gridTemplateColumns: viewType === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : undefined,
          flexDirection: viewType === 'compact' ? 'column' : undefined,
          gap: '12px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.3s',
        }}>
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.name}
              agent={agent}
              viewType={viewType}
              categories={categories}
              onClick={() => navigate(`/agents/${agent.name}`)}
              onEdit={() => { setEditingAgent(agent); }}
              onDelete={() => { setConfirmDelete(agent.name); }}
              onRate={val => handleRate(agent.name, val)}
              onTest={() => navigate(`/project/new?agent=${agent.name}`)}
            />
          ))}
          {filteredAgents.length === 0 && !loading && (
            <div style={{
              gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '60px', border: `1px dashed ${t.borderS}`, borderRadius: '12px',
            }}>
              <h3 style={{ fontSize: '14px', color: t.ts, margin: '0 0 8px 0' }}>No agents found</h3>
              <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Try adjusting your search or category filters.</p>
            </div>
          )}
        </div>
      </main>

      {/* ─── DRAWER ──────────────────────────────── */}
      {editingAgent && (
        <AgentDrawer
          agent={editingAgent}
          categories={categories}
          onClose={() => setEditingAgent(null)}
          onSave={handleSaveAgent}
        />
      )}

      {/* ─── DELETE MODAL ────────────────────────── */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
        }}>
          <div style={{
            backgroundColor: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '12px',
            padding: '32px', width: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}>
            <AlertCircle size={32} color={t.danger} style={{ marginBottom: 16 }} />
            <h3 style={{ fontSize: '16px', margin: '0 0 8px 0' }}>Delete Agent?</h3>
            <p style={{ color: t.ts, fontSize: '13px', textAlign: 'center', margin: '0 0 24px 0' }}>
              Are you sure you want to delete <strong style={{ color: '#fff' }}>{confirmDelete}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setConfirmDelete(null)} style={{
                backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => handleDeleteAgent(confirmDelete)} style={{
                backgroundColor: t.danger, color: '#fff', border: 'none',
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CATEGORY MODAL ─────────────────────── */}
      <CategoryModal
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        categories={categories}
        agentCounts={agentCounts}
        onSave={async (data) => { await handleCategoryModalSave(data); }}
        onDelete={async (id) => { await handleDeleteCategory(id); }}
        onReorder={handleReorderCategories}
      />

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
