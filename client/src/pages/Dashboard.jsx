import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Play, Activity, Clock, Terminal, ArrowUpRight, CheckCircle2, AlertCircle, RefreshCw, MonitorDot, Repeat, Zap, Globe, Cpu, BarChart3, History, Shield, Sparkles, User, Bot, Edit2, ChevronLeft, ChevronRight, Star, Eye, FileSearch, GitBranch, Code, MessageSquare, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import AgentCreator from '../components/AgentCreator';
import OnboardingBanner from '../components/OnboardingBanner';
import OnboardingWizard from '../components/OnboardingWizard';
import TemplateGallery from '../components/TemplateGallery';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

// Animated Counter Component
const Counter = ({ value }) => {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = parseInt(value) || 0;
    if (start === end) return;
    const duration = 1000;
    const increment = end / (duration / 30);
    let timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{count.toLocaleString()}</span>;
};

// Badge Component
const Badge = ({ children, color = t.violet }) => (
  <span style={{
    display: 'inline-flex',
    padding: '2px 8px',
    borderRadius: '100px',
    background: `${color}15`,
    border: `1px solid ${color}44`,
    color: color,
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  }}>
    {children}
  </span>
);

// ProjectCard Component (extracted to avoid useState inside .map)
const ProjectCard = ({ project, navigate, onDelete, t }) => {
  const [showDelete, setShowDelete] = React.useState(false);
  return (
    <div
      onClick={() => navigate(`/project/${project.id}`)}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${t.violet}44`;
        e.currentTarget.style.boxShadow = `0 8px 24px -8px ${t.violet}22`;
        e.currentTarget.style.transform = 'translateY(-2px)';
        setShowDelete(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
        setShowDelete(false);
      }}
      style={{
        background: t.surface, borderRadius: '12px', border: `1px solid ${t.border}`,
        padding: '18px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '14px',
        transition: 'all 0.2s', position: 'relative'
      }}
    >
      {showDelete && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          onClick={(e) => onDelete(project.id, project.name, e)}
          style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '32px', height: '32px', borderRadius: '6px',
            backgroundColor: 'rgba(239, 68, 68, 0.9)', border: '1px solid rgba(239, 68, 68, 1)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 1)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)'; e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <Trash2 size={16} />
        </motion.button>
      )}
      {project.latest_iteration_id && (
        <div style={{
          width: '100%', height: '140px', borderRadius: '8px', overflow: 'hidden',
          background: t.surfaceEl, border: `1px solid ${t.border}`, position: 'relative'
        }}>
          <iframe
            src={`/api/preview/${project.id}/${project.latest_iteration_id}`}
            title={`Preview ${project.name}`}
            style={{
              width: '1280px', height: '800px', border: 'none',
              transform: 'scale(0.22)', transformOrigin: 'top left',
              pointerEvents: 'none',
            }}
            sandbox="allow-same-origin allow-scripts"
            loading="lazy"
          />
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px', backgroundColor: t.surfaceEl,
          display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${t.borderS}`
        }}>
          <Shield size={18} color={t.violet} />
        </div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {project.mode === 'orchestra' && (
            <Badge color="#F59E0B">Orchestra</Badge>
          )}
          <Badge color={project.status === 'active' ? t.success : t.ts}>
            {project.status || 'Idle'}
          </Badge>
        </div>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>{project.name}</div>
        <div style={{ fontSize: '12px', color: t.ts, lineHeight: '1.4', height: '32px', overflow: 'hidden' }}>
          {project.description || "No description provided."}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0',
        borderTop: `1px solid ${t.border}`, marginTop: 'auto'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Agent</div>
          <div style={{ fontSize: '11px', color: t.tp, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Cpu size={10} color={t.ts} /> {project.agent_name || 'None'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', fontWeight: 700, marginBottom: '2px' }}>Iters</div>
          <div style={{ fontSize: '11px', color: t.tp }}>{project.iteration_count || 0}</div>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [guruPrompt, setGuruPrompt] = useState('');
  const [guruResponse, setGuruResponse] = useState('');
  const [guruLoading, setGuruLoading] = useState(false);
  const [showAgentArrows, setShowAgentArrows] = useState(false);
  const [activeSkill, setActiveSkill] = useState(null);
  const [showAgentCreator, setShowAgentCreator] = useState(false);
  const [onboarding, setOnboarding] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const agentScrollRef = React.useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [p, a] = await Promise.all([api('/api/projects'), api('/api/agents')]);
      setProjects(p || []);
      setAgents(a || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchOnboarding = async () => {
    try {
      const data = await api('/api/onboarding/status');
      if (!data.onboarding_completed) {
        setOnboarding(data);
        setShowWizard(true);
      } else {
        setOnboarding(null);
      }
    } catch (_) {}
  };

  const dismissOnboarding = async () => {
    try {
      await api('/api/onboarding/dismiss', { method: 'POST' });
      setOnboarding(null);
      setShowWizard(false);
    } catch (_) {}
  };

  const handleWizardComplete = async () => {
    setShowWizard(false);
    await dismissOnboarding();
  };

  const handleWizardNavigate = (path) => {
    setShowWizard(false);
    dismissOnboarding();
    navigate(path);
  };

  useEffect(() => { fetchData(); fetchOnboarding(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api('/api/seed', { method: 'POST' });
      await fetchData();
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  const handleAskGuru = async () => {
    if (!guruPrompt.trim() || guruLoading) return;
    setGuruLoading(true);
    setGuruResponse('');
    try {
      const result = await api('/api/orchestrator/command', {
        method: 'POST',
        body: JSON.stringify({ prompt: guruPrompt }),
      });
      setGuruResponse(result.response);
    } catch (err) {
      setGuruResponse(`Error: ${err.message}`);
    } finally {
      setGuruLoading(false);
    }
  };

  const handleDeleteProject = async (projectId, projectName, e) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    if (!window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await api(`/api/projects/${projectId}`, { method: 'DELETE' });
      await fetchData(); // Refresh the projects list
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project. Please try again.');
    }
  };

  const totalIterations = projects.reduce((a, p) => a + (p.iteration_count || 0), 0);

  const scrollAgentCarousel = (direction) => {
    if (agentScrollRef.current) {
      const { scrollLeft, clientWidth } = agentScrollRef.current;
      const scrollTo = direction === 'left'
        ? scrollLeft - clientWidth * 0.5
        : scrollLeft + clientWidth * 0.5;
      agentScrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const skills = [
    {
      id: 'commit',
      name: '/commit',
      description: 'Analyze staged changes and generate semantic commit messages.',
      icon: GitBranch,
      usage: 142,
      status: 'Available',
      accent: t.success,
      isNew: false
    },
    {
      id: 'review',
      name: '/review-pr',
      description: 'Perform an automated security and logic audit on pull requests.',
      icon: FileSearch,
      usage: 89,
      status: 'Available',
      accent: t.violet,
      isNew: false
    },
    {
      id: 'refactor',
      name: '/refactor',
      description: 'Suggest structural improvements for complex functions or components.',
      icon: Code,
      usage: 56,
      status: 'Available',
      accent: t.violet,
      isNew: true
    },
    {
      id: 'optimize',
      name: '/optimize',
      description: 'Identify performance bottlenecks and suggest faster alternatives.',
      icon: Zap,
      usage: 0,
      status: 'Coming Soon',
      accent: t.warning,
      isNew: false
    }
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  if (loading) return (
    <>
    <AnimatePresence>
      {showWizard && (
        <OnboardingWizard
          onComplete={handleWizardComplete}
          onNavigate={handleWizardNavigate}
        />
      )}
    </AnimatePresence>
    {!showWizard && (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: t.violet, fontFamily: t.mono, fontSize: '13px' }}>
        <RefreshCw size={20} style={{ animation: 'spin 2s linear infinite', marginRight: '8px' }} />
        INITIALIZING_DASHBOARD...
      </div>
    )}
    </>
  );

  return (
    <>
    {/* Onboarding Wizard Overlay */}
    <AnimatePresence>
      {showWizard && (
        <OnboardingWizard
          onComplete={handleWizardComplete}
          onNavigate={handleWizardNavigate}
        />
      )}
    </AnimatePresence>

    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}
    >
      {/* Header */}
      <motion.header variants={itemVariants} className="dash-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Dashboard <span style={{ fontSize: '24px' }}>👋</span>
          </h1>
          <p style={{ color: t.ts, fontSize: '14px', margin: 0 }}>
            Managing {projects.length} projects across {agents.length} specialized agents.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            padding: '6px 14px', borderRadius: '8px', backgroundColor: t.surface,
            border: `1px solid ${t.border}`, display: 'flex', alignItems: 'center', gap: '8px'
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: t.success, boxShadow: `0 0 10px ${t.success}` }}></div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: t.ts }}>All Systems Operational</span>
          </div>
        </div>
      </motion.header>

      {/* Onboarding Banner */}
      {onboarding && (
        <OnboardingBanner
          steps={onboarding.steps}
          completed={onboarding.completed}
          total={onboarding.total}
          percentage={onboarding.percentage}
          onDismiss={dismissOnboarding}
        />
      )}

      {/* Quick Actions Bar */}
      <motion.div variants={itemVariants} className="dash-actions" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px'
      }}>
        <button
          onClick={() => navigate('/project/new')}
          style={{
            padding: '20px', borderRadius: '12px', background: t.surface, border: `1px solid ${t.violet}66`,
            display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.3s',
            textAlign: 'left', boxShadow: `0 0 20px ${t.violet}15`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = t.violet;
            e.currentTarget.style.boxShadow = `0 10px 30px ${t.violet}25`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = `${t.violet}66`;
            e.currentTarget.style.boxShadow = `0 0 20px ${t.violet}15`;
          }}
        >
          <div style={{ padding: '10px', borderRadius: '8px', background: t.violet, color: '#fff', boxShadow: `0 0 15px ${t.violet}88` }}>
            <Plus size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: t.tp, marginBottom: '2px' }}>New Project</div>
            <div style={{ fontSize: '12px', color: t.ts }}>Initialize testing environment</div>
          </div>
        </button>

        <button
          onClick={() => setShowAgentCreator(true)}
          style={{
            padding: '20px', borderRadius: '12px', background: t.surface, border: `1px solid ${t.success}66`,
            display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.3s',
            textAlign: 'left', boxShadow: `0 0 20px rgba(34, 197, 94, 0.08)`
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.borderColor = t.success;
            e.currentTarget.style.boxShadow = `0 10px 30px rgba(34, 197, 94, 0.15)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = `${t.success}66`;
            e.currentTarget.style.boxShadow = `0 0 20px rgba(34, 197, 94, 0.08)`;
          }}
        >
          <div style={{ padding: '10px', borderRadius: '8px', background: 'rgba(34, 197, 94, 0.15)', color: t.success, boxShadow: `0 0 15px rgba(34, 197, 94, 0.2)` }}>
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: t.tp, marginBottom: '2px' }}>Create Agent</div>
            <div style={{ fontSize: '12px', color: t.ts }}>Design with GPT-5</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/agents')}
          style={{
            padding: '20px', borderRadius: '12px', background: t.surface, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.3s',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.surfaceEl; e.currentTarget.style.borderColor = t.borderS; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.surface; e.currentTarget.style.borderColor = t.border; }}
        >
          <div style={{ padding: '10px', borderRadius: '8px', background: t.surfaceEl, color: t.tp, border: `1px solid ${t.borderS}` }}>
            <Globe size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: t.tp, marginBottom: '2px' }}>Browse Agents</div>
            <div style={{ fontSize: '12px', color: t.ts }}>Explore pretrained models</div>
          </div>
        </button>

        <button
          onClick={() => navigate('/marketplace')}
          style={{
            padding: '20px', borderRadius: '12px', background: t.surface, border: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', transition: 'all 0.3s',
            textAlign: 'left'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = t.surfaceEl; e.currentTarget.style.borderColor = t.borderS; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = t.surface; e.currentTarget.style.borderColor = t.border; }}
        >
          <div style={{ padding: '10px', borderRadius: '8px', background: t.surfaceEl, color: t.tp, border: `1px solid ${t.borderS}` }}>
            <Zap size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '15px', color: t.tp, marginBottom: '2px' }}>Marketplace</div>
            <div style={{ fontSize: '12px', color: t.ts }}>Discover & share agents</div>
          </div>
        </button>
      </motion.div>

      {/* Persona Onboarding CTA */}
      <motion.div variants={itemVariants}>
        <div
          onClick={() => navigate('/personaboarding')}
          className="dash-persona-cta"
          style={{
            position: 'relative', overflow: 'hidden', cursor: 'pointer',
            borderRadius: '16px', padding: '32px 36px',
            background: `linear-gradient(135deg, ${t.surface} 0%, #1e1233 50%, ${t.surface} 100%)`,
            border: `1px solid ${t.violet}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px',
            transition: 'all 0.3s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = t.violet;
            e.currentTarget.style.boxShadow = `0 12px 40px ${t.violet}20`;
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = `${t.violet}33`;
            e.currentTarget.style.boxShadow = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {/* Animated glow orbs */}
          <div style={{
            position: 'absolute', top: '-40px', right: '120px',
            width: '200px', height: '200px', borderRadius: '50%',
            background: `radial-gradient(circle, ${t.violet}18 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: '-60px', left: '30%',
            width: '160px', height: '160px', borderRadius: '50%',
            background: `radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          {/* Left: Icon cluster */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: `linear-gradient(135deg, ${t.violet}, #a855f7)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 24px ${t.violet}44`,
              flexShrink: 0,
            }}>
              <User size={28} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: t.tp, letterSpacing: '-0.01em' }}>
                  Persona Onboarding
                </h3>
                <span style={{
                  padding: '2px 10px', borderRadius: '100px',
                  background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
                  color: '#fff', fontSize: '10px', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                  New
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: t.ts, lineHeight: '1.5', maxWidth: '420px' }}>
                Créez un agent personnalisé qui comprend votre façon de travailler. Chaque choix construit une histoire narrative unique.
              </p>
            </div>
          </div>

          {/* Right: Mini preview chips + arrow */}
          <div className="dash-persona-right" style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', maxWidth: '180px' }}>
              {['Role', 'Skills', 'Style', 'Workflow'].map(tag => (
                <span key={tag} style={{
                  padding: '4px 10px', borderRadius: '6px',
                  backgroundColor: `${t.violet}15`, border: `1px solid ${t.violet}30`,
                  color: t.violet, fontSize: '10px', fontWeight: 600,
                }}>
                  {tag}
                </span>
              ))}
            </div>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              backgroundColor: t.tp, color: t.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'transform 0.2s',
            }}>
              <ArrowUpRight size={20} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Metrics Section */}
      <motion.div variants={itemVariants} className="dash-metrics" style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px'
      }}>
        {[
          { label: 'Total Agents', value: agents.length, icon: Cpu, trend: 'Active', color: t.violet },
          { label: 'Active Projects', value: projects.length, icon: BarChart3, trend: 'Running', color: t.success },
          { label: 'Total Iterations', value: totalIterations, icon: Repeat, trend: 'Completed', color: t.warning }
        ].map((stat, i) => (
          <div key={i} style={{
            background: t.surface, padding: '20px', borderRadius: '12px', border: `1px solid ${t.border}`,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ color: t.ts, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stat.label}
              </div>
              <stat.icon size={18} color={stat.color} />
            </div>
            <div style={{ fontSize: '28px', fontWeight: 800, marginBottom: '6px', color: t.tp }}>
              <Counter value={stat.value} />
            </div>
            <div style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={10} /> {stat.trend}
            </div>
            <div style={{
              position: 'absolute', right: '-20px', bottom: '-20px', width: '100px', height: '100px',
              background: `radial-gradient(circle, ${stat.color}11 0%, transparent 70%)`, borderRadius: '50%'
            }} />
          </div>
        ))}
      </motion.div>

      {/* My Agents Section */}
      <motion.div
        variants={itemVariants}
        style={{ position: 'relative' }}
        onMouseEnter={() => setShowAgentArrows(true)}
        onMouseLeave={() => setShowAgentArrows(false)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
          <div>
            <h2 style={{ color: t.tp, fontSize: '18px', fontWeight: '700', marginBottom: '4px', margin: 0 }}>My Agents</h2>
            <p style={{ color: t.ts, fontSize: '13px', margin: 0 }}>Your active collection of AI specialized tools</p>
          </div>
          <span style={{ color: t.tm, fontSize: '12px', fontWeight: '500' }}>{agents.length} Available</span>
        </div>

        {showAgentArrows && agents.length > 0 && (
          <>
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scrollAgentCarousel('left')}
              style={{
                position: 'absolute',
                left: '-20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                backgroundColor: t.surfaceEl,
                border: `1px solid ${t.borderS}`,
                color: t.tp,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <ChevronLeft size={20} />
            </motion.button>
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scrollAgentCarousel('right')}
              style={{
                position: 'absolute',
                right: '-20px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                backgroundColor: t.surfaceEl,
                border: `1px solid ${t.borderS}`,
                color: t.tp,
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
            >
              <ChevronRight size={20} />
            </motion.button>
          </>
        )}

        <div
          ref={agentScrollRef}
          style={{
            display: 'flex',
            gap: '16px',
            overflowX: 'auto',
            padding: '8px 4px 24px 4px',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
            scrollBehavior: 'smooth'
          }}
        >
          {agents.length === 0 ? (
            <div style={{
              width: '100%',
              padding: '40px',
              textAlign: 'center',
              color: t.tm,
              background: t.surface,
              border: `1px dashed ${t.border}`,
              borderRadius: '12px'
            }}>
              <Bot size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '13px', margin: 0 }}>No agents available yet</p>
            </div>
          ) : (
            <>
              {agents.map((agent, idx) => (
                <motion.div
                  key={agent.name || idx}
                  whileHover={{ y: -5, borderColor: t.violet, boxShadow: `0 8px 30px ${t.violetG}` }}
                  style={{
                    flex: '0 0 300px',
                    backgroundColor: t.surface,
                    border: `1px solid ${t.border}`,
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                  onClick={() => navigate(`/agents/${agent.name}`)}
                >
                  {/* Agent thumbnail */}
                  {agent.screenshot_path && (
                    <div style={{
                      marginBottom: '10px', borderRadius: '8px', overflow: 'hidden',
                      aspectRatio: '16/10', backgroundColor: '#141415',
                      border: `1px solid ${t.border}`,
                    }}>
                      <img src={agent.screenshot_path + '?t=1'} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: idx % 2 === 0 ? t.violetM : 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: idx % 2 === 0 ? t.violet : t.ts,
                      border: `1px solid ${idx % 2 === 0 ? t.violet : t.border}`
                    }}>
                      {idx % 2 === 0 ? <Bot size={22} /> : <Cpu size={22} />}
                    </div>
                    {agent.rating && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: t.warning }}>
                        <Star size={12} fill={t.warning} />
                        <span style={{ fontSize: '12px', fontWeight: '600' }}>{agent.rating}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h3 style={{ color: t.tp, fontSize: '15px', fontWeight: '600', margin: 0 }}>{agent.name}</h3>
                      {agent.category && (
                        <Badge color={t.violet}>{agent.category}</Badge>
                      )}
                    </div>
                    <p style={{
                      color: t.ts,
                      fontSize: '12px',
                      lineHeight: '1.5',
                      margin: 0,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      height: '36px'
                    }}>
                      {agent.description || 'No description available'}
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      style={{
                        backgroundColor: t.tp,
                        color: t.bg,
                        border: 'none',
                        borderRadius: '4px',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        flex: 2
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/project/new?agent=${agent.name}`);
                      }}
                    >
                      <Play size={14} fill="currentColor" />
                      Use
                    </motion.button>
                    <button
                      style={{
                        backgroundColor: t.surfaceEl,
                        color: t.ts,
                        border: `1px solid ${t.borderS}`,
                        borderRadius: '4px',
                        padding: '8px 16px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        flex: 1.5
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agents/${agent.name}`);
                      }}
                    >
                      <Eye size={14} />
                      View
                    </button>
                    <button
                      style={{
                        backgroundColor: t.surfaceEl,
                        color: t.ts,
                        border: `1px solid ${t.borderS}`,
                        borderRadius: '4px',
                        padding: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/agents/${agent.name}/edit`);
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
              <div style={{ minWidth: '10px' }} />
            </>
          )}
        </div>
      </motion.div>

      {/* My Skills Section */}
      <motion.div variants={itemVariants} style={{ width: '100%' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: '20px',
          padding: '0 4px'
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              color: t.tp,
              margin: '0 0 4px 0',
              letterSpacing: '-0.01em'
            }}>
              Platform Capabilities
            </h2>
            <p style={{ fontSize: '13px', color: t.ts, margin: 0 }}>
              Slash commands and specialized agent skills available for your projects.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px'
        }}>
          {skills.map((skill) => (
            <motion.div
              key={skill.id}
              whileHover={{ y: -2 }}
              onMouseEnter={() => setActiveSkill(skill.id)}
              onMouseLeave={() => setActiveSkill(null)}
              style={{
                backgroundColor: t.surface,
                border: `1px solid ${activeSkill === skill.id ? t.violet : t.border}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                boxShadow: activeSkill === skill.id ? `0 0 20px ${t.violetG}` : 'none',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '60px',
                height: '60px',
                background: skill.accent,
                filter: 'blur(40px)',
                opacity: activeSkill === skill.id ? 0.15 : 0.05,
                borderRadius: '50%',
                transition: 'opacity 0.3s ease'
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  backgroundColor: `${skill.accent}15`,
                  border: `1px solid ${skill.accent}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: skill.accent
                }}>
                  <skill.icon size={18} />
                </div>

                {skill.isNew ? (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '100px',
                    backgroundColor: t.violetM,
                    border: `1px solid ${t.violet}`,
                    color: t.violet,
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    New
                  </span>
                ) : (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', fontWeight: '600' }}>Uses</div>
                    <div style={{ fontSize: '13px', color: t.ts, fontWeight: '500', fontFamily: t.mono }}>{skill.usage}</div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '12px' }}>
                <h3 style={{
                  margin: '0 0 6px 0',
                  fontSize: '15px',
                  color: t.tp,
                  fontFamily: t.mono,
                  fontWeight: '600'
                }}>
                  {skill.name}
                </h3>
                <p style={{
                  margin: 0,
                  fontSize: '13px',
                  color: t.ts,
                  lineHeight: '1.5',
                  height: '40px',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {skill.description}
                </p>
              </div>

              <div style={{
                marginTop: 'auto',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: '12px',
                borderTop: `1px solid ${t.border}`
              }}>
                <span style={{
                  fontSize: '11px',
                  color: skill.status === 'Available' ? t.success : t.tm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: skill.status === 'Available' ? t.success : t.tm
                  }} />
                  {skill.status}
                </span>

                <motion.div
                  animate={{ x: activeSkill === skill.id ? 4 : 0 }}
                  style={{ display: 'flex', alignItems: 'center', color: t.violet, fontSize: '12px', fontWeight: '600' }}
                >
                  Use skill <ChevronRight size={14} />
                </motion.div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="dash-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '28px', alignItems: 'start' }}>

        {/* Projects Column */}
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              Projects <Badge color={t.ts}>{projects.length}</Badge>
            </h2>
          </div>

          {projects.length === 0 ? (
            <div>
              <TemplateGallery onProjectCreated={fetchData} />
              <div style={{
                marginTop: '20px', textAlign: 'center', padding: '16px',
                borderRadius: '10px', border: `1px dashed ${t.border}`,
                background: `${t.surface}44`,
              }}>
                <span style={{ color: t.ts, fontSize: '13px' }}>
                  Or{' '}
                  <button onClick={() => navigate('/project/new')} style={{
                    background: 'none', border: 'none', color: t.violet, cursor: 'pointer',
                    fontWeight: 600, fontSize: '13px', textDecoration: 'underline',
                  }}>
                    create an empty project
                  </button>
                  {' '}from scratch
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <TemplateGallery compact onProjectCreated={fetchData} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} navigate={navigate} onDelete={handleDeleteProject} t={t} />
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Right Sidebar */}
        <motion.div variants={itemVariants} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Ask Guru AI */}
          <div style={{
            background: `linear-gradient(135deg, ${t.surface}, ${t.bg})`,
            borderRadius: '14px', border: `1px solid ${t.violet}33`,
            padding: '20px', boxShadow: `0 10px 40px -10px ${t.violet}15`,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ padding: '6px', borderRadius: '6px', background: t.violetG, color: t.violet }}>
                <Sparkles size={16} />
              </div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>Ask Guru AI</h3>
            </div>
            <p style={{ fontSize: '12px', color: t.ts, marginBottom: '16px', lineHeight: '1.5' }}>
              Get recommendations for agent selection, optimization tips, and platform guidance.
            </p>

            <div style={{ position: 'relative' }}>
              <textarea
                value={guruPrompt}
                onChange={(e) => setGuruPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAskGuru();
                  }
                }}
                placeholder="Ask anything..."
                style={{
                  width: '100%', height: '70px', backgroundColor: t.bg, border: `1px solid ${t.border}`,
                  borderRadius: '10px', padding: '10px', color: t.tp, fontSize: '13px', resize: 'none',
                  outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = t.violet}
                onBlur={(e) => e.target.style.borderColor = t.border}
              />
              <button
                onClick={handleAskGuru}
                disabled={guruLoading || !guruPrompt.trim()}
                style={{
                  position: 'absolute', bottom: '8px', right: '8px',
                  padding: '5px 10px', backgroundColor: t.violet, color: '#fff', border: 'none',
                  borderRadius: '5px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                  opacity: (!guruPrompt.trim() || guruLoading) ? 0.5 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {guruLoading ? 'Thinking...' : 'Send'}
              </button>
            </div>

            {guruResponse && (
              <div style={{
                marginTop: '12px', padding: '10px', borderRadius: '8px',
                backgroundColor: `${t.violet}08`, borderLeft: `3px solid ${t.violet}`,
                fontSize: '12px', color: t.tp, lineHeight: '1.5', fontFamily: t.mono,
                maxHeight: '200px', overflowY: 'auto'
              }}>
                {guruResponse}
              </div>
            )}
          </div>

          {/* Live Activity Feed */}
          <div style={{
            background: t.surface, borderRadius: '14px', border: `1px solid ${t.border}`,
            display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                <Terminal size={13} color={t.ts} /> Activity Log
              </h3>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                backgroundColor: t.success,
                animation: 'pulse 2s infinite'
              }}></div>
            </div>
            <div style={{
              height: '220px', overflowY: 'auto', padding: '12px', fontFamily: t.mono, fontSize: '11px',
              display: 'flex', flexDirection: 'column', gap: '8px'
            }}>
              {projects.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: '8px', opacity: 1 }}>
                    <span style={{ color: t.tm, whiteSpace: 'nowrap' }}>[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                    <span style={{ color: t.success }}>System initialized</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', opacity: 0.8 }}>
                    <span style={{ color: t.tm, whiteSpace: 'nowrap' }}>[{new Date(Date.now() - 120000).toLocaleTimeString('en-US', { hour12: false })}]</span>
                    <span style={{ color: t.ts }}>Projects loaded ({projects.length})</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', opacity: 0.6 }}>
                    <span style={{ color: t.tm, whiteSpace: 'nowrap' }}>[{new Date(Date.now() - 240000).toLocaleTimeString('en-US', { hour12: false })}]</span>
                    <span style={{ color: t.ts }}>Agent registry synced</span>
                  </div>
                </>
              )}
              {projects.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: t.tm }}>
                  No activity yet
                </div>
              )}
            </div>
          </div>

          {/* System Status */}
          <div style={{
            background: t.surface, borderRadius: '14px', border: `1px solid ${t.border}`,
            padding: '16px'
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>Platform Status</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                  <span style={{ color: t.ts }}>Project Capacity</span>
                  <span style={{ color: t.tp, fontWeight: 600 }}>{projects.length}/20</span>
                </div>
                <div style={{ width: '100%', height: '5px', backgroundColor: t.bg, borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(projects.length / 20) * 100}%`,
                    height: '100%',
                    backgroundColor: t.violet,
                    borderRadius: '10px',
                    transition: 'width 0.5s ease-out'
                  }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                  <span style={{ color: t.ts }}>Agent Registry</span>
                  <span style={{ color: t.tp, fontWeight: 600 }}>{agents.length} loaded</span>
                </div>
                <div style={{ width: '100%', height: '5px', backgroundColor: t.bg, borderRadius: '10px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', backgroundColor: t.success, borderRadius: '10px' }}></div>
                </div>
              </div>
            </div>
          </div>

        </motion.div>
      </div>

      {/* CSS Animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
          100% { opacity: 1; transform: scale(1); }
        }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${t.borderS}; borderRadius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: ${t.tm}; }

        @media (max-width: 1024px) {
          .dash-main-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .dash-actions { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .dash-metrics { grid-template-columns: 1fr !important; gap: 12px !important; }
          .dash-main-grid { grid-template-columns: 1fr !important; }
          .dash-header { flex-direction: column; align-items: flex-start !important; }
          .dash-persona-cta { flex-direction: column !important; padding: 20px !important; gap: 16px !important; align-items: flex-start !important; }
          .dash-persona-right { display: none !important; }
        }
        @media (max-width: 480px) {
          .dash-actions { grid-template-columns: 1fr !important; }
        }
      `}} />

      {/* Agent Creator Modal */}
      {showAgentCreator && <AgentCreator onClose={() => setShowAgentCreator(false)} />}
    </motion.div>
    </>
  );
}
