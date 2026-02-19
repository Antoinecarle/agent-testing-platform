import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, clearToken } from '../api';
import {
  User, Shield, Building2, CreditCard, Settings as SettingsIcon,
  Check, AlertCircle, Mail, Lock, Eye, EyeOff, Plus, Trash2,
  Crown, Users, ChevronRight, Loader2, ExternalLink, Landmark,
  DollarSign, TrendingUp, Zap, Link2, Unlink, Key,
} from 'lucide-react';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

const inputStyle = {
  width: '100%', backgroundColor: t.bg, border: `1px solid ${t.border}`,
  borderRadius: '6px', padding: '10px 12px', color: '#fff', fontSize: '13px',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};

const labelStyle = {
  display: 'block', fontSize: '12px', fontWeight: '500', color: t.ts, marginBottom: '6px',
};

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'connections', label: 'Connections', icon: Link2 },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'payouts', label: 'Payouts', icon: Landmark },
  { id: 'api-keys', label: 'API Keys', icon: Key },
];

const ROLE_COLORS = {
  owner: t.violet,
  admin: t.warning,
  member: t.success,
  viewer: t.ts,
};

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bg = type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
  const border = type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
  const color = type === 'success' ? t.success : t.danger;
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      style={{
        position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
        padding: '10px 20px', borderRadius: '8px', background: bg,
        border: `1px solid ${border}`, color, fontSize: '13px', fontWeight: '500',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
      }}
    >
      {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {message}
    </motion.div>
  );
}

