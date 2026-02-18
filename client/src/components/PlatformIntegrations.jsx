import React, { useState, useEffect, useCallback } from 'react';
import {
  Plug, Check, X, ExternalLink, Key, AlertCircle, CheckCircle,
  Search, ChevronRight, Loader, Link2, Unlink, Eye, EyeOff,
  RefreshCw, Zap, Lock, Clock, Globe, Terminal, ChevronDown, ChevronUp, Copy,
  Shield, Mail, HardDrive, LogOut
} from 'lucide-react';
import { api, getToken } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const CATEGORY_COLORS = {
  productivity: { bg: 'rgba(139,92,246,0.12)', text: '#8B5CF6', border: 'rgba(139,92,246,0.25)' },
  communication: { bg: 'rgba(6,182,212,0.12)', text: '#06b6d4', border: 'rgba(6,182,212,0.25)' },
  'dev-tools': { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  crm: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b', border: 'rgba(245,158,11,0.25)' },
  ecommerce: { bg: 'rgba(236,72,153,0.12)', text: '#ec4899', border: 'rgba(236,72,153,0.25)' },
  marketing: { bg: 'rgba(168,85,247,0.12)', text: '#a855f7', border: 'rgba(168,85,247,0.25)' },
  automation: { bg: 'rgba(251,146,60,0.12)', text: '#fb923c', border: 'rgba(251,146,60,0.25)' },
};

const CATEGORY_LABELS = {
  productivity: 'Productivity',
  communication: 'Communication',
  'dev-tools': 'Dev Tools',
  crm: 'CRM',
  ecommerce: 'E-commerce',
  marketing: 'Marketing',
  automation: 'Automation',
};

function CategoryBadge({ category }) {
  const colors = CATEGORY_COLORS[category] || CATEGORY_COLORS.productivity;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: '4px', fontSize: '10px', fontWeight: '600',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
    }}>
      {CATEGORY_LABELS[category] || category}
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'active') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px',
        borderRadius: '4px', fontSize: '10px', fontWeight: '600',
        background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)',
      }}>
        <Zap size={10} /> Active
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px',
      borderRadius: '4px', fontSize: '10px', fontWeight: '600',
      background: 'rgba(161,161,170,0.08)', color: t.tm, border: `1px solid ${t.border}`,
    }}>
      <Clock size={10} /> Coming Soon
    </span>
  );
}

// =================== CREDENTIAL MODAL ===================

