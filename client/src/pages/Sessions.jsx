import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Sessions() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [killing, setKilling] = useState(null); // session id or 'all'
  const navigate = useNavigate();

  const load = useCallback(() => {
    api('/api/sessions').then(data => {
      setSessions(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  const killSession = async (id) => {
    setKilling(id);
    try {
      await api(`/api/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Kill failed:', err);
    }
    setKilling(null);
  };

  const killAll = async () => {
    if (!sessions.length) return;
    setKilling('all');
    try {
      await api('/api/sessions/all', { method: 'DELETE' });
      setSessions([]);
    } catch (err) {
      console.error('Kill all failed:', err);
    }
    setKilling(null);
  };

  const timeAgo = (ts) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const activeSessions = sessions.filter(s => !s.exited);
  const deadSessions = sessions.filter(s => s.exited);

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ color: '#F4F4F5', fontSize: '20px', fontWeight: '600', margin: 0 }}>
            Sessions
          </h1>
          <p style={{ color: '#71717A', fontSize: '13px', margin: '4px 0 0' }}>
            {activeSessions.length} active instance{activeSessions.length !== 1 ? 's' : ''}
            {deadSessions.length > 0 && ` \u00b7 ${deadSessions.length} exited`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={load}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#A1A1AA', borderRadius: '6px', padding: '8px 14px',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.2)'; e.target.style.color = '#F4F4F5'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.color = '#A1A1AA'; }}
          >
            Refresh
          </button>
          {activeSessions.length > 0 && (
            <button
              onClick={killAll}
              disabled={killing === 'all'}
              style={{
                background: killing === 'all' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', borderRadius: '6px', padding: '8px 14px',
                fontSize: '13px', fontWeight: '500', cursor: killing === 'all' ? 'wait' : 'pointer',
                transition: 'all 0.15s',
                opacity: killing === 'all' ? 0.6 : 1,
              }}
              onMouseEnter={e => { if (killing !== 'all') { e.target.style.background = 'rgba(239,68,68,0.25)'; } }}
              onMouseLeave={e => { e.target.style.background = killing === 'all' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)'; }}
            >
              {killing === 'all' ? 'Killing...' : `Kill all (${activeSessions.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#52525B' }}>
          Loading sessions...
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '80px 24px',
          background: '#1a1a1b', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.4 }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#52525B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="m8 21 4-4 4 4" />
              <path d="M7 8h.01M12 8h.01" />
            </svg>
          </div>
          <p style={{ color: '#71717A', fontSize: '14px', margin: 0 }}>No active terminal sessions</p>
          <p style={{ color: '#52525B', fontSize: '12px', margin: '4px 0 0' }}>
            Sessions appear when you open terminals in projects
          </p>
        </div>
      )}

      {/* Active sessions */}
      {activeSessions.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ color: '#A1A1AA', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Active
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
            {activeSessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px', background: '#1a1a1b',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1f1f21'}
              onMouseLeave={e => e.currentTarget.style.background = '#1a1a1b'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  {/* Status dot */}
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: '#22c55e',
                    boxShadow: '0 0 6px rgba(34,197,94,0.4)',
                  }} />
                  {/* Info */}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#F4F4F5', fontSize: '13px', fontWeight: '500' }}>
                        {s.title || `Session ${s.id}`}
                      </span>
                      <span style={{
                        fontSize: '11px', color: '#8B5CF6',
                        background: 'rgba(139,92,246,0.12)', padding: '1px 6px',
                        borderRadius: '3px', fontFamily: '"JetBrains Mono", monospace',
                      }}>
                        {s.id}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                      {s.projectName && (
                        <span
                          style={{ fontSize: '12px', color: '#A1A1AA', cursor: 'pointer', transition: 'color 0.15s' }}
                          onClick={() => navigate(`/project/${s.projectId}`)}
                          onMouseEnter={e => e.target.style.color = '#8B5CF6'}
                          onMouseLeave={e => e.target.style.color = '#A1A1AA'}
                        >
                          {s.projectName}
                        </span>
                      )}
                      {!s.projectName && s.projectId && (
                        <span style={{ fontSize: '12px', color: '#52525B', fontFamily: '"JetBrains Mono", monospace' }}>
                          {s.projectId.slice(0, 8)}
                        </span>
                      )}
                      <span style={{ fontSize: '11px', color: '#52525B' }}>
                        Started {timeAgo(s.createdAt)}
                      </span>
                      <span style={{ fontSize: '11px', color: '#52525B' }}>
                        Active {timeAgo(s.lastActivity)}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Actions */}
                <button
                  onClick={() => killSession(s.id)}
                  disabled={killing === s.id}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', borderRadius: '4px', padding: '4px 10px',
                    fontSize: '12px', fontWeight: '500', cursor: killing === s.id ? 'wait' : 'pointer',
                    transition: 'all 0.15s',
                    opacity: killing === s.id ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => { if (killing !== s.id) { e.target.style.background = 'rgba(239,68,68,0.1)'; e.target.style.borderColor = 'rgba(239,68,68,0.4)'; } }}
                  onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'rgba(239,68,68,0.2)'; }}
                >
                  {killing === s.id ? '...' : 'Kill'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exited sessions */}
      {deadSessions.length > 0 && (
        <div>
          <h2 style={{ color: '#52525B', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
            Exited
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
            {deadSessions.map(s => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 16px', background: 'rgba(26,26,27,0.5)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                    background: '#52525B',
                  }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#71717A', fontSize: '13px', fontWeight: '500' }}>
                        {s.title || `Session ${s.id}`}
                      </span>
                      <span style={{
                        fontSize: '11px', color: '#52525B',
                        background: 'rgba(255,255,255,0.04)', padding: '1px 6px',
                        borderRadius: '3px', fontFamily: '"JetBrains Mono", monospace',
                      }}>
                        {s.id}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px' }}>
                      {s.projectName && (
                        <span style={{ fontSize: '12px', color: '#52525B' }}>{s.projectName}</span>
                      )}
                      <span style={{ fontSize: '11px', color: '#3F3F46' }}>
                        Exited {timeAgo(s.lastActivity)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => killSession(s.id)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#52525B', borderRadius: '4px', padding: '4px 10px',
                    fontSize: '12px', cursor: 'pointer',
                    transition: 'all 0.15s', flexShrink: 0,
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#71717A'; }}
                  onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.06)'; e.target.style.color = '#52525B'; }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
