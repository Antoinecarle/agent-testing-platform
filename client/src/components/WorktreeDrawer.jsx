import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2, X } from 'lucide-react';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

export default function WorktreeDrawer({
  treeData,
  selected,
  onSelect,
  onContext,
  onBranch,
  onRename,
  onImport,
  onSnapshot,
  onNewRoot,
  branchParent,
  onSetBranchParent,
  agentWorking,
  watcherLogs,
  multiSelect,
  selectedIds,
  onToggleSelect,
  onMultiSelectToggle,
  onBulkDelete,
  TreeNodeComponent,
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      borderTop: `1px solid ${t.border}`,
      background: t.surface,
      flexShrink: 0,
      transition: 'max-height 0.3s ease',
      maxHeight: open ? '400px' : '36px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          height: '36px', minHeight: '36px', display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: '8px', cursor: 'pointer',
          borderBottom: open ? `1px solid ${t.border}` : 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '10px', color: t.tm, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>
          {'\u25B6'}
        </span>
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Worktree
        </span>
        {agentWorking && (
          <span title="Agent is working..." style={{
            width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', flexShrink: 0,
            animation: 'pulse 1.5s infinite',
          }} />
        )}
        {treeData.length > 0 && (
          <span style={{
            fontSize: '9px', color: t.tm, background: 'rgba(255,255,255,0.05)',
            padding: '1px 5px', borderRadius: '3px', fontWeight: '600',
          }}>
            {treeData.length}
          </span>
        )}
        <div style={{ flex: 1 }} />
        {/* Action buttons (only when expanded) */}
        {open && (
          <div style={{ display: 'flex', gap: '3px' }} onClick={e => e.stopPropagation()}>
            {multiSelect ? (
              <>
                <button onClick={onBulkDelete} disabled={!selectedIds || selectedIds.size === 0}
                  title={`Delete ${selectedIds?.size || 0} selected`}
                  style={{
                    background: selectedIds?.size > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.05)',
                    color: selectedIds?.size > 0 ? '#ef4444' : t.tm,
                    border: `1px solid ${selectedIds?.size > 0 ? 'rgba(239,68,68,0.3)' : t.border}`,
                    borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '3px', cursor: selectedIds?.size > 0 ? 'pointer' : 'default',
                  }}>
                  <Trash2 size={10} /> {selectedIds?.size || 0}
                </button>
                <button onClick={() => onMultiSelectToggle?.(false)}
                  style={{ background: 'rgba(255,255,255,0.05)', color: t.ts, border: `1px solid ${t.border}`, borderRadius: '4px', padding: '3px 5px', fontSize: '10px', cursor: 'pointer' }}>
                  <X size={10} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => onMultiSelectToggle?.(true)} title="Select multiple to delete"
                  style={{ background: 'transparent', color: t.tm, border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <Trash2 size={11} />
                </button>
                <button onClick={onImport} title="Import all workspace files"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                  Save
                </button>
                <button onClick={onSnapshot} title="Snapshot current state"
                  style={{ background: 'rgba(139,92,246,0.15)', color: t.violet, border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                  Snap
                </button>
                <button onClick={onNewRoot} style={{ background: t.tp, color: t.bg, border: 'none', borderRadius: '4px', padding: '3px 6px', fontSize: '10px', fontWeight: '600', cursor: 'pointer' }}>
                  New
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body (visible when expanded) */}
      {open && (
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {/* Branch context indicator */}
          {branchParent !== undefined && (
            <div style={{
              padding: '4px 12px', borderBottom: `1px solid ${t.border}`, display: 'flex',
              alignItems: 'center', gap: '6px', fontSize: '10px', background: 'rgba(139,92,246,0.06)',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={t.violet} strokeWidth="2">
                <line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>
              </svg>
              <span style={{ color: t.violet, flex: 1 }}>
                {branchParent === null
                  ? 'New root worktree'
                  : `From ${branchParent.title || 'V' + branchParent.version}`}
              </span>
              <span onClick={() => onSetBranchParent?.(undefined)} style={{ color: t.tm, cursor: 'pointer', fontSize: '12px' }}>x</span>
            </div>
          )}

          {/* Tree */}
          <div style={{ padding: '6px 8px' }}>
            {treeData.map(node => (
              <TreeNodeComponent
                key={node.id}
                node={node}
                selected={selected}
                onSelect={onSelect}
                onContext={onContext}
                onBranch={onBranch}
                onRename={onRename}
                multiSelect={multiSelect}
                selectedIds={selectedIds}
                onToggleSelect={onToggleSelect}
              />
            ))}
            {treeData.length === 0 && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: t.tm }}>No iterations yet</div>
            )}
          </div>

          {/* Watcher logs */}
          {watcherLogs && watcherLogs.length > 0 && (
            <div style={{ borderTop: `1px solid ${t.border}`, maxHeight: '80px', overflowY: 'auto' }}>
              <div style={{ padding: '3px 12px', fontSize: '9px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', background: t.surfaceEl, position: 'sticky', top: 0, zIndex: 1 }}>
                Activity Log
              </div>
              {watcherLogs.slice().reverse().map((log, i) => (
                <div key={i} style={{ padding: '2px 12px', fontSize: '9px', color: t.ts, display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{
                    width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
                    background: log.type === 'create' ? '#22c55e' : log.type === 'update' ? '#3b82f6' : log.type === 'snapshot' ? t.violet : '#f59e0b',
                  }} />
                  <span style={{ color: t.tm, fontSize: '8px', flexShrink: 0 }}>
                    {new Date(log.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
