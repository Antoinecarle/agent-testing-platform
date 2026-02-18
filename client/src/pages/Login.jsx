import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, setRefreshToken, setUser } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check for error from OAuth redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError(params.get('error'));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToken(data.token);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      setUser({ userId: data.userId, email: data.email, displayName: data.displayName, role: data.role, claudeConnected: data.claudeConnected });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#050505', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '60%', height: '400px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <form onSubmit={handleSubmit} style={{
        width: '360px', padding: '40px', background: '#0A0A0B',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '8px', background: '#111112',
            border: '1px solid rgba(255,255,255,0.12)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
            color: '#8B5CF6', fontSize: '20px',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></svg>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Agent Testing Platform
          </h1>
          <p style={{ fontSize: '13px', color: '#A1A1AA' }}>Sign in to continue</p>
        </div>

        {error && (
          <div style={{
            padding: '8px 12px', marginBottom: '16px', borderRadius: '4px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444', fontSize: '12px',
          }}>{error}</div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#A1A1AA', marginBottom: '6px' }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ width: '100%' }} placeholder="admin@vps.local" />
        </div>
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#A1A1AA', marginBottom: '6px' }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ width: '100%' }} />
        </div>
        <button type="submit" disabled={loading} style={{
          width: '100%', padding: '10px', background: '#F4F4F5', color: '#050505',
          border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: '600',
          opacity: loading ? 0.7 : 1,
        }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', margin: '20px 0',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
          <span style={{ fontSize: '11px', color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>or</span>
          <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
        </div>

        <a href="/api/github/auth?action=login" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          width: '100%', padding: '10px', background: '#161618',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          fontSize: '13px', fontWeight: '500', color: '#F4F4F5',
          textDecoration: 'none', boxSizing: 'border-box',
          cursor: 'pointer', transition: 'border-color 0.2s',
        }}
        onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
        onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          Continue with GitHub
        </a>

        <div style={{ textAlign: 'center', marginTop: '12px' }}>
          <Link to="/forgot-password" style={{ color: '#A1A1AA', fontSize: '12px', textDecoration: 'none' }}>
            Forgot password?
          </Link>
        </div>
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#A1A1AA' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#8B5CF6', textDecoration: 'none', fontWeight: '500' }}>
            Create one
          </Link>
        </div>
      </form>
    </div>
  );
}
