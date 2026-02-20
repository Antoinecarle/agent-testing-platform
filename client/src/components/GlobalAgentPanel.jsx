import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgentActivity } from '../contexts/AgentActivityContext';

const t = {
  bg: '#0a0a0b', surface: '#111113', surfaceEl: '#1a1a1d',
  border: 'rgba(255,255,255,0.06)', borderS: 'rgba(255,255,255,0.12)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.15)', violetG: 'rgba(139,92,246,0.08)',
  cyan: '#06b6d4', cyanM: 'rgba(6,182,212,0.12)',
  green: '#22c55e', greenM: 'rgba(34,197,94,0.12)',
  red: '#ef4444', redM: 'rgba(239,68,68,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

function fmtDuration(ms) {
  if (!ms) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

const catColorMap = {
  subagent: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Task' },
  file_read: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Read' },
  file_write: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Write' },
  file_edit: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Edit' },
  command: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Bash' },
  search: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'Find' },
  web: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'Web' },
  mcp: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', label: 'MCP' },
};

function getCatColor(cat) {
  return catColorMap[cat] || { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: cat || 'Tool' };
}

export default function GlobalAgentPanel() {
  const { jobs, clearJob, clearDone } = useAgentActivity();
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [prevRunning, setPrevRunning] = useState(0);

  const jobList = useMemo(() => Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt), [jobs]);
  const runningCount = jobList.filter(j => j.status === 'running').length;
  const hasJobs = jobList.length > 0;

  // Auto-show when new running job appears
  useEffect(() => {
    if (runningCount > prevRunning && dismissed) {
      setDismissed(false);
    }
    setPrevRunning(runningCount);
  }, [runningCount, prevRunning, dismissed]);

  if (!hasJobs || dismissed) return null;

  return (
    <div style={{
      position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <style>{`
        @keyframes ga-spin { to { transform: rotate(360deg); } }
        @keyframes ga-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes ga-blink { 50% { opacity: 0; } }
      `}</style>

      {!expanded ? (
        /* Collapsed pill */
        <button
          onClick={() => setExpanded(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '24px',
            background: runningCount > 0 ? 'rgba(6,182,212,0.15)' : t.surfaceEl,
            border: `1px solid ${runningCount > 0 ? 'rgba(6,182,212,0.3)' : t.border}`,
            color: runningCount > 0 ? t.cyan : t.ts,
            cursor: 'pointer', fontSize: '12px', fontWeight: 600,
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            transition: 'all 0.2s',
          }}
        >
          {runningCount > 0 ? (
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: t.cyan, boxShadow: `0 0 8px ${t.cyan}`,
              animation: 'ga-pulse 1.5s ease infinite',
            }} />
          ) : (
            <span style={{ fontSize: '10px', color: t.green }}>&#10003;</span>
          )}
          {runningCount > 0
            ? `${runningCount} agent${runningCount > 1 ? 's' : ''} running`
            : `${jobList.length} job${jobList.length > 1 ? 's' : ''} done`
          }
        </button>
      ) : (
        /* Expanded panel */
        <div style={{
          width: '360px', maxHeight: '420px',
          background: 'rgba(17,17,19,0.97)', backdropFilter: 'blur(16px)',
          border: `1px solid ${t.border}`, borderRadius: '12px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: `1px solid ${t.border}`,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {runningCount > 0 && (
              <span style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: t.cyan, boxShadow: `0 0 6px ${t.cyan}`,
                animation: 'ga-pulse 1.5s ease infinite',
              }} />
            )}
            <span style={{ fontSize: '12px', fontWeight: 700, color: t.tp, flex: 1 }}>
              Agent Activity
            </span>
            {jobList.some(j => j.status === 'done') && (
              <button onClick={clearDone} style={{
                background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
                fontSize: '10px', padding: '2px 6px',
              }}>Clear done</button>
            )}
            <button onClick={() => setExpanded(false)} style={{
              background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
              fontSize: '11px', padding: '2px 6px',
            }}>&#9660;</button>
            <button onClick={() => { setExpanded(false); setDismissed(true); }} style={{
              background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
              fontSize: '14px', padding: '2px',
            }}>&#10005;</button>
          </div>

          {/* Job list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '6px' }}>
            {jobList.map(job => (
              <JobCard key={job.id} job={job} onNavigate={navigate} onClear={clearJob} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function JobCard({ job, onNavigate, onClear }) {
  const [expanded, setExpanded] = useState(job.status === 'running');
  const isRunning = job.status === 'running';
  const [, forceRender] = useState(0);

  // Tick timer for running jobs
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => forceRender(n => n + 1), 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const duration = (job.completedAt || Date.now()) - job.startedAt;
  const toolCount = job.toolCalls?.length || 0;
  const subagentCount = job.subagents?.length || 0;

  return (
    <div style={{
      margin: '4px 0', borderRadius: '8px',
      background: isRunning ? 'rgba(6,182,212,0.04)' : t.surfaceEl,
      border: `1px solid ${isRunning ? 'rgba(6,182,212,0.12)' : t.border}`,
      overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 10px', cursor: 'pointer',
        }}
      >
        {isRunning ? (
          <span style={{
            display: 'inline-block', width: '10px', height: '10px', flexShrink: 0,
            border: '2px solid rgba(255,255,255,0.06)', borderTopColor: t.cyan,
            borderRadius: '50%', animation: 'ga-spin 0.7s linear infinite',
          }} />
        ) : (
          <span style={{ fontSize: '10px', color: t.green, flexShrink: 0 }}>&#10003;</span>
        )}

        <span
          onClick={(e) => { e.stopPropagation(); if (job.projectId) onNavigate(`/project/${job.projectId}`); }}
          style={{
            fontSize: '11px', fontWeight: 600, color: isRunning ? t.cyan : t.ts,
            cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}
          title={`Go to project ${job.projectId}`}
        >
          {job.projectName || (job.projectId ? job.projectId.substring(0, 12) + '...' : 'Unknown')}
        </span>

        <span style={{
          fontSize: '9px', color: t.tm, fontFamily: 'monospace', flexShrink: 0,
        }}>
          {fmtDuration(duration)}
        </span>

        {!isRunning && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(job.id); }}
            style={{
              background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
              fontSize: '12px', padding: '0 2px', flexShrink: 0,
            }}
          >&#10005;</button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ padding: '0 10px 8px', borderTop: `1px solid ${t.border}` }}>
          {/* User message preview */}
          {job.userMessage && (
            <div style={{
              padding: '6px 0', fontSize: '11px', color: t.ts,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <span style={{ color: t.tm, marginRight: '4px' }}>&#8250;</span>
              {job.userMessage.substring(0, 120)}
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '8px', padding: '4px 0', flexWrap: 'wrap' }}>
            {toolCount > 0 && (
              <span style={{
                padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600,
                background: 'rgba(139,92,246,0.1)', color: t.violet, fontFamily: 'monospace',
              }}>
                {toolCount} tools
              </span>
            )}
            {subagentCount > 0 && (
              <span style={{
                padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 600,
                background: t.cyanM, color: t.cyan, fontFamily: 'monospace',
              }}>
                {subagentCount} sub-agent{subagentCount > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Sub-agents */}
          {job.subagents?.length > 0 && (
            <div style={{ margin: '4px 0' }}>
              {job.subagents.slice(0, 5).map((sa, i) => (
                <div key={sa.toolUseId || `sa-${i}`} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '3px 0', fontSize: '10px',
                }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                    background: sa.completed ? t.green : t.cyan,
                    boxShadow: sa.completed ? 'none' : `0 0 4px ${t.cyan}`,
                  }} />
                  <span style={{ color: t.cyan, fontWeight: 600, fontFamily: 'monospace' }}>
                    {sa.type || 'Task'}
                  </span>
                  <span style={{
                    color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', flex: 1,
                  }}>
                    {sa.name || (sa.description || '').substring(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recent tool calls */}
          {job.toolCalls?.length > 0 && (
            <div style={{ margin: '4px 0' }}>
              <div style={{ fontSize: '9px', color: t.tm, fontWeight: 600, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recent tools
              </div>
              {job.toolCalls.slice(-8).map((tc, i) => {
                const cc = getCatColor(tc.category);
                return (
                  <div key={`tc-${i}`} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '1px 0', fontSize: '10px', fontFamily: 'monospace',
                  }}>
                    <span style={{
                      padding: '0 4px', borderRadius: '2px', fontSize: '8px', fontWeight: 600,
                      background: cc.bg, color: cc.color,
                      minWidth: '32px', textAlign: 'center',
                    }}>
                      {cc.label}
                    </span>
                    <span style={{
                      color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', flex: 1,
                    }}>
                      {tc.summary || tc.toolName || ''}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Streaming text preview */}
          {isRunning && job.streamingText && (
            <div style={{
              padding: '6px 8px', borderRadius: '6px', marginTop: '4px',
              background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.08)',
              fontSize: '10px', color: t.ts, lineHeight: '1.4',
              maxHeight: '60px', overflow: 'hidden',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {job.streamingText.slice(-200)}
              <span style={{
                display: 'inline-block', width: '4px', height: '10px',
                background: t.violet, borderRadius: '1px', marginLeft: '2px',
                animation: 'ga-blink 0.8s step-end infinite', verticalAlign: 'text-bottom',
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
