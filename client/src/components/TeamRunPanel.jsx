import React, { useState, useEffect, useRef } from 'react';
import {
  Play, Terminal as TerminalIcon, Clock, CheckCircle2,
  XCircle, Loader2, ChevronRight, ChevronDown
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

const STATUS_STYLES = {
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  running: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.2)' },
  pending: { color: '#A1A1AA', bg: 'rgba(255,255,255,0.05)' },
};

const LOG_COLORS = {
  info: '#A1A1AA',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
};

function formatTs(ts) {
  if (!ts) return '--';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDateTime(ts) {
  if (!ts) return '--';
  const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function TeamRunPanel({ teamId, members }) {
  const [runs, setRuns] = useState([]);
  const [expandedRunId, setExpandedRunId] = useState(null);
  const [logs, setLogs] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const logEndRef = useRef(null);

  const fetchRuns = async () => {
    try {
      const response = await api(`/api/agent-teams/${teamId}/runs`);
      setRuns(response.runs || []);
    } catch (err) {
      console.error('Failed to fetch runs', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRunLogs = async (runId) => {
    try {
      const response = await api(`/api/agent-teams/${teamId}/runs/${runId}`);
      setLogs(prev => ({ ...prev, [runId]: response.logs || [] }));
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const startNewRun = async () => {
    setIsCreating(true);
    try {
      const run = await api(`/api/agent-teams/${teamId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ config: { initiated_by: 'user_ui' } }),
      });
      await api(`/api/agent-teams/${teamId}/runs/${run.id}/start`, { method: 'POST' });
      await fetchRuns();
      setExpandedRunId(run.id);
    } catch (err) {
      console.error('Failed to start run', err);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, [teamId]);

  useEffect(() => {
    let interval;
    if (expandedRunId) {
      fetchRunLogs(expandedRunId);
      interval = setInterval(() => fetchRunLogs(expandedRunId), 2000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [expandedRunId]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, expandedRunId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        paddingBottom: '8px', borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TerminalIcon size={16} color={t.violet} />
          <span style={{ fontSize: '13px', fontWeight: 600, color: t.tp }}>Team Runs</span>
          <span style={{ fontSize: '11px', color: t.tm, backgroundColor: t.surfaceEl, padding: '2px 6px', borderRadius: '4px' }}>
            {runs.length}
          </span>
        </div>

        <button onClick={startNewRun} disabled={isCreating} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          backgroundColor: t.violet, color: 'white', border: 'none',
          padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
          cursor: isCreating ? 'not-allowed' : 'pointer', opacity: isCreating ? 0.7 : 1,
        }}>
          {isCreating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} fill="currentColor" />}
          New Run
        </button>
      </div>

      {/* Runs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {runs.length === 0 && !isLoading ? (
          <div style={{
            padding: '32px', textAlign: 'center', border: `1px dashed ${t.border}`,
            borderRadius: '8px', color: t.tm, fontSize: '12px',
          }}>
            No runs yet. Click "New Run" to start.
          </div>
        ) : (
          runs.map(run => {
            const isExpanded = expandedRunId === run.id;
            const st = STATUS_STYLES[run.status] || STATUS_STYLES.pending;

            return (
              <div key={run.id} style={{
                backgroundColor: t.surface,
                border: `1px solid ${isExpanded ? t.violetM : t.border}`,
                borderRadius: '8px', overflow: 'hidden', transition: 'border-color 0.2s',
              }}>
                {/* Run Header */}
                <div
                  onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                  style={{
                    padding: '10px 12px', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isExpanded ? <ChevronDown size={14} color={t.tm} /> : <ChevronRight size={14} color={t.tm} />}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: t.tp, fontFamily: t.mono }}>
                        run_{run.id.split('-')[0]}
                      </span>
                      <span style={{ fontSize: '10px', color: t.tm }}>
                        {formatDateTime(run.created_at)}
                      </span>
                    </div>
                  </div>
                  <div style={{
                    fontSize: '10px', fontWeight: 600, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: '100px',
                    backgroundColor: st.bg, color: st.color,
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    {run.status === 'running' && <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
                    {run.status === 'completed' && <CheckCircle2 size={10} />}
                    {run.status === 'failed' && <XCircle size={10} />}
                    {run.status === 'pending' && <Clock size={10} />}
                    {run.status}
                  </div>
                </div>

                {/* Logs */}
                {isExpanded && (
                  <div style={{
                    backgroundColor: t.bg, borderTop: `1px solid ${t.border}`,
                    maxHeight: '400px', overflowY: 'auto', padding: '12px',
                    fontFamily: t.mono, fontSize: '11px', lineHeight: '1.6',
                  }}>
                    {!logs[run.id] || logs[run.id].length === 0 ? (
                      <div style={{ color: t.tm, fontStyle: 'italic', padding: '8px' }}>
                        Waiting for logs...
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {logs[run.id].map((log, i) => (
                          <div key={log.id || i} style={{ display: 'flex', gap: '12px', whiteSpace: 'pre-wrap' }}>
                            <span style={{ color: t.tm, flexShrink: 0, width: '70px' }}>
                              [{formatTs(log.created_at)}]
                            </span>
                            <span style={{ color: t.violet, fontWeight: 600, flexShrink: 0, minWidth: '80px' }}>
                              {log.agent_name || 'system'}
                            </span>
                            <span style={{ color: LOG_COLORS[log.log_type] || LOG_COLORS.info }}>
                              {log.message}
                            </span>
                          </div>
                        ))}
                        <div ref={logEndRef} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
