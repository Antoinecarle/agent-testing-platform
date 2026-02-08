import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, getUser, api } from '../api';
import GuruLogo from './GuruLogo';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Load user info from API
    api('/api/user/me').then(setUserInfo).catch(() => {
      // Fallback to localStorage
      const stored = getUser();
      if (stored) setUserInfo(stored);
    });
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const linkStyle = (isActive) => ({
    color: isActive ? '#F4F4F5' : '#52525B',
    fontSize: '13px',
    fontWeight: '500',
    textDecoration: 'none',
    transition: 'color 0.2s',
    padding: '6px 12px',
    borderRadius: '4px',
    background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
  });

  const isProjectPage = location.pathname.startsWith('/project/') && location.pathname !== '/project/new';
  const isComparePage = location.pathname.startsWith('/compare/');
  const isFullWidth = isProjectPage || isComparePage;

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f' }}>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(12px)',
      }}>
        {/* Logo guru.ai */}
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <GuruLogo size={28} withText={true} />
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
          <NavLink to="/agents" style={({ isActive }) => linkStyle(isActive)}>Agents</NavLink>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* User info + Claude status */}
          {userInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#A1A1AA' }}>
                {userInfo.displayName || userInfo.email}
              </span>
              <div
                title={userInfo.claudeConnected ? 'Claude connected' : 'Claude not connected'}
                onClick={() => !userInfo.claudeConnected && navigate('/setup-claude')}
                style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: userInfo.claudeConnected ? '#22c55e' : '#ef4444',
                  cursor: userInfo.claudeConnected ? 'default' : 'pointer',
                  boxShadow: userInfo.claudeConnected
                    ? '0 0 6px rgba(34,197,94,0.4)'
                    : '0 0 6px rgba(239,68,68,0.4)',
                }}
              />
            </div>
          )}
          <button onClick={handleLogout} style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.15)',
            color: '#A1A1AA', borderRadius: '4px', padding: '6px 12px',
            fontSize: '12px', fontWeight: '500', cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.target.style.borderColor = '#8B5CF6';
            e.target.style.color = '#F4F4F5';
          }}
          onMouseLeave={(e) => {
            e.target.style.borderColor = 'rgba(255,255,255,0.15)';
            e.target.style.color = '#A1A1AA';
          }}>
            Logout
          </button>
        </div>
      </nav>

      <main style={{
        padding: isFullWidth ? 0 : '24px',
        maxWidth: isFullWidth ? 'none' : '1400px',
        margin: '0 auto',
      }}>
        <Outlet />
      </main>
    </div>
  );
}
