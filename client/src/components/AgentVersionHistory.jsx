import React, { useState, useEffect } from 'react';
import {
  History, RotateCcw, ChevronDown, ChevronRight, Clock,
  GitBranch, AlertCircle, FileText, Cpu, Wrench
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

const formatDate = (ts) => {
  if (!ts) return '--';
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function AgentVersionHistory({ agentName, onRevert }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revertingId, setRevertingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    fetchVersions();
  }, [agentName]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/agents/${agentName}/versions`);
      const sorted = (data || []).sort((a, b) => b.version_number - a.version_number);
      setVersions(sorted);
    } catch (err) {
      setError('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRevert = async (versionId) => {
    try {
      await api(`/api/agents/${agentName}/versions/${versionId}/revert`, { method: 'POST' });
      setRevertingId(null);
      if (onRevert) onRevert();
      fetchVersions();
    } catch (err) {
      alert('Failed to revert version');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', color: t.ts, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History size={14} />
        Loading history...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '24px', color: t.danger, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={14} />
        {error}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '6px', background: t.violetG,
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.violet,
        }}>
          <History size={14} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: t.tp }}>Version History</h3>
          <span style={{ fontSize: '10px', color: t.tm }}>{versions.length} versions</span>
        </div>
      </div>

      <div style={{ position: 'relative', paddingLeft: '24px' }}>
        {/* Vertical Timeline Line */}
        {versions.length > 0 && (
          <div style={{
            position: 'absolute', left: '7px', top: '8px', bottom: '8px',
            width: '1px', background: t.borderS,
          }} />
        )}

        {versions.map((v, idx) => {
          const isLatest = idx === 0;
          const isExpanded = expandedId === v.id;
          const isConfirmingRevert = revertingId === v.id;

          const prev = versions[idx + 1];
          const hasModelChange = prev && v.model !== prev.model;
          const hasToolsChange = prev && v.tools !== prev.tools;

          return (
            <div key={v.id} style={{ marginBottom: '16px', position: 'relative' }}>
              {/* Timeline Dot */}
              <div style={{
                position: 'absolute', left: '-21px', top: '12px',
                width: '9px', height: '9px', borderRadius: '50%',
                background: isLatest ? t.violet : t.surfaceEl,
                border: `2px solid ${isLatest ? t.violetM : t.borderS}`,
                zIndex: 2,
              }} />

              <div style={{
                background: t.surface, border: `1px solid ${t.border}`, borderRadius: '8px',
                overflow: 'hidden', transition: 'border-color 0.2s',
              }}>
                {/* Header Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '11px', fontFamily: t.mono, color: isLatest ? t.violet : t.ts,
                      background: isLatest ? t.violetG : 'transparent',
                      padding: '2px 6px', borderRadius: '4px', border: `1px solid ${isLatest ? t.violetM : t.border}`,
                      flexShrink: 0,
                    }}>
                      v{v.version_number}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontSize: '13px', color: t.tp, fontWeight: 500 }}>
                        {v.change_summary || '[No summary]'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                        <span style={{ fontSize: '11px', color: t.tm, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={10} /> {formatDate(v.created_at)}
                        </span>
                        {isLatest && (
                          <span style={{ fontSize: '10px', color: t.violet, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {!isLatest && !isConfirmingRevert && (
                      <button
                        onClick={e => { e.stopPropagation(); setRevertingId(v.id); }}
                        style={{
                          background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '6px',
                          color: t.ts, padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center',
                          gap: '4px', cursor: 'pointer', transition: 'border-color 0.2s',
                        }}
                      >
                        <RotateCcw size={12} /> Revert
                      </button>
                    )}
                    {isExpanded ? <ChevronDown size={14} color={t.tm} /> : <ChevronRight size={14} color={t.tm} />}
                  </div>
                </div>

                {/* Revert Confirmation */}
                {isConfirmingRevert && (
                  <div style={{
                    padding: '12px 16px', background: 'rgba(139,92,246,0.05)',
                    borderTop: `1px solid ${t.violetM}`, display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: '12px', color: t.tp }}>
                      Revert to <strong>v{v.version_number}</strong>?
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => setRevertingId(null)} style={{
                        background: 'transparent', border: 'none', color: t.ts, fontSize: '11px', cursor: 'pointer', padding: '4px 8px',
                      }}>Cancel</button>
                      <button onClick={() => handleRevert(v.id)} style={{
                        background: t.violet, border: 'none', color: '#fff', fontSize: '11px', fontWeight: 600,
                        padding: '4px 12px', borderRadius: '4px', cursor: 'pointer',
                      }}>Revert Now</button>
                    </div>
                  </div>
                )}

                {/* Expanded Detail */}
                {isExpanded && (
                  <div style={{
                    padding: '16px', borderTop: `1px solid ${t.border}`, background: 'rgba(0,0,0,0.1)',
                  }}>
                    <p style={{ fontSize: '12px', color: t.ts, margin: '0 0 12px 0', lineHeight: 1.5 }}>
                      {v.description || '[No description]'}
                    </p>

                    {/* Compact Detail Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                      <div style={{
                        padding: '8px', background: t.surfaceEl, borderRadius: '6px',
                        border: `1px solid ${hasModelChange ? t.violetM : t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: t.tm, marginBottom: '4px', textTransform: 'uppercase' }}>
                          <Cpu size={10} /> Model
                        </div>
                        <div style={{ fontSize: '12px', color: hasModelChange ? t.violet : t.tp, fontFamily: t.mono }}>
                          {v.model || 'unknown'}
                        </div>
                      </div>

                      <div style={{
                        padding: '8px', background: t.surfaceEl, borderRadius: '6px',
                        border: `1px solid ${hasToolsChange ? t.violetM : t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: t.tm, marginBottom: '4px', textTransform: 'uppercase' }}>
                          <Wrench size={10} /> Tools
                        </div>
                        <div style={{ fontSize: '12px', color: hasToolsChange ? t.violet : t.tp }}>
                          {v.tools ? v.tools.split(',').filter(Boolean).length : 0} defined
                        </div>
                      </div>

                      <div style={{
                        padding: '8px', background: t.surfaceEl, borderRadius: '6px', border: `1px solid ${t.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: t.tm, marginBottom: '4px', textTransform: 'uppercase' }}>
                          <GitBranch size={10} /> Memory
                        </div>
                        <div style={{ fontSize: '12px', color: t.tp }}>
                          {v.memory || 'None'}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: t.tm, marginBottom: '6px', textTransform: 'uppercase' }}>
                        <FileText size={10} /> Prompt Snippet
                      </div>
                      <div style={{
                        fontSize: '11px', color: t.ts, fontFamily: t.mono, background: '#000',
                        padding: '10px', borderRadius: '6px', border: `1px solid ${t.border}`,
                        maxHeight: '100px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.4,
                      }}>
                        {(v.full_prompt || '[Empty]').substring(0, 500)}{v.full_prompt && v.full_prompt.length > 500 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {versions.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 0', border: `1px dashed ${t.border}`,
          borderRadius: '12px', color: t.tm, fontSize: '12px',
        }}>
          No version history available yet.
        </div>
      )}
    </div>
  );
}
