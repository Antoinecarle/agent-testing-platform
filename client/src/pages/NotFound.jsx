import React from 'react';
import { useNavigate } from 'react-router-dom';

const t = {
  bg: '#0f0f0f',
  surface: '#1a1a1b',
  border: '#2a2a2b',
  text: '#e4e4e7',
  muted: '#71717a',
  violet: '#8B5CF6',
};

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '40px',
      color: t.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{ fontSize: '72px', fontWeight: 700, color: t.violet, marginBottom: '8px' }}>404</div>
      <h2 style={{ margin: '0 0 8px', fontSize: '20px', fontWeight: 600 }}>Page not found</h2>
      <p style={{ color: t.muted, fontSize: '14px', marginBottom: '24px' }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <button
        onClick={() => navigate('/')}
        style={{
          background: t.violet,
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