export default function Settings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeTab = searchParams.get('tab') || 'profile';
  const setActiveTab = (tab) => setSearchParams({ tab });

  const [profile, setProfile] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Profile form
  const [displayName, setDisplayName] = useState('');
  const [company, setCompany] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  // New org form
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgSlug, setNewOrgSlug] = useState('');
  const [showNewOrg, setShowNewOrg] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');

  // GitHub
  const [githubStatus, setGithubStatus] = useState(null);
  const [githubLoading, setGithubLoading] = useState(false);

  // Stripe Connect
  const [connectStatus, setConnectStatus] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);

  // Onboarding form fields
  const [obFirstName, setObFirstName] = useState('');
  const [obLastName, setObLastName] = useState('');
  const [obDobDay, setObDobDay] = useState('');
  const [obDobMonth, setObDobMonth] = useState('');
  const [obDobYear, setObDobYear] = useState('');
  const [obAddressLine1, setObAddressLine1] = useState('');
  const [obCity, setObCity] = useState('');
  const [obPostalCode, setObPostalCode] = useState('');
  const [obCountry, setObCountry] = useState('FR');
  const [obIban, setObIban] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [profileRes, orgsRes, billingRes, connectRes, earningsRes, githubRes] = await Promise.allSettled([
        api('/api/settings/profile'),
        api('/api/organizations'),
        api('/api/settings/billing'),
        api('/api/stripe-connect/status'),
        api('/api/stripe-connect/earnings'),
        api('/api/github/status'),
      ]);
      if (profileRes.status === 'fulfilled' && profileRes.value) {
        const p = profileRes.value;
        setProfile(p);
        setDisplayName(p.display_name || '');
        setCompany(p.company || '');
        setJobTitle(p.job_title || '');
        setAvatarUrl(p.avatar_url || '');
      }
      if (orgsRes.status === 'fulfilled') setOrgs(orgsRes.value || []);
      if (billingRes.status === 'fulfilled') setBilling(billingRes.value || null);
      if (connectRes.status === 'fulfilled') setConnectStatus(connectRes.value || null);
      if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value || null);
      if (githubRes.status === 'fulfilled') setGithubStatus(githubRes.value || null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  function showToast(message, type = 'success') {
    setToast({ message, type });
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await api('/api/settings/profile', {
        method: 'PUT',
        body: JSON.stringify({ display_name: displayName, company, job_title: jobTitle, avatar_url: avatarUrl }),
      });
      setProfile(updated);
      showToast('Profile updated');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    try {
      await api('/api/settings/change-password', {
        method: 'POST',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function requestVerification() {
    setSaving(true);
    try {
      await api('/api/settings/request-verification', { method: 'POST' });
      showToast('Verification email sent');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGithub() {
    setGithubLoading(true);
    try {
      await api('/api/github/disconnect', { method: 'POST' });
      setGithubStatus({ connected: false, username: null, avatar_url: null });
      showToast('GitHub disconnected');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGithubLoading(false);
    }
  }

  function connectGithub() {
    const user = JSON.parse(localStorage.getItem('atp-user') || '{}');
    window.location.href = `/api/github/auth?action=connect&userId=${user.userId || ''}`;
  }

  // Check for GitHub connection success from redirect
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('github') === 'connected') {
      showToast('GitHub connected successfully');
      // Refresh GitHub status
      api('/api/github/status').then(data => setGithubStatus(data)).catch(() => {});
    }
  }, []);

  async function createOrg() {
    if (!newOrgName.trim() || !newOrgSlug.trim()) return;
    setSaving(true);
    try {
      await api('/api/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: newOrgName, slug: newOrgSlug }),
      });
      setNewOrgName('');
      setNewOrgSlug('');
      setShowNewOrg(false);
      const orgsData = await api('/api/organizations');
      setOrgs(orgsData);
      showToast('Organization created');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectStripe() {
    if (!obFirstName || !obLastName || !obAddressLine1 || !obCity || !obPostalCode || !obIban) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    setConnectLoading(true);
    try {
      const res = await api('/api/stripe-connect/onboard', {
        method: 'POST',
        body: JSON.stringify({
          business_type: 'individual',
          first_name: obFirstName,
          last_name: obLastName,
          dob_day: obDobDay || undefined,
          dob_month: obDobMonth || undefined,
          dob_year: obDobYear || undefined,
          address_line1: obAddressLine1,
          address_city: obCity,
          address_postal_code: obPostalCode,
          address_country: obCountry,
          iban: obIban.replace(/\s/g, ''),
        }),
      });
      if (res.already_connected) {
        showToast('Account already connected');
      } else if (res.success) {
        showToast('Stripe account created successfully!');
      }
      setShowOnboardingForm(false);
      // Reload connect status
      const [connectRes, earningsRes] = await Promise.allSettled([
        api('/api/stripe-connect/status'),
        api('/api/stripe-connect/earnings'),
      ]);
      if (connectRes.status === 'fulfilled') setConnectStatus(connectRes.value);
      if (earningsRes.status === 'fulfilled') setEarnings(earningsRes.value);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConnectLoading(false);
    }
  }

  async function handleDisconnect() {
    setConnectLoading(true);
    try {
      await api('/api/stripe-connect/disconnect', { method: 'POST' });
      setConnectStatus({ connected: false });
      setEarnings(null);
      showToast('Stripe account disconnected');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setConnectLoading(false);
    }
  }

  async function deleteAccount() {
    setSaving(true);
    try {
      await api('/api/settings/account', {
        method: 'DELETE',
        body: JSON.stringify({ password: deletePassword }),
      });
      clearToken();
      navigate('/login');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: t.ts }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: '8px', fontSize: '13px' }}>Loading settings...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ padding: '32px', maxWidth: '900px', margin: '0 auto' }}
    >
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
          <SettingsIcon size={20} color={t.violet} />
          <h1 style={{ fontSize: '20px', fontWeight: '700', letterSpacing: '-0.02em', color: t.tp }}>
            Settings
          </h1>
        </div>
        <p style={{ fontSize: '13px', color: t.ts }}>Manage your account, security, and organizations</p>
      </div>

      <div className="settings-layout" style={{ display: 'flex', gap: '24px' }}>
        {/* Sidebar tabs */}
        <div className="settings-sidebar" style={{ width: '180px', flexShrink: 0 }}>
          <div className="settings-tabs" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', borderRadius: '6px', border: 'none',
                    background: active ? t.surfaceEl : 'transparent',
                    color: active ? t.tp : t.ts,
                    fontSize: '13px', fontWeight: active ? '500' : '400',
                    cursor: 'pointer', textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {activeTab === 'profile' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Section title="Profile Information">
                <div className="settings-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <Field label="Display Name" value={displayName} onChange={setDisplayName} />
                  <Field label="Email" value={profile?.email || ''} disabled />
                  <Field label="Company" value={company} onChange={setCompany} placeholder="Your company" />
                  <Field label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="Your role" />
                </div>
                <Field label="Avatar URL" value={avatarUrl} onChange={setAvatarUrl} placeholder="https://..." style={{ marginTop: '16px' }} />
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    style={{
                      padding: '8px 20px', background: t.tp, color: t.bg,
                      border: 'none', borderRadius: '4px', fontSize: '12px',
                      fontWeight: '600', cursor: 'pointer', opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </Section>

              {/* Danger Zone */}
              <Section title="Danger Zone" danger style={{ marginTop: '24px' }}>
                <div className="settings-danger-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: t.danger }}>Delete Account</div>
                    <div style={{ fontSize: '12px', color: t.tm, marginTop: '2px' }}>
                      Permanently delete your account and all data
                    </div>
                  </div>
                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      style={{
                        padding: '6px 14px', background: 'transparent', color: t.danger,
                        border: `1px solid rgba(239,68,68,0.3)`, borderRadius: '4px',
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                      }}
                    >
                      Delete Account
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="password"
                        placeholder="Confirm password"
                        value={deletePassword}
                        onChange={e => setDeletePassword(e.target.value)}
                        style={{ ...inputStyle, width: '180px' }}
                      />
                      <button
                        onClick={deleteAccount}
                        disabled={saving}
                        style={{
                          padding: '6px 14px', background: t.danger, color: '#fff',
                          border: 'none', borderRadius: '4px', fontSize: '12px',
                          fontWeight: '600', cursor: 'pointer',
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); }}
                        style={{
                          padding: '6px 14px', background: 'transparent', color: t.ts,
                          border: `1px solid ${t.border}`, borderRadius: '4px',
                          fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </Section>
            </motion.div>
          )}

          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Email verification */}
              <Section title="Email Verification">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: profile?.email_verified ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {profile?.email_verified ? (
                        <Check size={14} color={t.success} />
                      ) : (
                        <AlertCircle size={14} color={t.warning} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '13px', color: t.tp }}>
                        {profile?.email || 'No email'}
                      </div>
                      <div style={{ fontSize: '11px', color: profile?.email_verified ? t.success : t.warning }}>
                        {profile?.email_verified ? 'Verified' : 'Not verified'}
                      </div>
                    </div>
                  </div>
                  {!profile?.email_verified && (
                    <button
                      onClick={requestVerification}
                      disabled={saving}
                      style={{
                        padding: '6px 14px', background: t.violetM, color: t.violet,
                        border: `1px solid ${t.violet}`, borderRadius: '4px',
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '6px',
                      }}
                    >
                      <Mail size={12} />
                      Send Verification
                    </button>
                  )}
                </div>
              </Section>

              {/* Change password */}
              <Section title="Change Password" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '360px' }}>
                  <Field
                    label="Current Password"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={setCurrentPassword}
                  />
                  <Field
                    label="New Password"
                    type={showPasswords ? 'text' : 'password'}
                    value={newPassword}
                    onChange={setNewPassword}
                    placeholder="Min 6 characters"
                  />
                  <Field
                    label="Confirm New Password"
                    type={showPasswords ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button
                      onClick={() => setShowPasswords(!showPasswords)}
                      style={{
                        background: 'none', border: 'none', color: t.ts, fontSize: '11px',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    >
                      {showPasswords ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showPasswords ? 'Hide' : 'Show'} passwords
                    </button>
                    <button
                      onClick={changePassword}
                      disabled={saving || !currentPassword || !newPassword || !confirmPassword}
                      style={{
                        padding: '8px 20px', background: t.tp, color: t.bg,
                        border: 'none', borderRadius: '4px', fontSize: '12px',
                        fontWeight: '600', cursor: 'pointer',
                        opacity: (saving || !currentPassword || !newPassword) ? 0.5 : 1,
                      }}
                    >
                      {saving ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                </div>
              </Section>
            </motion.div>
          )}

          {activeTab === 'connections' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Section title="Connected Accounts">
                <div style={{
                  padding: '16px', background: t.bg, borderRadius: '8px',
                  border: `1px solid ${t.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: githubStatus?.connected ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden',
                      }}>
                        {githubStatus?.connected && githubStatus?.avatar_url ? (
                          <img src={githubStatus.avatar_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '10px' }} />
                        ) : (
                          <svg width="20" height="20" viewBox="0 0 16 16" fill="#F4F4F5">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp }}>GitHub</div>
                        {githubStatus?.connected ? (
                          <div style={{ fontSize: '12px', color: t.success, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={12} /> Connected as @{githubStatus.username}
                          </div>
                        ) : (
                          <div style={{ fontSize: '12px', color: t.ts }}>Not connected</div>
                        )}
                      </div>
                    </div>
                    <div>
                      {githubStatus?.connected ? (
                        <button
                          onClick={disconnectGithub}
                          disabled={githubLoading}
                          style={{
                            padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: t.danger, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <Unlink size={12} />
                          {githubLoading ? 'Disconnecting...' : 'Disconnect'}
                        </button>
                      ) : (
                        <button
                          onClick={connectGithub}
                          style={{
                            padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: '500',
                            background: t.violetM, border: `1px solid ${t.violet}`,
                            color: t.violet, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}
                        >
                          <Link2 size={12} />
                          Connect GitHub
                        </button>
                      )}
                    </div>
                  </div>
                  {githubStatus?.connected && (
                    <div style={{
                      marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.border}`,
                      fontSize: '12px', color: t.ts, lineHeight: '1.6',
                    }}>
                      Your GitHub account is linked. You can deploy projects to GitHub repos, import from repos, and sync changes.
                    </div>
                  )}
                  {!githubStatus?.connected && (
                    <div style={{
                      marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${t.border}`,
                      fontSize: '12px', color: t.ts, lineHeight: '1.6',
                    }}>
                      Connect your GitHub account to deploy projects as repos, import existing repos, and keep your work synced.
                    </div>
                  )}
                </div>
              </Section>
            </motion.div>
          )}

          {activeTab === 'organizations' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Section
                title="Your Organizations"
                action={
                  <button
                    onClick={() => setShowNewOrg(!showNewOrg)}
                    style={{
                      padding: '6px 12px', background: t.violetM, color: t.violet,
                      border: `1px solid ${t.violet}`, borderRadius: '4px',
                      fontSize: '11px', fontWeight: '600', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <Plus size={12} />
                    New Organization
                  </button>
                }
              >
                {/* New org form */}
                {showNewOrg && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    style={{
                      padding: '16px', background: t.bg, borderRadius: '8px',
                      border: `1px solid ${t.borderS}`, marginBottom: '16px',
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <Field label="Name" value={newOrgName} onChange={setNewOrgName} placeholder="My Team" />
                      <Field
                        label="Slug"
                        value={newOrgSlug}
                        onChange={(v) => setNewOrgSlug(v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                        placeholder="my-team"
                      />
                    </div>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setShowNewOrg(false)}
                        style={{
                          padding: '6px 14px', background: 'transparent', color: t.ts,
                          border: `1px solid ${t.border}`, borderRadius: '4px',
                          fontSize: '12px', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={createOrg}
                        disabled={saving || !newOrgName.trim() || !newOrgSlug.trim()}
                        style={{
                          padding: '6px 14px', background: t.violet, color: '#fff',
                          border: 'none', borderRadius: '4px', fontSize: '12px',
                          fontWeight: '600', cursor: 'pointer',
                          opacity: (!newOrgName.trim() || !newOrgSlug.trim()) ? 0.5 : 1,
                        }}
                      >
                        Create
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Org list */}
                {orgs.length === 0 ? (
                  <div style={{
                    padding: '32px', textAlign: 'center', color: t.tm,
                    border: `1px dashed ${t.border}`, borderRadius: '8px',
                  }}>
                    <Building2 size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px' }}>No organizations yet</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>Create one to collaborate with your team</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {orgs.map((org) => (
                      <div
                        key={org.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', background: t.bg, borderRadius: '8px',
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Building2 size={14} color={t.violet} />
                          </div>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: t.tp }}>{org.name}</div>
                            <div style={{ fontSize: '11px', color: t.tm }}>{org.slug}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                            fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
                            background: `${ROLE_COLORS[org.user_role]}20`,
                            color: ROLE_COLORS[org.user_role],
                            border: `1px solid ${ROLE_COLORS[org.user_role]}40`,
                          }}>
                            {org.user_role}
                          </span>
                          <span style={{
                            padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                            fontWeight: '500', background: t.surfaceEl, color: t.ts,
                          }}>
                            {org.plan || 'free'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </motion.div>
          )}

          {activeTab === 'billing' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Section title="Billing & Plans">
                {(!billing?.organizations || billing.organizations.length === 0) ? (
                  <div style={{
                    padding: '32px', textAlign: 'center', color: t.tm,
                    border: `1px dashed ${t.border}`, borderRadius: '8px',
                  }}>
                    <CreditCard size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
                    <div style={{ fontSize: '13px' }}>No billing information</div>
                    <div style={{ fontSize: '11px', marginTop: '4px' }}>Create an organization to manage billing</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {billing.organizations.map((org) => (
                      <div
                        key={org.organization_id}
                        style={{
                          padding: '16px 20px', background: t.bg, borderRadius: '8px',
                          border: `1px solid ${t.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: t.tp }}>
                            {org.organization_name}
                          </div>
                          <span style={{
                            padding: '4px 12px', borderRadius: '100px', fontSize: '11px',
                            fontWeight: '600', textTransform: 'uppercase',
                            background: org.plan === 'enterprise' ? 'rgba(139,92,246,0.15)' :
                                       org.plan === 'pro' ? 'rgba(34,197,94,0.15)' : t.surfaceEl,
                            color: org.plan === 'enterprise' ? t.violet :
                                  org.plan === 'pro' ? t.success : t.ts,
                          }}>
                            {org.plan}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                          <LimitCard label="Projects" value={org.max_projects === -1 ? 'Unlimited' : org.max_projects} />
                          <LimitCard label="Agents" value={org.max_agents === -1 ? 'Unlimited' : org.max_agents} />
                          <LimitCard label="Members" value={org.max_members === -1 ? 'Unlimited' : org.max_members} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </motion.div>
          )}

          {activeTab === 'payouts' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              {/* Not connected */}
              {(!connectStatus || !connectStatus.connected) && (
                <Section title="Connect Stripe to Receive Payments">
                  {!showOnboardingForm ? (
                    <div style={{
                      padding: '24px', background: t.bg, borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                          background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Landmark size={18} color={t.violet} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: t.tp, marginBottom: '8px' }}>
                            Start earning from your agents
                          </div>
                          <div style={{ fontSize: '12px', color: t.ts, lineHeight: '1.6', marginBottom: '16px' }}>
                            Set up your payout account to receive real-money payments when users purchase your agents on the marketplace. The platform takes a 20% commission, and the rest is transferred directly to your bank account.
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                            {[
                              { icon: DollarSign, text: 'Receive payments directly to your bank account' },
                              { icon: Zap, text: 'Automatic payouts on a rolling basis' },
                              { icon: TrendingUp, text: 'Track earnings and transaction history' },
                            ].map((item, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <item.icon size={12} color={t.success} />
                                <span style={{ fontSize: '12px', color: t.ts }}>{item.text}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => setShowOnboardingForm(true)}
                            style={{
                              padding: '10px 24px', background: t.violet, color: '#fff',
                              border: 'none', borderRadius: '6px', fontSize: '13px',
                              fontWeight: '600', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: '8px',
                            }}
                          >
                            <Landmark size={14} />
                            Set Up Payouts
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      padding: '20px', background: t.bg, borderRadius: '8px',
                      border: `1px solid ${t.border}`,
                    }}>
                      {/* Personal Information */}
                      <div style={{ fontSize: '12px', fontWeight: '600', color: t.violet, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Personal Information
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <Field label="First Name *" value={obFirstName} onChange={setObFirstName} placeholder="John" />
                        <Field label="Last Name *" value={obLastName} onChange={setObLastName} placeholder="Doe" />
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: '500', color: t.ts, marginBottom: '6px' }}>Date of Birth</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '20px' }}>
                        <input
                          placeholder="Day"
                          value={obDobDay}
                          onChange={e => setObDobDay(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          style={inputStyle}
                        />
                        <input
                          placeholder="Month"
                          value={obDobMonth}
                          onChange={e => setObDobMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                          style={inputStyle}
                        />
                        <input
                          placeholder="Year"
                          value={obDobYear}
                          onChange={e => setObDobYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          style={inputStyle}
                        />
                      </div>

                      {/* Address */}
                      <div style={{ fontSize: '12px', fontWeight: '600', color: t.violet, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Address
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                        <Field label="Street Address *" value={obAddressLine1} onChange={setObAddressLine1} placeholder="123 Main Street" />
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                          <Field label="City *" value={obCity} onChange={setObCity} placeholder="Paris" />
                          <Field label="Postal Code *" value={obPostalCode} onChange={setObPostalCode} placeholder="75001" />
                        </div>
                        <div>
                          <label style={labelStyle}>Country *</label>
                          <select
                            value={obCountry}
                            onChange={e => setObCountry(e.target.value)}
                            style={{ ...inputStyle, cursor: 'pointer' }}
                          >
                            {[
                              { code: 'FR', name: 'France' },
                              { code: 'DE', name: 'Germany' },
                              { code: 'ES', name: 'Spain' },
                              { code: 'IT', name: 'Italy' },
                              { code: 'NL', name: 'Netherlands' },
                              { code: 'BE', name: 'Belgium' },
                              { code: 'PT', name: 'Portugal' },
                              { code: 'AT', name: 'Austria' },
                              { code: 'IE', name: 'Ireland' },
                              { code: 'LU', name: 'Luxembourg' },
                              { code: 'CH', name: 'Switzerland' },
                              { code: 'GB', name: 'United Kingdom' },
                              { code: 'US', name: 'United States' },
                              { code: 'CA', name: 'Canada' },
                            ].map(c => (
                              <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Bank Details */}
                      <div style={{ fontSize: '12px', fontWeight: '600', color: t.violet, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                        Bank Details
                      </div>
                      <Field label="IBAN *" value={obIban} onChange={setObIban} placeholder="FR76 3000 6000 0112 3456 7890 189" />
                      <div style={{ fontSize: '11px', color: t.tm, marginTop: '6px', marginBottom: '20px' }}>
                        Your IBAN is used to receive payouts. It is stored securely by Stripe.
                      </div>

                      {/* TOS notice */}
                      <div style={{
                        padding: '12px', background: t.surfaceEl, borderRadius: '6px',
                        fontSize: '11px', color: t.ts, lineHeight: '1.5', marginBottom: '20px',
                      }}>
                        By submitting this form, you agree to the <a href="https://stripe.com/connect-account/legal" target="_blank" rel="noopener noreferrer" style={{ color: t.violet }}>Stripe Connected Account Agreement</a> and authorize GURU to facilitate payments to your bank account.
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setShowOnboardingForm(false)}
                          style={{
                            padding: '8px 16px', background: 'transparent', color: t.ts,
                            border: `1px solid ${t.border}`, borderRadius: '6px',
                            fontSize: '12px', cursor: 'pointer',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleConnectStripe}
                          disabled={connectLoading || !obFirstName || !obLastName || !obAddressLine1 || !obCity || !obPostalCode || !obIban}
                          style={{
                            padding: '8px 20px', background: t.violet, color: '#fff',
                            border: 'none', borderRadius: '6px', fontSize: '13px',
                            fontWeight: '600', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            opacity: (connectLoading || !obFirstName || !obLastName || !obAddressLine1 || !obCity || !obPostalCode || !obIban) ? 0.5 : 1,
                          }}
                        >
                          {connectLoading ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                          {connectLoading ? 'Creating account...' : 'Create Payout Account'}
                        </button>
                      </div>
                    </div>
                  )}
                </Section>
              )}

              {/* Onboarding incomplete */}
              {connectStatus?.connected && !connectStatus.details_submitted && (
                <Section title="Complete Your Stripe Setup">
                  <div style={{
                    padding: '16px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px',
                    border: '1px solid rgba(245,158,11,0.2)',
                    display: 'flex', alignItems: 'center', gap: '12px',
                  }}>
                    <AlertCircle size={18} color={t.warning} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '500', color: t.warning }}>
                        Onboarding incomplete
                      </div>
                      <div style={{ fontSize: '12px', color: t.ts, marginTop: '2px' }}>
                        Your account setup is incomplete. Please disconnect and re-create your payout account.
                      </div>
                    </div>
                    <button
                      onClick={handleDisconnect}
                      disabled={connectLoading}
                      style={{
                        padding: '8px 16px', background: t.warning, color: '#000',
                        border: 'none', borderRadius: '4px', fontSize: '12px',
                        fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                        opacity: connectLoading ? 0.7 : 1,
                      }}
                    >
                      {connectLoading ? 'Loading...' : 'Reset & Retry'}
                    </button>
                  </div>
                </Section>
              )}

              {/* Connected */}
              {connectStatus?.connected && connectStatus.details_submitted && (
                <>
                  <Section title="Payout Account">
                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: 'rgba(34,197,94,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Check size={14} color={t.success} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: t.tp }}>Connected</div>
                        <div style={{ fontSize: '11px', color: t.tm, fontFamily: t.mono }}>
                          {connectStatus.account_id}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                          fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: connectStatus.charges_enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: connectStatus.charges_enabled ? t.success : t.danger,
                        }}>
                          {connectStatus.charges_enabled ? 'Charges On' : 'Charges Off'}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                          fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
                          background: connectStatus.payouts_enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                          color: connectStatus.payouts_enabled ? t.success : t.danger,
                        }}>
                          {connectStatus.payouts_enabled ? 'Payouts On' : 'Payouts Off'}
                        </span>
                      </div>
                    </div>

                    {/* Earnings summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                      <EarningsCard label="Total Earned" value={earnings?.summary?.total_earned_cents || 0} color={t.tp} />
                      <EarningsCard label="Platform Fees" value={earnings?.summary?.total_fees_cents || 0} color={t.warning} />
                      <EarningsCard label="Net Earnings" value={earnings?.summary?.net_earnings_cents || 0} color={t.success} />
                    </div>

                    {/* Recent payments */}
                    <div style={{ fontSize: '12px', fontWeight: '600', color: t.ts, marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Recent Payments ({earnings?.summary?.completed_payments || 0})
                    </div>
                    {(!earnings?.payments || earnings.payments.length === 0) ? (
                      <div style={{
                        padding: '24px', textAlign: 'center', color: t.tm,
                        border: `1px dashed ${t.border}`, borderRadius: '8px',
                      }}>
                        <DollarSign size={20} style={{ marginBottom: '6px', opacity: 0.5 }} />
                        <div style={{ fontSize: '12px' }}>No payments yet</div>
                      </div>
                    ) : (
                      <div style={{ borderRadius: '8px', border: `1px solid ${t.border}`, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                          <thead>
                            <tr style={{ background: t.bg }}>
                              {['Date', 'Agent', 'Amount', 'Fee', 'Net', 'Status'].map((h) => (
                                <th key={h} style={{
                                  padding: '8px 12px', textAlign: 'left', color: t.tm,
                                  fontWeight: '500', fontSize: '11px', textTransform: 'uppercase',
                                  letterSpacing: '0.05em', borderBottom: `1px solid ${t.border}`,
                                }}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {earnings.payments.map((p) => (
                              <tr key={p.id} style={{ borderBottom: `1px solid ${t.border}` }}>
                                <td style={{ padding: '8px 12px', color: t.ts }}>
                                  {new Date(p.created_at).toLocaleDateString()}
                                </td>
                                <td style={{ padding: '8px 12px', color: t.tp, fontWeight: '500' }}>
                                  {p.agent_name}
                                </td>
                                <td style={{ padding: '8px 12px', color: t.tp, fontFamily: t.mono }}>
                                  ${(p.amount_cents / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 12px', color: t.warning, fontFamily: t.mono }}>
                                  -${(p.platform_fee_cents / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 12px', color: t.success, fontFamily: t.mono }}>
                                  ${((p.amount_cents - p.platform_fee_cents) / 100).toFixed(2)}
                                </td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span style={{
                                    padding: '2px 8px', borderRadius: '100px', fontSize: '10px',
                                    fontWeight: '600', textTransform: 'uppercase',
                                    background: p.status === 'completed' ? 'rgba(34,197,94,0.15)' :
                                               p.status === 'failed' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: p.status === 'completed' ? t.success :
                                           p.status === 'failed' ? t.danger : t.warning,
                                  }}>
                                    {p.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Section>

                  {/* Danger zone: disconnect */}
                  <Section title="Disconnect Stripe" danger style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: t.danger }}>
                          Remove Stripe Connection
                        </div>
                        <div style={{ fontSize: '12px', color: t.tm, marginTop: '2px' }}>
                          You will no longer receive real-money payments for agent purchases
                        </div>
                      </div>
                      <button
                        onClick={handleDisconnect}
                        disabled={connectLoading}
                        style={{
                          padding: '6px 14px', background: 'transparent', color: t.danger,
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px',
                          fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                          opacity: connectLoading ? 0.7 : 1,
                        }}
                      >
                        {connectLoading ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  </Section>
                </>
              )}
            </motion.div>
          )}

          {activeTab === 'api-keys' && (
            <LlmApiKeysSection showToast={showToast} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @media (max-width: 640px) {
          .settings-layout { flex-direction: column !important; gap: 16px !important; }
          .settings-sidebar { width: 100% !important; }
          .settings-tabs { flex-direction: row !important; overflow-x: auto !important; gap: 4px !important; padding-bottom: 4px !important; }
          .settings-form-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </motion.div>
  );
}

function LlmApiKeysSection({ showToast }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [deleting, setDeleting] = useState(null);

  const providers = [
    { id: 'openai', name: 'OpenAI', color: '#10a37f', desc: 'GPT-5 Mini, GPT-4o, o1, o3 and more' },
    { id: 'anthropic', name: 'Anthropic', color: '#d97706', desc: 'Claude Sonnet 4, Opus 4, Haiku 3.5' },
    { id: 'google', name: 'Google', color: '#4285F4', desc: 'Gemini 2.5 Flash, Gemini 2.5 Pro' },
  ];

  useEffect(() => { loadKeys(); }, []);

  async function loadKeys() {
    try {
      const data = await api('/api/wallet/llm-keys');
      setKeys(data || []);
    } catch (err) {
      console.error('Failed to load LLM keys:', err);
    } finally {
      setLoading(false);
    }
  }

  function getEd(p) {
    return editing[p] || { apiKey: '', showKey: false, models: [], selectedModel: '', step: 'input', loading: false };
  }

  function setEd(p, updates) {
    setEditing(prev => ({ ...prev, [p]: { ...getEd(p), ...updates } }));
  }

  async function handleConnect(providerId) {
    const ed = getEd(providerId);
    if (!ed.apiKey.trim()) return;
    setEd(providerId, { loading: true });
    try {
      const result = await api(`/api/wallet/llm-keys/${providerId}/models`, {
        method: 'POST',
        body: JSON.stringify({ apiKey: ed.apiKey }),
      });
      const models = result.models || [];
      if (models.length === 0) {
        showToast('No models found — check your API key', 'error');
        setEd(providerId, { loading: false });
        return;
      }
      const defaultModel = models.find(m => m.default)?.id || models[0]?.id;
      setEd(providerId, { models, selectedModel: defaultModel, step: 'select', loading: false });
    } catch (err) {
      showToast(err.message || 'Invalid API key', 'error');
      setEd(providerId, { loading: false });
    }
  }

  async function handleSave(providerId) {
    const ed = getEd(providerId);
    if (!ed.apiKey || !ed.selectedModel) return;
    setEd(providerId, { loading: true });
    try {
      await api(`/api/wallet/llm-keys/${providerId}`, {
        method: 'PUT',
        body: JSON.stringify({ apiKey: ed.apiKey, model: ed.selectedModel }),
      });
      showToast(`${providers.find(p => p.id === providerId)?.name} connected successfully`);
      setEd(providerId, { apiKey: '', showKey: false, models: [], selectedModel: '', step: 'input', loading: false });
      loadKeys();
    } catch (err) {
      showToast(err.message || 'Failed to save key', 'error');
      setEd(providerId, { loading: false });
    }
  }

  async function handleDelete(providerId) {
    setDeleting(providerId);
    try {
      await api(`/api/wallet/llm-keys/${providerId}`, { method: 'DELETE' });
      showToast('API key removed');
      loadKeys();
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function handleActivate(providerId) {
    try {
      await api(`/api/wallet/llm-keys/${providerId}/activate`, { method: 'POST' });
      showToast(`${providers.find(p => p.id === providerId)?.name} set as active provider`);
      loadKeys();
    } catch (err) {
      showToast(err.message || 'Failed to activate', 'error');
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px', color: t.ts }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ marginLeft: '8px', fontSize: '13px' }}>Loading API keys...</span>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Section title="LLM Provider API Keys">
        <p style={{ fontSize: '12px', color: t.ts, margin: '-8px 0 16px', lineHeight: 1.6 }}>
          Connect your own API keys to power MCP deployments with your preferred models. Keys are encrypted at rest.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {providers.map(provider => {
            const configured = keys.find(k => k.provider === provider.id);
            const ed = getEd(provider.id);

            return (
              <div
                key={provider.id}
                style={{
                  padding: '16px', background: t.bg, borderRadius: '10px',
                  border: `1px solid ${configured ? `${provider.color}30` : t.border}`,
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Header row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  marginBottom: !configured ? '12px' : 0,
                }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: `${provider.color}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Key size={16} style={{ color: provider.color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: t.tp }}>{provider.name}</span>
                      {configured && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '100px',
                          background: 'rgba(34,197,94,0.12)', color: t.success,
                        }}>
                          Connected
                        </span>
                      )}
                      {configured?.is_active && (
                        <span style={{
                          fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '100px',
                          background: `${t.violet}20`, color: t.violet,
                        }}>
                          Active
                        </span>
                      )}
                    </div>
                    {configured ? (
                      <div style={{ fontSize: '11px', fontFamily: t.mono, color: t.tm, marginTop: '2px' }}>
                        {configured.model}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: t.tm, marginTop: '2px' }}>{provider.desc}</div>
                    )}
                  </div>
                  {configured && (
                    <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                      {!configured.is_active && (
                        <button
                          onClick={() => handleActivate(provider.id)}
                          style={{
                            padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                            background: `${t.violet}15`, border: `1px solid ${t.violet}40`,
                            color: t.violet, cursor: 'pointer',
                          }}
                        >
                          Set Active
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(provider.id)}
                        disabled={deleting === provider.id}
                        style={{
                          padding: '5px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '500',
                          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
                          color: t.danger, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                          opacity: deleting === provider.id ? 0.5 : 1,
                        }}
                      >
                        <Trash2 size={11} />
                        {deleting === provider.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Connect flow — key input */}
                {!configured && ed.step === 'input' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type={ed.showKey ? 'text' : 'password'}
                        value={ed.apiKey}
                        onChange={e => setEd(provider.id, { apiKey: e.target.value })}
                        placeholder={`Enter your ${provider.name} API key...`}
                        style={{ ...inputStyle, paddingRight: '36px' }}
                        onKeyDown={e => e.key === 'Enter' && handleConnect(provider.id)}
                      />
                      <button
                        onClick={() => setEd(provider.id, { showKey: !ed.showKey })}
                        style={{
                          position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px',
                        }}
                      >
                        {ed.showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    <button
                      onClick={() => handleConnect(provider.id)}
                      disabled={!ed.apiKey.trim() || ed.loading}
                      style={{
                        padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                        background: provider.color, color: '#fff', border: 'none',
                        cursor: (!ed.apiKey.trim() || ed.loading) ? 'not-allowed' : 'pointer',
                        opacity: (!ed.apiKey.trim() || ed.loading) ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap',
                      }}
                    >
                      {ed.loading && <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />}
                      {ed.loading ? 'Validating...' : 'Connect'}
                    </button>
                  </div>
                )}

                {/* Connect flow — model selection */}
                {!configured && ed.step === 'select' && (
                  <div>
                    <div style={{
                      padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: '6px',
                      border: '1px solid rgba(34,197,94,0.2)', marginBottom: '12px',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <Check size={12} style={{ color: t.success }} />
                      <span style={{ fontSize: '11px', color: t.success, fontWeight: '500' }}>
                        Key validated — {ed.models.length} model{ed.models.length !== 1 ? 's' : ''} available
                      </span>
                    </div>
                    <label style={labelStyle}>Select default model</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={ed.selectedModel}
                        onChange={e => setEd(provider.id, { selectedModel: e.target.value })}
                        style={{ ...inputStyle, flex: 1, cursor: 'pointer' }}
                      >
                        {ed.models.map(m => (
                          <option key={m.id} value={m.id}>{m.name || m.id}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleSave(provider.id)}
                        disabled={ed.loading}
                        style={{
                          padding: '10px 16px', borderRadius: '6px', fontSize: '12px', fontWeight: '600',
                          background: t.violet, color: '#fff', border: 'none',
                          cursor: ed.loading ? 'not-allowed' : 'pointer',
                          opacity: ed.loading ? 0.5 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {ed.loading ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEd(provider.id, { step: 'input', models: [], selectedModel: '' })}
                        style={{
                          padding: '10px 12px', borderRadius: '6px', fontSize: '12px',
                          background: 'transparent', color: t.ts, border: `1px solid ${t.border}`,
                          cursor: 'pointer',
                        }}
                      >
                        Back
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </motion.div>
  );
}

function Section({ title, children, action, danger, style }) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${danger ? 'rgba(239,68,68,0.2)' : t.border}`,
      borderRadius: '12px', padding: '20px', ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: danger ? t.danger : t.tp }}>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled, style }) {
  return (
    <div style={style}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...inputStyle,
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
    </div>
  );
}

function EarningsCard({ label, value, color }) {
  return (
    <div style={{
      padding: '14px 16px', background: t.bg, borderRadius: '8px',
      border: `1px solid ${t.border}`,
    }}>
      <div style={{ fontSize: '10px', color: t.tm, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '20px', fontWeight: '700', color, fontFamily: t.mono }}>
        ${(value / 100).toFixed(2)}
      </div>
    </div>
  );
}

function LimitCard({ label, value }) {
  return (
    <div style={{
      padding: '10px 12px', background: t.surfaceEl, borderRadius: '6px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '16px', fontWeight: '600', color: t.tp }}>
        {value}
      </div>
      <div style={{ fontSize: '10px', color: t.tm, marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}
