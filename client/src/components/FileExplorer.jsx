import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b',
};

// File type icons (simple SVG-based)
const FILE_ICONS = {
  javascript: { color: '#f7df1e', label: 'JS' },
  typescript: { color: '#3178c6', label: 'TS' },
  html: { color: '#e34f26', label: 'H' },
  css: { color: '#1572b6', label: 'C' },
  json: { color: '#a8a8a8', label: '{}' },
  markdown: { color: '#888', label: 'MD' },
  image: { color: '#8B5CF6', label: 'IMG' },
  python: { color: '#3776AB', label: 'PY' },
  shell: { color: '#4EAA25', label: 'SH' },
  yaml: { color: '#CB171E', label: 'YML' },
  config: { color: '#888', label: 'CFG' },
  lock: { color: '#555', label: 'LCK' },
  text: { color: '#888', label: 'TXT' },
  unknown: { color: '#555', label: '?' },
};

function FileIcon({ fileType, size = 14 }) {
  const icon = FILE_ICONS[fileType] || FILE_ICONS.unknown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 4, height: size + 2, borderRadius: '3px',
      fontSize: `${size - 5}px`, fontWeight: '700', fontFamily: 'monospace',
      background: `${icon.color}18`, color: icon.color, flexShrink: 0,
    }}>
      {icon.label}
    </span>
  );
}

function FolderIcon({ open, size = 14, skipped }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={skipped ? t.tm : t.warning} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, opacity: skipped ? 0.5 : 1 }}>
      {open ? (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      ) : (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      )}
    </svg>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

