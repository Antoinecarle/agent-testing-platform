import React, { useState, useEffect, useCallback } from 'react';
import {
  Plug, Check, X, ExternalLink, Key, AlertCircle, CheckCircle,
  Search, ChevronRight, Loader, Link2, Unlink, Eye, EyeOff,
  RefreshCw, Zap, Lock, Clock, Globe, Terminal, ChevronDown, ChevronUp, Copy
} from 'lucide-react';
import { api } from '../api';

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
      // Redirect to OAuth flow — JWT is sent via query param for the redirect
      // The /auth route requires JWT auth, so we pass the token as a Bearer header via fetch redirect
      const token = localStorage.getItem('token');
      if (token) {
        // Use a temporary approach: open the auth URL with the JWT in Authorization header
        // Since this is a redirect flow, we pass the token as a query param that the backend
        // middleware can extract (verifyToken already checks Authorization header)
        window.location.href = `/api/google-oauth/auth?platform=${platform.slug}&token=${encodeURIComponent(token)}`;
        return;
      }
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

      {/* Credential Modal */}
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

      {/* CSS for spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
