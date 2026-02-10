import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { clearToken, getUser, api } from '../api';
import GuruLogo from './GuruLogo';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [userInfo, setUserInfo] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    api('/api/user/me').then(setUserInfo).catch(() => {
      const stored = getUser();
      if (stored) setUserInfo(stored);
    });
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

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
      <nav className="guru-nav" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky', top: 0, zIndex: 50, background: 'rgba(15,15,15,0.95)',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <GuruLogo size={28} withText={true} />
        </div>

        {/* Desktop nav links */}
        <div className="guru-nav-links" style={{ display: 'flex', gap: '4px' }}>
          <NavLink to="/" end style={({ isActive }) => linkStyle(isActive)}>Dashboard</NavLink>
          <NavLink to="/marketplace" style={({ isActive }) => linkStyle(isActive || location.pathname.startsWith('/marketplace'))}>Marketplace</NavLink>
          <NavLink to="/agents" style={({ isActive }) => linkStyle(isActive || location.pathname.startsWith('/agents'))}>Agents</NavLink>
          <NavLink to="/agents/teams" style={({ isActive }) => linkStyle(isActive)}>Teams</NavLink>
          <NavLink to="/agents/stats" style={({ isActive }) => linkStyle(isActive)}>Stats</NavLink>
          <NavLink to="/sessions" style={({ isActive }) => linkStyle(isActive)}>Sessions</NavLink>
        </div>

        <div className="guru-nav-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userInfo && (
            <div className="guru-user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          <button onClick={handleLogout} className="guru-logout-btn" style={{
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

          {/* Mobile hamburger */}
          <button
            className="guru-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none', background: 'none', border: '1px solid rgba(255,255,255,0.15)',
              color: '#A1A1AA', borderRadius: '4px', padding: '6px 8px',
              cursor: 'pointer', flexDirection: 'column', gap: '3px', alignItems: 'center',
            }}
          >
            <span style={{ width: '16px', height: '2px', background: '#A1A1AA', borderRadius: '1px', transition: 'all 0.2s', transform: mobileMenuOpen ? 'rotate(45deg) translateY(5px)' : 'none' }} />
            <span style={{ width: '16px', height: '2px', background: '#A1A1AA', borderRadius: '1px', transition: 'all 0.2s', opacity: mobileMenuOpen ? 0 : 1 }} />
            <span style={{ width: '16px', height: '2px', background: '#A1A1AA', borderRadius: '1px', transition: 'all 0.2s', transform: mobileMenuOpen ? 'rotate(-45deg) translateY(-5px)' : 'none' }} />
          </button>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="guru-mobile-menu" style={{
          position: 'fixed', top: '53px', left: 0, right: 0, bottom: 0,
          background: 'rgba(15,15,15,0.98)', zIndex: 49,
          display: 'flex', flexDirection: 'column', padding: '16px 24px', gap: '4px',
          backdropFilter: 'blur(12px)',
        }}>
          <NavLink to="/" end style={({ isActive }) => ({ ...linkStyle(isActive), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Dashboard</NavLink>
          <NavLink to="/marketplace" style={({ isActive }) => ({ ...linkStyle(isActive || location.pathname.startsWith('/marketplace')), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Marketplace</NavLink>
          <NavLink to="/agents" style={({ isActive }) => ({ ...linkStyle(isActive || location.pathname.startsWith('/agents')), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Agents</NavLink>
          <NavLink to="/agents/teams" style={({ isActive }) => ({ ...linkStyle(isActive), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Teams</NavLink>
          <NavLink to="/agents/stats" style={({ isActive }) => ({ ...linkStyle(isActive), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Stats</NavLink>
          <NavLink to="/sessions" style={({ isActive }) => ({ ...linkStyle(isActive), fontSize: '15px', padding: '12px 16px' })} onClick={() => setMobileMenuOpen(false)}>Sessions</NavLink>
        </div>
      )}

      <main className="guru-main" style={{
        padding: isFullWidth ? 0 : '24px',
        maxWidth: isFullWidth ? 'none' : '1400px',
        margin: '0 auto',
      }}>
        <Outlet />
      </main>

      <style>{`
        @media (max-width: 768px) {
          .guru-nav { padding: 10px 16px !important; }
          .guru-nav-links { display: none !important; }
          .guru-hamburger { display: flex !important; }
          .guru-user-info { display: none !important; }
          .guru-logout-btn { display: none !important; }
          .guru-main { padding: 16px !important; }
        }
        @media (min-width: 769px) {
          .guru-mobile-menu { display: none !important; }
        }
      `}</style>
    </div>
  );
}
