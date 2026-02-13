import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, Edit2, Trash2,
  UserPlus, X, Check, Layers, Users, Zap, Hash,
  AlertCircle, FileText, Sparkles
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

const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  transition: 'border-color 0.2s ease',
};

const PRESET_COLORS = ['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1', '#14B8A6', '#F97316'];

export default function Skills() {
  const navigate = useNavigate();
  const [skills, setSkills] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSkill, setActiveSkill] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '', description: '', prompt: '', category: '', icon: '', color: '#8B5CF6'
  });
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedAgents, setSelectedAgents] = useState([]);

  // Auto-dismiss error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (categoryFilter) params.set('category', categoryFilter);
      const qs = params.toString();

      const [skillsData, statsData, catsData] = await Promise.all([
        api(`/api/skills${qs ? `?${qs}` : ''}`),
        api('/api/skills/stats'),
        api('/api/skills/categories'),
      ]);
      setSkills(skillsData);
      setStats(statsData);
      setCategories(catsData);
    } catch (err) {
      setError('Failed to load skills data');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadAgents = async () => {
    try {
      const data = await api('/api/agents');
      setAgents(data);
    } catch (err) {
      setError('Failed to load agents list');
    }
  };

  const handleOpenCreate = () => {
    setEditMode(false);
    setFormData({ name: '', description: '', prompt: '', category: '', icon: '', color: '#8B5CF6' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (skill) => {
    setEditMode(true);
    setActiveSkill(skill);
    setFormData({
      name: skill.name || '',
      description: skill.description || '',
      prompt: skill.prompt || '',
      category: skill.category || '',
      icon: skill.icon || '',
      color: skill.color || '#8B5CF6',
    });
    setIsModalOpen(true);
  };

  const handleOpenAssign = async (skill) => {
    setActiveSkill(skill);
    setSelectedAgents([]);
    setAssignSearch('');
    await loadAgents();
    // Pre-select already assigned agents
    try {
      const detailed = await api(`/api/skills/${skill.id}`);
      setSelectedAgents((detailed.agents || []).map(a => a.name));
    } catch (_) {}
    setIsAssignOpen(true);
  };

  const handleOpenDrawer = async (skill) => {
    try {
      const detailed = await api(`/api/skills/${skill.id}`);
      setActiveSkill(detailed);
      setIsDrawerOpen(true);
    } catch (err) {
      setError('Could not load skill details');
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Skill name is required');
      return;
    }
    try {
      setSaving(true);
      if (editMode && activeSkill) {
        await api(`/api/skills/${activeSkill.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        });
      } else {
        await api('/api/skills', {
          method: 'POST',
          body: JSON.stringify(formData),
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this skill? This will unassign it from all agents.')) return;
    try {
      await api(`/api/skills/${id}`, { method: 'DELETE' });
      fetchData();
      if (isDrawerOpen && activeSkill?.id === id) setIsDrawerOpen(false);
    } catch (err) {
      setError(err.message || 'Delete failed');
    }
  };

  const handleBulkAssign = async () => {
    try {
      await api(`/api/skills/${activeSkill.id}/bulk-assign`, {
        method: 'POST',
        body: JSON.stringify({ agent_names: selectedAgents }),
      });
      setIsAssignOpen(false);
      fetchData();
      // Refresh drawer if open
      if (isDrawerOpen && activeSkill) {
        const updated = await api(`/api/skills/${activeSkill.id}`);
        setActiveSkill(updated);
      }
    } catch (err) {
      setError(err.message || 'Assignment failed');
    }
  };

  const handleUnassign = async (agentName) => {
    try {
      await api(`/api/skills/${activeSkill.id}/unassign/${agentName}`, { method: 'DELETE' });
      const updated = await api(`/api/skills/${activeSkill.id}`);
      setActiveSkill(updated);
      fetchData();
    } catch (err) {
      setError(err.message || 'Unassign failed');
    }
  };

  return (
    <div style={{ color: t.tp }}>

      {/* Header */}
      <div className="skills-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>Skills</h1>
          <p style={{ color: t.ts, fontSize: '13px', margin: 0 }}>Create and manage reusable skills for your agents</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => navigate('/skills/create')}
            style={{
              backgroundColor: t.violetM, color: t.violet, border: `1px solid rgba(139,92,246,0.3)`, borderRadius: '4px',
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Sparkles size={14} /> Create with AI
          </button>
          <button
            onClick={handleOpenCreate}
            style={{
              backgroundColor: t.tp, color: t.bg, border: 'none', borderRadius: '4px',
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            <Plus size={14} /> New Skill
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="skills-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'Total Skills', val: stats?.total || 0, icon: <Layers size={13} /> },
          { label: 'Assignments', val: stats?.totalAssignments || 0, icon: <UserPlus size={13} /> },
          { label: 'Unique Agents', val: stats?.uniqueAgents || 0, icon: <Users size={13} /> },
          { label: 'Categories', val: categories?.length || 0, icon: <Hash size={13} /> },
        ].map((s, i) => (
          <div key={i} style={{
            backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px', padding: '14px',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px', color: t.tm, fontSize: '10px',
              marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600',
            }}>
              {s.icon} {s.label}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '700' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
          <input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px' }}
          />
        </div>
        <div style={{ position: 'relative', minWidth: '170px' }}>
          <Filter size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.tm, pointerEvents: 'none' }} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ ...inputStyle, paddingLeft: '34px', appearance: 'none', cursor: 'pointer' }}
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: t.tm, fontSize: '13px' }}>
          Loading...
        </div>
      ) : skills.length === 0 ? (
        <div style={{
          border: `1px dashed ${t.borderS}`, borderRadius: '12px', padding: '60px 20px', textAlign: 'center',
        }}>
          <Layers size={32} style={{ color: t.tm, marginBottom: '12px' }} />
          <h3 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 6px 0' }}>No skills found</h3>
          <p style={{ color: t.tm, fontSize: '12px', margin: '0 0 16px 0' }}>
            {search || categoryFilter ? 'Try adjusting your filters.' : 'Create your first skill to get started.'}
          </p>
          {!search && !categoryFilter && (
            <button onClick={handleOpenCreate} style={{
              backgroundColor: t.violetM, color: t.violet, border: 'none', borderRadius: '4px',
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
            }}>
              <Plus size={14} /> Create Skill
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {skills.map(skill => (
            <div
              key={skill.id}
              style={{
                backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '16px', transition: 'all 0.2s', cursor: 'pointer', position: 'relative',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = skill.color || t.violet;
                e.currentTarget.style.boxShadow = `0 4px 20px ${(skill.color || t.violet)}15`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
              onClick={() => handleOpenDrawer(skill)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: skill.color || t.violet, flexShrink: 0 }} />
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>{skill.name}</span>
                </div>
                <span style={{
                  backgroundColor: `${(skill.color || t.violet)}20`, color: skill.color || t.violet,
                  padding: '2px 8px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                  textTransform: 'uppercase', flexShrink: 0,
                }}>
                  {skill.category || 'general'}
                </span>
              </div>

              <p style={{
                color: t.ts, fontSize: '12px', lineHeight: '1.5', margin: '0 0 14px 0',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                minHeight: '36px',
              }}>
                {skill.description || 'No description provided.'}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: t.tm, fontSize: '11px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={11} />
                    <span>{skill.agent_count || 0} agent{(skill.agent_count || 0) !== 1 ? 's' : ''}</span>
                  </div>
                  {skill.total_files > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: t.violet }}>
                      <FileText size={11} />
                      <span>{skill.total_files} file{skill.total_files !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '2px' }} onClick={e => e.stopPropagation()}>
                  {skill.total_files > 0 && (
                    <button onClick={() => navigate(`/skills/${skill.id}/edit`)} style={{ ...iconBtnStyle, color: t.violet }} title="Edit in Editor"><FileText size={13} /></button>
                  )}
                  <button onClick={() => handleOpenAssign(skill)} style={iconBtnStyle} title="Assign to Agents"><UserPlus size={13} /></button>
                  <button onClick={() => handleOpenEdit(skill)} style={iconBtnStyle} title="Edit"><Edit2 size={13} /></button>
                  <button onClick={() => handleDelete(skill.id)} style={{ ...iconBtnStyle, color: t.danger }} title="Delete"><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div style={modalOverlayStyle} onClick={() => setIsModalOpen(false)}>
          <div style={{ ...modalContentStyle, width: '500px' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0 }}>{editMode ? 'Edit Skill' : 'Create New Skill'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Name</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. Code Reviewer"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  onFocus={e => e.target.style.borderColor = t.violet}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Category</label>
                  <input
                    style={inputStyle}
                    placeholder="general"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    onFocus={e => e.target.style.borderColor = t.violet}
                    onBlur={e => e.target.style.borderColor = t.border}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Color</label>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', paddingTop: '2px' }}>
                    {PRESET_COLORS.map(c => (
                      <div
                        key={c}
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{
                          width: '22px', height: '22px', borderRadius: '4px', cursor: 'pointer',
                          backgroundColor: c,
                          border: formData.color === c ? '2px solid #fff' : '2px solid transparent',
                          transition: 'border-color 0.15s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '50px', resize: 'vertical' }}
                  placeholder="Briefly describe what this skill does..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  onFocus={e => e.target.style.borderColor = t.violet}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
              </div>
              <div>
                <label style={labelStyle}>Prompt / Instructions</label>
                <textarea
                  style={{ ...inputStyle, minHeight: '120px', fontFamily: t.mono, fontSize: '12px', resize: 'vertical' }}
                  placeholder="The actual instructions or prompt snippet for this skill..."
                  value={formData.prompt}
                  onChange={e => setFormData({ ...formData, prompt: e.target.value })}
                  onFocus={e => e.target.style.borderColor = t.violet}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setIsModalOpen(false)} style={btnSecStyle}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnPriStyle, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : editMode ? 'Save Changes' : 'Create Skill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {isAssignOpen && activeSkill && (
        <div style={modalOverlayStyle} onClick={() => setIsAssignOpen(false)}>
          <div style={{ ...modalContentStyle, width: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: '600', margin: '0 0 2px 0' }}>Assign to Agents</h2>
                <span style={{ fontSize: '11px', color: t.tm }}>{activeSkill.name}</span>
              </div>
              <button onClick={() => setIsAssignOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>
            <div style={{ padding: '14px' }}>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
                <input
                  style={{ ...inputStyle, paddingLeft: '30px', fontSize: '12px' }}
                  placeholder="Search agents..."
                  value={assignSearch}
                  onChange={e => setAssignSearch(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: `1px solid ${t.border}`, borderRadius: '6px' }}>
                {agents
                  .filter(a => a.name.toLowerCase().includes(assignSearch.toLowerCase()))
                  .map(agent => {
                    const selected = selectedAgents.includes(agent.name);
                    return (
                      <div
                        key={agent.name}
                        onClick={() => {
                          setSelectedAgents(prev =>
                            selected ? prev.filter(n => n !== agent.name) : [...prev, agent.name]
                          );
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px',
                          cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
                          backgroundColor: selected ? t.violetG : 'transparent',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <div style={{
                          width: '16px', height: '16px', borderRadius: '3px',
                          border: `1.5px solid ${selected ? t.violet : t.tm}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: selected ? t.violet : 'transparent',
                          transition: 'all 0.15s', flexShrink: 0,
                        }}>
                          {selected && <Check size={10} color="#fff" />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '500' }}>{agent.name}</div>
                          {agent.category && (
                            <div style={{ fontSize: '10px', color: t.tm }}>{agent.category}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
              <div style={{ fontSize: '11px', color: t.tm, marginTop: '8px' }}>
                {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} selected
              </div>
            </div>
            <div style={modalFooterStyle}>
              <button onClick={() => setIsAssignOpen(false)} style={btnSecStyle}>Cancel</button>
              <button
                onClick={handleBulkAssign}
                disabled={selectedAgents.length === 0}
                style={{ ...btnPriStyle, opacity: selectedAgents.length === 0 ? 0.5 : 1 }}
              >
                Assign {selectedAgents.length} Agent{selectedAgents.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {isDrawerOpen && activeSkill && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }}
            onClick={() => setIsDrawerOpen(false)}
          />
          <div style={{
            position: 'fixed', top: 0, right: 0, width: '450px', height: '100vh',
            backgroundColor: t.surface, borderLeft: `1px solid ${t.border}`, zIndex: 100,
            display: 'flex', flexDirection: 'column', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          }}>
            <div style={{ ...modalHeaderStyle, borderBottom: `1px solid ${t.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: activeSkill.color || t.violet }} />
                <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{activeSkill.name}</h2>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} style={closeBtnStyle}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px', flex: 1, overflowY: 'auto' }}>
              {/* Category + Color */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <span style={{
                  backgroundColor: `${(activeSkill.color || t.violet)}20`, color: activeSkill.color || t.violet,
                  padding: '3px 10px', borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                  textTransform: 'uppercase',
                }}>
                  {activeSkill.category || 'general'}
                </span>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '20px' }}>
                <h3 style={sectionHeaderStyle}>Description</h3>
                <p style={{ color: t.ts, fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
                  {activeSkill.description || 'No description.'}
                </p>
              </div>

              {/* Prompt */}
              {activeSkill.prompt && (
                <div style={{ marginBottom: '20px' }}>
                  <h3 style={sectionHeaderStyle}>Prompt / Instructions</h3>
                  <div style={{
                    backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
                    padding: '12px', fontFamily: t.mono, fontSize: '11px', color: t.ts,
                    whiteSpace: 'pre-wrap', lineHeight: '1.6', maxHeight: '250px', overflowY: 'auto',
                  }}>
                    {activeSkill.prompt}
                  </div>
                </div>
              )}

              {/* Assigned Agents */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h3 style={{ ...sectionHeaderStyle, margin: 0 }}>
                    Assigned Agents ({(activeSkill.agents || []).length})
                  </h3>
                  <button
                    onClick={() => handleOpenAssign(activeSkill)}
                    style={{
                      background: 'none', border: 'none', color: t.violet, fontSize: '11px',
                      display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontWeight: '500',
                    }}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(activeSkill.agents || []).length === 0 ? (
                    <div style={{
                      padding: '24px', textAlign: 'center', color: t.tm, fontSize: '12px',
                      border: `1px dashed ${t.border}`, borderRadius: '6px',
                    }}>
                      No agents assigned yet
                    </div>
                  ) : (
                    (activeSkill.agents || []).map(agent => (
                      <div key={agent.name} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 10px', backgroundColor: t.surfaceEl, borderRadius: '6px',
                        border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={12} style={{ color: t.tm }} />
                          <span style={{ fontSize: '12px', fontWeight: '500' }}>{agent.name}</span>
                          {agent.category && (
                            <span style={{ fontSize: '9px', color: t.tm, padding: '1px 5px', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '100px' }}>
                              {agent.category}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleUnassign(agent.name)}
                          style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex' }}
                          title="Unassign"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: `1px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button onClick={() => { setIsDrawerOpen(false); navigate(`/skills/${activeSkill.id}/edit`); }} style={{
                width: '100%', padding: '8px', borderRadius: '4px',
                backgroundColor: t.violetM, color: t.violet, border: `1px solid rgba(139,92,246,0.3)`,
                fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}>
                <Sparkles size={13} /> Open in Editor
              </button>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleOpenEdit(activeSkill)} style={{ ...btnSecStyle, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(activeSkill.id)} style={{
                  ...btnSecStyle, color: t.danger, borderColor: `${t.danger}33`, flex: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error Toast */}
      {error && (
        <div style={{
          position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: t.danger, color: '#fff', padding: '10px 20px', borderRadius: '6px',
          display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.4)', zIndex: 200, fontSize: '13px',
        }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .skills-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .skills-header { flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
          .skills-search-row { flex-direction: column !important; }
          .skills-search-row > div:last-child { min-width: 0 !important; width: 100% !important; }
          .skills-grid { grid-template-columns: 1fr !important; }
          .skills-modal-content { width: 95vw !important; max-width: 95vw !important; }
          .skills-drawer {
            width: 100vw !important;
            border-left: none !important;
          }
        }
        @media (max-width: 480px) {
          .skills-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// Style constants
const modalOverlayStyle = {
  position: 'fixed', inset: 0,
  backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
};

const modalContentStyle = {
  backgroundColor: t.surface, border: `1px solid ${t.border}`,
  borderRadius: '8px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', overflow: 'hidden',
};

const modalHeaderStyle = {
  padding: '14px 20px', borderBottom: `1px solid ${t.border}`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

const modalFooterStyle = {
  padding: '12px 20px', borderTop: `1px solid ${t.border}`,
  display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: t.surfaceEl,
};

const btnPriStyle = {
  backgroundColor: t.tp, color: t.bg, border: 'none',
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px',
  fontWeight: '600', cursor: 'pointer',
};

const btnSecStyle = {
  backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
  borderRadius: '4px', padding: '8px 16px', fontSize: '12px',
  fontWeight: '500', cursor: 'pointer',
};

const iconBtnStyle = {
  background: 'none', border: 'none', color: t.ts, padding: '5px',
  borderRadius: '4px', cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.15s',
};

const labelStyle = {
  display: 'block', fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
  color: t.tm, marginBottom: '6px', letterSpacing: '0.05em',
};

const sectionHeaderStyle = {
  fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
  color: t.tm, letterSpacing: '0.08em', marginBottom: '10px',
};

const closeBtnStyle = {
  background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex',
};
