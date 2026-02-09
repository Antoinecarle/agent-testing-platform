import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  Share2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  AlertCircle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)',
  borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6',
  violetM: 'rgba(139,92,246,0.2)',
  violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5',
  ts: '#A1A1AA',
  tm: '#52525B',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

export default function ClientPreview() {
  const { projectId } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedIterationId, setSelectedIterationId] = useState(null);
  const [viewport, setViewport] = useState('desktop');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [barCollapsed, setBarCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/preview/showcase/${projectId}`);
        const result = await res.json();
        setData(result);
        if (result.iterations?.length > 0) {
          const sorted = [...result.iterations].sort((a, b) => b.version - a.version);
          setSelectedIterationId(sorted[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch showcase data', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const activeIteration = useMemo(() => {
    return data?.iterations?.find(i => i.id === selectedIterationId);
  }, [data, selectedIterationId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch (_) {}
  };

  if (loading) {
    return (
      <div style={{
        height: '100vh', backgroundColor: t.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px'
      }}>
        <div style={{
          width: '40px', height: '40px',
          border: `2px solid ${t.violetM}`, borderTopColor: t.violet,
          borderRadius: '50%', animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: t.ts, fontFamily: t.mono, fontSize: '12px' }}>Loading preview...</span>
      </div>
    );
  }

  if (!data?.project) {
    return (
      <div style={{
        height: '100vh', backgroundColor: t.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px', color: t.tm
      }}>
        <AlertCircle size={32} />
        <span style={{ fontSize: '14px' }}>Project not found</span>
      </div>
    );
  }

  const viewportWidths = { desktop: '100%', tablet: '768px', mobile: '390px' };
  const sortedIterations = [...data.iterations].sort((a, b) => a.version - b.version);

  return (
    <div style={{
      height: '100vh', width: '100vw', backgroundColor: t.bg, color: t.tp,
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', position: 'relative'
    }}>
      {/* Full-screen Preview Area */}
      <main style={{
        flex: 1, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#050505', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background Gradient (non-desktop only) */}
        {viewport !== 'desktop' && (
          <div style={{
            position: 'absolute', bottom: '10%', left: '50%', transform: 'translateX(-50%)',
            width: '80%', height: '40%',
            background: `radial-gradient(circle at center, ${t.violetG} 0%, transparent 70%)`,
            zIndex: 0, pointerEvents: 'none',
          }} />
        )}

        {/* Viewport Container */}
        <div style={{
          width: viewportWidths[viewport],
          height: viewport === 'desktop' ? '100%' : 'calc(100% - 100px)',
          maxWidth: '100%',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative', zIndex: 1,
          boxShadow: viewport === 'desktop' ? 'none' : '0 24px 64px rgba(0,0,0,0.8)',
          borderRadius: viewport === 'desktop' ? '0' : '12px',
          overflow: 'hidden',
          border: viewport === 'desktop' ? 'none' : `1px solid ${t.borderS}`,
        }}>
          {activeIteration ? (
            <iframe
              key={`${selectedIterationId}-${isRefreshing}`}
              src={`/api/preview/${projectId}/${selectedIterationId}`}
              style={{
                width: '100%', height: '100%', border: 'none',
                backgroundColor: 'white',
                opacity: isRefreshing ? 0.5 : 1, transition: 'opacity 0.2s',
              }}
              title={`Iteration v${activeIteration.version}`}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: t.tm, flexDirection: 'column', gap: '12px',
            }}>
              <AlertCircle size={32} />
              <span style={{ fontSize: '14px' }}>No iteration selected</span>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Control Bar */}
      <div style={{
        position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
        width: barCollapsed ? 'auto' : 'calc(100% - 40px)', maxWidth: barCollapsed ? 'none' : '1100px',
        backgroundColor: 'rgba(15, 15, 15, 0.85)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${t.borderS}`, borderRadius: '16px',
        zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}>
        {/* Collapsed state: just a small pill */}
        {barCollapsed ? (
          <button onClick={() => setBarCollapsed(false)} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 16px', border: 'none', background: 'transparent',
            cursor: 'pointer', color: t.ts,
          }}>
            <ChevronUp size={14} />
            <span style={{ fontFamily: t.mono, fontSize: '11px', fontWeight: 600 }}>
              v{activeIteration?.version || '?'}
            </span>
            <div style={{ width: '1px', height: '12px', backgroundColor: t.border }} />
            <span style={{ fontSize: '10px', color: t.tm }}>{data.project.name}</span>
          </button>
        ) : (
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Row 1: Brand + Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Left: Branding */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '14px', letterSpacing: '-0.5px' }}>guru</span>
                  <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '14px', color: t.violet }}>.ai</span>
                </div>
                <div style={{ width: '1px', height: '16px', backgroundColor: t.border }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: t.tp }}>{data.project.name}</span>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '2px 8px', borderRadius: '100px',
                  background: activeIteration?.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                  border: `1px solid ${activeIteration?.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
                }}>
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    backgroundColor: activeIteration?.status === 'completed' ? t.success : t.warning,
                  }} />
                  <span style={{ fontSize: '10px', color: activeIteration?.status === 'completed' ? t.success : t.warning, fontWeight: 500 }}>
                    {activeIteration?.status === 'completed' ? 'Live' : 'Draft'}
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
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
                    <button key={v.id} onClick={() => setViewport(v.id)} style={{
                      padding: '4px 7px', borderRadius: '6px', border: 'none',
                      backgroundColor: viewport === v.id ? t.surfaceEl : 'transparent',
                      color: viewport === v.id ? t.violet : t.tm,
                      cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center',
                    }}>
                      {v.icon}
                    </button>
                  ))}
                </div>

                <button onClick={handleRefresh} style={{
                  padding: '6px', borderRadius: '8px', border: `1px solid ${t.border}`,
                  backgroundColor: 'transparent', color: t.ts, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <RefreshCcw size={14} style={isRefreshing ? { animation: 'spin 0.8s ease-in-out' } : {}} />
                </button>

                <button onClick={handleShare} style={{
                  padding: '6px 12px', borderRadius: '8px', backgroundColor: t.violet,
                  border: 'none', color: 'white', fontSize: '11px', fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                  boxShadow: `0 0 10px ${t.violetG}`,
                }}>
                  <Share2 size={13} />
                  <span>Share</span>
                </button>

                <button onClick={() => setBarCollapsed(true)} style={{
                  padding: '6px', borderRadius: '8px', border: `1px solid ${t.border}`,
                  backgroundColor: 'transparent', color: t.tm, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            {/* Row 2: Iteration Navigator */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              overflowX: 'auto', paddingBottom: '2px',
              msOverflowStyle: 'none', scrollbarWidth: 'none',
            }}>
              {sortedIterations.map((iter) => {
                const isActive = selectedIterationId === iter.id;
                return (
                  <button
                    key={iter.id}
                    onClick={() => setSelectedIterationId(iter.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px',
                      padding: '7px 14px', borderRadius: '10px',
                      backgroundColor: isActive ? t.violetM : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isActive ? t.violet : t.border}`,
                      cursor: 'pointer', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      whiteSpace: 'nowrap', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      backgroundColor: iter.status === 'completed' ? t.success : iter.status === 'error' ? t.danger : t.warning,
                    }} />
                    <span style={{
                      fontSize: '12px', fontWeight: 600,
                      color: isActive ? t.tp : t.ts, fontFamily: t.mono,
                    }}>
                      v{iter.version}
                    </span>
                    {iter.title && (
                      <span style={{
                        fontSize: '11px', color: isActive ? t.ts : t.tm,
                        maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {iter.title}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } div::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}
