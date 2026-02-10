import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Download, Star, ChevronRight, ChevronLeft, X, Plus, Trash2,
  ArrowUp, ArrowDown, Eye, ChevronDown, ChevronUp, User, Package, Play, Code,
  Share2, RefreshCcw, Monitor, Smartphone, Tablet
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

  const handleDragStart = (e, iter) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('application/json', JSON.stringify({
      project_id: projectId,
      iteration_id: iter.id,
      title: iter.title || `V${iter.version}`,
      project_name: projectName,
      iteration_version: iter.version,
    }));
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
            <div
              key={iter.id}
              draggable
              onDragStart={(e) => handleDragStart(e, iter)}
              onClick={() => onSelectIteration(iter, projectId, projectName)}
              style={{
                flex: '0 0 180px', cursor: 'grab', transition: 'transform 0.2s',
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [filterByAgent, setFilterByAgent] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectIterations, setProjectIterations] = useState({});

  // Preview modal state (ClientPreview-style)
  const [previewViewport, setPreviewViewport] = useState('desktop');
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const [previewBarCollapsed, setPreviewBarCollapsed] = useState(false);

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

      // Load iterations for all projects
      const itersByProj = {};
      await Promise.all((allProjects || []).map(async (p) => {
        try {
          const iters = await api(`/api/iterations/${p.id}`);
          if (iters && iters.length > 0) itersByProj[p.id] = iters;
        } catch (err) {
          console.error(`Failed to load iterations for project ${p.id}:`, err);
        }
      }));
      setProjectIterations(itersByProj);
    } catch (err) {
      console.error(err);
    }
    setFilterByAgent(true);
    setSelectedProject(null);
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

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);

    if (showcases.length >= 6) {
      alert('Maximum 6 showcases per agent');
      return;
    }

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      await api(`/api/marketplace/${name}/showcases`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await loadData();
    } catch (err) {
      console.error('Drop error:', err);
      alert(err.message || 'Failed to add showcase');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
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
                <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>
                  Feature projects that use this agent. Max 6 showcases.
                  <span style={{ display: 'block', marginTop: '4px', color: t.violet, fontWeight: '500' }}>
                    💡 Drag & drop iterations from below or click Add Showcase
                  </span>
                </p>
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

            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minHeight: showcases.length === 0 ? '120px' : 'auto',
                border: isDragOver ? `2px dashed ${t.violet}` : 'none',
                borderRadius: '8px',
                padding: isDragOver ? '8px' : '0',
                background: isDragOver ? `${t.violet}10` : 'transparent',
                transition: 'all 0.2s',
              }}
            >
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
                <div style={{
                  padding: '40px',
                  textAlign: 'center',
                  border: `2px dashed ${isDragOver ? t.violet : t.border}`,
                  borderRadius: '8px',
                  color: isDragOver ? t.violet : t.tm,
                  background: isDragOver ? `${t.violet}10` : 'transparent',
                  transition: 'all 0.2s',
                }}>
                  {isDragOver ? '🎯 Drop iteration here to add to showcase' : 'No showcases added yet. Drag & drop iterations here!'}
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

      {/* Fullscreen Preview Modal — ClientPreview-style */}
      {selectedShowcase && (() => {
        const viewportWidths = { desktop: '100%', tablet: '768px', mobile: '390px' };
        const projectIters = iterationsByProject[selectedShowcase.project_id] || [];
        const sortedIters = [...projectIters].sort((a, b) => a.version - b.version);

        const handlePreviewRefresh = () => {
          setPreviewRefreshing(true);
          setTimeout(() => setPreviewRefreshing(false), 800);
        };

        const handlePreviewShare = async () => {
          try {
            const url = `${window.location.origin}/preview/${selectedShowcase.project_id}`;
            await navigator.clipboard.writeText(url);
          } catch (_) {}
        };

        const handleIterationSelect = (iter) => {
          setSelectedShowcase({
            ...selectedShowcase,
            iteration_id: iter.id,
            title: iter.title || `V${iter.version}`,
            iteration_version: iter.version,
          });
        };

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, backgroundColor: '#050505',
            display: 'flex', flexDirection: 'column', color: t.tp,
            fontFamily: 'Inter, sans-serif',
          }}>
            {/* Close button (top-right) */}
            <button
              onClick={() => { setSelectedShowcase(null); setPreviewViewport('desktop'); setPreviewBarCollapsed(false); }}
              style={{
                position: 'absolute', top: '16px', right: '16px', zIndex: 1100,
                background: 'rgba(15,15,15,0.85)', backdropFilter: 'blur(12px)',
                border: `1px solid ${t.borderS}`, borderRadius: '10px',
                width: '36px', height: '36px', cursor: 'pointer', color: t.ts,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={16} />
            </button>

            {/* Preview Area */}
            <main style={{
              flex: 1, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {previewViewport !== 'desktop' && (
                <div style={{
                  position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
                  width: '80%', height: '40%',
                  background: `radial-gradient(circle at center, ${t.violetG} 0%, transparent 70%)`,
                  zIndex: 0, pointerEvents: 'none',
                }} />
              )}

              <div style={{
                width: viewportWidths[previewViewport],
                height: previewViewport === 'desktop' ? '100%' : 'calc(100% - 100px)',
                maxWidth: '100%',
                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                position: 'relative', zIndex: 1,
                boxShadow: previewViewport === 'desktop' ? 'none' : '0 24px 64px rgba(0,0,0,0.8)',
                borderRadius: previewViewport === 'desktop' ? '0' : '12px',
                overflow: 'hidden',
                border: previewViewport === 'desktop' ? 'none' : `1px solid ${t.borderS}`,
              }}>
                <iframe
                  key={`${selectedShowcase.iteration_id}-${previewRefreshing}`}
                  src={`/api/preview/${selectedShowcase.project_id}/${selectedShowcase.iteration_id}`}
                  style={{
                    width: '100%', height: '100%', border: 'none',
                    backgroundColor: 'white',
                    opacity: previewRefreshing ? 0.5 : 1, transition: 'opacity 0.2s',
                  }}
                  title={selectedShowcase.title}
                />
              </div>
            </main>

            {/* Bottom Control Bar */}
            <div style={{
              position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              width: previewBarCollapsed ? 'auto' : 'calc(100% - 40px)', maxWidth: previewBarCollapsed ? 'none' : '1100px',
              backgroundColor: 'rgba(15, 15, 15, 0.85)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${t.borderS}`, borderRadius: '16px',
              zIndex: 1100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
            }}>
              {previewBarCollapsed ? (
                <button onClick={() => setPreviewBarCollapsed(false)} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 16px', border: 'none', background: 'transparent',
                  cursor: 'pointer', color: t.ts,
                }}>
                  <ChevronUp size={14} />
                  <span style={{ fontFamily: t.mono, fontSize: '11px', fontWeight: 600 }}>
                    v{selectedShowcase.iteration_version || '?'}
                  </span>
                  <div style={{ width: '1px', height: '12px', backgroundColor: t.border }} />
                  <span style={{ fontSize: '10px', color: t.tm }}>{selectedShowcase.project_name}</span>
                </button>
              ) : (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Row 1: Brand + Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '14px', letterSpacing: '-0.5px' }}>guru</span>
                        <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '14px', color: t.violet }}>.ai</span>
                      </div>
                      <div style={{ width: '1px', height: '16px', backgroundColor: t.border }} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: t.tp }}>{selectedShowcase.project_name}</span>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '5px',
                        padding: '2px 8px', borderRadius: '100px',
                        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
                      }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.success }} />
                        <span style={{ fontSize: '10px', color: t.success, fontWeight: 500 }}>Live</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Viewport switcher */}
                      <div style={{
                        display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)',
                        padding: '3px', borderRadius: '8px', border: `1px solid ${t.border}`,
                      }}>
                        {[
                          { id: 'mobile', icon: <Smartphone size={13} /> },
                          { id: 'tablet', icon: <Tablet size={13} /> },
                          { id: 'desktop', icon: <Monitor size={13} /> },
                        ].map(v => (
                          <button key={v.id} onClick={() => setPreviewViewport(v.id)} style={{
                            padding: '4px 7px', borderRadius: '6px', border: 'none',
                            backgroundColor: previewViewport === v.id ? t.surfaceEl : 'transparent',
                            color: previewViewport === v.id ? t.violet : t.tm,
                            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                          }}>
                            {v.icon}
                          </button>
                        ))}
                      </div>

                      <button onClick={handlePreviewRefresh} style={{
                        padding: '6px', borderRadius: '8px', border: `1px solid ${t.border}`,
                        backgroundColor: 'transparent', color: t.ts, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <RefreshCcw size={14} style={previewRefreshing ? { animation: 'mpSpin 0.8s ease-in-out' } : {}} />
                      </button>

                      <a
                        href={`/api/preview/download/${selectedShowcase.project_id}/${selectedShowcase.iteration_id}`}
                        style={{
                          padding: '6px 12px', borderRadius: '8px',
                          backgroundColor: 'rgba(255,255,255,0.06)',
                          border: `1px solid ${t.border}`, color: t.ts, fontSize: '11px', fontWeight: 600,
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                          textDecoration: 'none',
                        }}
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>

                      <button onClick={handlePreviewShare} style={{
                        padding: '6px 12px', borderRadius: '8px', backgroundColor: t.violet,
                        border: 'none', color: 'white', fontSize: '11px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                        boxShadow: `0 0 10px ${t.violetG}`,
                      }}>
                        <Share2 size={13} />
                        <span>Share</span>
                      </button>

                      <button onClick={() => setPreviewBarCollapsed(true)} style={{
                        padding: '6px', borderRadius: '8px', border: `1px solid ${t.border}`,
                        backgroundColor: 'transparent', color: t.tm, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Iteration tabs */}
                  {sortedIters.length > 0 && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      overflowX: 'auto', paddingBottom: '2px',
                      msOverflowStyle: 'none', scrollbarWidth: 'none',
                    }}>
                      {sortedIters.map((iter) => {
                        const isActive = selectedShowcase.iteration_id === iter.id;
                        return (
                          <button
                            key={iter.id}
                            onClick={() => handleIterationSelect(iter)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '7px',
                              padding: '7px 14px', borderRadius: '10px',
                              backgroundColor: isActive ? t.violetM : 'rgba(255,255,255,0.03)',
                              border: `1px solid ${isActive ? t.violet : t.border}`,
                              cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              whiteSpace: 'nowrap', flexShrink: 0, color: isActive ? t.tp : t.ts,
                            }}
                          >
                            <div style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: iter.status === 'completed' ? t.success : iter.status === 'error' ? t.danger : t.warning,
                            }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, fontFamily: t.mono }}>
                              v{iter.version}
                            </span>
                            {iter.title && (
                              <span style={{
                                fontSize: '11px', color: isActive ? t.ts : t.tm,
                                maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {iter.title}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <style>{`@keyframes mpSpin { to { transform: rotate(360deg); } } div::-webkit-scrollbar { display: none; }`}</style>
          </div>
        );
      })()}

      {/* Add Showcase Modal - Visual Selection */}
      {isAddModalOpen && (() => {
        const filteredProjects = filterByAgent
          ? availableProjects.filter(p => p.agent === name)
          : availableProjects;

        const handleIterationClick = (project, iteration) => {
          const title = iteration.title || `${project.name} v${iteration.version}`;
          setNewShowcase({
            project_id: project.id,
            iteration_id: iteration.id,
            title: title,
            description: '',
          });
          setSelectedProject({ project, iteration, title });
        };

        const confirmShowcase = async () => {
          if (!newShowcase.project_id || !newShowcase.iteration_id) return;
          await handleAddShowcase();
          setSelectedProject(null);
        };

        return (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            overflowY: 'auto',
          }}>
            <div style={{
              background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '12px',
              width: '100%', maxWidth: '900px', padding: '24px', maxHeight: '90vh', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>Add to Showcase</h3>
                  <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Select an iteration to feature</p>
                </div>
                <button onClick={() => { setIsAddModalOpen(false); setSelectedProject(null); }}
                  style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Filter Toggle */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', padding: '4px', background: t.surfaceEl, borderRadius: '8px' }}>
                <button
                  onClick={() => setFilterByAgent(true)}
                  style={{
                    flex: 1, padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: filterByAgent ? t.violet : 'transparent',
                    color: filterByAgent ? '#fff' : t.ts,
                  }}
                >
                  This Agent ({projects.length})
                </button>
                <button
                  onClick={() => setFilterByAgent(false)}
                  style={{
                    flex: 1, padding: '8px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                    background: !filterByAgent ? t.violet : 'transparent',
                    color: !filterByAgent ? '#fff' : t.ts,
                  }}
                >
                  All Projects ({availableProjects.length})
                </button>
              </div>

              {/* Projects Grid */}
              {filteredProjects.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center', color: t.tm, fontSize: '14px' }}>
                  No projects found{filterByAgent ? ' for this agent' : ''}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {filteredProjects.map(project => {
                    const iters = projectIterations[project.id] || [];
                    if (iters.length === 0) return null;

                    return (
                      <div key={project.id} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <Package size={14} style={{ color: t.tm }} />
                          <span style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>{project.name}</span>
                          <span style={{ fontSize: '11px', color: t.tm }}>{iters.length} version{iters.length > 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
                          {iters.map(iter => {
                            const isSelected = selectedProject?.iteration.id === iter.id;
                            return (
                              <div
                                key={iter.id}
                                onClick={() => handleIterationClick(project, iter)}
                                style={{
                                  cursor: 'pointer',
                                  borderRadius: '8px',
                                  overflow: 'hidden',
                                  border: isSelected ? `2px solid ${t.violet}` : `1px solid ${t.border}`,
                                  background: t.surfaceEl,
                                  transition: 'all 0.2s',
                                  boxShadow: isSelected ? `0 0 20px ${t.violet}40` : 'none',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.borderColor = t.violet;
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.borderColor = t.border;
                                }}
                              >
                                <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000', overflow: 'hidden' }}>
                                  <div style={{
                                    position: 'absolute', top: 0, left: 0, width: '450%', height: '450%',
                                    transform: 'scale(0.222)', transformOrigin: 'top left', pointerEvents: 'none',
                                  }}>
                                    <iframe src={`/api/preview/${project.id}/${iter.id}`}
                                      style={{ width: '100%', height: '100%', border: 'none' }}
                                      title={`Preview v${iter.version}`} loading="lazy" sandbox="allow-same-origin" />
                                  </div>
                                  {isSelected && (
                                    <div style={{
                                      position: 'absolute', top: '8px', right: '8px',
                                      background: t.violet, color: '#fff', padding: '4px 8px',
                                      borderRadius: '100px', fontSize: '10px', fontWeight: '600',
                                    }}>
                                      ✓ SELECTED
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: '8px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '600', color: t.tp, marginBottom: '2px' }}>
                                    {iter.title || `Version ${iter.version}`}
                                  </div>
                                  <div style={{ fontSize: '9px', color: t.tm }}>v{iter.version}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Footer with title input and confirm */}
              {selectedProject && (
                <div style={{
                  marginTop: '24px', padding: '16px', borderRadius: '8px',
                  background: t.surfaceEl, border: `1px solid ${t.violet}40`,
                }}>
                  <label style={{ display: 'block', fontSize: '12px', color: t.tm, marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase' }}>
                    Showcase Title
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Dynamic Dashboard v2"
                    value={newShowcase.title}
                    onChange={(e) => setNewShowcase({ ...newShowcase, title: e.target.value })}
                    style={{
                      width: '100%', background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: '6px', padding: '10px', color: t.tp, outline: 'none', boxSizing: 'border-box',
                      marginBottom: '12px',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={() => setSelectedProject(null)} style={{
                      padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    }}>
                      Cancel
                    </button>
                    <button
                      onClick={confirmShowcase}
                      disabled={!newShowcase.title}
                      style={{
                        padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                        cursor: 'pointer', background: t.violet, color: '#fff', border: 'none',
                        opacity: !newShowcase.title ? 0.5 : 1,
                      }}
                    >
                      Add to Showcase
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <style>{`
        select option { background: ${t.surface}; color: ${t.tp}; }
      `}</style>
    </div>
  );
}