function CredentialModal({ platform, onClose, onSaved }) {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);

  const authConfig = platform.auth_config || {};

  const handleSave = async () => {
    if (!token.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/platforms/${platform.slug}/credentials`, {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!token.trim()) return;
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // Save first, then test
      await api(`/api/platforms/${platform.slug}/credentials`, {
        method: 'POST',
        body: JSON.stringify({ token: token.trim() }),
      });
      const result = await api(`/api/platforms/${platform.slug}/test`, { method: 'POST' });
      setTestResult(result);
      if (result.success) {
        setTimeout(() => onSaved(), 1500);
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '16px',
        padding: '32px', width: '100%', maxWidth: '480px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: t.violetG, border: `1px solid ${t.violetM}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Key size={18} style={{ color: t.violet }} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: t.tp }}>
                Connect {platform.name}
              </h3>
              <p style={{ fontSize: '12px', color: t.ts, margin: 0 }}>
                {authConfig.token_label || 'API Token'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '4px',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Token URL - prominent link */}
        {authConfig.token_url && (
          <a
            href={authConfig.token_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(139,92,246,0.08)', border: `1px solid ${t.violetM}`,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.15)';
              e.currentTarget.style.borderColor = t.violet;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(139,92,246,0.08)';
              e.currentTarget.style.borderColor = t.violetM;
            }}
          >
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <Key size={14} style={{ color: t.violet }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: '600', color: t.violet }}>
                Get your {authConfig.token_label || 'API Token'}
              </div>
              <div style={{ fontSize: '11px', color: t.ts, marginTop: '2px' }}>
                {authConfig.token_url.replace(/^https?:\/\//, '').split('/')[0]}
              </div>
            </div>
            <ExternalLink size={14} style={{ color: t.violet, flexShrink: 0 }} />
          </a>
        )}

        {/* Help text */}
        {authConfig.token_help && (
          <div style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '20px',
            background: t.violetG, border: `1px solid ${t.violetM}`,
            fontSize: '12px', color: t.ts, lineHeight: 1.6,
          }}>
            {authConfig.token_help}
          </div>
        )}

        {/* Token input */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'block', fontSize: '11px', fontWeight: 600, color: t.tm,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px',
          }}>
            {authConfig.token_label || 'API Token'}
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder={`Enter your ${platform.name} token...`}
              style={{
                width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
                borderRadius: '8px', padding: '12px 40px 12px 14px', color: '#fff', fontSize: '13px',
                outline: 'none', boxSizing: 'border-box', fontFamily: t.mono,
              }}
              onFocus={e => e.target.style.borderColor = t.violet}
              onBlur={e => e.target.style.borderColor = t.border}
            />
            <button
              onClick={() => setShowToken(!showToken)}
              style={{
                position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '4px',
              }}
            >
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            fontSize: '12px', color: t.danger, display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div style={{
            padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
            background: testResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${testResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
            fontSize: '12px',
            color: testResult.success ? t.success : t.danger,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
            {testResult.message}
          </div>
        )}

        {/* Docs link */}
        {authConfig.docs_url && (
          <a
            href={authConfig.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              fontSize: '11px', color: t.tm, textDecoration: 'none', marginBottom: '20px',
              padding: '4px 0',
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.violet}
            onMouseLeave={e => e.currentTarget.style.color = t.tm}
          >
            <ExternalLink size={11} /> {platform.name} API Documentation
          </a>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`, cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleTest} disabled={!token.trim() || testing} style={{
            padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            background: 'rgba(34,197,94,0.15)', color: t.success, border: '1px solid rgba(34,197,94,0.3)',
            cursor: token.trim() && !testing ? 'pointer' : 'not-allowed',
            opacity: token.trim() && !testing ? 1 : 0.5,
            display: 'flex', alignItems: 'center', gap: '6px',
          }}>
            {testing ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
            Test & Save
          </button>
          <button onClick={handleSave} disabled={!token.trim() || saving} style={{
            padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
            background: t.violet, color: '#fff', border: 'none',
            cursor: token.trim() && !saving ? 'pointer' : 'not-allowed',
            opacity: token.trim() && !saving ? 1 : 0.5,
          }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =================== GOOGLE AUTH MODAL ===================

const GOOGLE_SERVICES = [
  {
    slug: 'google-drive',
    label: 'Google Drive',
    description: 'Search, read, create files and folders',
    icon: HardDrive,
    color: '#4285f4',
  },
  {
    slug: 'gmail',
    label: 'Gmail',
    description: 'Search, read, send emails and manage drafts',
    icon: Mail,
    color: '#ea4335',
  },
];

function GoogleAuthModal({ onClose, onConnected, initialPlatform }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedServices, setSelectedServices] = useState(new Set());
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api('/api/google-oauth/status');
        setStatus(data);
        // Pre-select the service that was clicked (if not already connected)
        if (initialPlatform) {
          const svc = data.services?.[initialPlatform];
          if (!svc?.connected) {
            setSelectedServices(new Set([initialPlatform]));
          }
        }
      } catch (err) {
        console.error('Failed to load Google status:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [initialPlatform]);

  const anyConnected = status?.services && Object.entries(status.services)
    .filter(([k]) => k !== '_account')
    .some(([, v]) => v.connected);

  const account = status?.services?._account;

  const handleConnect = () => {
    if (selectedServices.size === 0) return;
    const token = getToken();
    if (!token) {
      console.error('No auth token found — user may need to log in again');
      return;
    }
    setConnecting(true);
    const services = [...selectedServices].join(',');
    const returnTo = window.location.pathname;
    window.location.href = `/api/google-oauth/auth?services=${encodeURIComponent(services)}&token=${encodeURIComponent(token)}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  const toggleService = (slug) => {
    setSelectedServices(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const allConnected = GOOGLE_SERVICES.every(s => status?.services?.[s.slug]?.connected);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: t.surface, border: `1px solid ${t.borderS}`, borderRadius: '16px',
        padding: '0', width: '100%', maxWidth: '480px', overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header with Google branding */}
        <div style={{
          padding: '28px 28px 20px',
          background: 'linear-gradient(135deg, rgba(66,133,244,0.08) 0%, rgba(234,67,53,0.06) 50%, rgba(251,188,4,0.04) 100%)',
          borderBottom: `1px solid ${t.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Google G logo */}
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: t.tp }}>
                  Google Account
                </h3>
                <p style={{ fontSize: '12px', color: t.ts, margin: '2px 0 0' }}>
                  {anyConnected ? 'Manage connected services' : 'Connect your Google account'}
                </p>
              </div>
            </div>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: t.tm, padding: '4px',
            }}>
              <X size={18} />
            </button>
          </div>

          {/* Connected account info */}
          {account && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px', marginTop: '16px',
              padding: '10px 14px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
            }}>
              {account.photo ? (
                <img src={account.photo} alt="" style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  border: '2px solid rgba(34,197,94,0.3)',
                }} />
              ) : (
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Check size={14} style={{ color: t.success }} />
                </div>
              )}
              <div style={{ flex: 1 }}>
                {account.name && (
                  <div style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{account.name}</div>
                )}
                <div style={{ fontSize: '11px', color: t.ts }}>{account.email}</div>
              </div>
              <Shield size={14} style={{ color: t.success }} />
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <Loader size={20} style={{ color: t.violet, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontSize: '12px', color: t.ts, marginTop: '12px' }}>Checking connection...</p>
          </div>
        )}

        {/* Not configured */}
        {!loading && !status?.configured && (
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            <AlertCircle size={24} style={{ color: t.warning, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: t.ts }}>
              Google OAuth is not configured on this server.
            </p>
            <p style={{ fontSize: '11px', color: t.tm, marginTop: '8px' }}>
              Ask your admin to set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.
            </p>
          </div>
        )}

        {/* Services list */}
        {!loading && status?.configured && (
          <div style={{ padding: '20px 28px' }}>
            <div style={{
              fontSize: '10px', fontWeight: '600', color: t.tm,
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px',
            }}>
              Google Services
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {GOOGLE_SERVICES.map(svc => {
                const svcStatus = status.services?.[svc.slug];
                const isConnected = svcStatus?.connected;
                const isSelected = selectedServices.has(svc.slug);
                const Icon = svc.icon;

                return (
                  <div
                    key={svc.slug}
                    onClick={() => {
                      if (!isConnected) toggleService(svc.slug);
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 16px', borderRadius: '10px',
                      background: isConnected
                        ? 'rgba(34,197,94,0.04)'
                        : isSelected
                          ? 'rgba(66,133,244,0.08)'
                          : t.surfaceEl,
                      border: `1px solid ${
                        isConnected
                          ? 'rgba(34,197,94,0.2)'
                          : isSelected
                            ? 'rgba(66,133,244,0.3)'
                            : t.border
                      }`,
                      cursor: isConnected ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {/* Service icon */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '8px',
                      background: isConnected ? 'rgba(34,197,94,0.1)' : `${svc.color}15`,
                      border: `1px solid ${isConnected ? 'rgba(34,197,94,0.2)' : svc.color + '30'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} style={{ color: isConnected ? t.success : svc.color }} />
                    </div>

                    {/* Service info */}
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '13px', fontWeight: '600',
                        color: isConnected ? t.success : t.tp,
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}>
                        {svc.label}
                        {isConnected && (
                          <span style={{
                            fontSize: '9px', fontWeight: '700', padding: '2px 6px',
                            borderRadius: '4px', background: 'rgba(34,197,94,0.12)',
                            color: t.success, textTransform: 'uppercase',
                          }}>
                            Connected
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: t.ts, marginTop: '2px' }}>
                        {svc.description}
                      </div>
                      {isConnected && svcStatus.connected_at && (
                        <div style={{ fontSize: '10px', color: t.tm, marginTop: '4px' }}>
                          Connected {new Date(svcStatus.connected_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Checkbox / status */}
                    <div style={{ flexShrink: 0 }}>
                      {isConnected ? (
                        <CheckCircle size={18} style={{ color: t.success }} />
                      ) : (
                        <div style={{
                          width: '20px', height: '20px', borderRadius: '4px',
                          border: `2px solid ${isSelected ? '#4285f4' : t.border}`,
                          background: isSelected ? '#4285f4' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.15s',
                        }}>
                          {isSelected && <Check size={12} style={{ color: '#fff' }} />}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        {!loading && status?.configured && (
          <div style={{
            padding: '16px 28px 24px',
            display: 'flex', gap: '10px', justifyContent: 'flex-end',
            borderTop: `1px solid ${t.border}`,
          }}>
            <button onClick={onClose} style={{
              padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
              background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`, cursor: 'pointer',
            }}>
              {allConnected ? 'Done' : 'Cancel'}
            </button>

            {!allConnected && (
              <button
                onClick={handleConnect}
                disabled={selectedServices.size === 0 || connecting}
                style={{
                  padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                  background: selectedServices.size > 0 && !connecting
                    ? 'linear-gradient(135deg, #4285f4, #3b78e7)'
                    : t.surfaceEl,
                  color: selectedServices.size > 0 && !connecting ? '#fff' : t.tm,
                  border: 'none',
                  cursor: selectedServices.size > 0 && !connecting ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: selectedServices.size > 0 ? '0 2px 8px rgba(66,133,244,0.3)' : 'none',
                }}
              >
                {connecting ? (
                  <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Globe size={14} />
                )}
                {connecting
                  ? 'Redirecting...'
                  : anyConnected
                    ? `Add ${selectedServices.size} service${selectedServices.size > 1 ? 's' : ''}`
                    : `Connect with Google`
                }
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// =================== PLATFORM CARD ===================

function PlatformCard({ platform, agentLinked, onConnect, onDisconnect, onLink, onUnlink }) {
  const isActive = platform.status === 'active';
  const isConnected = platform.credential_status?.connected;
  const actions = platform.available_actions || [];

  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`, borderRadius: '12px',
      padding: '20px', transition: 'all 0.2s',
      opacity: isActive ? 1 : 0.6,
      position: 'relative',
    }}
      onMouseEnter={e => {
        if (isActive) {
          e.currentTarget.style.borderColor = t.violet + '40';
          e.currentTarget.style.boxShadow = `0 4px 20px -4px ${t.violet}15`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: isActive ? t.violetG : t.surfaceEl,
            border: `1px solid ${isActive ? t.violetM : t.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isActive ? t.violet : t.tm,
          }} dangerouslySetInnerHTML={{ __html: platform.icon_svg || '' }} />
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0, color: t.tp }}>{platform.name}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <CategoryBadge category={platform.category} />
              <StatusBadge status={platform.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p style={{ fontSize: '12px', color: t.ts, margin: '0 0 16px', lineHeight: 1.5 }}>
        {platform.description}
      </p>

      {/* Actions list */}
      {isActive && actions.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: '600', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Available Actions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {actions.map(a => (
              <span key={a.action} style={{
                fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                background: t.surfaceEl, color: t.ts, border: `1px solid ${t.border}`,
              }}>
                {a.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Connection + Link status */}
      {isActive && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* Credential button */}
          {isConnected ? (
            <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 12px', borderRadius: '6px',
                background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                fontSize: '11px', color: t.success,
              }}>
                <CheckCircle size={12} /> Connected
              </div>
              <button onClick={() => onDisconnect(platform)} style={{
                padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                background: 'rgba(239,68,68,0.08)', color: t.danger, border: '1px solid rgba(239,68,68,0.2)',
                cursor: 'pointer',
              }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <button onClick={() => onConnect(platform)} style={{
              flex: 1, padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
              background: (platform.auth_config?.auth_type === 'oauth2') ? 'rgba(66,133,244,0.12)' : t.violetG,
              color: (platform.auth_config?.auth_type === 'oauth2') ? '#4285f4' : t.violet,
              border: `1px solid ${(platform.auth_config?.auth_type === 'oauth2') ? 'rgba(66,133,244,0.3)' : t.violetM}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            }}>
              {(platform.auth_config?.auth_type === 'oauth2') ? (
                <><Globe size={12} /> Connect with Google</>
              ) : (
                <><Key size={12} /> Connect</>
              )}
            </button>
          )}

          {/* Agent link button */}
          {isConnected && (
            agentLinked ? (
              <button onClick={() => onUnlink(platform)} style={{
                padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                background: 'rgba(34,197,94,0.08)', color: t.success, border: '1px solid rgba(34,197,94,0.2)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Link2 size={12} /> Linked
              </button>
            ) : (
              <button onClick={() => onLink(platform)} style={{
                padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600',
                background: t.surfaceEl, color: t.ts, border: `1px solid ${t.borderS}`,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <Link2 size={12} /> Link to Agent
              </button>
            )
          )}
        </div>
      )}

      {/* Coming soon overlay for inactive */}
      {!isActive && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          padding: '8px 12px', borderRadius: '6px',
          background: 'rgba(161,161,170,0.05)', border: `1px solid ${t.border}`,
          fontSize: '11px', color: t.tm,
        }}>
          <Lock size={12} /> Coming Soon
        </div>
      )}
    </div>
  );
}

// =================== MAIN COMPONENT ===================

export default function PlatformIntegrations({ agentName }) {
  const [platforms, setPlatforms] = useState([]);
  const [agentPlatforms, setAgentPlatforms] = useState([]);
  const [mcpTools, setMcpTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [connectModal, setConnectModal] = useState(null);
  const [googleAuthModal, setGoogleAuthModal] = useState(null); // { platform slug }
  const [expandedTool, setExpandedTool] = useState(null);
  const [copiedTool, setCopiedTool] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [platformList, agentLinks, tools] = await Promise.all([
        api('/api/platforms'),
        api(`/api/platforms/agent/${agentName}/platforms`),
        api(`/api/platforms/agent/${agentName}/mcp-tools`),
      ]);
      setPlatforms(platformList);
      setAgentPlatforms(agentLinks);
      setMcpTools(tools || []);
    } catch (err) {
      console.error('Failed to load platforms:', err);
    } finally {
      setLoading(false);
    }
  }, [agentName]);

  // Check for google=connected query param on mount (after OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google') === 'connected') {
      // Clean up URL
      const url = new URL(window.location);
      url.searchParams.delete('google');
      url.searchParams.delete('tab');
      window.history.replaceState({}, '', url.pathname + url.search);
      // Refresh data to show newly connected platform
      loadData();
    }
  }, [loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleConnect = (platform) => {
    const authConfig = platform.auth_config || {};
    if (authConfig.auth_type === 'oauth2') {
      // Show Google auth modal instead of redirecting directly
      setGoogleAuthModal(platform.slug);
      return;
    }
    setConnectModal(platform);
  };

  const handleDisconnect = async (platform) => {
    if (!confirm(`Disconnect ${platform.name}? This will remove your credentials.`)) return;
    try {
      await api(`/api/platforms/${platform.slug}/credentials`, { method: 'DELETE' });
      // Also unlink if linked
      const link = agentPlatforms.find(l => l.platform_id === platform.id);
      if (link) {
        await api(`/api/platforms/agent/${agentName}/platforms/${platform.id}`, { method: 'DELETE' });
      }
      loadData();
    } catch (err) {
      console.error('Disconnect failed:', err);
    }
  };

  const handleLink = async (platform) => {
    try {
      const allActions = (platform.available_actions || []).map(a => a.action);
      await api(`/api/platforms/agent/${agentName}/platforms`, {
        method: 'POST',
        body: JSON.stringify({ platform_id: platform.id, enabled_actions: allActions }),
      });
      loadData();
    } catch (err) {
      console.error('Link failed:', err);
    }
  };

  const handleUnlink = async (platform) => {
    try {
      await api(`/api/platforms/agent/${agentName}/platforms/${platform.id}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      console.error('Unlink failed:', err);
    }
  };

  // Filter platforms
  const categories = [...new Set(platforms.map(p => p.category))];
  const filtered = platforms.filter(p => {
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Separate active from coming_soon
  const activePlatforms = filtered.filter(p => p.status === 'active');
  const comingSoonPlatforms = filtered.filter(p => p.status !== 'active');
  const linkedPlatformIds = new Set(agentPlatforms.map(l => l.platform_id));

  if (loading) {
    return (
      <div style={{ padding: '60px 32px', textAlign: 'center' }}>
        <Loader size={24} style={{ color: t.violet, animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: '13px', color: t.ts, marginTop: '12px' }}>Loading platforms...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px', color: t.tp }}>
          Platform Integrations
        </h2>
        <p style={{ fontSize: '13px', color: t.ts, margin: 0, lineHeight: 1.6 }}>
          Connect external platforms to give your agent the ability to read and write data from services like Notion, Slack, and more.
          Link a platform to this agent to enable its tools in MCP.
        </p>
      </div>

      {/* Connected summary */}
      {agentPlatforms.length > 0 && (
        <div style={{
          padding: '16px 20px', borderRadius: '12px', marginBottom: '24px',
          background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}>
          <CheckCircle size={18} style={{ color: t.success }} />
          <div>
            <span style={{ fontSize: '13px', fontWeight: '600', color: t.tp }}>
              {agentPlatforms.length} platform{agentPlatforms.length > 1 ? 's' : ''} linked
            </span>
            <span style={{ fontSize: '12px', color: t.ts, marginLeft: '8px' }}>
              {agentPlatforms.map(l => l.platform_integrations?.name).filter(Boolean).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* MCP Tools Section — shows tools generated from linked platforms */}
      {mcpTools.length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '600', color: t.tp, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Terminal size={14} style={{ color: t.violet }} /> MCP Actions
              <span style={{
                fontSize: '10px', fontWeight: '600', color: t.tm, padding: '2px 8px',
                borderRadius: '100px', background: 'rgba(255,255,255,0.04)',
              }}>
                {mcpTools.length} tool{mcpTools.length > 1 ? 's' : ''}
              </span>
            </h3>
            <span style={{ fontSize: '11px', color: t.ts }}>
              Available via MCP server
            </span>
          </div>

          {/* Group tools by platform */}
          {(() => {
            const grouped = {};
            for (const tool of mcpTools) {
              const key = tool.platform_slug;
              if (!grouped[key]) grouped[key] = { name: tool.platform_name, tools: [] };
              grouped[key].tools.push(tool);
            }

            return Object.entries(grouped).map(([slug, group]) => (
              <div key={slug} style={{ marginBottom: '16px' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
                  padding: '8px 12px', borderRadius: '8px',
                  background: 'rgba(139,92,246,0.04)', border: `1px solid rgba(139,92,246,0.1)`,
                }}>
                  <Plug size={12} style={{ color: t.violet }} />
                  <span style={{ fontSize: '12px', fontWeight: '600', color: t.tp }}>{group.name}</span>
                  <span style={{ fontSize: '10px', color: t.tm }}>{group.tools.length} action{group.tools.length > 1 ? 's' : ''}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {group.tools.map(tool => {
                    const isExpanded = expandedTool === tool.tool_name;
                    const params = tool.input_schema?.properties || {};
                    const required = tool.input_schema?.required || [];

                    return (
                      <div key={tool.tool_name} style={{
                        background: t.surface, border: `1px solid ${isExpanded ? t.violetM : t.border}`,
                        borderRadius: '8px', overflow: 'hidden',
                        transition: 'border-color 0.2s',
                      }}>
                        {/* Tool header */}
                        <div
                          onClick={() => setExpandedTool(isExpanded ? null : tool.tool_name)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 14px', cursor: 'pointer',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = t.surfaceEl}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{
                            width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                            background: t.success,
                          }} />
                          <span style={{
                            fontSize: '12px', fontWeight: '600', color: t.violet,
                            fontFamily: t.mono,
                          }}>
                            {tool.tool_name}
                          </span>
                          <span style={{
                            fontSize: '11px', color: t.ts, flex: 1,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {tool.description}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            {Object.keys(params).length > 0 && (
                              <span style={{
                                fontSize: '9px', padding: '2px 6px', borderRadius: '4px',
                                background: t.surfaceEl, color: t.tm, fontFamily: t.mono,
                              }}>
                                {Object.keys(params).length} param{Object.keys(params).length > 1 ? 's' : ''}
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(tool.tool_name);
                                setCopiedTool(tool.tool_name);
                                setTimeout(() => setCopiedTool(null), 1500);
                              }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: copiedTool === tool.tool_name ? t.success : t.tm,
                                padding: '2px', display: 'flex',
                              }}
                              title="Copy tool name"
                            >
                              {copiedTool === tool.tool_name ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            {isExpanded ? <ChevronUp size={14} style={{ color: t.tm }} /> : <ChevronDown size={14} style={{ color: t.tm }} />}
                          </div>
                        </div>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div style={{
                            padding: '0 14px 14px', borderTop: `1px solid ${t.border}`,
                          }}>
                            <p style={{ fontSize: '12px', color: t.ts, margin: '12px 0', lineHeight: 1.5 }}>
                              {tool.description}
                            </p>

                            {Object.keys(params).length > 0 && (
                              <>
                                <div style={{
                                  fontSize: '10px', fontWeight: '600', color: t.tm,
                                  textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px',
                                }}>
                                  Parameters
                                </div>
                                <div style={{
                                  background: t.bg, borderRadius: '6px', border: `1px solid ${t.border}`,
                                  overflow: 'hidden',
                                }}>
                                  {Object.entries(params).map(([paramName, paramDef], idx) => {
                                    const isRequired = required.includes(paramName);
                                    return (
                                      <div key={paramName} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '10px',
                                        padding: '8px 12px',
                                        borderBottom: idx < Object.keys(params).length - 1 ? `1px solid ${t.border}` : 'none',
                                      }}>
                                        <div style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <code style={{
                                            fontSize: '11px', fontFamily: t.mono, color: t.tp, fontWeight: '600',
                                          }}>
                                            {paramName}
                                          </code>
                                          {isRequired && (
                                            <span style={{
                                              fontSize: '8px', fontWeight: '700', color: t.danger,
                                              padding: '1px 4px', borderRadius: '3px',
                                              background: 'rgba(239,68,68,0.1)', textTransform: 'uppercase',
                                            }}>
                                              req
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <span style={{ fontSize: '10px', color: t.tm, fontFamily: t.mono }}>
                                            {paramDef.type || 'string'}
                                            {paramDef.enum ? ` [${paramDef.enum.join(', ')}]` : ''}
                                          </span>
                                          {paramDef.description && (
                                            <div style={{ fontSize: '11px', color: t.ts, marginTop: '2px', lineHeight: 1.4 }}>
                                              {paramDef.description}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* Search + Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: t.tm }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search platforms..."
            style={{
              width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
              borderRadius: '8px', padding: '10px 12px 10px 34px', color: '#fff', fontSize: '13px',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('all')}
            style={{
              padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500',
              background: filterCategory === 'all' ? t.violetG : 'transparent',
              color: filterCategory === 'all' ? t.violet : t.tm,
              border: `1px solid ${filterCategory === 'all' ? t.violetM : t.border}`,
              cursor: 'pointer',
            }}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              style={{
                padding: '8px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500',
                background: filterCategory === cat ? t.violetG : 'transparent',
                color: filterCategory === cat ? t.violet : t.tm,
                border: `1px solid ${filterCategory === cat ? t.violetM : t.border}`,
                cursor: 'pointer',
              }}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Active Platforms */}
      {activePlatforms.length > 0 && (
        <>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: t.tp, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={14} style={{ color: t.success }} /> Available Platforms
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px', marginBottom: '32px',
          }}>
            {activePlatforms.map(p => (
              <PlatformCard
                key={p.id}
                platform={p}
                agentLinked={linkedPlatformIds.has(p.id)}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onLink={handleLink}
                onUnlink={handleUnlink}
              />
            ))}
          </div>
        </>
      )}

      {/* Coming Soon Platforms */}
      {comingSoonPlatforms.length > 0 && (
        <>
          <h3 style={{ fontSize: '13px', fontWeight: '600', color: t.tm, margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={14} /> Coming Soon ({comingSoonPlatforms.length})
          </h3>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px',
          }}>
            {comingSoonPlatforms.map(p => (
              <PlatformCard
                key={p.id}
                platform={p}
                agentLinked={false}
                onConnect={() => {}}
                onDisconnect={() => {}}
                onLink={() => {}}
                onUnlink={() => {}}
              />
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <Globe size={36} style={{ color: t.tm, margin: '0 auto 16px' }} />
          <p style={{ fontSize: '14px', color: t.ts }}>No platforms match your search.</p>
        </div>
      )}

      {/* Credential Modal (API key platforms) */}
      {connectModal && (
        <CredentialModal
          platform={connectModal}
          onClose={() => setConnectModal(null)}
          onSaved={() => {
            setConnectModal(null);
            loadData();
          }}
        />
      )}

      {/* Google Auth Modal (OAuth platforms) */}
      {googleAuthModal && (
        <GoogleAuthModal
          initialPlatform={googleAuthModal}
          onClose={() => setGoogleAuthModal(null)}
          onConnected={() => {
            setGoogleAuthModal(null);
            loadData();
          }}
        />
      )}

      {/* CSS for spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
