import React, { useState, useEffect } from 'react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
};

// Simple syntax highlighting by file extension
const LANG_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.html': 'html', '.htm': 'html', '.css': 'css', '.scss': 'css',
  '.json': 'json', '.jsonc': 'json', '.md': 'markdown',
  '.py': 'python', '.sh': 'shell', '.bash': 'shell',
  '.yml': 'yaml', '.yaml': 'yaml',
};

function getExtension(filePath) {
  const dot = filePath.lastIndexOf('.');
  return dot >= 0 ? filePath.slice(dot).toLowerCase() : '';
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileViewer({ projectId, filePath, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState({});

  useEffect(() => {
    if (!filePath) return;
    setLoading(true);
    setError(null);

    api(`/api/projects/${projectId}/files/read?path=${encodeURIComponent(filePath)}`)
      .then(data => {
        if (data.binary) {
          setContent(null);
          setMeta({ binary: true, size: data.size });
        } else if (data.truncated) {
          setContent(null);
          setMeta({ truncated: true, size: data.size, message: data.message });
        } else {
          setContent(data.content);
          setMeta({ size: data.size, mtime: data.mtime });
        }
      })
      .catch(err => setError(err.message || 'Failed to load file'))
      .finally(() => setLoading(false));
  }, [projectId, filePath]);

  if (!filePath) return null;

  const ext = getExtension(filePath);
  const fileName = filePath.split('/').pop();

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.bg, borderLeft: `1px solid ${t.border}`,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '8px 12px', borderBottom: `1px solid ${t.border}`,
        background: t.surface, flexShrink: 0,
      }}>
        <span style={{ fontSize: '12px', fontWeight: '600', color: t.tp, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {filePath}
        </span>
        {meta.size !== undefined && (
          <span style={{ fontSize: '10px', color: t.tm, flexShrink: 0 }}>
            {formatSize(meta.size)}
          </span>
        )}
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: t.tm, cursor: 'pointer',
          padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 0 }}>
        {loading ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: t.tm }}>
            Loading...
          </div>
        ) : error ? (
          <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#ef4444' }}>
            {error}
          </div>
        ) : meta.binary ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.tm }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>Binary file</div>
            <div>{formatSize(meta.size)}</div>
          </div>
        ) : meta.truncated ? (
          <div style={{ padding: '40px', textAlign: 'center', fontSize: '13px', color: t.tm }}>
            <div style={{ fontSize: '18px', marginBottom: '8px' }}>File too large</div>
            <div>{meta.message}</div>
          </div>
        ) : (
          <pre style={{
            margin: 0, padding: '12px', fontSize: '12px', lineHeight: '1.6',
            fontFamily: '"JetBrains Mono","Fira Code",monospace',
            color: t.ts, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            counterReset: 'line',
          }}>
            {content && content.split('\n').map((line, i) => (
              <div key={i} style={{ display: 'flex', minHeight: '19px' }}>
                <span style={{
                  display: 'inline-block', width: '40px', textAlign: 'right',
                  paddingRight: '12px', color: t.tm, fontSize: '11px',
                  userSelect: 'none', flexShrink: 0, borderRight: `1px solid ${t.border}`,
                  marginRight: '12px',
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1 }}>{line || ' '}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}
