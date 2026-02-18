import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api, clearToken } from '../api';
import {
  User, Shield, Building2, CreditCard, Settings as SettingsIcon,
  Check, AlertCircle, Mail, Lock, Eye, EyeOff, Plus, Trash2,
  Crown, Users, ChevronRight, Loader2, ExternalLink, Landmark,
  DollarSign, TrendingUp, Zap,
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
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'payouts', label: 'Payouts', icon: Landmark },
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
      const [profileRes, orgsRes, billingRes, connectRes, earningsRes] = await Promise.allSettled([
        api('/api/settings/profile'),
        api('/api/organizations'),
        api('/api/settings/billing'),
        api('/api/stripe-connect/status'),
        api('/api/stripe-connect/earnings'),
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

      <div style={{ display: 'flex', gap: '24px' }}>
        {/* Sidebar tabs */}
        <div style={{ width: '180px', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
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
