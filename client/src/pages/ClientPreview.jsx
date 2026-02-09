import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import {
  ExternalLink,
  Share2,
  RefreshCcw,
  Monitor,
  Smartphone,
  Tablet,
  AlertCircle
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

  return (
    <div style={{
      height: '100vh', width: '100vw', backgroundColor: t.bg, color: t.tp,
      fontFamily: 'Inter, sans-serif', overflow: 'hidden',
      display: 'flex', flexDirection: 'column', position: 'relative'
    }}>
      {/* Floating Header */}
      <header style={{
        position: 'fixed', top: '16px', left: '50%', transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)', maxWidth: '1200px', height: '64px',
        backgroundColor: 'rgba(26, 26, 27, 0.7)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${t.borderS}`, borderRadius: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 1000, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}>
        {/* Left: Branding & Project */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '16px', letterSpacing: '-0.5px' }}>guru</span>
            <span style={{ fontFamily: t.mono, fontWeight: 800, fontSize: '16px', color: t.violet }}>.ai</span>
          </div>
          <div style={{ width: '1px', height: '20px', backgroundColor: t.border }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: t.tp }}>{data.project.name}</span>
            <span style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Preview</span>
          </div>
        </div>

        {/* Center: Iteration Navigator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          overflowX: 'auto', padding: '0 20px', flex: 1, justifyContent: 'center',
          msOverflowStyle: 'none', scrollbarWidth: 'none',
        }}>
          {[...data.iterations].sort((a, b) => a.version - b.version).map((iter) => {
            const isActive = selectedIterationId === iter.id;
            return (
              <button
                key={iter.id}
                onClick={() => setSelectedIterationId(iter.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 12px', borderRadius: '8px',
                  backgroundColor: isActive ? t.violetM : 'transparent',
                  border: `1px solid ${isActive ? t.violet : 'transparent'}`,
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
                    fontSize: '11px', color: isActive ? t.tp : t.tm,
                    maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {iter.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Viewport switcher */}
          <div style={{
            display: 'flex', backgroundColor: 'rgba(0,0,0,0.2)',
            padding: '4px', borderRadius: '8px', border: `1px solid ${t.border}`,
          }}>
            {[
              { id: 'mobile', icon: <Smartphone size={14} /> },
              { id: 'tablet', icon: <Tablet size={14} /> },
              { id: 'desktop', icon: <Monitor size={14} /> },
            ].map(v => (
              <button key={v.id} onClick={() => setViewport(v.id)} style={{
                padding: '4px 8px', borderRadius: '6px', border: 'none',
                backgroundColor: viewport === v.id ? t.surfaceEl : 'transparent',
                color: viewport === v.id ? t.violet : t.tm,
                cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center',
              }}>
                {v.icon}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={handleRefresh} style={{
            padding: '8px', borderRadius: '8px', border: `1px solid ${t.border}`,
            backgroundColor: 'transparent', color: t.ts, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
          }}>
            <RefreshCcw size={16} style={isRefreshing ? { animation: 'spin 0.8s ease-in-out' } : {}} />
          </button>

          {/* Share */}
          <button onClick={handleShare} style={{
            padding: '8px 14px', borderRadius: '8px', backgroundColor: t.violet,
            border: 'none', color: 'white', fontSize: '12px', fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: `0 0 12px ${t.violetG}`,
          }}>
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </header>

      {/* Main Preview Area */}
      <main style={{
        flex: 1, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#050505', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background Gradient */}
        <div style={{
          position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
          width: '80%', height: '40%',
          background: `radial-gradient(circle at center, ${t.violetG} 0%, transparent 70%)`,
          zIndex: 0, pointerEvents: 'none',
        }} />

        {/* Viewport Container */}
        <div style={{
          width: viewportWidths[viewport],
          height: viewport === 'desktop' ? '100%' : 'calc(100% - 120px)',
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

      {/* Bottom Status Pill */}
      <div style={{
        position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
        padding: '8px 16px',
        backgroundColor: 'rgba(26, 26, 27, 0.8)', backdropFilter: 'blur(8px)',
        border: `1px solid ${t.border}`, borderRadius: '100px',
        display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            backgroundColor: activeIteration?.status === 'completed' ? t.success : t.warning,
            boxShadow: `0 0 8px ${activeIteration?.status === 'completed' ? t.success : t.warning}44`,
          }} />
          <span style={{ fontSize: '11px', color: t.ts, fontWeight: 500 }}>
            {activeIteration?.status === 'completed' ? 'Live Preview' : 'Draft'}
          </span>
        </div>
        <div style={{ width: '1px', height: '12px', backgroundColor: t.border }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ fontSize: '11px', color: t.tm }}>Agent:</span>
          <span style={{ fontSize: '11px', color: t.tp, fontWeight: 600 }}>{activeIteration?.agent_name || 'System'}</span>
        </div>
        <div style={{ width: '1px', height: '12px', backgroundColor: t.border }} />
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono }}>Powered by guru.ai</span>
      </div>
    </div>
  );
}
