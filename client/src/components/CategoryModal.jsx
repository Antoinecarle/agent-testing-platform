import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Edit3, Trash2, Plus } from 'lucide-react';
import IconPicker, { getIconSvg } from './IconPicker';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', danger: '#ef4444',
};

const PRESET_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06b6d4', '#f97316', '#22c55e', '#a855f7'];

const inputStyle = {
  backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
  padding: '10px 12px', color: '#fff', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
};

const labelStyle = {
  fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em',
};

export default function CategoryModal({ isOpen, onClose, categories, agentCounts, onSave, onDelete, onReorder }) {
  const [form, setForm] = useState({ name: '', color: '#8B5CF6', icon: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setForm({ name: '', color: '#8B5CF6', icon: '', description: '' });
      setEditingId(null);
      setConfirmDeleteId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleEdit = (cat) => {
    setEditingId(cat.id);
    setForm({ name: cat.name, color: cat.color || '#8B5CF6', icon: cat.icon || '', description: cat.description || '' });
  };

  const handleSubmit = () => {
    if (!form.name?.trim()) return;
    onSave({ ...form, id: editingId || undefined });
    setForm({ name: '', color: '#8B5CF6', icon: '', description: '' });
    setEditingId(null);
  };

  const handleCancel = () => {
    setForm({ name: '', color: '#8B5CF6', icon: '', description: '' });
    setEditingId(null);
  };

  const moveCategory = (index, direction) => {
    const ordered = [...categories];
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    onReorder(ordered.map(c => c.id));
  };

  return (
    <div onClick={onClose} style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '720px', maxHeight: '80vh', backgroundColor: t.surface,
        border: `1px solid ${t.borderS}`, borderRadius: '12px',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${t.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Manage Categories</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* LEFT: Form */}
          <div style={{ width: '55%', padding: '20px 24px', borderRight: `1px solid ${t.border}`, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', margin: 0, color: t.ts }}>
              {editingId ? 'Edit Category' : 'New Category'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Name</label>
              <input style={inputStyle} value={form.name} placeholder="Category name..."
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Color</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: '24px', height: '24px', borderRadius: '50%', backgroundColor: c, padding: 0, cursor: 'pointer',
                    border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                    transition: 'border 0.15s',
                  }} />
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Icon</label>
              <IconPicker value={form.icon} onChange={icon => setForm(f => ({ ...f, icon }))} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Description</label>
              <input style={inputStyle} value={form.description} placeholder="Optional description..."
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {editingId && (
                <button onClick={handleCancel} style={{
                  backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                  padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
                }}>Cancel</button>
              )}
              <button onClick={handleSubmit} style={{
                backgroundColor: t.tp, color: t.bg, border: 'none',
                padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Plus size={12} />{editingId ? 'Update' : 'Add Category'}
              </button>
            </div>
          </div>

          {/* RIGHT: Category List */}
          <div style={{ width: '45%', padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', margin: '0 0 8px 0', color: t.ts }}>
              Existing ({categories.length})
            </h3>
            {categories.map((cat, idx) => (
              <div key={cat.id}
                onMouseEnter={() => setHoveredId(cat.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px',
                  borderRadius: '6px', fontSize: '13px',
                  backgroundColor: editingId === cat.id ? t.violetM : hoveredId === cat.id ? 'rgba(255,255,255,0.02)' : 'transparent',
                  border: editingId === cat.id ? `1px solid ${t.violet}` : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: cat.color || t.violet, flexShrink: 0 }} />
                <span style={{ color: t.tm, flexShrink: 0, display: 'flex' }}>{getIconSvg(cat.icon, 14)}</span>
                <span style={{ flex: 1, color: t.tp, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat.name}</span>
                <span style={{ fontSize: '10px', color: t.tm, backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                  {agentCounts[cat.name] || 0}
                </span>

                {hoveredId === cat.id && (
                  <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                    <button onClick={() => moveCategory(idx, -1)} disabled={idx === 0}
                      style={{ background: 'none', border: 'none', color: idx === 0 ? 'rgba(255,255,255,0.1)' : t.tm, cursor: idx === 0 ? 'default' : 'pointer', padding: '2px', display: 'flex' }}>
                      <ChevronUp size={12} />
                    </button>
                    <button onClick={() => moveCategory(idx, 1)} disabled={idx === categories.length - 1}
                      style={{ background: 'none', border: 'none', color: idx === categories.length - 1 ? 'rgba(255,255,255,0.1)' : t.tm, cursor: idx === categories.length - 1 ? 'default' : 'pointer', padding: '2px', display: 'flex' }}>
                      <ChevronDown size={12} />
                    </button>
                    <button onClick={() => handleEdit(cat)}
                      style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                      <Edit3 size={12} />
                    </button>
                    {confirmDeleteId === cat.id ? (
                      <div style={{ display: 'flex', gap: '2px' }}>
                        <button onClick={() => { onDelete(cat.id); setConfirmDeleteId(null); }}
                          style={{ background: 'none', border: 'none', color: t.danger, cursor: 'pointer', padding: '2px', fontSize: '10px', fontWeight: '700' }}>Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', fontSize: '10px' }}>No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(cat.id)}
                        style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {categories.length === 0 && (
              <p style={{ color: t.tm, fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>No categories yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