function FileTreeNode({ node, level = 0, onFileSelect, selectedFile, recentChanges }) {
  const [expanded, setExpanded] = useState(level < 2 && !node.skipped);
  const [hovered, setHovered] = useState(false);
  const isDir = node.type === 'directory';
  const isSelected = !isDir && selectedFile === node.path;
  const isRecentlyChanged = recentChanges.has(node.path);

  return (
    <div>
      <div
        onClick={() => {
          if (isDir) setExpanded(!expanded);
          else onFileSelect(node);
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '3px 8px', paddingLeft: `${8 + level * 14}px`,
          cursor: 'pointer', fontSize: '12px',
          background: isSelected ? 'rgba(139,92,246,0.12)' : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
          borderLeft: isRecentlyChanged ? '2px solid #22c55e' : '2px solid transparent',
          transition: 'all 0.15s',
        }}
      >
        {isDir ? (
          <>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={t.tm} strokeWidth="1.5"
              style={{ flexShrink: 0, transition: 'transform 0.15s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)' }}>
              <polyline points="3,1 7,5 3,9"/>
            </svg>
            <FolderIcon open={expanded} skipped={node.skipped} />
          </>
        ) : (
          <>
            <span style={{ width: '10px', flexShrink: 0 }} />
            <FileIcon fileType={node.fileType} />
          </>
        )}
        <span style={{
          color: isSelected ? t.tp : node.skipped ? t.tm : t.ts,
          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontStyle: node.skipped ? 'italic' : 'normal',
          opacity: node.skipped ? 0.6 : 1,
        }}>
          {node.name}
        </span>
        {!isDir && hovered && node.size !== undefined && (
          <span style={{ color: t.tm, fontSize: '10px', flexShrink: 0 }}>
            {formatSize(node.size)}
          </span>
        )}
        {isRecentlyChanged && (
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#22c55e', flexShrink: 0,
            animation: 'pulse 1s ease-in-out 3',
          }} />
        )}
      </div>
      {isDir && expanded && !node.skipped && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeNode
              key={child.path || i}
              node={child}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              recentChanges={recentChanges}
            />
          ))}
          {node.children.length === 0 && (
            <div style={{ paddingLeft: `${8 + (level + 1) * 14}px`, fontSize: '11px', color: t.tm, padding: '4px 8px' }}>
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FileExplorer({ projectId, onFileSelect, selectedFile }) {
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentChanges, setRecentChanges] = useState(new Map()); // path -> timestamp
  const [activityLog, setActivityLog] = useState([]); // [{path, type, time}]
  const socketRef = useRef(null);
  const [creating, setCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [createError, setCreateError] = useState('');
  const newFileRef = useRef(null);

  // Load file tree
  const loadTree = useCallback(async () => {
    try {
      const data = await api(`/api/projects/${projectId}/files`);
      setTree(data.tree || []);
    } catch (err) {
      console.error('[FileExplorer] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createFile = useCallback(async () => {
    const filePath = newFilePath.trim();
    if (!filePath) return;
    setCreateError('');
    try {
      await api(`/api/projects/${projectId}/files/write`, {
        method: 'POST',
        body: JSON.stringify({ path: filePath, content: '' }),
      });
      setCreating(false);
      setNewFilePath('');
      loadTree();
    } catch (err) {
      setCreateError(err.message || 'Error');
    }
  }, [projectId, newFilePath, loadTree]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (creating && newFileRef.current) newFileRef.current.focus();
  }, [creating]);

  // Listen for real-time file changes
  useEffect(() => {
    const socket = io({ transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('file-changed', (data) => {
      if (data.projectId !== projectId) return;

      // Mark as recently changed
      setRecentChanges(prev => {
        const next = new Map(prev);
        next.set(data.path, data.timestamp);
        return next;
      });

      // Add to activity log
      setActivityLog(prev => [{
        path: data.path,
        type: data.changeType,
        time: Date.now(),
      }, ...prev].slice(0, 50));

      // Refresh tree (debounced via state)
      loadTree();

      // Clear the highlight after 5 seconds
      setTimeout(() => {
        setRecentChanges(prev => {
          const next = new Map(prev);
          if (next.get(data.path) === data.timestamp) {
            next.delete(data.path);
          }
          return next;
        });
      }, 5000);
    });

    return () => socket.disconnect();
  }, [projectId, loadTree]);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>
        Loading files...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px', borderBottom: `1px solid ${t.border}`, flexShrink: 0,
      }}>
        <span style={{ fontSize: '11px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Files
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button onClick={() => { setCreating(true); setCreateError(''); setNewFilePath(''); }} style={{
            background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
            padding: '2px', display: 'flex', alignItems: 'center',
          }} title="New file">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button onClick={loadTree} style={{
            background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
            padding: '2px', display: 'flex', alignItems: 'center',
          }} title="Refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* New file input */}
      {creating && (
        <div style={{
          padding: '6px 10px', borderBottom: `1px solid ${t.border}`,
          background: 'rgba(139,92,246,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              ref={newFileRef}
              value={newFilePath}
              onChange={e => setNewFilePath(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') createFile();
                if (e.key === 'Escape') { setCreating(false); setNewFilePath(''); }
              }}
              placeholder="path/to/file.js"
              style={{
                flex: 1, background: t.bg, border: `1px solid ${t.violet}50`,
                borderRadius: '4px', padding: '5px 8px', color: t.tp,
                fontSize: '11px', outline: 'none', fontFamily: '"JetBrains Mono","Fira Code",monospace',
              }}
            />
            <button onClick={createFile} style={{
              background: t.violet, border: 'none', borderRadius: '4px',
              padding: '4px 8px', color: '#fff', fontSize: '10px', fontWeight: 600,
              cursor: 'pointer',
            }}>
              OK
            </button>
            <button onClick={() => { setCreating(false); setNewFilePath(''); }} style={{
              background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
              padding: '2px', display: 'flex', fontSize: '14px', lineHeight: 1,
            }}>
              x
            </button>
          </div>
          {createError && (
            <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '4px' }}>{createError}</div>
          )}
        </div>
      )}

      {/* File Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {tree.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>
            No files in workspace yet
          </div>
        ) : (
          tree.map((node, i) => (
            <FileTreeNode
              key={node.path || i}
              node={node}
              onFileSelect={onFileSelect || (() => {})}
              selectedFile={selectedFile}
              recentChanges={recentChanges}
            />
          ))
        )}
      </div>

      {/* Activity Log */}
      {activityLog.length > 0 && (
        <div style={{
          borderTop: `1px solid ${t.border}`, maxHeight: '120px', overflowY: 'auto', flexShrink: 0,
        }}>
          <div style={{
            padding: '6px 12px', fontSize: '10px', fontWeight: '600', color: t.tm,
            textTransform: 'uppercase', letterSpacing: '0.05em', position: 'sticky', top: 0,
            background: t.surface, borderBottom: `1px solid ${t.border}`,
          }}>
            Activity
          </div>
          {activityLog.slice(0, 10).map((entry, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '3px 12px', fontSize: '11px',
            }}>
              <span style={{
                width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                background: entry.type === 'created' ? '#22c55e' : entry.type === 'deleted' ? '#ef4444' : '#f59e0b',
              }} />
              <span style={{ color: t.ts, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.path}
              </span>
              <span style={{ color: t.tm, fontSize: '10px', flexShrink: 0 }}>
                {new Date(entry.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* CSS animation for pulse */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
