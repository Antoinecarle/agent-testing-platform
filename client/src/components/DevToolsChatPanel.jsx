import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { io } from 'socket.io-client';
import { api, getToken, refreshAccessToken } from '../api';
import ToolCallCard from './ToolCallCard';

const t = {
  bg: '#0a0a0b', surface: '#111113', surfaceEl: '#1a1a1d', surfaceEl2: '#222225',
  border: 'rgba(255,255,255,0.06)', borderS: 'rgba(255,255,255,0.12)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.15)', violetG: 'rgba(139,92,246,0.08)',
  cyan: '#06b6d4', cyanM: 'rgba(6,182,212,0.12)',
  green: '#22c55e', greenM: 'rgba(34,197,94,0.12)',
  amber: '#f59e0b', amberM: 'rgba(245,158,11,0.12)',
  red: '#ef4444', redM: 'rgba(239,68,68,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B', td: '#3f3f46',
};

// ─── Token formatter ───────────────────────────────────────────────────
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(ms) {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// ─── Spinner component ──────────────────────────────────────────────────
function Spinner({ size = 14, color = '#06b6d4' }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, flexShrink: 0,
      border: `2px solid rgba(255,255,255,0.06)`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── Category badge colors ─────────────────────────────────────────────
const catColors = {
  subagent: { bg: 'rgba(6,182,212,0.12)', color: '#06b6d4', label: 'Task' },
  file_read: { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', label: 'Read' },
  file_write: { bg: 'rgba(34,197,94,0.12)', color: '#22c55e', label: 'Write' },
  file_edit: { bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', label: 'Edit' },
  command: { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', label: 'Bash' },
  search: { bg: 'rgba(139,92,246,0.12)', color: '#8b5cf6', label: 'Search' },
  web: { bg: 'rgba(99,102,241,0.12)', color: '#6366f1', label: 'Web' },
  mcp: { bg: 'rgba(236,72,153,0.12)', color: '#ec4899', label: 'MCP' },
};

// ─── Permission Card ──────────────────────────────────────────────────
function PermissionCard({ request, onRespond }) {
  const [responding, setResponding] = useState(false);

  const toolIcon = {
    read: '\uD83D\uDD0D', write: '\u270F\uFE0F', edit: '\uD83D\uDD27', bash: '\u26A1',
    task: '\uD83E\uDD16', glob: '\uD83D\uDCC2', grep: '\uD83D\uDD0E',
    webfetch: '\uD83C\uDF10', websearch: '\uD83C\uDF10',
  };
  const name = (request.toolName || '').toLowerCase();
  const icon = toolIcon[name] || (name.startsWith('mcp__') ? '\uD83D\uDD0C' : '\uD83D\uDEE0\uFE0F');

  const handleRespond = (approved) => {
    setResponding(true);
    onRespond(request.requestId, approved);
  };

  return (
    <div style={{
      margin: '8px 0', padding: '12px 14px', borderRadius: '10px',
      background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)',
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '16px' }}>{icon}</span>
        <span style={{ fontSize: '12px', fontWeight: 600, color: t.amber, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Permission Required
        </span>
      </div>

      <div style={{ marginBottom: '8px' }}>
        <span style={{
          display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
          fontFamily: 'monospace', background: t.surfaceEl, color: t.tp, fontWeight: 600,
        }}>
          {request.toolName}
        </span>
      </div>

      {request.inputSummary && (
        <div style={{
          padding: '6px 10px', borderRadius: '6px', background: t.surfaceEl,
          fontSize: '11px', fontFamily: 'monospace', color: t.ts,
          maxHeight: '60px', overflow: 'hidden', marginBottom: '10px',
          whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {request.inputSummary.slice(0, 300)}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={() => handleRespond(true)}
          disabled={responding}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: responding ? t.surfaceEl : 'rgba(34,197,94,0.15)', color: responding ? t.tm : t.green,
            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          {responding ? '...' : 'Allow'}
        </button>
        <button
          onClick={() => handleRespond(false)}
          disabled={responding}
          style={{
            flex: 1, padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: responding ? t.surfaceEl : 'rgba(239,68,68,0.12)', color: responding ? t.tm : t.red,
            fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
          }}
        >
          {responding ? '...' : 'Deny'}
        </button>
      </div>
    </div>
  );
}

// ─── Sub-Agent Status Card ────────────────────────────────────────────
function SubAgentCard({ subagent, isRunning }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: '8px', margin: '4px 0',
      background: isRunning ? 'rgba(6,182,212,0.06)' : t.surfaceEl,
      border: `1px solid ${isRunning ? 'rgba(6,182,212,0.15)' : t.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
        {isRunning && <Spinner size={10} color="#06b6d4" />}
        <span style={{ fontSize: '11px', fontWeight: 600, color: isRunning ? t.cyan : t.ts }}>
          {subagent.type || 'Agent'}
        </span>
        {subagent.name && (
          <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
            {subagent.name}
          </span>
        )}
      </div>
      {subagent.description && (
        <div style={{ fontSize: '11px', color: t.tm, lineHeight: '1.4' }}>
          {subagent.description.slice(0, 120)}{subagent.description.length > 120 ? '...' : ''}
        </div>
      )}
    </div>
  );
}

// ─── AI Group Card (claude-devtools style) ─────────────────────────────
function AIGroupCard({ turn, defaultExpanded = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const toolCount = turn.toolCalls?.length || 0;
  const hasSubagent = turn.toolCalls?.some(tc => tc.category === 'subagent');
  const totalIn = turn.tokens?.input || 0;
  const totalOut = turn.tokens?.output || 0;

  // Category breakdown for the summary
  const catBreakdown = useMemo(() => {
    const counts = {};
    (turn.toolCalls || []).forEach(tc => {
      const cat = tc.category || 'tool';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [turn.toolCalls]);

  return (
    <div style={{
      margin: '2px 0', borderRadius: '8px',
      background: t.surfaceEl, border: `1px solid ${t.border}`,
      overflow: 'hidden', transition: 'border-color 0.15s',
    }}>
      {/* ── Header ── */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 12px', cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${t.border}` : 'none',
        }}
      >
        {/* Expand arrow */}
        <span style={{
          fontSize: '10px', color: t.tm, flexShrink: 0, width: '14px', textAlign: 'center',
          transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'none',
        }}>&#9654;</span>

        {/* Claude badge */}
        <span style={{
          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
          background: t.violetG, color: t.violet, fontFamily: 'monospace', flexShrink: 0,
        }}>Claude</span>

        {/* Tool count badges */}
        {toolCount > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {Object.entries(catBreakdown).map(([cat, count]) => {
              const style = catColors[cat] || { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: cat };
              return (
                <span key={cat} style={{
                  padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600',
                  background: style.bg, color: style.color, fontFamily: 'monospace',
                }}>
                  {count} {style.label || cat}
                </span>
              );
            })}
          </div>
        )}

        {/* Subagent indicator */}
        {hasSubagent && (
          <span style={{
            padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600',
            background: t.cyanM, color: t.cyan, fontFamily: 'monospace',
          }}>Subagent</span>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Token metrics */}
        {(totalIn > 0 || totalOut > 0) && (
          <span style={{
            fontSize: '9px', color: t.tm, fontFamily: 'monospace', flexShrink: 0,
          }}>
            {fmtTokens(totalIn)} in / {fmtTokens(totalOut)} out
          </span>
        )}

        {/* Streaming indicator */}
        {turn.streaming && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: t.green, boxShadow: `0 0 8px ${t.green}`,
            animation: 'pulse 1.5s ease infinite', flexShrink: 0,
          }} />
        )}
      </div>

      {/* ── Body (expanded) ── */}
      {expanded && (
        <div style={{ padding: '0' }}>
          {/* Tool calls */}
          {(turn.toolCalls || []).map((tc, i) => (
            <ToolCallCard
              key={tc.id || `tc-${i}`}
              toolName={tc.toolName}
              input={tc.rawInput}
              output={tc.result}
              isError={tc.isError}
              duration={tc.mcpProgress?.elapsedMs}
              mcpProgress={tc.mcpProgress}
            />
          ))}

          {/* Assistant text */}
          {turn.assistantText && (
            <div style={{
              padding: '10px 14px', fontSize: '13px', lineHeight: '1.6',
              color: t.tp, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              borderTop: toolCount > 0 ? `1px solid ${t.border}` : 'none',
            }}>
              {turn.assistantText}
            </div>
          )}

          {/* Streaming text */}
          {turn.streaming && turn.streamingText && (
            <div style={{
              padding: '10px 14px', fontSize: '13px', lineHeight: '1.6',
              color: t.tp, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              borderTop: toolCount > 0 ? `1px solid ${t.border}` : 'none',
            }}>
              {turn.streamingText}
              <span style={{
                display: 'inline-block', width: '6px', height: '14px',
                background: t.violet, borderRadius: '1px', marginLeft: '2px',
                animation: 'blink 0.8s step-end infinite', verticalAlign: 'text-bottom',
              }} />
            </div>
          )}
        </div>
      )}

      {/* ── Collapsed preview ── */}
      {!expanded && turn.assistantText && (
        <div style={{
          padding: '4px 12px 8px 36px', fontSize: '12px', color: t.ts,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {turn.assistantText.substring(0, 200)}
        </div>
      )}
    </div>
  );
}

// ─── User Message ──────────────────────────────────────────────────────
function UserMessage({ text }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'flex-end', padding: '4px 0',
    }}>
      <div style={{
        maxWidth: '80%', padding: '8px 14px', borderRadius: '12px 12px 2px 12px',
        background: t.violetM, border: `1px solid rgba(139,92,246,0.25)`,
        fontSize: '13px', lineHeight: '1.5', color: t.tp,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {text}
      </div>
    </div>
  );
}

// ─── Activity Sidebar (claude-devtools style context panel) ────────────
function ActivitySidebar({ turns, events, visible, onClose, sending, activeSubagents = [], permissionRequests = [], onPermissionRespond }) {
  // Aggregate stats from turns
  const stats = useMemo(() => {
    const result = {
      totalTokensIn: 0, totalTokensOut: 0,
      toolCounts: {}, fileAccess: new Set(), subagents: [],
      runningSubagents: [], completedSubagents: [],
      errors: 0, turnCount: turns.length,
    };
    for (const turn of turns) {
      if (turn.tokens) {
        result.totalTokensIn += turn.tokens.input || 0;
        result.totalTokensOut += turn.tokens.output || 0;
      }
      for (const tc of (turn.toolCalls || [])) {
        const cat = tc.category || 'tool';
        result.toolCounts[cat] = (result.toolCounts[cat] || 0) + 1;
        if (tc.isError) result.errors++;
        if (cat === 'subagent') {
          const isRunning = !tc.result && !tc.isError && turn.streaming;
          result.subagents.push({ ...tc, isRunning, turnStreaming: turn.streaming });
          if (isRunning) result.runningSubagents.push(tc);
          else result.completedSubagents.push(tc);
        }
        if (['file_read', 'file_write', 'file_edit'].includes(cat)) {
          const fp = tc.rawInput?.file_path || tc.toolInput;
          if (fp) result.fileAccess.add(fp);
        }
      }
    }
    return result;
  }, [turns]);

  if (!visible) return null;

  return (
    <div style={{
      width: '320px', flexShrink: 0, borderLeft: `1px solid ${t.border}`,
      background: t.surface, display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp }}>Activity</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
          fontSize: '14px', padding: '2px',
        }}>&#10005;</button>
      </div>

      {/* Stats summary */}
      <div style={{
        padding: '12px 14px', borderBottom: `1px solid ${t.border}`,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px',
      }}>
        <StatBox label="Tokens In" value={fmtTokens(stats.totalTokensIn)} color={t.cyan} />
        <StatBox label="Tokens Out" value={fmtTokens(stats.totalTokensOut)} color={t.violet} />
        <StatBox label="Turns" value={stats.turnCount} color={t.green} />
        <StatBox label="Subagents" value={stats.subagents.length + activeSubagents.filter(sa => !sa.completed).length} color={stats.runningSubagents.length > 0 || activeSubagents.some(sa => !sa.completed) ? t.cyan : t.tm} running={stats.runningSubagents.length + activeSubagents.filter(sa => !sa.completed).length} />
      </div>

      {/* Scrollable sections */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
        {/* Running now (always on top when active) */}
        {(stats.runningSubagents.length > 0 || sending) && (
          <div style={{ margin: '0 14px 10px', padding: '10px', borderRadius: '8px', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', background: t.cyan,
                boxShadow: `0 0 8px ${t.cyan}`, animation: 'pulse 1.5s ease infinite', flexShrink: 0,
              }} />
              <span style={{ fontSize: '11px', fontWeight: '700', color: t.cyan }}>Running Now</span>
            </div>
            {sending && stats.runningSubagents.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                <Spinner size={12} color={t.violet} />
                <span style={{ fontSize: '10px', color: t.ts }}>Claude is thinking...</span>
              </div>
            )}
            {stats.runningSubagents.map((tc, i) => (
              <div key={tc.id || `run-${i}`} style={{
                display: 'flex', alignItems: 'flex-start', gap: '8px',
                padding: '6px 0', borderTop: i > 0 ? `1px solid rgba(6,182,212,0.1)` : 'none',
              }}>
                <Spinner size={12} color={t.cyan} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: t.cyan }}>
                    {tc.rawInput?.subagent_type || 'Task'}
                    {tc.rawInput?.name && <span style={{ color: t.ts, fontWeight: '400', marginLeft: '4px' }}>{tc.rawInput.name}</span>}
                  </div>
                  <div style={{ fontSize: '10px', color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                    {tc.rawInput?.description || tc.toolInput}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending permission requests in sidebar */}
        {permissionRequests.length > 0 && (
          <div style={{ margin: '0 14px 10px', padding: '10px', borderRadius: '8px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '14px' }}>&#9888;&#65039;</span>
              <span style={{ fontSize: '11px', fontWeight: '700', color: t.amber }}>Permissions ({permissionRequests.length})</span>
            </div>
            {permissionRequests.map(req => (
              <div key={req.requestId} style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '10px', fontWeight: 600, color: t.tp, marginBottom: '3px' }}>{req.toolName}</div>
                {req.inputSummary && (
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: t.ts, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {req.inputSummary.slice(0, 100)}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => onPermissionRespond(req.requestId, true)} style={{
                    flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: 'rgba(34,197,94,0.15)', color: t.green, fontSize: '10px', fontWeight: 600,
                  }}>Allow</button>
                  <button onClick={() => onPermissionRespond(req.requestId, false)} style={{
                    flex: 1, padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    background: 'rgba(239,68,68,0.12)', color: t.red, fontSize: '10px', fontWeight: 600,
                  }}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live sub-agents (real-time from stream events) */}
        {activeSubagents.filter(sa => !sa.completed).length > 0 && (
          <ActivitySection title="Live Sub-agents" count={activeSubagents.filter(sa => !sa.completed).length}>
            {activeSubagents.filter(sa => !sa.completed).map((sa, i) => (
              <SubAgentCard key={sa.toolUseId || `live-sa-${i}`} subagent={sa} isRunning={true} />
            ))}
          </ActivitySection>
        )}

        {/* Tool breakdown */}
        <ActivitySection title="Tool Calls" count={Object.values(stats.toolCounts).reduce((a, b) => a + b, 0)}>
          {Object.entries(stats.toolCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
            const cs = catColors[cat] || { bg: 'rgba(168,85,247,0.12)', color: '#a855f7', label: cat };
            return (
              <div key={cat} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0',
              }}>
                <span style={{
                  padding: '1px 5px', borderRadius: '3px', fontSize: '9px', fontWeight: '600',
                  background: cs.bg, color: cs.color, fontFamily: 'monospace', minWidth: '40px', textAlign: 'center',
                }}>{cs.label || cat}</span>
                <div style={{ flex: 1, height: '3px', background: t.border, borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', background: cs.color,
                    width: `${Math.min(100, (count / Math.max(...Object.values(stats.toolCounts))) * 100)}%`,
                  }} />
                </div>
                <span style={{ fontSize: '10px', color: t.ts, fontFamily: 'monospace', minWidth: '24px', textAlign: 'right' }}>{count}</span>
              </div>
            );
          })}
        </ActivitySection>

        {/* Files accessed */}
        {stats.fileAccess.size > 0 && (
          <ActivitySection title="Files Accessed" count={stats.fileAccess.size}>
            {[...stats.fileAccess].slice(0, 30).map(fp => (
              <div key={fp} style={{
                padding: '2px 0', fontSize: '10px', fontFamily: 'monospace', color: t.ts,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fp.split('/').pop()}
                <span style={{ color: t.tm, marginLeft: '4px' }}>{fp.split('/').slice(0, -1).join('/')}</span>
              </div>
            ))}
          </ActivitySection>
        )}

        {/* Subagents / Parallel tasks */}
        {stats.subagents.length > 0 && (
          <ActivitySection title="Subagents & Tasks" count={stats.subagents.length}>
            {stats.subagents.map((tc, i) => (
              <div key={tc.id || `sub-${i}`} style={{
                padding: '6px 8px', margin: '2px 0', borderRadius: '6px',
                background: tc.isRunning ? 'rgba(6,182,212,0.08)' : tc.isError ? t.redM : t.cyanM,
                border: `1px solid ${tc.isRunning ? 'rgba(6,182,212,0.25)' : tc.isError ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.15)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                  {tc.isRunning && <Spinner size={10} color={t.cyan} />}
                  <span style={{ fontSize: '10px', fontWeight: '600', color: tc.isRunning ? t.cyan : tc.isError ? t.red : t.ts }}>
                    {tc.rawInput?.subagent_type || 'Task'}
                    {tc.rawInput?.name && <span style={{ fontWeight: '400', marginLeft: '4px' }}>{tc.rawInput.name}</span>}
                  </span>
                  <div style={{ flex: 1 }} />
                  <span style={{
                    fontSize: '8px', fontWeight: '600', padding: '1px 4px', borderRadius: '3px',
                    background: tc.isRunning ? 'rgba(6,182,212,0.2)' : tc.isError ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                    color: tc.isRunning ? t.cyan : tc.isError ? t.red : t.green,
                  }}>
                    {tc.isRunning ? 'RUNNING' : tc.isError ? 'FAILED' : 'DONE'}
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: t.ts, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {tc.rawInput?.description || tc.toolInput}
                </div>
              </div>
            ))}
          </ActivitySection>
        )}

        {/* Recent events (raw activity stream) */}
        {events.length > 0 && (
          <ActivitySection title="Live Events" count={events.length} defaultOpen={false}>
            {events.slice(-20).reverse().map((evt, i) => (
              <div key={evt.id || `evt-${i}`} style={{
                padding: '3px 0', fontSize: '10px', color: t.ts,
                display: 'flex', alignItems: 'center', gap: '6px',
                borderBottom: `1px solid ${t.border}`,
              }}>
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: evt.type === 'tool_call' ? '#8b5cf6'
                    : evt.type === 'tool_result' ? '#22c55e'
                    : evt.type === 'text' ? '#3b82f6'
                    : '#52525b',
                }} />
                <span style={{ fontFamily: 'monospace', color: t.tm, flexShrink: 0, width: '65px' }}>
                  {evt.type?.replace('_', ' ')}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {evt.toolName || evt.content?.substring(0, 60) || ''}
                </span>
              </div>
            ))}
          </ActivitySection>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color, running }) {
  return (
    <div style={{
      padding: '6px 8px', borderRadius: '6px', background: t.surfaceEl,
      border: `1px solid ${t.border}`,
    }}>
      <div style={{ fontSize: '9px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
        <span style={{ fontSize: '16px', fontWeight: '700', color, fontFamily: 'monospace' }}>{value}</span>
        {running > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
            <Spinner size={10} color={t.cyan} />
            <span style={{ fontSize: '9px', color: t.cyan, fontWeight: '600' }}>{running}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function ActivitySection({ title, count, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ margin: '0 14px 8px' }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 0',
          cursor: 'pointer', borderBottom: `1px solid ${t.border}`,
        }}
      >
        <span style={{
          fontSize: '9px', color: t.tm, transition: 'transform 0.2s',
          transform: open ? 'rotate(90deg)' : 'none',
        }}>&#9654;</span>
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.ts }}>{title}</span>
        <span style={{
          padding: '0 5px', borderRadius: '8px', fontSize: '9px', fontWeight: '600',
          background: t.violetG, color: t.violet, fontFamily: 'monospace',
        }}>{count}</span>
      </div>
      {open && <div style={{ padding: '4px 0' }}>{children}</div>}
    </div>
  );
}

// ─── Session Tabs ──────────────────────────────────────────────────────
function SessionBar({ sessions, selectedId, onSelect, onNewSession, chatSessionId }) {
  if (!sessions || sessions.length === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '2px', padding: '4px 12px',
      borderBottom: `1px solid ${t.border}`, overflowX: 'auto', flexShrink: 0,
      scrollbarWidth: 'none',
    }}>
      <span style={{ fontSize: '9px', color: t.tm, marginRight: '4px', flexShrink: 0 }}>Sessions:</span>
      {sessions.map(s => {
        const isActive = selectedId === s.sessionId;
        const isCurrent = chatSessionId === s.sessionId;
        return (
          <button
            key={s.sessionId}
            onClick={() => onSelect(s.sessionId)}
            style={{
              padding: '3px 8px', borderRadius: '4px', fontSize: '10px',
              fontFamily: 'monospace', border: 'none', cursor: 'pointer',
              background: isActive ? t.violetM : 'transparent',
              color: isActive ? '#a78bfa' : t.tm,
              fontWeight: isActive ? '600' : '400',
              whiteSpace: 'nowrap', flexShrink: 0,
              outline: isCurrent ? `1px solid ${t.green}` : 'none',
            }}
            title={isCurrent ? 'Active chat session' : s.sessionId}
          >
            {s.sessionId.substring(0, 8)}...
            {isCurrent && <span style={{ color: t.green, marginLeft: '3px', fontSize: '8px' }}>&#9679;</span>}
          </button>
        );
      })}
      <button onClick={onNewSession} style={{
        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', border: `1px solid ${t.border}`,
        cursor: 'pointer', background: 'transparent', color: t.tm, flexShrink: 0,
      }} title="New conversation">+</button>
    </div>
  );
}

// ─── Main DevTools Chat Panel ──────────────────────────────────────────
export default function DevToolsChatPanel({ projectId, claudeConnected }) {
  const [turns, setTurns] = useState([]);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claudeAuthError, setClaudeAuthError] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [watching, setWatching] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const [chatSessionId, setChatSessionId] = useState(() => {
    try { return localStorage.getItem(`guru-chat-session-${projectId}`) || null; } catch { return null; }
  });
  const [permissionRequests, setPermissionRequests] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeSubagents, setActiveSubagents] = useState([]);

  const scrollRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const autoScrollRef = useRef(true);
  const selectedSessionRef = useRef(null);

  // Persist chatSessionId
  useEffect(() => {
    if (chatSessionId && projectId) {
      try { localStorage.setItem(`guru-chat-session-${projectId}`, chatSessionId); } catch {}
    }
  }, [chatSessionId, projectId]);

  useEffect(() => { selectedSessionRef.current = selectedSession; }, [selectedSession]);

  // Load sessions list
  useEffect(() => {
    if (!projectId) return;
    api(`/api/session-logs/${projectId}/sessions`).then(data => {
      setSessions(data.sessions || []);
      if (data.sessions?.length > 0 && !selectedSession) {
        setSelectedSession(data.sessions[0].sessionId);
      }
    }).catch(() => {});
  }, [projectId]);

  // Load turns + raw events for selected session
  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const params = selectedSession ? `?sessionId=${selectedSession}&limit=500` : '?limit=500';

    Promise.all([
      api(`/api/session-logs/${projectId}/turns${params}`).catch(() => ({ turns: [] })),
      api(`/api/session-logs/${projectId}/activity${params.replace('limit=500', 'limit=200')}`).catch(() => ({ events: [] })),
    ]).then(([turnsData, activityData]) => {
      setTurns(turnsData.turns || []);
      setEvents(activityData.events || []);
      if (turnsData.sessionId && !selectedSession) setSelectedSession(turnsData.sessionId);
      setLoading(false);
      setTimeout(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }, 50);
    });
  }, [projectId, selectedSession]);

  // Socket.IO for streaming + live activity
  useEffect(() => {
    if (!projectId) return;
    const token = getToken();
    const socket = io('/terminal', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('watch-activity', { projectId }, (resp) => {
        if (resp?.watching) setWatching(true);
      });
    });

    socket.on('connect_error', (err) => {
      setWatching(false);
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        refreshAccessToken().then(newToken => {
          socket.auth = { token: newToken };
          socket.connect();
        }).catch(() => { window.location.href = '/login'; });
      }
    });

    socket.on('disconnect', () => { setWatching(false); setSending(false); });

    // Permission requests from MCP permission server
    socket.on('chat-permission-request', (data) => {
      console.log('[Chat] Permission request:', data);
      setPermissionRequests(prev => [...prev, data]);
      // Auto-scroll to show the permission card
      if (autoScrollRef.current && scrollRef.current) {
        setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
      }
    });

    // Live activity events
    socket.on('activity-events', (newEvts) => {
      setEvents(prev => [...prev, ...(newEvts || [])].slice(-200));
      const sid = selectedSessionRef.current;
      const params = sid ? `?sessionId=${sid}&limit=500` : '?limit=500';
      api(`/api/session-logs/${projectId}/turns${params}`).then(data => {
        setTurns(data.turns || []);
        if (autoScrollRef.current && scrollRef.current) {
          setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 30);
        }
      }).catch(() => {});
    });

    // Chat streaming — handle ALL Claude CLI stream-json event types
    socket.on('chat-stream', (data) => {
      // Also track as raw event for activity sidebar
      setEvents(prev => [...prev, {
        id: `stream-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type: data.type,
        toolName: data.type === 'assistant'
          ? (data.message?.content || []).find(b => b.type === 'tool_use')?.name
          : data.data?.toolName,
        content: data.type === 'raw' ? data.text : undefined,
      }].slice(-200));

      if (data.type === 'assistant') {
        const content = data.message?.content || [];
        const usage = data.message?.usage;
        let text = '';
        const toolUses = [];
        for (const block of content) {
          if (block.type === 'text') text += block.text || '';
          else if (block.type === 'tool_use') {
            const tc = {
              id: block.id || `tc-${Date.now()}`,
              toolName: block.name,
              rawInput: block.input,
              toolInput: summarizeTool(block.name, block.input),
              category: categorizeTool(block.name),
              result: null, isError: false,
            };
            // Enrich sub-agent tool calls with metadata
            if (block.name?.toLowerCase() === 'task' && data._guruSubagent) {
              tc.subagentMeta = data._guruSubagent;
            } else if (block.name?.toLowerCase() === 'task' && block.input) {
              tc.subagentMeta = {
                type: block.input.subagent_type || 'general-purpose',
                name: block.input.name || block.input.description || 'Sub-agent',
                description: block.input.description || (block.input.prompt || '').slice(0, 150),
              };
            }
            toolUses.push(tc);
          }
        }
        // Track active sub-agents
        const newSubagents = toolUses.filter(tc => tc.subagentMeta);
        if (newSubagents.length > 0) {
          setActiveSubagents(prev => [...prev, ...newSubagents.map(tc => ({
            ...tc.subagentMeta, toolUseId: tc.id, startedAt: Date.now(), completed: false,
          }))]);
        }
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            let turn = { ...copy[lastIdx] };
            if (toolUses.length > 0) turn.toolCalls = [...(turn.toolCalls || []), ...toolUses];
            if (text) turn.streamingText = text;
            if (usage) {
              turn.tokens = {
                input: (turn.tokens?.input || 0) + (usage.input_tokens || 0),
                output: (turn.tokens?.output || 0) + (usage.output_tokens || 0),
              };
            }
            copy[lastIdx] = turn;
          }
          return copy;
        });

      } else if (data.type === 'user') {
        // Tool results come back as user messages with tool_result blocks
        const content = data.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'tool_result') {
              // Mark sub-agents as completed
              setActiveSubagents(prev => prev.map(sa =>
                sa.toolUseId === block.tool_use_id ? { ...sa, completed: true } : sa
              ));
              setTurns(prev => {
                const copy = [...prev];
                const lastIdx = copy.length - 1;
                if (lastIdx >= 0 && copy[lastIdx].streaming && copy[lastIdx].toolCalls?.length > 0) {
                  const turn = { ...copy[lastIdx], toolCalls: [...copy[lastIdx].toolCalls] };
                  // Match by tool_use_id or attach to last unresolved tool call
                  const target = turn.toolCalls.findIndex(tc => tc.id === block.tool_use_id)
                    !== -1 ? turn.toolCalls.findIndex(tc => tc.id === block.tool_use_id)
                    : turn.toolCalls.findIndex(tc => !tc.result);
                  if (target !== -1) {
                    const resultText = typeof block.content === 'string'
                      ? block.content
                      : Array.isArray(block.content)
                        ? block.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
                        : '';
                    turn.toolCalls[target] = {
                      ...turn.toolCalls[target],
                      result: resultText.substring(0, 2000),
                      isError: block.is_error || false,
                    };
                  }
                  copy[lastIdx] = turn;
                }
                return copy;
              });
            }
          }
        }

      } else if (data.type === 'progress') {
        // MCP progress, tool progress, hook progress
        const pd = data.data || {};
        if (pd.type === 'mcp_progress' && pd.toolName) {
          setTurns(prev => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].streaming && copy[lastIdx].toolCalls?.length > 0) {
              const turn = { ...copy[lastIdx], toolCalls: [...copy[lastIdx].toolCalls] };
              const target = turn.toolCalls.findIndex(tc => tc.id === data.toolUseID)
                !== -1 ? turn.toolCalls.findIndex(tc => tc.id === data.toolUseID)
                : turn.toolCalls.length - 1;
              if (target !== -1) {
                turn.toolCalls[target] = {
                  ...turn.toolCalls[target],
                  mcpProgress: {
                    status: pd.status,
                    serverName: pd.serverName,
                    toolName: pd.toolName,
                    elapsedMs: pd.elapsedTimeMs,
                  },
                };
              }
              copy[lastIdx] = turn;
            }
            return copy;
          });
        }

      } else if (data.type === 'result') {
        const text = data.result?.trim() || data.message?.content?.find(b => b.type === 'text')?.text || '';
        if (data.session_id) setChatSessionId(data.session_id);
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = { ...copy[lastIdx], assistantText: text || copy[lastIdx].streamingText || '', streaming: false, streamingText: undefined };
          }
          return copy;
        });

      } else if (data.type === 'error') {
        const errText = (data.text || '').toLowerCase();
        if (errText.includes('auth') || errText.includes('not authenticated') || errText.includes('login') || errText.includes('credentials') || errText.includes('check authentication')) {
          setClaudeAuthError(true);
        }
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = { ...copy[lastIdx], assistantText: data.text || 'Error', streaming: false, streamingText: undefined, isError: true };
          }
          return copy;
        });

      } else if (data.type === 'raw' && data.text?.trim()) {
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = { ...copy[lastIdx], streamingText: (copy[lastIdx].streamingText || '') + data.text };
          }
          return copy;
        });
      }

      if (autoScrollRef.current && scrollRef.current) {
        setTimeout(() => { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 20);
      }
    });

    socket.on('chat-done', (data) => {
      if (data.sessionId) setChatSessionId(data.sessionId);
      if (data.error === 'timeout') setClaudeAuthError(true);
      setSending(false);
      setTurns(prev => {
        const copy = [...prev];
        const lastIdx = copy.length - 1;
        if (lastIdx >= 0 && copy[lastIdx].streaming) {
          copy[lastIdx] = { ...copy[lastIdx], assistantText: copy[lastIdx].streamingText || copy[lastIdx].assistantText || '', streaming: false, streamingText: undefined };
        }
        return copy;
      });

      // Re-watch activity (session file may be new since the chat created it)
      socket.emit('watch-activity', { projectId }, (resp) => {
        if (resp?.watching) setWatching(true);
      });

      // Reload full turns from JSONL for complete data (tool results, tokens, etc.)
      const sid = selectedSessionRef.current;
      const params = sid ? `?sessionId=${sid}&limit=500` : '?limit=500';
      setTimeout(() => {
        api(`/api/session-logs/${projectId}/turns${params}`).then(d => {
          if (d.turns?.length > 0) setTurns(d.turns);
        }).catch(() => {});
      }, 500);
    });

    return () => {
      socket.emit('stop-watch-activity');
      socket.emit('chat-cancel');
      socket.disconnect();
      socketRef.current = null;
      setWatching(false);
    };
  }, [projectId]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60;
  }, []);

  const sendMessage = useCallback(() => {
    if (!input.trim() || sending || !socketRef.current) return;
    const msg = input.trim();
    setInput('');
    setSending(true);

    setTurns(prev => [...prev, {
      id: `turn-${Date.now()}`, timestamp: new Date().toISOString(),
      userMessage: msg, toolCalls: [], assistantText: '',
      streaming: true, streamingText: '', tokens: null,
    }]);

    // Clear previous permission requests and sub-agents
    setPermissionRequests([]);
    setActiveSubagents([]);

    socketRef.current.emit('chat-send', {
      projectId, message: msg,
      sessionResume: chatSessionId,
      useContinue: !chatSessionId,
    }, (resp) => {
      if (resp?.error) {
        setSending(false);
        setTurns(prev => {
          const copy = [...prev];
          const lastIdx = copy.length - 1;
          if (lastIdx >= 0 && copy[lastIdx].streaming) {
            copy[lastIdx] = { ...copy[lastIdx], assistantText: `Error: ${resp.error}`, streaming: false, isError: true };
          }
          return copy;
        });
      }
      // Track chatId for permission responses
      if (resp?.chatId) setActiveChatId(resp.chatId);
    });

    setTimeout(() => { setSending(prev => prev ? false : prev); }, 60000);
    setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 50);
  }, [input, sending, projectId, chatSessionId]);

  // Handle permission response
  const handlePermissionResponse = useCallback((requestId, approved) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat-permission-response', {
      chatId: activeChatId,
      requestId,
      approved,
    });
    // Remove from pending requests
    setPermissionRequests(prev => prev.filter(r => r.requestId !== requestId));
  }, [activeChatId]);

  const cancelChat = () => {
    if (socketRef.current) socketRef.current.emit('chat-cancel');
    setSending(false);
    setPermissionRequests([]);
    setActiveSubagents([]);
    setTurns(prev => {
      const copy = [...prev];
      const lastIdx = copy.length - 1;
      if (lastIdx >= 0 && copy[lastIdx].streaming) {
        copy[lastIdx] = { ...copy[lastIdx], assistantText: (copy[lastIdx].streamingText || '') + ' [cancelled]', streaming: false, streamingText: undefined };
      }
      return copy;
    });
  };

  // Aggregate stats for header
  const totalTools = turns.reduce((s, t) => s + (t.toolCalls?.length || 0), 0);
  const totalTokens = turns.reduce((s, t) => s + (t.tokens ? t.tokens.input + t.tokens.output : 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%', background: t.bg }}>
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        padding: '6px 12px', borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        background: t.surface,
      }}>
        {/* Status indicator */}
        <div style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: watching ? t.green : t.tm,
          boxShadow: watching ? `0 0 6px ${t.green}` : 'none',
        }} />
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.tp }}>DevTools</span>

        {/* Stats */}
        <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
          {turns.length} turns
        </span>
        {totalTools > 0 && (
          <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
            {totalTools} tools
          </span>
        )}
        {totalTokens > 0 && (
          <span style={{ fontSize: '10px', color: t.tm, fontFamily: 'monospace' }}>
            {fmtTokens(totalTokens)} tokens
          </span>
        )}

        <div style={{ flex: 1 }} />

        {/* Session ID indicator */}
        {chatSessionId && (
          <span style={{ fontSize: '9px', color: t.tm, fontFamily: 'monospace' }}>
            Session: {chatSessionId.substring(0, 8)}
          </span>
        )}

        {/* Toggle activity */}
        <button
          onClick={() => setShowActivity(!showActivity)}
          style={{
            background: showActivity ? t.violetG : 'transparent',
            border: `1px solid ${showActivity ? 'rgba(139,92,246,0.3)' : t.border}`,
            borderRadius: '4px', padding: '3px 8px', cursor: 'pointer',
            fontSize: '10px', fontWeight: '600',
            color: showActivity ? t.violet : t.tm,
          }}
        >
          Activity
        </button>

        {/* Refresh */}
        <button
          onClick={() => {
            const sid = selectedSessionRef.current;
            const params = sid ? `?sessionId=${sid}&limit=500` : '?limit=500';
            api(`/api/session-logs/${projectId}/turns${params}`).then(data => setTurns(data.turns || [])).catch(() => {});
          }}
          style={{
            background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '4px',
            color: t.ts, cursor: 'pointer', padding: '3px 8px', fontSize: '10px',
          }}
        >
          Refresh
        </button>
      </div>

      {/* ── Session tabs ── */}
      <SessionBar
        sessions={sessions}
        selectedId={selectedSession}
        onSelect={setSelectedSession}
        chatSessionId={chatSessionId}
        onNewSession={() => {
          setChatSessionId(null);
          try { localStorage.removeItem(`guru-chat-session-${projectId}`); } catch {}
          setTurns([]);
          setSelectedSession(null);
        }}
      />

      {/* ── Main content: Chat + Activity sidebar ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        {/* Chat timeline */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          {/* Scrollable turns */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ flex: 1, overflow: 'auto', padding: '8px 12px', minHeight: 0 }}
          >
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: t.tm, fontSize: '12px' }}>
                Loading conversation...
              </div>
            ) : turns.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: t.tm }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.5 }}>&#128172;</div>
                <div style={{ fontSize: '13px', fontWeight: '600' }}>Chat with Claude</div>
                <div style={{ fontSize: '11px', marginTop: '6px', maxWidth: '280px', margin: '6px auto 0' }}>
                  Messages are sent via Claude CLI with the workspace CLAUDE.md applied.
                  Activity from terminal sessions appears in the sidebar.
                </div>
                {chatSessionId && (
                  <div style={{ fontSize: '9px', marginTop: '12px', color: t.td, fontFamily: 'monospace' }}>
                    Session: {chatSessionId.substring(0, 12)}...
                  </div>
                )}
              </div>
            ) : (
              <>
                {turns.map((turn, i) => (
                  <div key={turn.id || `turn-${i}`} style={{ marginBottom: '4px' }}>
                    {turn.userMessage && <UserMessage text={turn.userMessage} />}
                    <AIGroupCard
                      turn={turn}
                      defaultExpanded={i >= turns.length - 3 || turn.streaming}
                    />
                  </div>
                ))}

                {/* Active sub-agents inline display */}
                {activeSubagents.filter(sa => !sa.completed).length > 0 && (
                  <div style={{ margin: '6px 0', padding: '8px 12px', borderRadius: '8px', background: 'rgba(6,182,212,0.04)', border: `1px solid rgba(6,182,212,0.12)` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Spinner size={10} color={t.cyan} />
                      <span style={{ fontSize: '10px', fontWeight: 700, color: t.cyan, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sub-agents Running</span>
                    </div>
                    {activeSubagents.filter(sa => !sa.completed).map((sa, i) => (
                      <SubAgentCard key={sa.toolUseId || `sa-${i}`} subagent={sa} isRunning={true} />
                    ))}
                  </div>
                )}

                {/* Pending permission requests */}
                {permissionRequests.length > 0 && (
                  <div style={{ margin: '6px 0' }}>
                    {permissionRequests.map(req => (
                      <PermissionCard
                        key={req.requestId}
                        request={req}
                        onRespond={handlePermissionResponse}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Claude auth banner ── */}
          {(claudeAuthError || claudeConnected === false) && (
            <div style={{
              padding: '8px 12px', borderTop: `1px solid rgba(239,68,68,0.2)`,
              background: 'rgba(239,68,68,0.06)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
            }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.red, flexShrink: 0 }} />
              <span style={{ fontSize: '11px', color: t.red, flex: 1 }}>
                Claude CLI is not authenticated. Connect to use chat.
              </span>
              <button
                onClick={() => { window.location.href = '/setup-claude'; }}
                style={{
                  padding: '5px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  background: t.violet, color: '#fff', fontSize: '11px', fontWeight: '600', flexShrink: 0,
                }}
              >
                Connect Claude
              </button>
            </div>
          )}

          {/* ── Input area ── */}
          <div style={{
            padding: '8px 12px', borderTop: `1px solid ${t.border}`,
            display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0,
            background: t.surface,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={sending ? 'Claude is working...' : 'Message Claude...'}
              disabled={sending}
              rows={1}
              style={{
                flex: 1, padding: '8px 12px', borderRadius: '8px', resize: 'none',
                background: t.surfaceEl, border: `1px solid ${t.border}`, color: t.tp,
                fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                minHeight: '36px', maxHeight: '120px',
                opacity: sending ? 0.5 : 1,
              }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            {sending ? (
              <button onClick={cancelChat} style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: t.redM, color: t.red, fontSize: '12px', fontWeight: '600', flexShrink: 0,
              }}>Stop</button>
            ) : (
              <button onClick={sendMessage} disabled={!input.trim()} style={{
                padding: '8px 14px', borderRadius: '8px', border: 'none',
                cursor: input.trim() ? 'pointer' : 'not-allowed',
                background: input.trim() ? t.violet : 'rgba(139,92,246,0.15)',
                color: input.trim() ? '#fff' : t.tm, fontSize: '12px', fontWeight: '600',
                flexShrink: 0, opacity: input.trim() ? 1 : 0.5,
              }}>Send</button>
            )}
          </div>
        </div>

        {/* Activity sidebar */}
        <ActivitySidebar
          turns={turns}
          events={events}
          visible={showActivity}
          onClose={() => setShowActivity(false)}
          sending={sending}
          activeSubagents={activeSubagents}
          permissionRequests={permissionRequests}
          onPermissionRespond={handlePermissionResponse}
        />
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────
function summarizeTool(name, input) {
  if (!input) return '';
  const n = (name || '').toLowerCase();
  if (n === 'read') return input.file_path || '';
  if (n === 'write') return input.file_path || '';
  if (n === 'edit') return input.file_path || '';
  if (n === 'bash') return (input.command || '').substring(0, 80);
  if (n === 'glob') return input.pattern || '';
  if (n === 'grep') return input.pattern || '';
  if (n === 'task') return input.description || (input.prompt || '').substring(0, 80);
  if (n.startsWith('mcp__')) {
    const parts = n.split('__');
    return parts.slice(1).join('/');
  }
  return '';
}

function categorizeTool(name) {
  if (!name) return 'tool';
  const n = name.toLowerCase();
  if (n === 'read') return 'file_read';
  if (n === 'write') return 'file_write';
  if (n === 'edit') return 'file_edit';
  if (n === 'bash') return 'command';
  if (n === 'glob' || n === 'grep') return 'search';
  if (n === 'task') return 'subagent';
  if (n === 'webfetch' || n === 'websearch') return 'web';
  if (n.startsWith('mcp__')) return 'mcp';
  return 'tool';
}
