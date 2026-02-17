import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, setRefreshToken, setUser } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#A1A1AA' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#8B5CF6', textDecoration: 'none', fontWeight: '500' }}>
            Create one
          </Link>
        </div>
      </form>
    </div>
  );
}
