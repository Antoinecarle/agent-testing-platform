import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Download, Star, ChevronRight, ChevronLeft, X, Plus, Trash2,
  ArrowUp, ArrowDown, Eye, ChevronDown, User, Package, Play, Code
} from 'lucide-react';
import { api, getToken } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

function ShowcaseCard({ showcase, onClick }) {
  const previewUrl = `/api/preview/${showcase.project_id}/${showcase.iteration_id}`;

  return (
    <div
      onClick={() => onClick(showcase)}
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
        overflow: 'hidden', cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.violet;
        e.currentTarget.style.boxShadow = `0 10px 30px -10px ${t.violet}30`;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '62.5%', background: '#000', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '400%', height: '400%',
          transform: 'scale(0.25)', transformOrigin: 'top left', pointerEvents: 'none',
        }}>
          <iframe src={previewUrl} style={{ width: '100%', height: '100%', border: 'none' }} title={showcase.title} />
        </div>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 60%, rgba(0,0,0,0.8))',
          display: 'flex', alignItems: 'flex-end', padding: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <Play size={12} fill="currentColor" />
            <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase' }}>Preview</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '12px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: t.tp, marginBottom: '4px' }}>
          {showcase.title || 'Untitled'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: t.ts }}>{showcase.project_name}</span>
          <span style={{ color: t.tm }}>·</span>
          <span style={{ fontSize: '11px', color: t.tm }}>v{showcase.iteration_version}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectIterationCarousel({ iterations, projectId, projectName, onSelectIteration }) {
  const scrollRef = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeft(scrollLeft > 10);
      setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [iterations]);

  const scroll = (dir) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' });
    }
  };

  if (!iterations || iterations.length === 0) return null;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Package size={14} style={{ color: t.tm }} />
        <span style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>{projectName}</span>
        <span style={{ fontSize: '11px', color: t.tm }}>{iterations.length} version{iterations.length > 1 ? 's' : ''}</span>
      </div>
      <div style={{ position: 'relative' }}>
        {showLeft && (
          <button onClick={() => scroll('left')} style={{
            position: 'absolute', left: '-4px', top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: t.surfaceEl, border: `1px solid ${t.borderS}`,
            borderRadius: '50%', width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <ChevronLeft size={16} />
          </button>
        )}
        <div ref={scrollRef} onScroll={checkScroll} style={{
          display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none',
          msOverflowStyle: 'none', padding: '4px 0', scrollBehavior: 'smooth',
        }}>
          {iterations.map((iter) => (
            <div key={iter.id} onClick={() => onSelectIteration(iter, projectId, projectName)} style={{
              flex: '0 0 180px', cursor: 'pointer', transition: 'transform 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                width: '180px', height: '101px', borderRadius: '6px', overflow: 'hidden',
                border: `1px solid ${t.border}`, background: '#000', position: 'relative',
                transition: 'border-color 0.2s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
              >
                <div style={{
                  width: '1440px', height: '810px', transform: 'scale(0.125)',
                  transformOrigin: 'top left', pointerEvents: 'none',
                }}>
                  <iframe src={`/api/preview/${projectId}/${iter.id}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={`Preview V${iter.version}`} loading="lazy" sandbox="allow-same-origin" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px 0' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: t.ts }}>
                  {iter.title || `V${iter.version}`}
                </span>
                <span style={{
                  fontSize: '9px', padding: '1px 5px', borderRadius: '10px',
                  background: t.surfaceEl, border: `1px solid ${t.border}`, color: t.tm,
                }}>v{iter.version}</span>
              </div>
            </div>
          ))}
        </div>
        {showRight && (
          <button onClick={() => scroll('right')} style={{
            position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: t.surfaceEl, border: `1px solid ${t.borderS}`,
            borderRadius: '50%', width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function MarketplaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [user, setUser] = useState(null);
  const [showcases, setShowcases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [iterationsByProject, setIterationsByProject] = useState({});
  const [loading, setLoading] = useState(true);
  const [promptOpen, setPromptOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState(null);

  // Management
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [availableIterations, setAvailableIterations] = useState([]);
  const [newShowcase, setNewShowcase] = useState({ project_id: '', iteration_id: '', title: '', description: '' });

  useEffect(() => { loadData(); }, [name]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentData, userData] = await Promise.all([
        api(`/api/marketplace/${name}`),
        api('/api/user/me'),
      ]);
      setAgent(agentData);
      setShowcases(agentData.showcases || []);
      setProjects(agentData.projects || []);
      setIterationsByProject(agentData.iterations_by_project || {});
      setUser(userData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isCreator = agent && user && (agent.created_by === user.id || user.role === 'admin');

  const handleDownload = async () => {
    try {
      const token = getToken();
      const res = await fetch(`/api/marketplace/${encodeURIComponent(name)}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleReorder = async (id, direction) => {
    const idx = showcases.findIndex(s => s.id === id);
    if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === showcases.length - 1)) return;
    const newOrder = [...showcases];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    [newOrder[idx], newOrder[targetIdx]] = [newOrder[targetIdx], newOrder[idx]];
    setShowcases(newOrder);
    await api(`/api/marketplace/${name}/showcases/reorder`, {
      method: 'PUT', body: JSON.stringify({ ids: newOrder.map(s => s.id) }),
    });
  };

  const handleDeleteShowcase = async (id) => {
    if (!window.confirm('Remove this showcase?')) return;
    await api(`/api/marketplace/${name}/showcases/${id}`, { method: 'DELETE' });
    setShowcases(showcases.filter(s => s.id !== id));
  };

  const handleProjectSelect = async (projectId) => {
    setNewShowcase({ ...newShowcase, project_id: projectId, iteration_id: '' });
    try {
      const iterations = await api(`/api/iterations/${projectId}`);
      setAvailableIterations(iterations || []);
    } catch (err) {
      console.error(err);
      setAvailableIterations([]);
    }
  };

  const openAddModal = async () => {
    try {
      const allProjects = await api('/api/projects');
      setAvailableProjects(allProjects || []);
    } catch (err) {
      console.error(err);
    }
    setIsAddModalOpen(true);
  };

  const handleAddShowcase = async () => {
    if (!newShowcase.project_id || !newShowcase.iteration_id || !newShowcase.title) return;
    try {
      const result = await api(`/api/marketplace/${name}/showcases`, {
        method: 'POST', body: JSON.stringify(newShowcase),
      });
      await loadData();
      setIsAddModalOpen(false);
      setNewShowcase({ project_id: '', iteration_id: '', title: '', description: '' });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to add showcase');
    }
  };

  if (loading) return (
    <div style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: t.tm, fontSize: '14px' }}>Loading...</div>
    </div>
  );

  if (!agent) return (
    <div style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.ts }}>
      Agent not found.
    </div>
  );

  const formatName = (str) => str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return (
    <div style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', color: t.tp, padding: '40px 20px' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <Link to="/marketplace" style={{ fontSize: '12px', color: t.tm, textDecoration: 'none' }}>Marketplace</Link>
          <ChevronRight size={14} style={{ color: t.tm }} />
          <span style={{ fontSize: '12px', color: t.ts }}>{formatName(agent.name)}</span>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px', gap: '40px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.02em', margin: 0 }}>
                {formatName(agent.name)}
              </h1>
              <span style={{
                display: 'inline-flex', padding: '2px 8px', borderRadius: '100px',
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                background: t.violetM, color: t.violet, border: `1px solid ${t.violet}40`,
              }}>{agent.category}</span>
              <span style={{
                display: 'inline-flex', padding: '2px 8px', borderRadius: '100px',
                fontSize: '10px', fontWeight: '600', textTransform: 'uppercase',
                background: `${t.ts}20`, color: t.ts, border: `1px solid ${t.ts}40`,
              }}>{agent.model || 'unknown'}</span>
            </div>

            <p style={{ fontSize: '15px', lineHeight: '1.6', color: t.ts, marginBottom: '24px', maxWidth: '700px' }}>
              {agent.description}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%', background: t.surfaceEl,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`,
                }}>
                  <User size={16} style={{ color: t.ts }} />
                </div>
                <div>
                  <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase' }}>Created By</div>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{agent.creator?.display_name || 'Platform'}</div>
                </div>
              </div>

              <div style={{ width: '1px', height: '24px', background: t.border }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} size={14}
                      fill={i <= (agent.rating || 0) ? t.warning : 'none'}
                      stroke={i <= (agent.rating || 0) ? t.warning : t.tm}
                    />
                  ))}
                </div>
                <span style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{(agent.rating || 0).toFixed(1)}</span>
              </div>

              <div style={{ width: '1px', height: '24px', background: t.border }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={14} style={{ color: t.tm }} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{agent.download_count || 0}</span>
                <span style={{ fontSize: '12px', color: t.tm }}>Downloads</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button onClick={handleDownload} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px 24px', borderRadius: '4px', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer', background: t.tp, color: t.bg, border: 'none',
            }}>
              <Download size={16} /> Download Agent
            </button>
            {isCreator && (
              <button onClick={() => setMgmtOpen(!mgmtOpen)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                padding: '10px 24px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                cursor: 'pointer', background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
              }}>
                <Package size={14} /> {mgmtOpen ? 'Hide Management' : 'Manage Showcases'}
              </button>
            )}
          </div>
        </div>

        {/* Management Panel */}
        {mgmtOpen && (
          <div style={{
            background: t.surface, border: `1px solid ${t.violet}40`, borderRadius: '12px',
            padding: '24px', marginBottom: '40px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 4px 0' }}>Manage Showcases</h3>
                <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Feature projects that use this agent. Max 6 showcases.</p>
              </div>
              {showcases.length < 6 && (
                <button onClick={openAddModal} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', background: t.tp, color: t.bg, border: 'none',
                }}>
                  <Plus size={14} /> Add Showcase
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {showcases.map((s, idx) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px',
                  background: t.surfaceEl, borderRadius: '8px', border: `1px solid ${t.border}`,
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <button onClick={() => handleReorder(s.id, 'up')} disabled={idx === 0}
                      style={{ background: 'none', border: 'none', color: idx === 0 ? t.tm : t.ts, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => handleReorder(s.id, 'down')} disabled={idx === showcases.length - 1}
                      style={{ background: 'none', border: 'none', color: idx === showcases.length - 1 ? t.tm : t.ts, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                      <ArrowDown size={14} />
                    </button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.title || 'Untitled'}</div>
                    <div style={{ fontSize: '11px', color: t.tm }}>{s.project_name} · v{s.iteration_version}</div>
                  </div>
                  <button onClick={() => handleDeleteShowcase(s.id)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', background: `${t.danger}20`, color: t.danger, border: 'none',
                  }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
              {showcases.length === 0 && (
                <div style={{ padding: '40px', textAlign: 'center', border: `2px dashed ${t.border}`, borderRadius: '8px', color: t.tm }}>
                  No showcases added yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Showcase Gallery */}
        {showcases.length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Showcase Gallery</h2>
              <div style={{ height: '1px', flex: 1, background: t.border }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {showcases.map(s => (
                <ShowcaseCard key={s.id} showcase={s} onClick={setSelectedShowcase} />
              ))}
            </div>
          </section>
        )}

        {/* Iteration Browser */}
        {projects.length > 0 && Object.keys(iterationsByProject).length > 0 && (
          <section style={{ marginBottom: '60px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
              <Eye size={18} style={{ color: t.violet }} />
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Iteration Browser</h2>
              <div style={{ height: '1px', flex: 1, background: t.border }} />
            </div>
            {projects.filter(p => iterationsByProject[p.id] && iterationsByProject[p.id].length > 0).map(p => (
              <ProjectIterationCarousel
                key={p.id}
                iterations={iterationsByProject[p.id]}
                projectId={p.id}
                projectName={p.name}
                onSelectIteration={(iter, projectId, projectName) => {
                  setSelectedShowcase({
                    project_id: projectId,
                    iteration_id: iter.id,
                    title: iter.title || `V${iter.version}`,
                    project_name: projectName,
                    iteration_version: iter.version,
                  });
                }}
              />
            ))}
          </section>
        )}

        {/* Agent Prompt */}
        <section style={{ marginBottom: '60px' }}>
          <div
            onClick={() => setPromptOpen(!promptOpen)}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}
          >
            <Code size={18} style={{ color: t.violet }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Agent Prompt</h2>
            <ChevronDown size={18} style={{ color: t.tm, transform: promptOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
          {promptOpen && (
            <div style={{
              background: '#0a0a0a', border: `1px solid ${t.border}`, borderRadius: '8px',
              padding: '20px', fontFamily: t.mono, fontSize: '13px', lineHeight: '1.6',
              color: t.ts, whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto',
            }}>
              {agent.full_prompt || '[No prompt content]'}
            </div>
          )}
        </section>

        {/* Projects */}
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Projects using this Agent</h2>
            <div style={{ height: '1px', flex: 1, background: t.border }} />
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{
                padding: '8px 16px', background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center',
                gap: '8px', cursor: 'pointer', transition: 'border-color 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = t.violet}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = t.border}
              >
                <Package size={14} style={{ color: t.tm }} />
                {p.name}
              </div>
            ))}
            {projects.length === 0 && (
              <div style={{ fontSize: '14px', color: t.tm }}>No projects recorded yet.</div>
            )}
          </div>
        </section>
      </div>

      {/* Fullscreen Preview Modal */}
      {selectedShowcase && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.95)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            height: '60px', borderBottom: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>{selectedShowcase.title}</span>
              <span style={{ fontSize: '12px', color: t.tm }}>{selectedShowcase.project_name} v{selectedShowcase.iteration_version}</span>
            </div>
            <button
              onClick={() => setSelectedShowcase(null)}
              style={{
                background: t.surfaceEl, border: 'none', color: t.tp,
                width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          </div>
          <div style={{ flex: 1 }}>
            <iframe
              src={`/api/preview/${selectedShowcase.project_id}/${selectedShowcase.iteration_id}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        </div>
      )}

      {/* Add Showcase Modal */}
      {isAddModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '12px',
            width: '100%', maxWidth: '480px', padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Add to Showcase</h3>
              <button onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: t.tm, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Select Project
                </label>
                <select
                  value={newShowcase.project_id}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  style={{
                    width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    borderRadius: '6px', padding: '10px', color: t.tp, outline: 'none', boxSizing: 'border-box',
                  }}
                >
                  <option value="">Select a project...</option>
                  {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: t.tm, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Select Iteration
                </label>
                <select
                  value={newShowcase.iteration_id}
                  onChange={(e) => setNewShowcase({ ...newShowcase, iteration_id: e.target.value })}
                  disabled={!newShowcase.project_id}
                  style={{
                    width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    borderRadius: '6px', padding: '10px', color: t.tp, outline: 'none', boxSizing: 'border-box',
                    opacity: !newShowcase.project_id ? 0.5 : 1,
                  }}
                >
                  <option value="">Select iteration...</option>
                  {availableIterations.map(i => <option key={i.id} value={i.id}>v{i.version}: {i.title || 'Untitled'}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: t.tm, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                  Showcase Title
                </label>
                <input
                  type="text"
                  placeholder="E.g. Dynamic Dashboard v2"
                  value={newShowcase.title}
                  onChange={(e) => setNewShowcase({ ...newShowcase, title: e.target.value })}
                  style={{
                    width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    borderRadius: '6px', padding: '10px', color: t.tp, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button onClick={() => setIsAddModalOpen(false)} style={{
                  padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                  cursor: 'pointer', background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                }}>Cancel</button>
                <button
                  onClick={handleAddShowcase}
                  disabled={!newShowcase.iteration_id || !newShowcase.title}
                  style={{
                    padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', background: t.tp, color: t.bg, border: 'none',
                    opacity: (!newShowcase.iteration_id || !newShowcase.title) ? 0.5 : 1,
                  }}
                >Confirm Showcase</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        select option { background: ${t.surface}; color: ${t.tp}; }
      `}</style>
    </div>
  );
}
