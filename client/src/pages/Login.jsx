import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { setToken, setRefreshToken, setUser } from '../api';

const LOGO_URL = '/logo.png';

const keyframes = `
@keyframes loginFadeUp {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes loginPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}
@keyframes loginOrb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(60px, -40px) scale(1.1); }
  50% { transform: translate(-30px, -80px) scale(0.95); }
  75% { transform: translate(-60px, 20px) scale(1.05); }
}
@keyframes loginOrb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-50px, 60px) scale(0.9); }
  50% { transform: translate(40px, 30px) scale(1.1); }
  75% { transform: translate(20px, -50px) scale(1); }
}
@keyframes loginOrb3 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(70px, 40px) scale(1.15); }
  66% { transform: translate(-40px, -60px) scale(0.9); }
}
@keyframes loginLogoGlow {
  0%, 100% { box-shadow: 0 0 30px rgba(139,92,246,0.2), 0 0 60px rgba(139,92,246,0.1); }
  50% { box-shadow: 0 0 40px rgba(139,92,246,0.35), 0 0 80px rgba(139,92,246,0.15); }
}
@keyframes loginShimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes loginGridFade {
  0%, 100% { opacity: 0.03; }
  50% { opacity: 0.06; }
}
`;

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [hoverBtn, setHoverBtn] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) setError(params.get('error'));
    requestAnimationFrame(() => setMounted(true));
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

  const inputStyle = (field) => ({
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    border: `1px solid ${focusedField === field ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
    borderRadius: '10px',
    padding: '12px 14px 12px 42px',
    color: '#F4F4F5',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: '"Inter", -apple-system, sans-serif',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(139,92,246,0.12), 0 0 20px rgba(139,92,246,0.06)' : 'none',
  });

  const iconColor = (field) => focusedField === field ? '#8B5CF6' : '#52525B';

  return (
    <>
      <style>{keyframes}</style>
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        {/* Animated background orbs */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            top: '15%', left: '20%',
            width: '400px', height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'loginOrb1 20s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            top: '60%', right: '15%',
            width: '350px', height: '350px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'loginOrb2 25s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute',
            bottom: '10%', left: '40%',
            width: '300px', height: '300px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
            animation: 'loginOrb3 18s ease-in-out infinite',
          }} />
        </div>

        {/* Subtle grid pattern */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          animation: 'loginGridFade 8s ease-in-out infinite',
        }} />

        {/* Top gradient wash */}
        <div style={{
          position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
          width: '120%', height: '500px',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.08) 0%, transparent 60%)',
          filter: 'blur(60px)', pointerEvents: 'none',
          animation: 'loginPulse 6s ease-in-out infinite',
        }} />

        {/* Login card */}
        <form onSubmit={handleSubmit} style={{
          width: '420px',
          maxWidth: 'calc(100vw - 40px)',
          padding: '44px 40px 36px',
          background: 'rgba(12, 12, 14, 0.8)',
          backdropFilter: 'blur(40px) saturate(1.2)',
          WebkitBackdropFilter: 'blur(40px) saturate(1.2)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '20px',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 20px 60px rgba(0,0,0,0.5), 0 0 100px rgba(139,92,246,0.04)',
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          {/* Card inner glow at top */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '60%', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)',
          }} />

          {/* Logo + Branding */}
          <div style={{
            textAlign: 'center',
            marginBottom: '32px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(16px)',
            transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s',
          }}>
            <div style={{
              position: 'relative',
              display: 'inline-block',
              marginBottom: '20px',
            }}>
              <img
                src={LOGO_URL}
                alt="GURU Logo"
                style={{
                  width: '88px',
                  height: '88px',
                  borderRadius: '22px',
                  objectFit: 'cover',
                  border: '2px solid rgba(139,92,246,0.3)',
                  animation: 'loginLogoGlow 4s ease-in-out infinite',
                  position: 'relative',
                  zIndex: 1,
                }}
              />
              {/* Glow behind logo */}
              <div style={{
                position: 'absolute',
                inset: '-8px',
                borderRadius: '28px',
                background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                filter: 'blur(12px)',
                zIndex: 0,
              }} />
            </div>
            <h1 style={{
              fontSize: '26px',
              fontWeight: '800',
              letterSpacing: '-0.03em',
              marginBottom: '6px',
              margin: '0 0 6px',
              lineHeight: 1.2,
            }}>
              <span style={{ color: '#F4F4F5' }}>GURU</span>
              <span style={{ color: '#8B5CF6' }}>.ai</span>
            </h1>
            <p style={{
              fontSize: '13px',
              color: '#71717A',
              margin: 0,
              letterSpacing: '0.02em',
              fontWeight: '400',
            }}>
              AI Agent Testing Platform
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              padding: '10px 14px',
              marginBottom: '20px',
              borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Email field */}
          <div style={{
            marginBottom: '16px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.25s',
          }}>
            <label style={{
              display: 'block', fontSize: '12px', fontWeight: '600',
              color: '#A1A1AA', marginBottom: '8px', letterSpacing: '0.03em',
              textTransform: 'uppercase',
            }}>Email</label>
            <div style={{ position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor('email')} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', transition: 'stroke 0.3s', pointerEvents: 'none' }}>
                <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="you@example.com"
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={inputStyle('email')}
              />
            </div>
          </div>

          {/* Password field */}
          <div style={{
            marginBottom: '24px',
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.35s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{
                fontSize: '12px', fontWeight: '600',
                color: '#A1A1AA', letterSpacing: '0.03em',
                textTransform: 'uppercase',
              }}>Password</label>
              <Link to="/forgot-password" style={{
                color: '#71717A', fontSize: '12px', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseOver={e => e.target.style.color = '#8B5CF6'}
              onMouseOut={e => e.target.style.color = '#71717A'}
              >
                Forgot?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor('password')} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: '13px', top: '50%', transform: 'translateY(-50%)', transition: 'stroke 0.3s', pointerEvents: 'none' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="Enter your password"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField(null)}
                style={{ ...inputStyle('password'), paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
                  color: '#52525B', transition: 'color 0.2s', display: 'flex',
                }}
                onMouseOver={e => e.currentTarget.style.color = '#A1A1AA'}
                onMouseOut={e => e.currentTarget.style.color = '#52525B'}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <path d="m1 1 22 22"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Sign In button */}
          <div style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.45s',
          }}>
            <button
              type="submit" disabled={loading}
              onMouseOver={() => setHoverBtn('signin')}
              onMouseOut={() => setHoverBtn(null)}
              style={{
                width: '100%',
                padding: '13px',
                background: hoverBtn === 'signin' && !loading
                  ? 'linear-gradient(135deg, #9B6DF7 0%, #7C3AED 100%)'
                  : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: hoverBtn === 'signin' && !loading
                  ? '0 0 30px rgba(139,92,246,0.4), 0 4px 20px rgba(139,92,246,0.3)'
                  : '0 0 20px rgba(139,92,246,0.15), 0 4px 12px rgba(0,0,0,0.3)',
                letterSpacing: '0.01em',
                fontFamily: 'inherit',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{
                    animation: 'spin 1s linear infinite',
                  }}>
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </div>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.55s',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
            <span style={{ fontSize: '11px', color: '#3F3F46', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '500' }}>or continue with</span>
            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
          </div>

          {/* GitHub button */}
          <div style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.6s',
          }}>
            <a
              href="/api/github/auth?action=login"
              onMouseOver={() => setHoverBtn('github')}
              onMouseOut={() => setHoverBtn(null)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                width: '100%', padding: '12px',
                background: hoverBtn === 'github' ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${hoverBtn === 'github' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '10px',
                fontSize: '14px', fontWeight: '500', color: '#E4E4E7',
                textDecoration: 'none', boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: hoverBtn === 'github' ? '0 0 20px rgba(255,255,255,0.03)' : 'none',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              GitHub
            </a>
          </div>

          {/* Register link */}
          <div style={{
            textAlign: 'center', marginTop: '24px',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.7s',
          }}>
            <span style={{ fontSize: '13px', color: '#52525B' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{
                color: '#8B5CF6', textDecoration: 'none', fontWeight: '600',
                transition: 'color 0.2s',
              }}
              onMouseOver={e => e.target.style.color = '#A78BFA'}
              onMouseOut={e => e.target.style.color = '#8B5CF6'}
              >
                Create one
              </Link>
            </span>
          </div>

          {/* Bottom subtle branding */}
          <div style={{
            textAlign: 'center', marginTop: '28px', paddingTop: '20px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.8s',
          }}>
            <p style={{
              fontSize: '11px', color: '#3F3F46', margin: 0,
              letterSpacing: '0.05em',
            }}>
              Secured by <span style={{ color: '#52525B', fontWeight: '600' }}>GURU</span><span style={{ color: 'rgba(139,92,246,0.5)' }}>.ai</span>
            </p>
          </div>
        </form>
      </div>
    </>
  );
}
