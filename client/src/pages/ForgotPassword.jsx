import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  border: '#2a2a2b',
  text: '#e4e4e7',
  muted: '#71717a',
  violet: '#8B5CF6',
  success: '#22c55e',
};

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: t.bg,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: '12px',
        padding: '40px',
        width: '100%',
        maxWidth: '400px',
      }}>
        <h1 style={{ color: t.text, fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
          Reset Password
        </h1>
        <p style={{ color: t.muted, fontSize: '14px', margin: '0 0 24px' }}>
          Enter your email and we'll send you a reset link.
        </p>

        {sent ? (
          <div style={{ color: t.success, fontSize: '14px', lineHeight: 1.6 }}>
            If an account exists with that email, a reset link has been generated. Check your inbox.
            <div style={{ marginTop: '16px' }}>
              <Link to="/login" style={{ color: t.violet, textDecoration: 'none' }}>
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
            )}
            <label htmlFor="email" style={{ display: 'block', color: t.muted, fontSize: '13px', marginBottom: '6px' }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: t.bg,
                border: `1px solid ${t.border}`,
                borderRadius: '8px',
                color: t.text,
                fontSize: '14px',
                outline: 'none',
                marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                background: t.violet,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Link to="/login" style={{ color: t.muted, fontSize: '13px', textDecoration: 'none' }}>
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
