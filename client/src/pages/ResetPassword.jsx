import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  border: '#2a2a2b',
  text: '#e4e4e7',
  muted: '#71717a',
  violet: '#8B5CF6',
  success: '#22c55e',
};

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: t.bg, fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{ color: t.muted, textAlign: 'center' }}>
          <p>Invalid or missing reset token.</p>
          <Link to="/forgot-password" style={{ color: t.violet, textDecoration: 'none' }}>
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: t.bg, fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px',
        padding: '40px', width: '100%', maxWidth: '400px',
      }}>
        <h1 style={{ color: t.text, fontSize: '24px', fontWeight: 700, margin: '0 0 8px' }}>
          Set New Password
        </h1>

        {success ? (
          <div style={{ color: t.success, fontSize: '14px', lineHeight: 1.6 }}>
            Password has been reset successfully.
            <div style={{ marginTop: '16px' }}>
              <Link to="/login" style={{ color: t.violet, textDecoration: 'none', fontWeight: 600 }}>
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{error}</div>
            )}
            <label htmlFor="newPassword" style={{ display: 'block', color: t.muted, fontSize: '13px', marginBottom: '6px' }}>
              New Password
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoFocus
              minLength={6}
              style={{
                width: '100%', padding: '10px 12px', background: t.bg,
                border: `1px solid ${t.border}`, borderRadius: '8px',
                color: t.text, fontSize: '14px', outline: 'none', marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <label htmlFor="confirmPassword" style={{ display: 'block', color: t.muted, fontSize: '13px', marginBottom: '6px' }}>
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: '100%', padding: '10px 12px', background: t.bg,
                border: `1px solid ${t.border}`, borderRadius: '8px',
                color: t.text, fontSize: '14px', outline: 'none', marginBottom: '16px',
                boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '10px', background: t.violet, color: '#fff',
                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
