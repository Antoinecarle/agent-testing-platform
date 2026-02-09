import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BarChart3, Star, Users, Layers, Activity, PieChart,
  Database, Cpu, ChevronRight, TrendingUp, FileCode, Globe
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

function StatCard({ icon: Icon, label, value, subtext, color = t.violet }) {
  return (
    <div style={{
      backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
      padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.05 }}>
        <Icon size={80} color={color} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          padding: '6px', borderRadius: '6px', backgroundColor: `${color}15`, color: color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={14} />
        </div>
        <span style={{ color: t.ts, fontSize: '12px', fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ color: t.tp, fontSize: '24px', fontWeight: 600, letterSpacing: '-0.02em' }}>{value}</span>
        {subtext && <span style={{ color: t.tm, fontSize: '11px' }}>{subtext}</span>}
      </div>
    </div>
  );
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
      {Icon && <Icon size={14} style={{ color: t.violet }} />}
      <h2 style={{ color: t.tp, fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{children}</h2>
    </div>
  );
}

export default function AgentStats() {
  const [stats, setStats] = useState(null);
  const [topAgents, setTopAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, agentsRes] = await Promise.all([
          api('/api/agents/stats'),
          api('/api/agents'),
        ]);
        setStats(statsRes);
        const sorted = [...(agentsRes || [])].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
        setTopAgents(sorted);
      } catch (err) {
        console.error('Error fetching dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return (
    <div style={{
      height: 'calc(100vh - 53px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.bg, color: t.ts,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <Activity size={24} style={{ color: t.violet }} />
        <span style={{ fontSize: '13px', letterSpacing: '0.05em' }}>ANALYZING AGENT DATA...</span>
      </div>
    </div>
  );

  const sourceTotal = stats?.bySource?.reduce((sum, s) => sum + s.count, 0) || 1;
  const filesystemCount = stats?.bySource?.find(s => s.source === 'filesystem')?.count || 0;
  const filesystemPct = Math.round((filesystemCount / sourceTotal) * 100);

  return (
    <div style={{
      height: 'calc(100vh - 53px)', backgroundColor: t.bg, padding: '24px', overflowY: 'auto',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <h1 style={{ color: t.tp, fontSize: '20px', fontWeight: 600, margin: '0 0 4px 0' }}>Agent Statistics</h1>
            <p style={{ color: t.ts, fontSize: '13px', margin: 0 }}>System-wide metrics and distribution for all agents.</p>
          </div>
          <div style={{
            padding: '6px 12px', borderRadius: '4px', border: `1px solid ${t.border}`,
            color: t.ts, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: t.success }} />
            Live
          </div>
        </div>

        {/* Top Grid: Main Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px', marginBottom: '32px',
        }}>
          <StatCard icon={Users} label="Total Agents" value={stats?.total || 0} subtext="deployed" />
          <StatCard icon={Star} label="Avg Rating" value={`${(stats?.avgRating || 0).toFixed(1)}/5.0`} color={t.warning} subtext="user feedback" />
          <StatCard icon={Layers} label="Total Projects" value={stats?.totalProjects || 0} subtext="active" />
          <StatCard icon={TrendingUp} label="Categories" value={stats?.byCategory?.length || 0} color={t.success} subtext="organized" />
        </div>

        {/* Middle Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', marginBottom: '32px' }}>

          {/* Category Distribution */}
          <div style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <SectionTitle icon={BarChart3}>Agent Distribution by Category</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {stats?.byCategory?.map((cat, idx) => {
                const percentage = stats.total > 0 ? (cat.count / stats.total) * 100 : 0;
                return (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: t.ts, textTransform: 'capitalize' }}>{cat.category}</span>
                      <span style={{ color: t.tp, fontWeight: 500 }}>
                        {cat.count} <span style={{ color: t.tm, fontSize: '10px' }}>({percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div style={{ height: '6px', width: '100%', backgroundColor: t.surfaceEl, borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${percentage}%`, backgroundColor: t.violet,
                        boxShadow: `0 0 10px ${t.violetG}`, borderRadius: '3px',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Source Breakdown */}
          <div style={{
            backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px',
            display: 'flex', flexDirection: 'column',
          }}>
            <SectionTitle icon={PieChart}>Source Analysis</SectionTitle>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
              <div style={{
                width: '120px', height: '120px', borderRadius: '50%',
                background: `conic-gradient(${t.violet} 0% ${filesystemPct}%, ${t.surfaceEl} ${filesystemPct}% 100%)`,
                position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%', backgroundColor: t.surface,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Database size={16} style={{ color: t.tm, marginBottom: '2px' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: t.tp }}>{stats?.total || 0}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              {stats?.bySource?.map((src, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px', borderRadius: '6px', backgroundColor: t.surfaceEl,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {src.source === 'filesystem' ? <FileCode size={12} color={t.violet} /> : <Globe size={12} color={t.ts} />}
                    <span style={{ fontSize: '11px', color: t.ts, textTransform: 'capitalize' }}>{src.source}</span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: t.tp }}>{src.count} agents</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>

          {/* Model Usage */}
          <div style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <SectionTitle icon={Cpu}>Model Usage</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {stats?.byModel?.map((model, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px', borderBottom: i !== stats.byModel.length - 1 ? `1px solid ${t.border}` : 'none',
                }}>
                  <span style={{ fontSize: '12px', color: t.tp, fontFamily: t.mono }}>{model.model}</span>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: t.violet }}>{model.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Rated Agents */}
          <div style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px', padding: '20px' }}>
            <SectionTitle icon={Star}>Top Rated Agents</SectionTitle>
            <div style={{ width: '100%', overflow: 'hidden' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Header row */}
                <div style={{
                  display: 'flex', padding: '12px 8px', borderBottom: `1px solid ${t.border}`,
                }}>
                  <span style={{ flex: 2, fontSize: '11px', color: t.tm, textTransform: 'uppercase' }}>Agent</span>
                  <span style={{ flex: 1, fontSize: '11px', color: t.tm, textTransform: 'uppercase' }}>Category</span>
                  <span style={{ width: '80px', fontSize: '11px', color: t.tm, textTransform: 'uppercase', textAlign: 'right' }}>Rating</span>
                  <span style={{ width: '30px' }} />
                </div>
                {topAgents.map((agent, i) => (
                  <div
                    key={agent.name}
                    onClick={() => navigate(`/agents/${agent.name}`)}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '12px 8px', cursor: 'pointer',
                      borderBottom: i !== topAgents.length - 1 ? `1px solid ${t.border}` : 'none',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ flex: 2, display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '4px', backgroundColor: t.surfaceEl,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: t.violet, fontSize: '12px', fontWeight: 'bold',
                      }}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 500, color: t.tp }}>
                          {agent.name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </div>
                        <div style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono }}>{agent.model || 'unknown'}</div>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: t.violetM, color: t.violet,
                      }}>
                        {agent.category}
                      </span>
                    </div>
                    <div style={{ width: '80px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <Star size={10} fill={t.warning} color={t.warning} />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: t.tp }}>{agent.rating || 0}</span>
                    </div>
                    <div style={{ width: '30px', textAlign: 'right' }}>
                      <ChevronRight size={14} color={t.tm} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Link to="/agents" style={{
              display: 'block', textAlign: 'center', marginTop: '16px', fontSize: '11px',
              color: t.ts, textDecoration: 'none', padding: '8px', borderRadius: '6px',
              border: `1px dashed ${t.border}`,
            }}>
              View all agents
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
