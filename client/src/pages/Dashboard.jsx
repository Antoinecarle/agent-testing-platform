import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Play, Activity, Clock, Terminal, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, RefreshCw, MonitorDot, Repeat } from 'lucide-react';
import { api } from '../api';
import StatusIndicator from '../components/StatusIndicator';
import MetricsCard from '../components/MetricsCard';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [hoveredAction, setHoveredAction] = useState(null);
  const [guruPrompt, setGuruPrompt] = useState('');
  const [guruResponse, setGuruResponse] = useState('');
  const [guruLoading, setGuruLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [p, a] = await Promise.all([api('/api/projects'), api('/api/agents')]);
      setProjects(p || []);
      setAgents(a || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await api('/api/seed', { method: 'POST' });
      await fetchData();
    } catch (e) { console.error(e); }
    finally { setSeeding(false); }
  };

  const quickActions = [
    { id: 'new', label: 'New Project', icon: <Plus size={16} />, onClick: () => navigate('/projects/new') },
    { id: 'browse', label: 'Browse Agents', icon: <Search size={16} />, onClick: () => navigate('/agents') },
    { id: 'run', label: 'Run Test', icon: <Play size={16} />, onClick: () => navigate('/test-runner'), primary: true },
  ];

  const totalIterations = projects.reduce((a, p) => a + (p.iteration_count || 0), 0);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: t.violet, fontFamily: t.mono, fontSize: '13px' }}>
      INITIALIZING_DASHBOARD...
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '600', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          {projects.length === 0 && (
            <button onClick={handleSeed} disabled={seeding} style={{
              background: 'transparent', color: t.tp, border: `1px solid ${t.borderS}`,
              padding: '8px 16px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
            }}>{seeding ? 'Seeding...' : 'Seed Data'}</button>
          )}
        </div>
      </header>

      {/* Quick Actions Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        paddingBottom: '16px',
        borderBottom: `1px solid ${t.border}`
      }}>
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            onMouseEnter={() => setHoveredAction(action.id)}
            onMouseLeave={() => setHoveredAction(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: action.primary ? t.violet : 'transparent',
              border: `1px solid ${action.primary ? t.violet : t.borderS}`,
              borderRadius: '4px',
              color: t.tp,
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: action.primary && hoveredAction === action.id ? `0 0 20px ${t.violetG}` : 'none',
              opacity: hoveredAction && hoveredAction !== action.id ? 0.7 : 1,
            }}
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>

      {/* Main Dashboard Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* Left Column: Metrics + Activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metrics Cards */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <MetricsCard
              label="Total Agents"
              value={agents.length}
              icon={<MonitorDot size={18} />}
              trend={{ direction: 'up', value: '+2' }}
            />
            <MetricsCard
              label="Active Projects"
              value={projects.length}
              icon={<Activity size={18} />}
              trend={{ direction: 'up', value: '+3' }}
            />
            <MetricsCard
              label="Total Iterations"
              value={totalIterations}
              icon={<Repeat size={18} />}
              trend={{ direction: 'neutral', value: '—' }}
            />
          </div>

          {/* Activity Feed */}
          <div style={{
            backgroundColor: t.surface,
            border: `1px solid ${t.border}`,
            borderRadius: '12px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, color: t.tp, fontSize: '16px', fontWeight: '600' }}>Recent Activity</h3>
              <span style={{ color: t.tm, fontSize: '12px', fontFamily: t.mono }}>LIVE_FEED_V2</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { type: 'success', msg: 'Iteration #142 complete', meta: 'agent-ux-01', time: new Date(Date.now() - 120000) },
                { type: 'terminal', msg: 'DOM snapshot captured', meta: 'auth-flow-test', time: new Date(Date.now() - 300000) },
                { type: 'warning', msg: 'Latency threshold reached', meta: 'api-gateway', time: new Date(Date.now() - 720000) },
                { type: 'success', msg: 'New baseline generated', meta: 'checkout-v2', time: new Date(Date.now() - 1080000) },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '8px 12px',
                  backgroundColor: t.surfaceEl,
                  borderRadius: '4px',
                  borderLeft: `2px solid ${
                    item.type === 'success' ? t.success :
                    item.type === 'warning' ? t.warning :
                    t.violet
                  }`
                }}>
                  {item.type === 'terminal' ? <Terminal size={14} style={{ color: t.violet }} /> :
                   item.type === 'warning' ? <AlertCircle size={14} style={{ color: t.warning }} /> :
                   <CheckCircle2 size={14} style={{ color: t.success }} />}

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ color: t.tp, fontSize: '13px', fontWeight: '500' }}>{item.msg}</span>
                    <span style={{ color: t.tm, fontSize: '11px', fontFamily: t.mono }}>
                      {item.meta}
                    </span>
                  </div>

                  <StatusIndicator
                    status={item.type === 'success' ? 'success' : item.type === 'warning' ? 'error' : 'idle'}
                    timestamp={item.time}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: System Status */}
        <div style={{
          backgroundColor: t.surfaceEl,
          border: `1px solid ${t.borderS}`,
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h4 style={{ margin: 0, color: t.ts, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Status</h4>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: t.success, boxShadow: `0 0 8px ${t.success}` }} />
                <span style={{ color: t.tp, fontSize: '14px' }}>Inference Engine</span>
              </div>
              <span style={{ color: t.tm, fontSize: '12px', fontFamily: t.mono }}>0.12ms</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: t.ts }}>Project Capacity</span>
                <span style={{ color: t.tp }}>{projects.length}/20</span>
              </div>
              <div style={{ width: '100%', height: '4px', backgroundColor: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${(projects.length / 20) * 100}%`,
                  height: '100%',
                  backgroundColor: t.violet,
                  transition: 'width 1s ease-out'
                }} />
              </div>
            </div>

            <button
              style={{
                marginTop: '16px',
                padding: '8px',
                backgroundColor: 'transparent',
                border: `1px solid ${t.borderS}`,
                borderRadius: '4px',
                color: t.ts,
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = t.tp}
              onMouseLeave={(e) => e.currentTarget.style.color = t.ts}
            >
              <Terminal size={14} />
              Open System Logs
            </button>
          </div>
        </div>

        {/* Ask Guru - Orchestrator Chat */}
        <div style={{
          gridColumn: '1 / -1',
          backgroundColor: t.surface,
          border: `1px solid ${t.border}`,
          borderRadius: '12px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '6px', background: t.violetM,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={t.violet} strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
            </div>
            <h3 style={{ margin: 0, color: t.tp, fontSize: '16px', fontWeight: '600' }}>Ask Guru</h3>
            <span style={{ color: t.tm, fontSize: '11px', fontFamily: t.mono, marginLeft: 'auto' }}>ORCHESTRATOR_V1</span>
          </div>

          <div style={{ position: 'relative' }}>
            <input
              value={guruPrompt}
              onChange={e => setGuruPrompt(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && guruPrompt.trim() && !guruLoading) {
                  setGuruLoading(true);
                  setGuruResponse('');
                  api('/api/orchestrator/command', {
                    method: 'POST',
                    body: JSON.stringify({ prompt: guruPrompt }),
                  }).then(r => setGuruResponse(r.response))
                    .catch(err => setGuruResponse(`Error: ${err.message}`))
                    .finally(() => setGuruLoading(false));
                }
              }}
              placeholder="Ask about agents, project setup, or get recommendations..."
              style={{
                width: '100%', padding: '10px 80px 10px 14px', background: t.surfaceEl,
                border: `1px solid ${t.borderS}`, borderRadius: '8px', color: t.tp,
                fontSize: '13px', outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (!guruPrompt.trim() || guruLoading) return;
                setGuruLoading(true);
                setGuruResponse('');
                api('/api/orchestrator/command', {
                  method: 'POST',
                  body: JSON.stringify({ prompt: guruPrompt }),
                }).then(r => setGuruResponse(r.response))
                  .catch(err => setGuruResponse(`Error: ${err.message}`))
                  .finally(() => setGuruLoading(false));
              }}
              disabled={!guruPrompt.trim() || guruLoading}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: guruPrompt.trim() && !guruLoading ? t.violet : t.tm, color: '#fff',
                border: 'none', borderRadius: '4px', padding: '6px 12px', fontSize: '11px',
                fontWeight: '600', cursor: guruPrompt.trim() && !guruLoading ? 'pointer' : 'default',
                opacity: guruPrompt.trim() && !guruLoading ? 1 : 0.5,
              }}
            >
              {guruLoading ? '...' : 'Ask'}
            </button>
          </div>

          {guruResponse && (
            <div style={{
              padding: '14px', background: t.surfaceEl, borderRadius: '8px',
              border: `1px solid ${t.border}`, fontSize: '13px', color: t.ts,
              lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: t.mono,
              maxHeight: '300px', overflowY: 'auto',
            }}>
              {guruResponse}
            </div>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length > 0 ? (
        <section>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: t.tp }}>Projects</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => navigate(`/project/${p.id}`)}
                style={{
                  background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px',
                  cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.violet; e.currentTarget.style.boxShadow = `0 0 30px ${t.violetG}`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                {/* Thumbnail Preview */}
                <div style={{
                  width: '100%', height: '180px', overflow: 'hidden', position: 'relative',
                  background: t.surfaceEl, borderBottom: `1px solid ${t.border}`,
                }}>
                  {p.latest_iteration_id ? (
                    <iframe
                      src={`/api/preview/${p.id}/${p.latest_iteration_id}`}
                      title={`Preview ${p.name}`}
                      style={{
                        width: '1280px', height: '800px', border: 'none',
                        transform: 'scale(0.28)', transformOrigin: 'top left',
                        pointerEvents: 'none',
                      }}
                      sandbox="allow-same-origin"
                      loading="lazy"
                    />
                  ) : (
                    <div style={{
                      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: '8px',
                    }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={t.tm} strokeWidth="1.5">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <line x1="8" y1="21" x2="16" y2="21" />
                        <line x1="12" y1="17" x2="12" y2="21" />
                      </svg>
                      <span style={{ fontSize: '11px', color: t.tm, fontFamily: t.mono }}>NO_PREVIEW</span>
                    </div>
                  )}
                </div>

                {/* Card Content */}
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>{p.name}</h3>
                    <span style={{
                      background: t.violetM, color: t.violet, fontSize: '10px', padding: '2px 8px',
                      borderRadius: '100px', fontWeight: '600', border: `1px solid rgba(139,92,246,0.2)`,
                      whiteSpace: 'nowrap',
                    }}>{p.agent_name}</span>
                  </div>
                  {p.description && <div style={{ fontSize: '13px', color: t.ts, lineHeight: '1.5' }}>{p.description}</div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '12px', borderTop: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: '12px', color: t.ts, fontFamily: t.mono }}>{p.iteration_count} iterations</span>
                    <StatusIndicator
                      status={p.status === 'active' ? 'running' : 'idle'}
                      timestamp={p.updated_at ? new Date(p.updated_at) : null}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '60px', textAlign: 'center', background: t.surface,
          border: `1px dashed ${t.borderS}`, borderRadius: '12px', gap: '16px',
        }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={t.tm} strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
          <h2 style={{ fontSize: '18px' }}>No projects found</h2>
          <p style={{ color: t.ts, fontSize: '14px', maxWidth: '300px' }}>Get started by seeding demo data from existing landing pages.</p>
          <button onClick={handleSeed} disabled={seeding} style={{
            background: t.tp, color: t.bg, border: 'none', borderRadius: '4px',
            padding: '10px 20px', fontSize: '13px', fontWeight: '600', marginTop: '8px',
          }}>{seeding ? 'Seeding...' : 'Seed Demo Data'}</button>
        </div>
      )}
    </div>
  );
}
