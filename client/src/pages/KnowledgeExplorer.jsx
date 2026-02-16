import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Search, X, FileText, Globe, Type, File, Clock, Hash } from 'lucide-react';
import { api } from '../api';
import VectorCanvas from '../components/VectorCanvas';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  cyan: '#06b6d4', cyanM: 'rgba(6,182,212,0.15)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const sourceIcons = {
  manual: <Type size={11} />,
  document: <FileText size={11} />,
  url: <Globe size={11} />,
  csv: <File size={11} />,
};

export default function KnowledgeExplorer() {
  const { id: kbId } = useParams();
  const navigate = useNavigate();

  const [kbName, setKbName] = useState('');
  const [vizData, setVizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [similarities, setSimilarities] = useState(null);
  const [searching, setSearching] = useState(false);

  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const containerRef = useRef(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const debounceRef = useRef(null);

  // Fetch KB info + visualization
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [kb, viz] = await Promise.all([
          api(`/api/knowledge/${kbId}`),
          api(`/api/knowledge/${kbId}/visualization`),
        ]);
        setKbName(kb.name || 'Knowledge Base');
        setVizData(viz);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [kbId]);

  // ResizeObserver for canvas sizing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Debounced search
  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setSimilarities(null);
      setSearchResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true);
        const data = await api(`/api/knowledge/${kbId}/visualization/search`, {
          method: 'POST',
          body: JSON.stringify({ query: value }),
        });
        setSimilarities(data.matches || {});
        setSearchResults(data.topResults || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [kbId]);

  // Hover tracking for tooltip position
  const handleMouseMove = useCallback((e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  }, []);

  // Click on point → load full entry
  const handlePointClick = useCallback(async (index) => {
    if (!vizData?.points?.[index]) return;
    const point = vizData.points[index];
    try {
      const entry = await api(`/api/knowledge/${kbId}/entries/${point.id}`);
      setSelectedEntry(entry);
    } catch (err) {
      console.error('Failed to load entry:', err);
    }
  }, [vizData, kbId]);

  const hoveredPoint = hoveredIndex >= 0 && vizData?.points?.[hoveredIndex] ? vizData.points[hoveredIndex] : null;
  const hasSidebar = searchResults && searchResults.length > 0;

  function simColor(sim) {
    if (sim > 0.8) return t.success;
    if (sim > 0.6) return t.cyan;
    if (sim > 0.4) return t.warning;
    return t.tm;
  }

  function simBg(sim) {
    if (sim > 0.8) return 'rgba(34,197,94,0.12)';
    if (sim > 0.6) return 'rgba(6,182,212,0.12)';
    if (sim > 0.4) return 'rgba(245,158,11,0.12)';
    return 'rgba(82,82,91,0.12)';
  }

  // Loading state
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: t.ts, gap: '16px' }}>
        <div style={{ width: '32px', height: '32px', border: `2px solid ${t.border}`, borderTopColor: t.violet, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '13px' }}>Projecting vectors into 2D space...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: t.danger, gap: '12px' }}>
        <span style={{ fontSize: '14px', fontWeight: '600' }}>Failed to load visualization</span>
        <span style={{ fontSize: '12px', color: t.ts }}>{error}</span>
        <button onClick={() => navigate(`/knowledge/${kbId}`)} style={{ marginTop: '8px', backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`, borderRadius: '4px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }}>
          Back to Knowledge Base
        </button>
      </div>
    );
  }

  // Empty state
  if (!vizData || vizData.points.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '400px', color: t.ts, gap: '12px' }}>
        <Sparkles size={32} style={{ color: t.tm }} />
        <span style={{ fontSize: '15px', fontWeight: '600', color: t.tp }}>No embedded entries</span>
        <span style={{ fontSize: '12px', color: t.tm }}>Add entries with embeddings to visualize the vector space</span>
        <button onClick={() => navigate(`/knowledge/${kbId}`)} style={{ marginTop: '8px', backgroundColor: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`, borderRadius: '4px', padding: '8px 16px', fontSize: '12px', cursor: 'pointer' }}>
          Back to Knowledge Base
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', color: t.tp, overflow: 'hidden' }} onMouseMove={handleMouseMove}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
        backgroundColor: t.surface, flexShrink: 0,
      }}>
        <button onClick={() => navigate(`/knowledge/${kbId}`)} style={{ background: 'none', border: 'none', color: t.ts, cursor: 'pointer', display: 'flex', padding: '4px' }}>
          <ArrowLeft size={18} />
        </button>
        <Sparkles size={16} style={{ color: t.violet }} />
        <span style={{ fontSize: '14px', fontWeight: '600', whiteSpace: 'nowrap' }}>{kbName}</span>
        <span style={{
          fontSize: '10px', fontWeight: '600', color: t.violet, backgroundColor: t.violetM,
          padding: '2px 8px', borderRadius: '100px',
        }}>
          {vizData.points.length} vectors
        </span>
        <div style={{ flex: 1, position: 'relative', maxWidth: '480px', marginLeft: '12px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search semantically..."
            style={{
              width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
              borderRadius: '6px', padding: '8px 10px 8px 30px', color: '#fff', fontSize: '12px',
              outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setSimilarities(null); setSearchResults(null); }}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex', padding: '2px' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
        {searching && (
          <span style={{ fontSize: '10px', color: t.tm, whiteSpace: 'nowrap' }}>Searching...</span>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Canvas area */}
        <div ref={containerRef} style={{ flex: 1, backgroundColor: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
          <VectorCanvas
            points={vizData.points}
            clusters={vizData.clusters}
            similarities={similarities}
            hoveredIndex={hoveredIndex}
            onHover={setHoveredIndex}
            onClick={handlePointClick}
            width={hasSidebar ? canvasSize.width : canvasSize.width}
            height={canvasSize.height}
          />

          {/* Tooltip */}
          {hoveredPoint && (
            <div style={{
              position: 'fixed',
              left: tooltipPos.x + 14,
              top: tooltipPos.y - 10,
              backgroundColor: t.surface,
              border: `1px solid ${t.borderS}`,
              borderRadius: '6px',
              padding: '8px 12px',
              pointerEvents: 'none',
              zIndex: 50,
              maxWidth: '260px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hoveredPoint.title}
              </div>
              <div style={{ display: 'flex', gap: '8px', fontSize: '10px', color: t.tm }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                  {sourceIcons[hoveredPoint.sourceType] || <FileText size={10} />}
                  {hoveredPoint.sourceType}
                </span>
                <span>{hoveredPoint.tokenCount} tokens</span>
                {similarities && similarities[hoveredPoint.id] != null && (
                  <span style={{ color: simColor(similarities[hoveredPoint.id]), fontWeight: '600' }}>
                    {(similarities[hoveredPoint.id] * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {hasSidebar && (
          <div style={{
            width: '320px', flexShrink: 0,
            backgroundColor: t.surface, borderLeft: `1px solid ${t.border}`,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Top Matches</span>
              <span style={{ fontSize: '10px', color: t.tm }}>{searchResults.length} results</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
              {searchResults.map((r, i) => (
                <div
                  key={r.id}
                  onClick={async () => {
                    try {
                      const entry = await api(`/api/knowledge/${kbId}/entries/${r.id}`);
                      setSelectedEntry(entry);
                    } catch {}
                  }}
                  style={{
                    padding: '10px 12px', marginBottom: '6px',
                    backgroundColor: t.surfaceEl, border: `1px solid ${t.border}`,
                    borderRadius: '6px', cursor: 'pointer', transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = t.borderS}
                  onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '8px' }}>
                      {r.title}
                    </span>
                    <span style={{
                      fontSize: '10px', fontWeight: '700', color: simColor(r.similarity),
                      backgroundColor: simBg(r.similarity),
                      padding: '2px 7px', borderRadius: '100px', flexShrink: 0,
                    }}>
                      {(r.similarity * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', fontSize: '10px', color: t.tm, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {sourceIcons[r.sourceType] || <FileText size={10} />}
                      {r.sourceType}
                    </span>
                    <span>{r.tokenCount} tok</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Entry detail modal */}
      {selectedEntry && (
        <div
          style={{
            position: 'fixed', inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 110,
          }}
          onClick={() => setSelectedEntry(null)}
        >
          <div
            style={{
              backgroundColor: t.surface, border: `1px solid ${t.border}`,
              borderRadius: '8px', width: '640px', maxHeight: '80vh',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              padding: '14px 20px', borderBottom: `1px solid ${t.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '12px' }}>
                {selectedEntry.title}
              </h2>
              <button onClick={() => setSelectedEntry(null)} style={{ background: 'none', border: 'none', color: t.tm, cursor: 'pointer', display: 'flex' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: t.ts, backgroundColor: t.surfaceEl, padding: '4px 10px', borderRadius: '100px' }}>
                  {sourceIcons[selectedEntry.source_type] || <FileText size={11} />}
                  {selectedEntry.source_type}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: t.ts, backgroundColor: t.surfaceEl, padding: '4px 10px', borderRadius: '100px' }}>
                  <Hash size={11} />
                  {selectedEntry.token_count || 0} tokens
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: t.ts, backgroundColor: t.surfaceEl, padding: '4px 10px', borderRadius: '100px' }}>
                  <Clock size={11} />
                  {new Date(selectedEntry.created_at).toLocaleDateString()}
                </span>
              </div>
              {selectedEntry.source_url && (
                <div style={{ marginBottom: '12px', fontSize: '11px' }}>
                  <span style={{ color: t.tm }}>Source: </span>
                  <a href={selectedEntry.source_url} target="_blank" rel="noopener noreferrer" style={{ color: t.cyan }}>{selectedEntry.source_url}</a>
                </div>
              )}
              <pre style={{
                backgroundColor: t.bg, border: `1px solid ${t.border}`, borderRadius: '6px',
                padding: '14px', fontFamily: t.mono, fontSize: '11px', color: t.ts,
                whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0,
                maxHeight: '400px', overflowY: 'auto',
              }}>
                {selectedEntry.content}
              </pre>
            </div>
            <div style={{
              padding: '12px 20px', borderTop: `1px solid ${t.border}`,
              display: 'flex', justifyContent: 'flex-end', backgroundColor: t.surfaceEl,
            }}>
              <button onClick={() => setSelectedEntry(null)} style={{
                backgroundColor: t.tp, color: t.bg, border: 'none',
                borderRadius: '4px', padding: '8px 16px', fontSize: '12px', fontWeight: '600', cursor: 'pointer',
              }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
