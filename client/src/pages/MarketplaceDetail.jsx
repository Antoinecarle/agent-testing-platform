import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Download, Star, ChevronRight, ChevronLeft, X, Plus, Trash2,
  ArrowUp, ArrowDown, Eye, ChevronDown, ChevronUp, User, Package, Play, Code,
  Share2, RefreshCcw, Monitor, Smartphone, Tablet, GitFork, Shield, Zap,
  Lock, Copy, Check, CreditCard, FileText, Terminal, BookOpen, Coins,
  ExternalLink, Layers, TrendingUp, Key, RotateCcw, GripVertical,
  AlertCircle, CheckCircle, Settings, Hash, DollarSign
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

const ease = 'cubic-bezier(0.4, 0, 0.2, 1)';
const formatName = (str) => str.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

/* ─── Toast Notification ─── */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bg = type === 'success' ? 'rgba(34,197,94,0.15)' : type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(139,92,246,0.15)';
  const border = type === 'success' ? 'rgba(34,197,94,0.4)' : type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(139,92,246,0.4)';
  const color = type === 'success' ? t.success : type === 'error' ? t.danger : t.violet;
  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : CheckCircle;

  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, padding: '12px 24px', borderRadius: '12px',
      background: bg, backdropFilter: 'blur(20px)', border: `1px solid ${border}`,
      display: 'flex', alignItems: 'center', gap: '10px',
      animation: 'toastSlideIn 0.3s ease-out',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <Icon size={16} style={{ color, flexShrink: 0 }} />
      <span style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>{message}</span>
    </div>
  );
}

/* ─── Showcase Card ─── */
function ShowcaseCard({ showcase, onClick }) {
  const previewUrl = `/api/preview/${showcase.project_id}/${showcase.iteration_id}`;

  return (
    <div
      onClick={() => onClick(showcase)}
      style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px',
        overflow: 'hidden', cursor: 'pointer',
        transition: `all 0.3s ${ease}`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.violet;
        e.currentTarget.style.boxShadow = `0 12px 40px -10px ${t.violet}30`;
        e.currentTarget.style.transform = 'translateY(-4px)';
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
          background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.85))',
          display: 'flex', alignItems: 'flex-end', padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'rgba(139,92,246,0.3)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(139,92,246,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Play size={12} fill="currentColor" />
            </div>
            <span style={{ fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp, marginBottom: '6px' }}>
          {showcase.title || 'Untitled'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: t.ts }}>{showcase.project_name}</span>
          <span style={{ color: t.tm, fontSize: '8px' }}>|</span>
          <span style={{
            fontSize: '10px', padding: '1px 6px', borderRadius: '100px',
            background: t.surfaceEl, border: `1px solid ${t.border}`, color: t.tm,
            fontFamily: t.mono,
          }}>v{showcase.iteration_version}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Iteration Carousel ─── */
