import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser, setUser } from '../api';
import TerminalPanel from '../components/TerminalPanel';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e',
};

export default function ClaudeSetup() {
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const terminalRef = useRef(null);
  const navigate = useNavigate();

  const checkConnection = async () => {
    setChecking(true);
    setError('');
    try {
      const result = await api('/api/claude-auth/verify', { method: 'POST' });
      setConnected(result.connected);
      if (result.connected) {
        const user = getUser();
        if (user) {
          setUser({ ...user, claudeConnected: true });
        }
      } else {
        setError('Claude is not connected yet. Complete the OAuth flow in the terminal first.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#050505', display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '60%', height: '400px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />

      <div style={{
        width: '680px', background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px', position: 'relative', zIndex: 1, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '32px 32px 0', textAlign: 'center' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px', background: '#111112',
            border: '1px solid rgba(255,255,255,0.12)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
            color: connected ? t.success : t.violet,
          }}>
            {connected ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            )}
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', letterSpacing: '-0.02em', marginBottom: '6px', color: t.tp }}>
            {connected ? 'Claude Connected!' : 'Connect Claude'}
          </h1>
          <p style={{ fontSize: '13px', color: t.ts, lineHeight: 1.5, maxWidth: '480px', margin: '0 auto' }}>
            {connected
              ? 'Your Claude account is connected and ready to use. You can now create projects and generate iterations.'
              : 'Authenticate with Claude to enable AI-powered agent testing. Follow the steps below.'
            }
          </p>
        </div>

        {connected ? (
          /* Success state */
          <div style={{ padding: '24px 32px 32px' }}>
            <div style={{
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: '8px', padding: '16px', marginBottom: '20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', color: t.success, fontWeight: '500' }}>
                Claude OAuth authentication successful
              </div>
            </div>
            <button onClick={() => navigate('/')} style={{
              width: '100%', padding: '12px', background: t.violet, color: '#fff',
              border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600',
              cursor: 'pointer',
            }}>
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Steps */}
            <div style={{ padding: '20px 32px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { num: '1', text: "Type 'claude' in the terminal below and press Enter" },
                  { num: '2', text: 'A URL will appear — open it in your browser' },
                  { num: '3', text: 'Sign in and authorize the connection' },
                  { num: '4', text: "Come back here and click 'Check Connection'" },
                ].map(step => (
                  <div key={step.num} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      width: '22px', height: '22px', borderRadius: '50%', background: t.violetM,
                      color: t.violet, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: '700', flexShrink: 0,
                    }}>{step.num}</span>
                    <span style={{ fontSize: '12px', color: t.ts }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal */}
            <div style={{
              margin: '0 16px', height: '280px', borderRadius: '8px', overflow: 'hidden',
              border: `1px solid ${t.borderS}`, background: t.bg,
            }}>
              <TerminalPanel
                ref={terminalRef}
                projectId=""
                onSessionCreated={() => {}}
              />
            </div>

            {/* Actions */}
            <div style={{ padding: '20px 32px 28px' }}>
              {error && (
                <div style={{
                  padding: '8px 12px', marginBottom: '12px', borderRadius: '4px',
                  background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                  color: '#f59e0b', fontSize: '12px',
                }}>{error}</div>
              )}

              <button onClick={checkConnection} disabled={checking} style={{
                width: '100%', padding: '10px', background: t.tp, color: '#050505',
                border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600',
                cursor: checking ? 'default' : 'pointer', opacity: checking ? 0.7 : 1,
                marginBottom: '12px',
              }}>
                {checking ? 'Checking...' : 'Check Connection'}
              </button>

              <div style={{ textAlign: 'center' }}>
                <span onClick={() => navigate('/')} style={{
                  fontSize: '12px', color: t.tm, cursor: 'pointer', textDecoration: 'none',
                }}
                onMouseEnter={e => e.target.style.color = t.ts}
                onMouseLeave={e => e.target.style.color = t.tm}>
                  Skip for now
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
