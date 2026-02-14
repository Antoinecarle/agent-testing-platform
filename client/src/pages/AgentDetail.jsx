import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Star, Edit3, Trash2, ExternalLink, Plus, Clock, Calendar, Download, Copy, Package, ChevronLeft, ChevronRight, Eye, ArrowUp, ArrowDown, X, Zap, Rocket, Globe, Key, BarChart3, Pause, Play, Trash } from 'lucide-react';
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

function formatTokenCount(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

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

export default function AgentDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const [agent, setAgent] = useState(null);
  const [projects, setProjects] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Skills
  const [agentSkills, setAgentSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [showSkillPicker, setShowSkillPicker] = useState(false);

  // Showcase management
  const [showcases, setShowcases] = useState([]);
  const [iterationsByProject, setIterationsByProject] = useState({});
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [filterByAgent, setFilterByAgent] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectIterations, setProjectIterations] = useState({});
  const [newShowcase, setNewShowcase] = useState({ project_id: '', iteration_id: '', title: '', description: '' });

  // MCP Deployment
  const [deployment, setDeployment] = useState(null);
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployApiKey, setDeployApiKey] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api(`/api/agents/${name}`),
      api(`/api/agents/${name}/projects`),
      api('/api/categories'),
      api(`/api/marketplace/${name}`), // Get showcases
    ]).then(async ([a, p, c, marketplaceData]) => {
      setAgent(a);
      setProjects(p || []);
      setCategories(c || []);
      setShowcases(marketplaceData.showcases || []);

      // Load skills for this agent
      try {
        const skills = await api(`/api/skills/agent/${name}`);
        setAgentSkills(skills || []);
      } catch (err) { console.error('Failed to load agent skills:', err); }

      // Load MCP deployment status
      try {
        const dep = await api(`/api/agent-deploy/${name}/deployment`);
        setDeployment(dep);
      } catch (err) { /* Not deployed yet */ }

      // Load iterations for all projects
      const projectsList = (p || []).slice(0, 20);
      const itersByProj = {};
      await Promise.all(projectsList.map(async (proj) => {
        try {
          const iters = await api(`/api/iterations/${proj.id}`);
          if (iters && iters.length > 0) itersByProj[proj.id] = iters;
        } catch (err) {
          console.error(`Failed to load iterations for project ${proj.id}:`, err);
        }
      }));
      setIterationsByProject(itersByProj);
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
      // Reload showcases
      const marketplaceData = await api(`/api/marketplace/${name}`);
      setShowcases(marketplaceData.showcases || []);
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

  // MCP Deployment handlers
  const handleDeploy = async () => {
    setDeployLoading(true);
    try {
      const result = await api(`/api/agent-deploy/${name}/deploy`, {
        method: 'POST',
        body: JSON.stringify({ tier: 'starter' }),
      });
      setDeployment(result.deployment);
      setDeployApiKey(result.apiKey);
      setShowApiKey(true);
    } catch (err) {
      alert(err.message || 'Deploy failed');
    } finally {
      setDeployLoading(false);
    }
  };

  const handleUndeploy = async () => {
    if (!window.confirm('Undeploy this MCP server? API keys will be revoked.')) return;
    setDeployLoading(true);
    try {
      await api(`/api/agent-deploy/${name}/deployment`, { method: 'DELETE' });
      setDeployment(null);
      setDeployApiKey(null);
    } catch (err) {
      alert(err.message || 'Undeploy failed');
    } finally {
      setDeployLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!deployment) return;
    const newStatus = deployment.status === 'active' ? 'paused' : 'active';
    try {
      await api(`/api/agent-deploy/${name}/deployment`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      setDeployment(prev => ({ ...prev, status: newStatus }));
    } catch (err) {
      alert(err.message || 'Status update failed');
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
      await api(`/api/marketplace/${name}/showcases`, {
        method: 'POST', body: JSON.stringify(newShowcase),
      });
      // Reload showcases
      const marketplaceData = await api(`/api/marketplace/${name}`);
      setShowcases(marketplaceData.showcases || []);
      setIsAddModalOpen(false);
      setSelectedProject(null);
      setNewShowcase({ project_id: '', iteration_id: '', title: '', description: '' });
    } catch (err) {
      console.error(err);
      alert(err.message || 'Failed to add showcase');
    }
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
    <div style={{ minHeight: '100vh', backgroundColor: t.bg, color: t.tp, overflowY: 'auto' }}>
      {/* Back nav */}
      <div className="agent-detail-breadcrumb" style={{ padding: '16px 32px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: `1px solid ${t.border}` }}>
        <Link to="/agents" style={{ color: t.tm, display: 'flex', textDecoration: 'none' }}><ArrowLeft size={18} /></Link>
        <span style={{ fontSize: '12px', color: t.tm }}>Agents</span>
        <span style={{ fontSize: '12px', color: t.tm }}>/</span>
        <span style={{ fontSize: '12px', color: t.ts }}>{name}</span>
      </div>

      {/* Header Card */}
      <div className="agent-detail-header" style={{ margin: '0', padding: '32px', borderRadius: '0', border: 'none', borderBottom: `1px solid ${t.border}`,
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
        <div className="agent-detail-actions" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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
          {deployment ? (
            <a href={`/mcp/${deployment.slug}`} target="_blank" rel="noopener noreferrer" style={{
              backgroundColor: 'rgba(34,197,94,0.1)', color: t.success, border: 'none',
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none',
            }}>
              <Globe size={13} />View MCP
            </a>
          ) : (
            <button onClick={handleDeploy} disabled={deployLoading} style={{
              backgroundColor: t.violetM, color: t.violet, border: 'none',
              padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px',
              cursor: deployLoading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              <Rocket size={13} />{deployLoading ? 'Deploying...' : 'Deploy MCP'}
            </button>
          )}
          <button onClick={() => setMgmtOpen(!mgmtOpen)} style={{
            backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
            padding: '8px 16px', fontSize: '12px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <Package size={13} />{mgmtOpen ? 'Hide Showcases' : 'Manage Showcases'}
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

      {/* Showcase Management Panel */}
      {mgmtOpen && (
        <div style={{ margin: '0 24px 24px', padding: '24px', borderRadius: '12px', border: `1px solid ${t.violet}40`,
          background: t.surface }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: t.ts }}>{showcases.length} / 6 showcases</span>
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
                {isDragOver ? '🎯 Drop iteration here to add to showcase' : 'No showcases added yet. Drag & drop iterations below!'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Showcase Gallery */}
      {showcases.length > 0 && (
        <div style={{ margin: '0 24px 24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} style={{ color: t.violet }} /> Showcase Gallery
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {showcases.map(s => (
              <ShowcaseCard key={s.id} showcase={s} onClick={setSelectedShowcase} />
            ))}
          </div>
        </div>
      )}

      {/* Iteration Browser */}
      {Object.keys(iterationsByProject).length > 0 && (
        <div style={{ margin: '0 24px 24px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={16} style={{ color: t.violet }} /> Iteration Browser
          </h3>
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
        </div>
      )}

      {/* Content: 2 columns */}
      <div className="agent-detail-content" style={{ display: 'flex', padding: '0 24px 24px', gap: '24px', flexWrap: 'wrap' }}>
        {/* LEFT: Prompt + Version History */}
        <div className="agent-detail-left" style={{ width: '65%', minWidth: '300px', flex: '1 1 400px' }}>
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
        <div className="agent-detail-right" style={{ width: '35%', minWidth: '280px', flex: '1 1 280px' }}>
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

          {/* Skills Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={14} style={{ color: t.violet }} />
                Skills
                <span style={{ fontSize: '10px', color: t.tm, fontWeight: '400', backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                  {agentSkills.length}
                </span>
              </h2>
              <button onClick={async () => {
                try {
                  const all = await api('/api/skills');
                  setAllSkills(all || []);
                  setShowSkillPicker(true);
                } catch (e) { console.error(e); }
              }} style={{
                backgroundColor: t.violetM, color: t.violet, border: 'none',
                padding: '5px 10px', fontSize: '11px', fontWeight: '600', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Plus size={12} />Add
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {agentSkills.map(skill => (
                <div key={skill.id} style={{
                  backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                  padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = skill.color || t.violet}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: skill.color || t.violet }} />
                    <span style={{ fontSize: '12px', fontWeight: '500' }}>{skill.name}</span>
                    <span style={{
                      fontSize: '9px', color: t.tm, padding: '1px 6px', borderRadius: '100px',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                    }}>{skill.category || 'general'}</span>
                  </div>
                  <button onClick={async () => {
                    try {
                      await api(`/api/skills/${skill.id}/unassign/${name}`, { method: 'DELETE' });
                      setAgentSkills(prev => prev.filter(s => s.id !== skill.id));
                    } catch (e) { console.error(e); }
                  }} style={{
                    background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px', display: 'flex',
                  }} title="Remove skill">
                    <X size={13} />
                  </button>
                </div>
              ))}
              {agentSkills.length === 0 && (
                <div style={{
                  padding: '24px 14px', textAlign: 'center', borderRadius: '8px',
                  border: `1px dashed ${t.borderS}`, color: t.tm, fontSize: '11px',
                }}>
                  No skills assigned
                </div>
              )}
            </div>
          </div>

          {/* MCP Deployment Section */}
          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Rocket size={14} style={{ color: t.violet }} />
                MCP Deploy
                {deployment && (
                  <span style={{
                    fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', padding: '2px 8px', borderRadius: '100px',
                    backgroundColor: deployment.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: deployment.status === 'active' ? t.success : t.warning,
                  }}>
                    {deployment.status}
                  </span>
                )}
              </h2>
            </div>

            {!deployment ? (
              <div style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                padding: '20px', textAlign: 'center',
              }}>
                <Globe size={24} style={{ color: t.tm, marginBottom: '8px' }} />
                <p style={{ fontSize: '12px', color: t.tm, marginBottom: '14px' }}>
                  Deploy this agent as an MCP server with its own landing page & API
                </p>
                <button
                  onClick={handleDeploy}
                  disabled={deployLoading}
                  style={{
                    backgroundColor: t.violet, color: '#fff', border: 'none',
                    padding: '8px 20px', fontSize: '12px', fontWeight: '600', borderRadius: '6px',
                    cursor: deployLoading ? 'wait' : 'pointer', display: 'inline-flex',
                    alignItems: 'center', gap: '6px', opacity: deployLoading ? 0.6 : 1,
                  }}
                >
                  <Rocket size={13} />{deployLoading ? 'Deploying...' : 'Deploy as MCP'}
                </button>
              </div>
            ) : (
              <div style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                overflow: 'hidden',
              }}>
                {/* Landing Page Link */}
                <a
                  href={`/mcp/${deployment.slug}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 14px', borderBottom: `1px solid ${t.border}`,
                    textDecoration: 'none', color: t.tp, fontSize: '12px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surfaceEl}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Globe size={13} style={{ color: t.violet }} />
                  <span style={{ fontFamily: t.mono, fontSize: '11px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    /mcp/{deployment.slug}
                  </span>
                  <ExternalLink size={11} style={{ color: t.tm }} />
                </a>

                {/* API Endpoint */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderBottom: `1px solid ${t.border}`,
                  fontSize: '11px',
                }}>
                  <Key size={12} style={{ color: t.violet }} />
                  <span style={{ fontFamily: t.mono, color: t.ts, flex: 1 }}>
                    /mcp/{deployment.slug}/api/chat
                  </span>
                </div>

                {/* API Key Display (only shown once after deploy) */}
                {showApiKey && deployApiKey && (
                  <div style={{
                    padding: '10px 14px', borderBottom: `1px solid ${t.border}`,
                    background: 'rgba(139,92,246,0.05)',
                  }}>
                    <div style={{ fontSize: '10px', color: t.warning, fontWeight: '600', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Key size={10} /> Save your API key (shown only once)
                    </div>
                    <div style={{
                      fontFamily: t.mono, fontSize: '10px', color: t.tp,
                      background: 'rgba(0,0,0,0.3)', padding: '6px 8px', borderRadius: '4px',
                      wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <span style={{ flex: 1 }}>{deployApiKey}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(deployApiKey);
                        }}
                        style={{
                          background: 'none', border: 'none', color: t.violet,
                          cursor: 'pointer', padding: '2px', display: 'flex', flexShrink: 0,
                        }}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Token Usage Bar */}
                {deployment.monthlyUsage !== undefined && (
                  <div style={{ padding: '12px 14px', borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <BarChart3 size={10} /> Monthly Tokens
                      </span>
                      <span style={{ fontSize: '10px', fontFamily: t.mono, color: t.ts }}>
                        {formatTokenCount(deployment.monthlyUsage)} / {formatTokenCount(deployment.monthly_token_limit)}
                      </span>
                    </div>
                    <div style={{
                      height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px',
                      overflow: 'hidden',
                    }}>
                      <div style={{
                        height: '100%', borderRadius: '3px',
                        width: `${Math.min(((deployment.monthlyUsage || 0) / (deployment.monthly_token_limit || 1)) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${t.violet}, ${t.violet}cc)`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>
                )}

                {/* Stats Row */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                  borderBottom: `1px solid ${t.border}`,
                }}>
                  <div style={{ padding: '10px 14px', textAlign: 'center', borderRight: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: t.mono }}>{deployment.total_requests || 0}</div>
                    <div style={{ fontSize: '9px', color: t.tm, marginTop: '2px' }}>Requests</div>
                  </div>
                  <div style={{ padding: '10px 14px', textAlign: 'center', borderRight: `1px solid ${t.border}` }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: t.mono }}>{formatTokenCount(deployment.total_input_tokens || 0)}</div>
                    <div style={{ fontSize: '9px', color: t.tm, marginTop: '2px' }}>Input</div>
                  </div>
                  <div style={{ padding: '10px 14px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: '700', fontFamily: t.mono }}>{formatTokenCount(deployment.total_output_tokens || 0)}</div>
                    <div style={{ fontSize: '9px', color: t.tm, marginTop: '2px' }}>Output</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ padding: '10px 14px', display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleToggleStatus}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      padding: '6px', fontSize: '10px', fontWeight: '600', borderRadius: '4px',
                      backgroundColor: deployment.status === 'active' ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)',
                      color: deployment.status === 'active' ? t.warning : t.success,
                      border: 'none', cursor: 'pointer',
                    }}
                  >
                    {deployment.status === 'active' ? <><Pause size={10} />Pause</> : <><Play size={10} />Resume</>}
                  </button>
                  <button
                    onClick={handleUndeploy}
                    disabled={deployLoading}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                      padding: '6px', fontSize: '10px', fontWeight: '600', borderRadius: '4px',
                      backgroundColor: 'rgba(239,68,68,0.1)', color: t.danger,
                      border: 'none', cursor: deployLoading ? 'wait' : 'pointer',
                    }}
                  >
                    <Trash size={10} />Undeploy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Skill Picker Modal */}
          {showSkillPicker && (
            <div style={{
              position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            }} onClick={() => setShowSkillPicker(false)}>
              <div style={{
                background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '8px',
                width: '400px', maxHeight: '500px', overflow: 'hidden',
              }} onClick={e => e.stopPropagation()}>
                <div style={{
                  padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <h3 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>Add Skills</h3>
                  <button onClick={() => setShowSkillPicker(false)}
                    style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                  {allSkills
                    .filter(s => !agentSkills.find(as => as.id === s.id))
                    .map(skill => (
                      <div key={skill.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: '6px', cursor: 'pointer',
                        transition: 'background-color 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = t.surfaceEl}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: skill.color || t.violet }} />
                          <span style={{ fontSize: '12px', fontWeight: '500' }}>{skill.name}</span>
                          <span style={{ fontSize: '9px', color: t.tm }}>{skill.category}</span>
                        </div>
                        <button onClick={async () => {
                          try {
                            await api(`/api/skills/${skill.id}/assign/${name}`, { method: 'POST' });
                            setAgentSkills(prev => [...prev, skill]);
                            setAllSkills(prev => prev.filter(s => s.id !== skill.id));
                          } catch (e) { console.error(e); }
                        }} style={{
                          backgroundColor: t.violetM, color: t.violet, border: 'none', borderRadius: '4px',
                          padding: '4px 10px', fontSize: '10px', fontWeight: '600', cursor: 'pointer',
                        }}>
                          Add
                        </button>
                      </div>
                    ))}
                  {allSkills.filter(s => !agentSkills.find(as => as.id === s.id)).length === 0 && (
                    <div style={{ padding: '30px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                      No more skills available
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedShowcase.title}</span>
              <span style={{ fontSize: '12px', color: t.tm, whiteSpace: 'nowrap' }}>{selectedShowcase.project_name} v{selectedShowcase.iteration_version}</span>
            </div>
            <button
              onClick={() => setSelectedShowcase(null)}
              style={{
                background: t.surfaceEl, border: 'none', color: t.tp,
                width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
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

      <style>{`
        @media (max-width: 768px) {
          .agent-detail-breadcrumb { padding: 12px 16px !important; }
          .agent-detail-header { padding: 20px 16px !important; }
          .agent-detail-content { padding: 0 16px 16px !important; flex-direction: column; }
          .agent-detail-left, .agent-detail-right { width: 100% !important; min-width: 0 !important; }
          .agent-detail-actions button { padding: 6px 10px !important; font-size: 11px !important; }
        }
      `}</style>
    </div>
  );
}