function ProjectIterationCarousel({ iterations, projectId, projectName, onSelectIteration, onDragStart }) {
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
            borderRadius: '50%', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
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
                flex: '0 0 200px', cursor: 'grab', transition: `transform 0.2s ${ease}`,
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                width: '200px', height: '112px', borderRadius: '8px', overflow: 'hidden',
                border: `1px solid ${t.border}`, background: '#000', position: 'relative',
                transition: `border-color 0.2s ${ease}`,
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
              >
                <div style={{
                  width: '1600px', height: '900px', transform: 'scale(0.125)',
                  transformOrigin: 'top left', pointerEvents: 'none',
                }}>
                  <iframe src={`/api/preview/${projectId}/${iter.id}`}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    title={`Preview V${iter.version}`} loading="lazy" sandbox="allow-same-origin" />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 2px 0' }}>
                <span style={{ fontSize: '11px', fontWeight: '600', color: t.ts }}>
                  {iter.title || `V${iter.version}`}
                </span>
                <span style={{
                  fontSize: '9px', padding: '1px 6px', borderRadius: '10px',
                  background: t.surfaceEl, border: `1px solid ${t.border}`, color: t.tm,
                  fontFamily: t.mono,
                }}>v{iter.version}</span>
              </div>
            </div>
          ))}
        </div>
        {showRight && (
          <button onClick={() => scroll('right')} style={{
            position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)',
            zIndex: 10, background: t.surfaceEl, border: `1px solid ${t.borderS}`,
            borderRadius: '50%', width: '32px', height: '32px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.tp,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          }}>
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Tab Button ─── */
function TabButton({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '7px',
        padding: '10px 18px', borderRadius: '8px',
        background: active ? t.violetM : 'transparent',
        border: `1px solid ${active ? t.violet + '60' : 'transparent'}`,
        color: active ? t.tp : t.ts, fontSize: '13px', fontWeight: '600',
        cursor: 'pointer', transition: `all 0.2s ${ease}`,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
    >
      {Icon && <Icon size={14} />}
      {label}
    </button>
  );
}

/* ─── Stat Item ─── */
function StatItem({ icon: Icon, label, value }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0',
      borderBottom: `1px solid ${t.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Icon size={15} style={{ color: t.tm }} />
        <span style={{ fontSize: '13px', color: t.ts }}>{label}</span>
      </div>
      <span style={{ fontSize: '14px', fontWeight: '700', color: t.tp, fontFamily: t.mono }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

export default function MarketplaceDetail() {
  const { name } = useParams();
  const navigate = useNavigate();

  // Data
  const [agent, setAgent] = useState(null);
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [showcases, setShowcases] = useState([]);
  const [projects, setProjects] = useState([]);
  const [iterationsByProject, setIterationsByProject] = useState({});
  const [loading, setLoading] = useState(true);

  // UI states
  const [activeTab, setActiveTab] = useState('overview');
  const [promptOpen, setPromptOpen] = useState(false);
  const [selectedShowcase, setSelectedShowcase] = useState(null);
  const [toast, setToast] = useState(null);
  const [copiedToken, setCopiedToken] = useState(null);
  const [revealedTokens, setRevealedTokens] = useState({});

  // Purchase flow
  const [purchasing, setPurchasing] = useState(false);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [purchaseGlow, setPurchaseGlow] = useState(false);

  // Creator management
  const [mgmtOpen, setMgmtOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [projectIterations, setProjectIterations] = useState({});
  const [newShowcase, setNewShowcase] = useState({ project_id: '', iteration_id: '', title: '', description: '' });
  const [isDragOver, setIsDragOver] = useState(false);
  const [filterByAgent, setFilterByAgent] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);

  // Pricing settings
  const [pricingForm, setPricingForm] = useState({ price: 0, is_premium: false, documentation: '', token_symbol: '' });
  const [savingPricing, setSavingPricing] = useState(false);

  // Preview modal
  const [previewViewport, setPreviewViewport] = useState('desktop');
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const [previewBarCollapsed, setPreviewBarCollapsed] = useState(false);

  // Forking
  const [forking, setForking] = useState(false);

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
      setPricingForm({
        price: agentData.price || 0,
        is_premium: agentData.is_premium || false,
        documentation: agentData.documentation || '',
        token_symbol: agentData.token_symbol || '',
      });
      // Load wallet
      try {
        const w = await api('/api/wallet');
        setWallet(w);
      } catch (_) { setWallet({ balance: 0 }); }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isCreator = agent && user && (agent.created_by === user?.id || user?.role === 'admin');

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  /* ─── Capabilities parser ─── */
  const capabilities = useMemo(() => {
    if (!agent?.full_prompt) return [];
    const caps = [];
    const lines = agent.full_prompt.split('\n');
    let inList = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^#{1,3}\s*(capabilities|features|what|skills)/i)) {
        inList = true;
        continue;
      }
      if (inList && trimmed.match(/^#{1,3}\s/)) break;
      if (inList && trimmed.match(/^[-*]\s+/)) {
        caps.push(trimmed.replace(/^[-*]\s+/, ''));
      }
    }
    if (caps.length === 0 && agent.description) {
      return agent.description.split(/[.,;]/).filter(s => s.trim().length > 10).slice(0, 5).map(s => s.trim());
    }
    return caps.slice(0, 8);
  }, [agent]);

  /* ─── Tools parser ─── */
  const toolsList = useMemo(() => {
    if (!agent?.tools) return [];
    return agent.tools.split(',').map(t => t.trim()).filter(Boolean);
  }, [agent]);

  /* ─── Copy to clipboard ─── */
  const copyToClipboard = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedToken(id);
      setTimeout(() => setCopiedToken(null), 2000);
      showToast('Copied to clipboard');
    } catch (_) {
      showToast('Failed to copy', 'error');
    }
  };

  /* ─── Fork ─── */
  const handleFork = async () => {
    const newName = window.prompt('Name for your forked agent (leave empty for auto-name):');
    if (newName === null) return;
    setForking(true);
    try {
      const body = newName.trim() ? { new_name: newName.trim() } : {};
      const forked = await api(`/api/marketplace/${encodeURIComponent(name)}/fork`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      showToast('Agent forked successfully!');
      navigate(`/agents/${forked.name}/edit`);
    } catch (err) {
      showToast(err.message || 'Fork failed', 'error');
    } finally {
      setForking(false);
    }
  };

  /* ─── Download ─── */
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
      showToast('Download started');
    } catch (err) {
      showToast('Download failed', 'error');
    }
  };

  /* ─── Purchase ─── */
  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const result = await api(`/api/marketplace/${encodeURIComponent(name)}/purchase`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setPurchaseGlow(true);
      setTimeout(() => setPurchaseGlow(false), 3000);
      setShowPurchaseConfirm(false);
      showToast('Agent purchased! Your API token is ready.');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Purchase failed', 'error');
    } finally {
      setPurchasing(false);
    }
  };

  /* ─── Pricing update ─── */
  const handleSavePricing = async () => {
    setSavingPricing(true);
    try {
      await api(`/api/marketplace/${encodeURIComponent(name)}/pricing`, {
        method: 'PUT',
        body: JSON.stringify(pricingForm),
      });
      showToast('Pricing updated');
      await loadData();
    } catch (err) {
      showToast(err.message || 'Failed to update pricing', 'error');
    } finally {
      setSavingPricing(false);
    }
  };

  /* ─── Showcase management ─── */
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
    showToast('Showcase removed');
  };

  const openAddModal = async () => {
    try {
      const allProjects = await api('/api/projects');
      setAvailableProjects(allProjects || []);
      const itersByProj = {};
      await Promise.all((allProjects || []).map(async (p) => {
        try {
          const iters = await api(`/api/iterations/${p.id}`);
          if (iters && iters.length > 0) itersByProj[p.id] = iters;
        } catch (_) {}
      }));
      setProjectIterations(itersByProj);
    } catch (_) {}
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
      await loadData();
      setIsAddModalOpen(false);
      setNewShowcase({ project_id: '', iteration_id: '', title: '', description: '' });
      showToast('Showcase added');
    } catch (err) {
      showToast(err.message || 'Failed to add showcase', 'error');
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (showcases.length >= 6) {
      showToast('Maximum 6 showcases per agent', 'error');
      return;
    }
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      await api(`/api/marketplace/${name}/showcases`, {
        method: 'POST', body: JSON.stringify(data),
      });
      await loadData();
      showToast('Showcase added');
    } catch (err) {
      showToast(err.message || 'Failed to add showcase', 'error');
    }
  };

  /* ─── Loading / Not Found ─── */
  if (loading) return (
    <div style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: `2px solid ${t.border}`, borderTopColor: t.violet,
          animation: 'mpSpin 0.8s linear infinite',
        }} />
        <span style={{ color: t.tm, fontSize: '13px' }}>Loading agent...</span>
      </div>
    </div>
  );

  if (!agent) return (
    <div style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
      <AlertCircle size={40} style={{ color: t.tm }} />
      <span style={{ color: t.ts, fontSize: '16px' }}>Agent not found</span>
      <Link to="/marketplace" style={{ color: t.violet, fontSize: '13px', textDecoration: 'none' }}>Back to Marketplace</Link>
    </div>
  );

  const tokenSymbol = agent.token_symbol || `$${name.toUpperCase().replace(/-/g, '').slice(0, 6)}`;
  const isFree = !agent.price || agent.price === 0;

  return (
    <div className="mpd" style={{ background: t.bg, minHeight: 'calc(100vh - 53px)', color: t.tp }}>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* ════════ BREADCRUMB ════════ */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link to="/marketplace" style={{ fontSize: '12px', color: t.tm, textDecoration: 'none', transition: `color 0.2s ${ease}` }}
            onMouseEnter={e => e.currentTarget.style.color = t.ts}
            onMouseLeave={e => e.currentTarget.style.color = t.tm}
          >Marketplace</Link>
          <ChevronRight size={12} style={{ color: t.tm }} />
          <span style={{ fontSize: '12px', color: t.ts, fontWeight: '500' }}>{formatName(agent.name)}</span>
        </div>
      </div>

      {/* ════════ HERO ════════ */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 32px 0' }}>
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', letterSpacing: '-0.02em', margin: '0 0 16px 0', lineHeight: '1.2' }}>
            {formatName(agent.name)}
          </h1>

          {/* Badges row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '100px',
              fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
              background: t.violetM, color: t.violet, border: `1px solid ${t.violet}40`,
            }}>
              <Layers size={10} /> {agent.category || 'uncategorized'}
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '100px',
              fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
              background: `${t.ts}15`, color: t.ts, border: `1px solid ${t.ts}30`,
            }}>
              <Zap size={10} /> {agent.model || 'unknown'}
            </span>
            {agent.token_symbol && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '100px',
                fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em',
                background: 'rgba(34,197,94,0.1)', color: t.success, border: '1px solid rgba(34,197,94,0.3)',
                fontFamily: t.mono,
              }}>
                <Coins size={10} /> {tokenSymbol}
              </span>
            )}
            {agent.is_premium && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '3px 10px', borderRadius: '100px',
                fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                background: 'rgba(245,158,11,0.1)', color: t.warning, border: '1px solid rgba(245,158,11,0.3)',
              }}>
                <Star size={10} fill={t.warning} /> Premium
              </span>
            )}
          </div>

          {/* Description */}
          <p style={{ fontSize: '15px', lineHeight: '1.7', color: t.ts, margin: '0 0 12px 0', maxWidth: '800px' }}>
            {agent.description}
          </p>

          {/* Forked from */}
          {agent.forked_from && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
              <GitFork size={13} style={{ color: t.tm }} />
              <span style={{ fontSize: '12px', color: t.tm }}>Forked from</span>
              <Link to={`/marketplace/${agent.forked_from}`} style={{
                fontSize: '12px', color: t.violet, textDecoration: 'none', fontWeight: '600',
                transition: `opacity 0.2s ${ease}`,
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                {formatName(agent.forked_from)}
              </Link>
            </div>
          )}

          {/* Meta row: creator, rating, forks, purchases */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', background: t.surfaceEl,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.border}`,
              }}>
                <User size={14} style={{ color: t.ts }} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Creator</div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{agent.creator?.display_name || 'Platform'}</div>
              </div>
            </div>

            <div style={{ width: '1px', height: '24px', background: t.border }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={13}
                    fill={i <= (agent.rating || 0) ? t.warning : 'none'}
                    stroke={i <= (agent.rating || 0) ? t.warning : t.tm}
                  />
                ))}
              </div>
              <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp }}>{(agent.rating || 0).toFixed(1)}</span>
            </div>

            <div style={{ width: '1px', height: '24px', background: t.border }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GitFork size={13} style={{ color: t.tm }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp }}>{agent.fork_count || 0}</span>
              <span style={{ fontSize: '11px', color: t.tm }}>forks</span>
            </div>

            <div style={{ width: '1px', height: '24px', background: t.border }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CreditCard size={13} style={{ color: t.tm }} />
              <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp }}>{agent.purchase_count || 0}</span>
              <span style={{ fontSize: '11px', color: t.tm }}>purchases</span>
            </div>
          </div>
        </div>
      </div>

      {/* ════════ TWO-COLUMN LAYOUT ════════ */}
      <div className="mpd-cols" style={{
        maxWidth: '1280px', margin: '0 auto', padding: '32px 32px 60px',
        display: 'flex', gap: '32px', alignItems: 'flex-start',
      }}>

        {/* ──── LEFT COLUMN (Content) ──── */}
        <div className="mpd-left" style={{ flex: '1 1 0', minWidth: 0 }}>

          {/* ════ DOCUMENTATION TABS ════ */}
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px',
            overflow: 'hidden', marginBottom: '32px',
          }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: '4px', padding: '12px 16px',
              borderBottom: `1px solid ${t.border}`, overflowX: 'auto', scrollbarWidth: 'none',
            }}>
              <TabButton label="Overview" icon={Eye} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
              <TabButton label="Documentation" icon={BookOpen} active={activeTab === 'docs'} onClick={() => setActiveTab('docs')} />
              <TabButton label="API & Token" icon={Key} active={activeTab === 'api'} onClick={() => setActiveTab('api')} />
              <TabButton label="Prompt" icon={Code} active={activeTab === 'prompt'} onClick={() => setActiveTab('prompt')} />
            </div>

            {/* Tab content */}
            <div style={{ padding: '24px' }}>

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 16px 0' }}>About this Agent</h3>
                  <p style={{ fontSize: '14px', lineHeight: '1.7', color: t.ts, margin: '0 0 24px 0' }}>
                    {agent.description || 'No description provided.'}
                  </p>

                  {/* Capabilities */}
                  {capabilities.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: t.tp, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capabilities</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {capabilities.map((cap, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <CheckCircle size={14} style={{ color: t.success, marginTop: '2px', flexShrink: 0 }} />
                            <span style={{ fontSize: '13px', color: t.ts, lineHeight: '1.5' }}>{cap}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Model Info */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px',
                    marginBottom: '24px',
                  }}>
                    <div style={{
                      padding: '14px 16px', borderRadius: '10px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    }}>
                      <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Model</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp, fontFamily: t.mono }}>{agent.model || 'N/A'}</div>
                    </div>
                    <div style={{
                      padding: '14px 16px', borderRadius: '10px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    }}>
                      <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Category</div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp }}>{agent.category || 'N/A'}</div>
                    </div>
                    {agent.max_turns > 0 && (
                      <div style={{
                        padding: '14px 16px', borderRadius: '10px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Max Turns</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp, fontFamily: t.mono }}>{agent.max_turns}</div>
                      </div>
                    )}
                    {agent.permission_mode && (
                      <div style={{
                        padding: '14px 16px', borderRadius: '10px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Permissions</div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp }}>{agent.permission_mode}</div>
                      </div>
                    )}
                  </div>

                  {/* Tools */}
                  {toolsList.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: t.tp, margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tools</h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {toolsList.map((tool, i) => (
                          <span key={i} style={{
                            padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                            background: t.violetG, color: t.violet, border: `1px solid ${t.violet}30`,
                            fontFamily: t.mono,
                          }}>{tool}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* DOCUMENTATION */}
              {activeTab === 'docs' && (
                <div>
                  {agent.documentation ? (
                    <div style={{ fontSize: '14px', lineHeight: '1.8', color: t.ts, whiteSpace: 'pre-wrap' }}>
                      {agent.documentation}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                      <BookOpen size={40} style={{ color: t.tm, marginBottom: '16px' }} />
                      <div style={{ fontSize: '15px', fontWeight: '600', color: t.ts, marginBottom: '8px' }}>No documentation yet</div>
                      <div style={{ fontSize: '13px', color: t.tm }}>
                        {isCreator ? 'Add documentation from the management panel below.' : 'The creator has not added documentation.'}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* API & TOKEN */}
              {activeTab === 'api' && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 8px 0' }}>API Access</h3>
                  <p style={{ fontSize: '13px', color: t.ts, margin: '0 0 24px 0', lineHeight: '1.6' }}>
                    After purchasing this agent, you receive an API token for programmatic access.
                  </p>

                  {agent.user_purchased ? (
                    <>
                      {/* User has purchased - show tokens */}
                      <div style={{
                        padding: '16px', borderRadius: '12px', marginBottom: '20px',
                        background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <CheckCircle size={16} style={{ color: t.success }} />
                          <span style={{ fontSize: '14px', fontWeight: '700', color: t.success }}>Purchased</span>
                        </div>
                        <div style={{ fontSize: '12px', color: t.ts }}>You have API access to this agent.</div>
                      </div>

                      {/* Active tokens */}
                      {(agent.user_tokens || []).length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '13px', fontWeight: '700', color: t.tp, margin: '0 0 12px 0' }}>Your API Tokens</h4>
                          {agent.user_tokens.map((tk) => (
                            <div key={tk.id} style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 16px', borderRadius: '10px', marginBottom: '8px',
                              background: t.surfaceEl, border: `1px solid ${t.border}`,
                            }}>
                              <Key size={14} style={{ color: t.violet, flexShrink: 0 }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontFamily: t.mono, fontSize: '13px', color: t.tp,
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>
                                  {revealedTokens[tk.id] ? (tk.token || tk.token_prefix + '...') : (tk.token_prefix + '...')}
                                </div>
                                <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px' }}>
                                  Created {new Date(tk.created_at).toLocaleDateString()} {tk.is_active ? '' : '(inactive)'}
                                </div>
                              </div>
                              <button
                                onClick={() => setRevealedTokens(r => ({ ...r, [tk.id]: !r[tk.id] }))}
                                style={{
                                  background: 'none', border: 'none', color: t.ts, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', padding: '4px',
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => copyToClipboard(tk.token || tk.token_prefix, tk.id)}
                                style={{
                                  background: 'none', border: 'none', color: copiedToken === tk.id ? t.success : t.ts,
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px',
                                }}
                              >
                                {copiedToken === tk.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Usage example */}
                      <h4 style={{ fontSize: '13px', fontWeight: '700', color: t.tp, margin: '0 0 12px 0' }}>Usage Example</h4>
                      <div style={{
                        background: '#0a0a0a', borderRadius: '10px', padding: '16px',
                        border: `1px solid ${t.border}`, position: 'relative',
                      }}>
                        <button
                          onClick={() => copyToClipboard(`curl -X POST \\
  -H "Authorization: Bearer guru_xxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello"}' \\
  ${window.location.origin}/api/mcp/${name}/chat`, 'example')}
                          style={{
                            position: 'absolute', top: '10px', right: '10px',
                            background: t.surfaceEl, border: `1px solid ${t.border}`,
                            borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                            color: copiedToken === 'example' ? t.success : t.ts,
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px',
                          }}
                        >
                          {copiedToken === 'example' ? <Check size={10} /> : <Copy size={10} />}
                          {copiedToken === 'example' ? 'Copied' : 'Copy'}
                        </button>
                        <pre style={{
                          fontFamily: t.mono, fontSize: '12px', lineHeight: '1.7', color: t.ts,
                          margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                        }}>{`curl -X POST \\
  -H "Authorization: Bearer guru_xxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello"}' \\
  ${window.location.origin}/api/mcp/${name}/chat`}</pre>
                      </div>
                    </>
                  ) : (
                    /* Not purchased - blurred view */
                    <div style={{ position: 'relative' }}>
                      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none', opacity: 0.4 }}>
                        <div style={{
                          padding: '12px 16px', borderRadius: '10px', marginBottom: '12px',
                          background: t.surfaceEl, border: `1px solid ${t.border}`,
                          fontFamily: t.mono, fontSize: '13px', color: t.ts,
                        }}>
                          guru_sk_a1b2c3d4e5f6g7h8i9j0...
                        </div>
                        <div style={{
                          background: '#0a0a0a', borderRadius: '10px', padding: '16px',
                          border: `1px solid ${t.border}`, fontFamily: t.mono, fontSize: '12px', color: t.ts,
                        }}>
                          {`curl -X POST -H "Authorization: Bearer guru_sk_..." ${window.location.origin}/api/mcp/${name}/chat`}
                        </div>
                      </div>
                      <div style={{
                        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '12px',
                      }}>
                        <Lock size={28} style={{ color: t.violet }} />
                        <span style={{ fontSize: '14px', fontWeight: '700', color: t.tp }}>Purchase to unlock API access</span>
                        <span style={{ fontSize: '12px', color: t.ts }}>Get your personal API token and full documentation</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* PROMPT */}
              {activeTab === 'prompt' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Agent Prompt</h3>
                    <button
                      onClick={() => setPromptOpen(!promptOpen)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px', background: 'none',
                        border: `1px solid ${t.border}`, borderRadius: '6px', padding: '6px 12px',
                        color: t.ts, cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                      }}
                    >
                      {promptOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {promptOpen ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                  <div style={{
                    background: '#0a0a0a', border: `1px solid ${t.border}`, borderRadius: '10px',
                    padding: '20px', fontFamily: t.mono, fontSize: '12px', lineHeight: '1.7',
                    color: t.ts, whiteSpace: 'pre-wrap', maxHeight: promptOpen ? 'none' : '300px',
                    overflowY: promptOpen ? 'visible' : 'auto',
                    transition: `max-height 0.4s ${ease}`,
                    position: 'relative',
                  }}>
                    {agent.full_prompt || '[No prompt content]'}
                    {!promptOpen && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px',
                        background: 'linear-gradient(transparent, #0a0a0a)',
                        pointerEvents: 'none',
                      }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ════ SHOWCASE GALLERY ════ */}
          {showcases.length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Showcase Gallery</h2>
                <div style={{ height: '1px', flex: 1, background: t.border }} />
                <span style={{ fontSize: '11px', color: t.tm }}>{showcases.length} item{showcases.length > 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {showcases.map(s => (
                  <ShowcaseCard key={s.id} showcase={s} onClick={setSelectedShowcase} />
                ))}
              </div>
            </section>
          )}

          {/* ════ ITERATION BROWSER ════ */}
          {projects.length > 0 && Object.keys(iterationsByProject).length > 0 && (
            <section style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
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

          {/* ════ PROJECTS LIST ════ */}
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <Package size={18} style={{ color: t.violet }} />
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Projects</h2>
              <div style={{ height: '1px', flex: 1, background: t.border }} />
              <span style={{ fontSize: '11px', color: t.tm }}>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {projects.map(p => (
                <div key={p.id} onClick={() => navigate(`/project/${p.id}`)} style={{
                  padding: '10px 16px', background: t.surface, border: `1px solid ${t.border}`,
                  borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center',
                  gap: '8px', cursor: 'pointer', transition: `all 0.2s ${ease}`,
                }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = t.violet; e.currentTarget.style.background = t.surfaceEl; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.surface; }}
                >
                  <Package size={14} style={{ color: t.tm }} />
                  <span style={{ fontWeight: '500' }}>{p.name}</span>
                  <ExternalLink size={11} style={{ color: t.tm }} />
                </div>
              ))}
              {projects.length === 0 && (
                <div style={{ fontSize: '13px', color: t.tm, padding: '20px 0' }}>No projects recorded yet.</div>
              )}
            </div>
          </section>
        </div>

        {/* ──── RIGHT COLUMN (Sidebar) ──── */}
        <div className="mpd-right" style={{ flex: '0 0 340px', position: 'sticky', top: '70px' }}>

          {/* ══ PRICING CARD ══ */}
          <div style={{
            background: 'rgba(26, 26, 27, 0.8)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${purchaseGlow ? t.violet : 'rgba(139,92,246,0.3)'}`,
            borderRadius: '16px', padding: '28px',
            marginBottom: '20px',
            boxShadow: purchaseGlow
              ? `0 0 40px rgba(139,92,246,0.3), 0 0 80px rgba(139,92,246,0.1)`
              : '0 4px 24px rgba(0,0,0,0.3)',
            transition: `all 0.5s ${ease}`,
          }}>
            {/* Token symbol */}
            <div style={{
              textAlign: 'center', marginBottom: '20px',
            }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                padding: '12px 24px', borderRadius: '12px',
                background: isFree ? 'rgba(34,197,94,0.08)' : t.violetG,
                border: `1px solid ${isFree ? 'rgba(34,197,94,0.2)' : t.violet + '30'}`,
                marginBottom: '12px',
              }}>
                <span style={{
                  fontFamily: t.mono, fontSize: '22px', fontWeight: '800',
                  color: isFree ? t.success : t.violet, letterSpacing: '-0.02em',
                  textShadow: isFree ? `0 0 20px rgba(34,197,94,0.4)` : `0 0 20px rgba(139,92,246,0.4)`,
                }}>
                  {tokenSymbol}
                </span>
              </div>
              <div style={{
                fontSize: isFree ? '28px' : '32px', fontWeight: '800',
                color: isFree ? t.success : t.tp, fontFamily: t.mono,
                letterSpacing: '-0.02em',
              }}>
                {isFree ? 'Free' : `${agent.price} credits`}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: t.border, margin: '0 -4px 20px' }} />

            {/* What you get */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }}>
                What you get
              </div>
              {[
                { icon: Key, text: 'API Access Token' },
                { icon: Code, text: 'Full Prompt Access' },
                { icon: GitFork, text: 'Fork Rights' },
                { icon: Shield, text: 'Priority Support' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: t.violetG, border: `1px solid ${t.violet}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <item.icon size={12} style={{ color: t.violet }} />
                  </div>
                  <span style={{ fontSize: '13px', color: t.ts }}>{item.text}</span>
                </div>
              ))}
            </div>

            {/* Purchase / Owned state */}
            {agent.user_purchased ? (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  padding: '12px', borderRadius: '10px', marginBottom: '16px',
                  background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
                }}>
                  <CheckCircle size={16} style={{ color: t.success }} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: t.success }}>Owned</span>
                </div>

                {/* Show masked token */}
                {(agent.user_tokens || []).length > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 14px', borderRadius: '8px', marginBottom: '12px',
                    background: t.surfaceEl, border: `1px solid ${t.border}`,
                  }}>
                    <Key size={13} style={{ color: t.violet, flexShrink: 0 }} />
                    <span style={{
                      fontFamily: t.mono, fontSize: '11px', color: t.ts,
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {agent.user_tokens[0].token_prefix}...
                    </span>
                    <button
                      onClick={() => copyToClipboard(agent.user_tokens[0].token || agent.user_tokens[0].token_prefix, 'sidebar')}
                      style={{
                        background: 'none', border: 'none', padding: '2px',
                        color: copiedToken === 'sidebar' ? t.success : t.ts, cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      {copiedToken === 'sidebar' ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleFork} disabled={forking} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: forking ? 'wait' : 'pointer',
                    background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    transition: `all 0.2s ${ease}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                    onMouseLeave={e => e.currentTarget.style.borderColor = t.borderS}
                  >
                    <GitFork size={14} /> Fork
                  </button>
                  <button onClick={handleDownload} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    transition: `all 0.2s ${ease}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                    onMouseLeave={e => e.currentTarget.style.borderColor = t.borderS}
                  >
                    <Download size={14} /> .md
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Purchase button */}
                <button
                  onClick={() => {
                    if (isFree) handlePurchase();
                    else setShowPurchaseConfirm(true);
                  }}
                  disabled={purchasing}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    padding: '14px', borderRadius: '10px', fontSize: '15px', fontWeight: '700',
                    cursor: purchasing ? 'wait' : 'pointer',
                    background: `linear-gradient(135deg, ${t.violet}, #a78bfa)`,
                    color: '#fff', border: 'none',
                    boxShadow: `0 4px 20px rgba(139,92,246,0.4)`,
                    transition: `all 0.2s ${ease}`,
                    opacity: purchasing ? 0.7 : 1,
                    marginBottom: '12px',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(139,92,246,0.5)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.4)'; }}
                >
                  {purchasing ? (
                    <>
                      <div style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                        animation: 'mpSpin 0.6s linear infinite',
                      }} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} />
                      {isFree ? 'Get Agent (Free)' : `Purchase Agent`}
                    </>
                  )}
                </button>

                {!isFree && wallet && (
                  <div style={{ textAlign: 'center', fontSize: '11px', color: t.tm, marginBottom: '12px' }}>
                    Your balance: <span style={{ color: t.tp, fontWeight: '600', fontFamily: t.mono }}>{wallet.balance || 0} credits</span>
                    {(wallet.balance || 0) < (agent.price || 0) && (
                      <span style={{ display: 'block', marginTop: '4px' }}>
                        <Link to="/wallet" style={{ color: t.warning, textDecoration: 'none', fontWeight: '600' }}>Add Credits</Link>
                      </span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={handleFork} disabled={forking} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: forking ? 'wait' : 'pointer',
                    background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    transition: `all 0.2s ${ease}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                    onMouseLeave={e => e.currentTarget.style.borderColor = t.borderS}
                  >
                    <GitFork size={14} /> {forking ? '...' : 'Fork'}
                  </button>
                  <button onClick={handleDownload} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    transition: `all 0.2s ${ease}`,
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
                    onMouseLeave={e => e.currentTarget.style.borderColor = t.borderS}
                  >
                    <Download size={14} /> .md
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ══ STATS CARD ══ */}
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`, borderRadius: '16px',
            padding: '20px', marginBottom: '20px',
          }}>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px 0' }}>
              Statistics
            </h3>
            <StatItem icon={Download} label="Downloads" value={agent.download_count || 0} />
            <StatItem icon={GitFork} label="Forks" value={agent.fork_count || 0} />
            <StatItem icon={CreditCard} label="Purchases" value={agent.purchase_count || 0} />
            <StatItem icon={Package} label="Projects" value={agent.project_count || 0} />
          </div>

          {/* ══ CREATOR MANAGE BUTTON ══ */}
          {isCreator && (
            <button
              onClick={() => setMgmtOpen(!mgmtOpen)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                transition: `all 0.2s ${ease}`,
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = t.violet}
              onMouseLeave={e => e.currentTarget.style.borderColor = t.borderS}
            >
              <Settings size={15} />
              {mgmtOpen ? 'Hide Management' : 'Creator Management'}
            </button>
          )}
        </div>
      </div>

      {/* ════════ CREATOR MANAGEMENT PANEL ════════ */}
      {mgmtOpen && isCreator && (
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 32px 60px' }}>
          <div style={{
            background: t.surface, border: `1px solid ${t.violet}30`, borderRadius: '16px',
            padding: '28px', position: 'relative',
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
              background: `linear-gradient(90deg, ${t.violet}, #a78bfa, ${t.violet})`,
              borderRadius: '16px 16px 0 0',
            }} />

            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Settings size={18} style={{ color: t.violet }} /> Creator Management
            </h3>

            {/* ── Pricing Settings ── */}
            <div style={{ marginBottom: '32px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '700', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <DollarSign size={15} style={{ color: t.violet }} /> Pricing Settings
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.tm, marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Price (credits)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pricingForm.price}
                    onChange={e => setPricingForm({ ...pricingForm, price: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                      borderRadius: '8px', padding: '10px 14px', color: t.tp, outline: 'none',
                      fontSize: '14px', fontFamily: t.mono, boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: t.tm, marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    placeholder="$AGENT"
                    value={pricingForm.token_symbol}
                    onChange={e => setPricingForm({ ...pricingForm, token_symbol: e.target.value })}
                    style={{
                      width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                      borderRadius: '8px', padding: '10px 14px', color: t.tp, outline: 'none',
                      fontSize: '14px', fontFamily: t.mono, boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                  padding: '12px 16px', borderRadius: '8px', background: t.surfaceEl, border: `1px solid ${t.border}`,
                }}>
                  <input
                    type="checkbox"
                    checked={pricingForm.is_premium}
                    onChange={e => setPricingForm({ ...pricingForm, is_premium: e.target.checked })}
                    style={{ accentColor: t.violet, width: '16px', height: '16px' }}
                  />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>Premium Agent</div>
                    <div style={{ fontSize: '11px', color: t.tm }}>Mark this agent as premium in the marketplace</div>
                  </div>
                </label>
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: t.tm, marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Documentation
                </label>
                <textarea
                  rows={6}
                  placeholder="Write documentation for your agent..."
                  value={pricingForm.documentation}
                  onChange={e => setPricingForm({ ...pricingForm, documentation: e.target.value })}
                  style={{
                    width: '100%', background: t.surfaceEl, border: `1px solid ${t.border}`,
                    borderRadius: '8px', padding: '12px 14px', color: t.tp, outline: 'none',
                    fontSize: '13px', lineHeight: '1.6', resize: 'vertical', boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                onClick={handleSavePricing}
                disabled={savingPricing}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                  cursor: savingPricing ? 'wait' : 'pointer',
                  background: t.violet, color: '#fff', border: 'none',
                  opacity: savingPricing ? 0.7 : 1,
                }}
              >
                {savingPricing ? 'Saving...' : 'Save Pricing'}
              </button>
            </div>

            {/* ── Showcase Management ── */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={15} style={{ color: t.violet }} /> Showcases ({showcases.length}/6)
                </h4>
                {showcases.length < 6 && (
                  <button onClick={openAddModal} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '7px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', background: t.tp, color: t.bg, border: 'none',
                  }}>
                    <Plus size={14} /> Add Showcase
                  </button>
                )}
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '8px',
                  minHeight: showcases.length === 0 ? '120px' : 'auto',
                  border: isDragOver ? `2px dashed ${t.violet}` : 'none',
                  borderRadius: '10px',
                  padding: isDragOver ? '8px' : '0',
                  background: isDragOver ? `${t.violet}08` : 'transparent',
                  transition: `all 0.2s ${ease}`,
                }}
              >
                {showcases.map((s, idx) => (
                  <div key={s.id} style={{
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px',
                    background: t.surfaceEl, borderRadius: '10px', border: `1px solid ${t.border}`,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button onClick={() => handleReorder(s.id, 'up')} disabled={idx === 0}
                        style={{ background: 'none', border: 'none', color: idx === 0 ? t.tm : t.ts, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <ArrowUp size={13} />
                      </button>
                      <button onClick={() => handleReorder(s.id, 'down')} disabled={idx === showcases.length - 1}
                        style={{ background: 'none', border: 'none', color: idx === showcases.length - 1 ? t.tm : t.ts, cursor: 'pointer', padding: '2px', display: 'flex' }}>
                        <ArrowDown size={13} />
                      </button>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '600' }}>{s.title || 'Untitled'}</div>
                      <div style={{ fontSize: '11px', color: t.tm }}>{s.project_name} - v{s.iteration_version}</div>
                    </div>
                    <button onClick={() => handleDeleteShowcase(s.id)} style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                      cursor: 'pointer', background: `${t.danger}15`, color: t.danger, border: 'none',
                    }}>
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                ))}
                {showcases.length === 0 && (
                  <div style={{
                    padding: '40px', textAlign: 'center',
                    border: `2px dashed ${isDragOver ? t.violet : t.border}`,
                    borderRadius: '10px',
                    color: isDragOver ? t.violet : t.tm,
                    background: isDragOver ? `${t.violet}08` : 'transparent',
                    transition: `all 0.2s ${ease}`,
                    fontSize: '13px',
                  }}>
                    {isDragOver ? 'Drop iteration here to add' : 'No showcases yet. Drag & drop iterations from the browser above, or click Add Showcase.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ PURCHASE CONFIRM DIALOG ════════ */}
      {showPurchaseConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 2000,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}>
          <div style={{
            background: t.surface, border: `1px solid ${t.violet}40`, borderRadius: '16px',
            padding: '32px', maxWidth: '420px', width: '100%',
            boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${t.violetG}`,
          }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
                background: t.violetG, border: `1px solid ${t.violet}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CreditCard size={24} style={{ color: t.violet }} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0' }}>Confirm Purchase</h3>
              <p style={{ fontSize: '13px', color: t.ts, margin: 0, lineHeight: '1.6' }}>
                You are about to purchase <strong style={{ color: t.tp }}>{formatName(agent.name)}</strong> for{' '}
                <strong style={{ color: t.violet, fontFamily: t.mono }}>{agent.price} credits</strong>.
              </p>
            </div>

            <div style={{
              padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
              background: t.surfaceEl, border: `1px solid ${t.border}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: t.ts }}>Current balance</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp, fontFamily: t.mono }}>{wallet?.balance || 0} credits</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: t.ts }}>Cost</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: t.danger, fontFamily: t.mono }}>-{agent.price} credits</span>
              </div>
              <div style={{ height: '1px', background: t.border, margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: t.ts }}>Remaining</span>
                <span style={{
                  fontSize: '12px', fontWeight: '700', fontFamily: t.mono,
                  color: ((wallet?.balance || 0) - (agent.price || 0)) >= 0 ? t.success : t.danger,
                }}>
                  {(wallet?.balance || 0) - (agent.price || 0)} credits
                </span>
              </div>
            </div>

            {((wallet?.balance || 0) < (agent.price || 0)) && (
              <div style={{
                padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <AlertCircle size={14} style={{ color: t.danger, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: t.danger }}>
                  Insufficient credits. <Link to="/wallet" style={{ color: t.danger, fontWeight: '700' }}>Add credits</Link>
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowPurchaseConfirm(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                  cursor: 'pointer', background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePurchase}
                disabled={purchasing || (wallet?.balance || 0) < (agent.price || 0)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', fontSize: '13px', fontWeight: '700',
                  cursor: purchasing ? 'wait' : 'pointer',
                  background: `linear-gradient(135deg, ${t.violet}, #a78bfa)`,
                  color: '#fff', border: 'none',
                  opacity: (purchasing || (wallet?.balance || 0) < (agent.price || 0)) ? 0.5 : 1,
                  boxShadow: `0 4px 16px rgba(139,92,246,0.3)`,
                }}
              >
                {purchasing ? 'Processing...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ FULLSCREEN PREVIEW MODAL ════════ */}
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
            showToast('Link copied to clipboard');
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
            position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#050505',
            display: 'flex', flexDirection: 'column', color: t.tp,
            fontFamily: 'Inter, sans-serif',
          }}>
            {/* Close */}
            <button
              onClick={() => { setSelectedShowcase(null); setPreviewViewport('desktop'); setPreviewBarCollapsed(false); }}
              style={{
                position: 'absolute', top: '16px', right: '16px', zIndex: 3100,
                background: 'rgba(15,15,15,0.85)', backdropFilter: 'blur(12px)',
                border: `1px solid ${t.borderS}`, borderRadius: '10px',
                width: '38px', height: '38px', cursor: 'pointer', color: t.ts,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: `all 0.2s ${ease}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(30,30,30,0.9)'; e.currentTarget.style.color = t.tp; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(15,15,15,0.85)'; e.currentTarget.style.color = t.ts; }}
            >
              <X size={16} />
            </button>

            {/* Preview area */}
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
                transition: `all 0.5s ${ease}`,
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

            {/* Bottom control bar */}
            <div style={{
              position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
              width: previewBarCollapsed ? 'auto' : 'calc(100% - 40px)', maxWidth: previewBarCollapsed ? 'none' : '1100px',
              backgroundColor: 'rgba(15, 15, 15, 0.85)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${t.borderS}`, borderRadius: '16px',
              zIndex: 3100, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              transition: `all 0.3s ${ease}`,
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
                  {/* Row 1 */}
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
                              cursor: 'pointer', transition: `all 0.2s ${ease}`,
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
          </div>
        );
      })()}

      {/* ════════ ADD SHOWCASE MODAL ════════ */}
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
            position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.92)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            overflowY: 'auto',
          }}>
            <div style={{
              background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '16px',
              width: '100%', maxWidth: '900px', padding: '28px', maxHeight: '90vh', overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 4px 0' }}>Add to Showcase</h3>
                  <p style={{ fontSize: '12px', color: t.tm, margin: 0 }}>Select an iteration to feature</p>
                </div>
                <button onClick={() => { setIsAddModalOpen(false); setSelectedProject(null); }}
                  style={{
                    background: t.surfaceEl, border: `1px solid ${t.border}`, borderRadius: '8px',
                    width: '32px', height: '32px', color: t.ts, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <X size={16} />
                </button>
              </div>

              {/* Filter toggle */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', padding: '4px', background: t.surfaceEl, borderRadius: '10px' }}>
                <button
                  onClick={() => setFilterByAgent(true)}
                  style={{
                    flex: 1, padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', border: 'none', transition: `all 0.2s ${ease}`,
                    background: filterByAgent ? t.violet : 'transparent',
                    color: filterByAgent ? '#fff' : t.ts,
                  }}
                >
                  This Agent ({projects.length})
                </button>
                <button
                  onClick={() => setFilterByAgent(false)}
                  style={{
                    flex: 1, padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', border: 'none', transition: `all 0.2s ${ease}`,
                    background: !filterByAgent ? t.violet : 'transparent',
                    color: !filterByAgent ? '#fff' : t.ts,
                  }}
                >
                  All Projects ({availableProjects.length})
                </button>
              </div>

              {/* Projects grid */}
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
                      <div key={project.id}>
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
                                  cursor: 'pointer', borderRadius: '10px', overflow: 'hidden',
                                  border: isSelected ? `2px solid ${t.violet}` : `1px solid ${t.border}`,
                                  background: t.surfaceEl, transition: `all 0.2s ${ease}`,
                                  boxShadow: isSelected ? `0 0 24px ${t.violet}40` : 'none',
                                }}
                                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = t.violet; }}
                                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = t.border; }}
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
                                      background: t.violet, color: '#fff', padding: '3px 8px',
                                      borderRadius: '100px', fontSize: '9px', fontWeight: '700',
                                      display: 'flex', alignItems: 'center', gap: '3px',
                                    }}>
                                      <Check size={10} /> SELECTED
                                    </div>
                                  )}
                                </div>
                                <div style={{ padding: '8px 10px' }}>
                                  <div style={{ fontSize: '11px', fontWeight: '600', color: t.tp, marginBottom: '2px' }}>
                                    {iter.title || `Version ${iter.version}`}
                                  </div>
                                  <div style={{ fontSize: '9px', color: t.tm, fontFamily: t.mono }}>v{iter.version}</div>
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

              {/* Footer */}
              {selectedProject && (
                <div style={{
                  marginTop: '24px', padding: '16px', borderRadius: '12px',
                  background: t.surfaceEl, border: `1px solid ${t.violet}40`,
                }}>
                  <label style={{ display: 'block', fontSize: '11px', color: t.tm, marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Showcase Title
                  </label>
                  <input
                    type="text"
                    placeholder="E.g. Dynamic Dashboard v2"
                    value={newShowcase.title}
                    onChange={(e) => setNewShowcase({ ...newShowcase, title: e.target.value })}
                    style={{
                      width: '100%', background: t.surface, border: `1px solid ${t.border}`,
                      borderRadius: '8px', padding: '10px 14px', color: t.tp, outline: 'none', boxSizing: 'border-box',
                      marginBottom: '14px', fontSize: '14px',
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button onClick={() => setSelectedProject(null)} style={{
                      padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '600',
                      cursor: 'pointer', background: 'transparent', color: t.ts, border: `1px solid ${t.borderS}`,
                    }}>
                      Cancel
                    </button>
                    <button
                      onClick={confirmShowcase}
                      disabled={!newShowcase.title}
                      style={{
                        padding: '10px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: '700',
                        cursor: 'pointer', background: t.violet, color: '#fff', border: 'none',
                        opacity: !newShowcase.title ? 0.5 : 1,
                        boxShadow: newShowcase.title ? `0 4px 12px rgba(139,92,246,0.3)` : 'none',
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

      {/* ════════ GLOBAL STYLES ════════ */}
      <style>{`
        @keyframes mpSpin { to { transform: rotate(360deg); } }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        div::-webkit-scrollbar { display: none; }
        select option { background: ${t.surface}; color: ${t.tp}; }
        @media (max-width: 900px) {
          .mpd-cols { flex-direction: column-reverse !important; }
          .mpd-right { flex: 1 1 auto !important; position: static !important; width: 100% !important; }
          .mpd-left { width: 100% !important; }
        }
        @media (max-width: 768px) {
          .mpd { padding: 0 !important; }
          .mpd-cols { padding: 16px !important; gap: 20px !important; }
        }
      `}</style>
    </div>
  );
}
