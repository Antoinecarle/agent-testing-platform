import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet as WalletIcon, Plus, ArrowUpRight, ArrowDownLeft, Gift, RefreshCw,
  CreditCard, Copy, Eye, EyeOff, Trash2, Key, Shield, Zap, Crown, Package,
  Check, AlertCircle, X, Loader2, ExternalLink, Search, Filter, Clock,
  Coins, TrendingUp, Bot, ChevronRight, Sparkles, Hash, MoreHorizontal,
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

const TABS = [
  { id: 'transactions', label: 'Transactions', icon: Clock },
  { id: 'agents', label: 'My Agents', icon: Bot },
  { id: 'tokens', label: 'API Tokens', icon: Key },
];

const PACKAGES = [
  { amount: 500, price: 500, label: 'Starter', icon: Zap, desc: 'Get started with AI agents' },
  { amount: 2000, price: 2000, label: 'Popular', icon: Crown, desc: 'Most chosen by developers', popular: true },
  { amount: 5000, price: 5000, label: 'Pro', icon: TrendingUp, desc: 'For power users & teams' },
  { amount: 10000, price: 10000, label: 'Enterprise', icon: Shield, desc: 'Unlimited potential' },
];

function formatPrice(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

const TX_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'deposit', label: 'Deposits' },
  { id: 'purchase', label: 'Purchases' },
  { id: 'refund', label: 'Refunds' },
  { id: 'bonus', label: 'Bonuses' },
];

function formatNumber(n) {
  if (n == null) return '0';
  return n.toLocaleString('en-US');
}

function formatDate(d) {
  if (!d) return '--';
  const date = new Date(d);
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bg = type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
  const border = type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
  const color = type === 'success' ? t.success : t.danger;
  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      padding: '12px 24px', borderRadius: '10px', background: bg,
      border: `1px solid ${border}`, color, fontSize: '13px', fontWeight: '500',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
      backdropFilter: 'blur(12px)', animation: 'toastIn 0.3s ease',
    }}>
      {type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
      {message}
    </div>
  );
}

function AnimatedBalance({ value }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const start = display;
    const end = value || 0;
    const duration = 1200;
    const startTime = performance.now();

    function animate(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    }

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span style={{
      fontFamily: t.mono, fontSize: '42px', fontWeight: '700',
      background: `linear-gradient(135deg, ${t.tp}, ${t.violet})`,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      letterSpacing: '-1px', lineHeight: 1,
    }}>
      {formatNumber(display)}
    </span>
  );
}

function TokenModal({ token, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.surface, border: `1px solid ${t.borderS}`,
        borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '520px',
        margin: '0 16px', animation: 'slideUp 0.3s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Key size={18} color={t.violet} />
            </div>
            <div>
              <div style={{ color: t.tp, fontWeight: '600', fontSize: '16px' }}>API Token Generated</div>
              <div style={{ color: t.ts, fontSize: '12px', marginTop: '2px' }}>Save this token now</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: t.tm, cursor: 'pointer', padding: '4px',
          }}>
            <X size={18} />
          </button>
        </div>

        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: '8px', padding: '12px 16px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <AlertCircle size={16} color={t.danger} style={{ flexShrink: 0 }} />
          <span style={{ color: '#fca5a5', fontSize: '12px', lineHeight: '1.5' }}>
            This token will only be shown once. Copy it now and store it securely.
            You will not be able to see the full token again.
          </span>
        </div>

        <div style={{
          background: t.bg, border: `1px solid ${t.border}`, borderRadius: '8px',
          padding: '14px 16px', fontFamily: t.mono, fontSize: '13px', color: t.violet,
          wordBreak: 'break-all', lineHeight: '1.6', marginBottom: '20px',
        }}>
          {token}
        </div>

        <button onClick={handleCopy} style={{
          width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
          background: copied ? t.success : t.violet, color: '#fff',
          fontSize: '14px', fontWeight: '600', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'all 0.2s ease',
        }}>
          {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Token</>}
        </button>
      </div>
    </div>
  );
}

function DepositConfirmModal({ pkg, customAmount, onConfirm, onClose, depositing }) {
  const amount = pkg ? pkg.amount : customAmount;
  const priceCents = amount; // 1 credit = 1 cent
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: t.surface, border: `1px solid ${t.borderS}`,
        borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px',
        margin: '0 16px', animation: 'slideUp 0.3s ease',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px', margin: '0 auto 16px',
            background: t.violetM, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={24} color={t.violet} />
          </div>
          <div style={{ color: t.tp, fontWeight: '600', fontSize: '18px', marginBottom: '4px' }}>
            Purchase Credits
          </div>
          <div style={{ color: t.ts, fontSize: '13px' }}>
            You will be redirected to Stripe to complete payment
          </div>
        </div>

        <div style={{
          background: t.bg, borderRadius: '10px', padding: '20px',
          textAlign: 'center', marginBottom: '16px', border: `1px solid ${t.border}`,
        }}>
          <div style={{
            fontFamily: t.mono, fontSize: '36px', fontWeight: '700',
            color: t.violet, letterSpacing: '-1px',
          }}>
            {formatNumber(amount)}
          </div>
          <div style={{ color: t.ts, fontSize: '12px', marginTop: '4px' }}>credits</div>
        </div>

        <div style={{
          textAlign: 'center', marginBottom: '24px',
          fontFamily: t.mono, fontSize: '20px', fontWeight: '700', color: t.tp,
        }}>
          {formatPrice(priceCents)}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '12px', borderRadius: '8px',
            border: `1px solid ${t.border}`, background: 'transparent',
            color: t.ts, fontSize: '14px', fontWeight: '500', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={() => onConfirm(amount)} disabled={depositing} style={{
            flex: 1, padding: '12px', borderRadius: '8px', border: 'none',
            background: t.violet, color: '#fff', fontSize: '14px', fontWeight: '600',
            cursor: depositing ? 'not-allowed' : 'pointer', opacity: depositing ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}>
            {depositing ? <Loader2 size={16} className="spin" /> : <CreditCard size={16} />}
            {depositing ? 'Redirecting...' : `Pay ${formatPrice(priceCents)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center',
    }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '20px',
        background: t.violetG, display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px', border: `1px solid ${t.violetM}`,
      }}>
        <Icon size={28} color={t.violet} strokeWidth={1.5} />
      </div>
      <div style={{ color: t.ts, fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>{title}</div>
      <div style={{ color: t.tm, fontSize: '13px', maxWidth: '300px', lineHeight: '1.5' }}>{description}</div>
    </div>
  );
}

export default function Wallet() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('transactions');
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [txFilter, setTxFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [depositModal, setDepositModal] = useState(null);
  const [depositing, setDepositing] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [tokenModal, setTokenModal] = useState(null);
  const [generatingToken, setGeneratingToken] = useState(null);
  const [revealedTokens, setRevealedTokens] = useState({});

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const data = await api('/api/wallet');
      setWallet(data);
    } catch (e) {
      console.error('Failed to fetch wallet:', e);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api('/api/wallet/transactions');
      setTransactions(data);
    } catch (e) {
      console.error('Failed to fetch transactions:', e);
    }
  }, []);

  const fetchPurchases = useCallback(async () => {
    try {
      const data = await api('/api/wallet/purchases');
      setPurchases(data);
    } catch (e) {
      console.error('Failed to fetch purchases:', e);
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      const data = await api('/api/wallet/tokens');
      setTokens(data);
    } catch (e) {
      console.error('Failed to fetch tokens:', e);
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchWallet(), fetchTransactions(), fetchPurchases(), fetchTokens()]);
      setLoading(false);
    }
    load();

    // Detect Stripe checkout result from URL params
    const params = new URLSearchParams(window.location.search);
    const purchase = params.get('purchase');
    if (purchase === 'success') {
      showToast('Credits added successfully!');
      // Clean URL
      window.history.replaceState({}, '', '/wallet');
    } else if (purchase === 'canceled') {
      showToast('Purchase canceled', 'error');
      window.history.replaceState({}, '', '/wallet');
    }
  }, [fetchWallet, fetchTransactions, fetchPurchases, fetchTokens, showToast]);

  const handleDeposit = async (amount) => {
    setDepositing(true);
    try {
      const data = await api('/api/wallet/deposit', {
        method: 'POST',
        body: JSON.stringify({ amount: Number(amount) }),
      });
      if (data.url) {
        window.location.href = data.url;
      } else {
        showToast('Failed to create checkout session', 'error');
      }
    } catch (e) {
      showToast(e.message || 'Deposit failed', 'error');
      setDepositing(false);
    }
  };

  const handleGenerateToken = async (agentName) => {
    setGeneratingToken(agentName);
    try {
      const data = await api(`/api/wallet/tokens/${encodeURIComponent(agentName)}/generate`, {
        method: 'POST',
      });
      setTokenModal(data.token);
      fetchTokens();
    } catch (e) {
      showToast(e.message || 'Failed to generate token', 'error');
    } finally {
      setGeneratingToken(null);
    }
  };

  const handleRevokeToken = async (tokenId) => {
    try {
      await api(`/api/wallet/tokens/${tokenId}`, { method: 'DELETE' });
      showToast('Token revoked successfully');
      fetchTokens();
    } catch (e) {
      showToast(e.message || 'Failed to revoke token', 'error');
    }
  };

  const handleCopyToken = (prefix) => {
    navigator.clipboard.writeText(prefix);
    showToast('Token prefix copied');
  };

  const filteredTransactions = txFilter === 'all'
    ? transactions
    : transactions.filter(tx => tx.type === txFilter);

  const stats = [
    { label: 'Total Deposited', value: wallet?.total_deposited || 0, icon: ArrowDownLeft, color: t.success },
    { label: 'Total Spent', value: wallet?.total_spent || 0, icon: ArrowUpRight, color: t.danger },
    { label: 'Active Agents', value: purchases?.length || 0, icon: Bot, color: t.violet },
    { label: 'API Tokens', value: tokens?.filter(tk => tk.is_active)?.length || 0, icon: Key, color: t.warning },
  ];

  const txIcon = (type) => {
    switch (type) {
      case 'deposit': return { Icon: ArrowDownLeft, color: t.success, bg: 'rgba(34,197,94,0.12)' };
      case 'purchase': return { Icon: ArrowUpRight, color: t.danger, bg: 'rgba(239,68,68,0.12)' };
      case 'bonus': return { Icon: Gift, color: t.warning, bg: 'rgba(245,158,11,0.12)' };
      case 'refund': return { Icon: RefreshCw, color: t.violet, bg: t.violetG };
      default: return { Icon: CreditCard, color: t.ts, bg: 'rgba(161,161,170,0.12)' };
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: t.bg, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Loader2 size={32} color={t.violet} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes balanceGlow {
          0%, 100% { box-shadow: 0 0 30px rgba(139,92,246,0.1), 0 0 60px rgba(139,92,246,0.05); }
          50% { box-shadow: 0 0 40px rgba(139,92,246,0.2), 0 0 80px rgba(139,92,246,0.1); }
        }
        .spin { animation: spin 1s linear infinite; }
        .wallet-pkg:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 32px rgba(0,0,0,0.5) !important; }
        .wallet-pkg-popular:hover { box-shadow: 0 12px 32px rgba(0,0,0,0.5), 0 0 30px rgba(139,92,246,0.25) !important; }
        .wallet-tab:hover { color: ${t.tp} !important; background: rgba(255,255,255,0.04) !important; }
        .wallet-row:hover { background: rgba(255,255,255,0.02) !important; }
        .wallet-btn:hover { opacity: 0.85 !important; }
        .wallet-filter:hover { background: rgba(255,255,255,0.06) !important; }
        @media (max-width: 768px) {
          .wallet-stats { grid-template-columns: 1fr 1fr !important; }
          .wallet-packages { grid-template-columns: 1fr !important; }
          .wallet-agents-grid { grid-template-columns: 1fr !important; }
          .wallet-header-row { flex-direction: column !important; gap: 16px !important; }
          .wallet-balance-card { padding: 24px !important; }
          .wallet-balance-num { font-size: 32px !important; }
        }
        @media (max-width: 480px) {
          .wallet-stats { grid-template-columns: 1fr !important; }
          .wallet-tab-text { display: none; }
        }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {tokenModal && <TokenModal token={tokenModal} onClose={() => setTokenModal(null)} />}
      {depositModal && (
        <DepositConfirmModal
          pkg={depositModal.pkg}
          customAmount={depositModal.customAmount}
          onConfirm={handleDeposit}
          onClose={() => setDepositModal(null)}
          depositing={depositing}
        />
      )}

      <div style={{
        minHeight: '100vh', background: t.bg, color: t.tp,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px 64px' }}>

          {/* Header Row */}
          <div className="wallet-header-row" style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            marginBottom: '28px',
          }}>
            <div>
              <h1 style={{
                fontSize: '28px', fontWeight: '700', color: t.tp, margin: 0,
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px',
                  background: `linear-gradient(135deg, ${t.violet}, #a78bfa)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <WalletIcon size={18} color="#fff" />
                </div>
                Wallet
              </h1>
              <p style={{ color: t.ts, fontSize: '14px', margin: '6px 0 0 48px' }}>
                Manage your credits and API tokens
              </p>
            </div>
          </div>

          {/* Balance Card */}
          <div className="wallet-balance-card" style={{
            background: 'rgba(26, 26, 27, 0.8)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(139,92,246,0.3)',
            borderRadius: '16px', padding: '32px',
            marginBottom: '24px', position: 'relative', overflow: 'hidden',
            animation: 'balanceGlow 4s ease-in-out infinite',
          }}>
            {/* Decorative gradient orbs */}
            <div style={{
              position: 'absolute', top: '-60px', right: '-40px',
              width: '200px', height: '200px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', bottom: '-80px', left: '-20px',
              width: '160px', height: '160px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexWrap: 'wrap', gap: '16px',
              }}>
                <div>
                  <div style={{
                    color: t.ts, fontSize: '13px', fontWeight: '500',
                    textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <Coins size={14} /> Available Balance
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <AnimatedBalance value={wallet?.balance || 0} />
                    <span style={{
                      fontFamily: t.mono, fontSize: '16px', color: t.ts, fontWeight: '500',
                    }}>
                      credits
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setDepositModal({ pkg: PACKAGES[1] })}
                  className="wallet-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '12px 24px', borderRadius: '10px', border: 'none',
                    background: `linear-gradient(135deg, ${t.violet}, #7c3aed)`,
                    color: '#fff', fontSize: '14px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                    boxShadow: `0 4px 16px rgba(139,92,246,0.3)`,
                  }}
                >
                  <Plus size={16} /> Add Credits
                </button>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div className="wallet-stats" style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px', marginBottom: '28px',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                background: t.surface, border: `1px solid ${t.border}`,
                borderRadius: '12px', padding: '18px 20px',
                animation: `slideUp 0.4s ease ${i * 0.08}s both`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    background: `${s.color}18`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <s.icon size={14} color={s.color} />
                  </div>
                  <span style={{ color: t.tm, fontSize: '12px', fontWeight: '500' }}>{s.label}</span>
                </div>
                <div style={{
                  fontFamily: t.mono, fontSize: '22px', fontWeight: '700', color: t.tp,
                }}>
                  {formatNumber(s.value)}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Deposit Section */}
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontSize: '16px', fontWeight: '600', color: t.tp, margin: '0 0 16px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <Sparkles size={16} color={t.violet} /> Quick Deposit
            </h2>
            <div className="wallet-packages" style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '12px', marginBottom: '16px',
            }}>
              {PACKAGES.map((pkg, i) => {
                const IconComp = pkg.icon;
                return (
                  <div
                    key={i}
                    className={`wallet-pkg ${pkg.popular ? 'wallet-pkg-popular' : ''}`}
                    onClick={() => setDepositModal({ pkg })}
                    style={{
                      background: pkg.popular
                        ? `linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))`
                        : t.surface,
                      border: `1px solid ${pkg.popular ? 'rgba(139,92,246,0.4)' : t.border}`,
                      borderRadius: '12px', padding: '20px', cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {pkg.popular && (
                      <div style={{
                        position: 'absolute', top: '10px', right: '-24px',
                        background: t.violet, color: '#fff', fontSize: '9px',
                        fontWeight: '700', padding: '3px 28px', transform: 'rotate(35deg)',
                        textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>
                        Popular
                      </div>
                    )}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: pkg.popular ? t.violetM : `${t.surfaceEl}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: '14px', border: `1px solid ${pkg.popular ? 'rgba(139,92,246,0.3)' : t.border}`,
                    }}>
                      <IconComp size={16} color={pkg.popular ? t.violet : t.ts} />
                    </div>
                    <div style={{
                      fontFamily: t.mono, fontSize: '22px', fontWeight: '700',
                      color: t.tp, marginBottom: '2px',
                    }}>
                      {formatNumber(pkg.amount)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ color: t.ts, fontSize: '12px', fontWeight: '500' }}>
                        {pkg.label}
                      </span>
                      <span style={{
                        fontFamily: t.mono, fontSize: '13px', fontWeight: '700',
                        color: t.success,
                      }}>
                        {formatPrice(pkg.price)}
                      </span>
                    </div>
                    <div style={{ color: t.tm, fontSize: '11px', lineHeight: '1.4' }}>
                      {pkg.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Amount */}
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'stretch',
            }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Coins size={14} color={t.tm} style={{
                  position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
                }} />
                <input
                  type="number"
                  placeholder="Custom amount (credits)..."
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customAmount && Number(customAmount) > 0) {
                      setDepositModal({ customAmount: Number(customAmount) });
                    }
                  }}
                  style={{
                    width: '100%', background: t.surface, border: `1px solid ${t.border}`,
                    borderRadius: '10px', padding: '12px 14px 12px 38px',
                    color: t.tp, fontSize: '14px', fontFamily: t.mono,
                    outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={e => e.target.style.borderColor = t.violet}
                  onBlur={e => e.target.style.borderColor = t.border}
                />
              </div>
              {customAmount && Number(customAmount) > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', padding: '0 12px',
                  fontFamily: t.mono, fontSize: '14px', fontWeight: '600', color: t.success,
                  whiteSpace: 'nowrap',
                }}>
                  {formatPrice(Number(customAmount))}
                </div>
              )}
              <button
                onClick={() => {
                  if (customAmount && Number(customAmount) > 0) {
                    setDepositModal({ customAmount: Number(customAmount) });
                  }
                }}
                className="wallet-btn"
                style={{
                  padding: '12px 24px', borderRadius: '10px', border: `1px solid ${t.violet}`,
                  background: 'transparent', color: t.violet, fontSize: '14px', fontWeight: '600',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >
                <CreditCard size={14} /> Purchase
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '24px',
            background: t.surface, borderRadius: '12px', padding: '4px',
            border: `1px solid ${t.border}`,
          }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  className={active ? '' : 'wallet-tab'}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none',
                    background: active ? t.surfaceEl : 'transparent',
                    color: active ? t.tp : t.tm, fontSize: '13px', fontWeight: '500',
                    cursor: 'pointer', transition: 'all 0.2s ease',
                  }}
                >
                  <tab.icon size={15} />
                  <span className="wallet-tab-text">{tab.label}</span>
                  {tab.id === 'tokens' && tokens.filter(tk => tk.is_active).length > 0 && (
                    <span style={{
                      background: t.violetG, color: t.violet, fontSize: '11px', fontWeight: '600',
                      padding: '1px 7px', borderRadius: '10px', fontFamily: t.mono,
                    }}>
                      {tokens.filter(tk => tk.is_active).length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div style={{
            background: t.surface, border: `1px solid ${t.border}`,
            borderRadius: '14px', overflow: 'hidden',
            animation: 'fadeIn 0.3s ease',
          }}>

            {/* ===== TRANSACTIONS TAB ===== */}
            {activeTab === 'transactions' && (
              <div>
                {/* Filters */}
                <div style={{
                  padding: '16px 20px', borderBottom: `1px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
                }}>
                  <Filter size={14} color={t.tm} style={{ marginRight: '4px' }} />
                  {TX_FILTERS.map(f => (
                    <button
                      key={f.id}
                      className={txFilter === f.id ? '' : 'wallet-filter'}
                      onClick={() => setTxFilter(f.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '6px', border: 'none',
                        background: txFilter === f.id ? t.violetM : 'transparent',
                        color: txFilter === f.id ? t.violet : t.tm,
                        fontSize: '12px', fontWeight: '500', cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {filteredTransactions.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="No transactions yet"
                    description="Your transaction history will appear here once you make a deposit or purchase."
                  />
                ) : (
                  <div>
                    {filteredTransactions.map((tx, i) => {
                      const { Icon, color, bg } = txIcon(tx.type);
                      const isPositive = tx.amount > 0;
                      return (
                        <div
                          key={tx.id || i}
                          className="wallet-row"
                          style={{
                            display: 'flex', alignItems: 'center', padding: '14px 20px',
                            borderBottom: i < filteredTransactions.length - 1 ? `1px solid ${t.border}` : 'none',
                            transition: 'background 0.15s',
                            animation: `slideUp 0.3s ease ${i * 0.03}s both`,
                          }}
                        >
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '10px', background: bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            marginRight: '14px', flexShrink: 0,
                          }}>
                            <Icon size={16} color={color} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              color: t.tp, fontSize: '13px', fontWeight: '500',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {tx.description || tx.type}
                            </div>
                            <div style={{ color: t.tm, fontSize: '11px', marginTop: '2px' }}>
                              {formatDate(tx.created_at)}
                              {tx.reference_id && (
                                <span style={{
                                  marginLeft: '8px', fontFamily: t.mono, fontSize: '10px',
                                  color: t.tm, opacity: 0.7,
                                }}>
                                  #{tx.reference_id.slice(0, 8)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{
                            fontFamily: t.mono, fontSize: '14px', fontWeight: '600',
                            color: isPositive ? t.success : t.danger,
                            whiteSpace: 'nowrap',
                          }}>
                            {isPositive ? '+' : ''}{formatNumber(tx.amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== MY AGENTS TAB ===== */}
            {activeTab === 'agents' && (
              <div style={{ padding: '20px' }}>
                {purchases.length === 0 ? (
                  <EmptyState
                    icon={Bot}
                    title="No agents purchased"
                    description="Visit the Marketplace to discover and purchase AI agents for your projects."
                  />
                ) : (
                  <div className="wallet-agents-grid" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px',
                  }}>
                    {purchases.map((purchase, i) => {
                      const agent = purchase.agent || {};
                      const agentTokens = tokens.filter(tk => tk.agent_name === purchase.agent_name && tk.is_active);
                      return (
                        <div key={purchase.id || i} style={{
                          background: t.surfaceEl, border: `1px solid ${t.border}`,
                          borderRadius: '12px', overflow: 'hidden',
                          animation: `slideUp 0.3s ease ${i * 0.06}s both`,
                        }}>
                          {/* Agent Header */}
                          <div style={{ padding: '18px 18px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '40px', height: '40px', borderRadius: '10px',
                                  background: t.violetM, display: 'flex',
                                  alignItems: 'center', justifyContent: 'center',
                                  fontSize: '16px', fontWeight: '700', color: t.violet,
                                  border: `1px solid rgba(139,92,246,0.3)`,
                                }}>
                                  {(purchase.agent_name || '?').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div style={{ color: t.tp, fontSize: '14px', fontWeight: '600' }}>
                                    {(purchase.agent_name || 'Unknown').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                    {agent.category && (
                                      <span style={{
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                                        fontWeight: '600', background: t.violetG, color: t.violet,
                                        textTransform: 'uppercase', letterSpacing: '0.3px',
                                      }}>
                                        {agent.category}
                                      </span>
                                    )}
                                    {agent.token_symbol && (
                                      <span style={{
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '10px',
                                        fontWeight: '600', fontFamily: t.mono,
                                        background: 'rgba(245,158,11,0.12)', color: t.warning,
                                      }}>
                                        {agent.token_symbol}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div style={{
                                fontFamily: t.mono, fontSize: '13px', fontWeight: '600',
                                color: t.danger, whiteSpace: 'nowrap',
                              }}>
                                -{formatNumber(purchase.price_paid)}
                              </div>
                            </div>

                            {/* Purchase info */}
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              color: t.tm, fontSize: '11px',
                            }}>
                              <span>Purchased {formatDate(purchase.purchased_at)}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Key size={10} /> {agentTokens.length} token{agentTokens.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {/* Token Section */}
                          <div style={{
                            borderTop: `1px solid ${t.border}`, padding: '14px 18px',
                            background: 'rgba(0,0,0,0.15)',
                          }}>
                            {agentTokens.length > 0 && (
                              <div style={{ marginBottom: '10px' }}>
                                {agentTokens.map((tk, j) => (
                                  <div key={tk.id || j} style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    padding: '8px 10px', borderRadius: '6px',
                                    background: t.bg, border: `1px solid ${t.border}`,
                                    marginBottom: j < agentTokens.length - 1 ? '6px' : 0,
                                  }}>
                                    <Hash size={12} color={t.tm} />
                                    <span style={{
                                      flex: 1, fontFamily: t.mono, fontSize: '12px', color: t.ts,
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                      {revealedTokens[tk.id] ? (tk.token_prefix + '...') : (tk.token_prefix?.slice(0, 12) + '...')}
                                    </span>
                                    <button onClick={() => setRevealedTokens(p => ({ ...p, [tk.id]: !p[tk.id] }))}
                                      style={{
                                        background: 'none', border: 'none', color: t.tm,
                                        cursor: 'pointer', padding: '2px', display: 'flex',
                                      }}>
                                      {revealedTokens[tk.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                    <button onClick={() => handleCopyToken(tk.token_prefix)}
                                      style={{
                                        background: 'none', border: 'none', color: t.tm,
                                        cursor: 'pointer', padding: '2px', display: 'flex',
                                      }}>
                                      <Copy size={12} />
                                    </button>
                                    <button onClick={() => handleRevokeToken(tk.id)}
                                      style={{
                                        background: 'none', border: 'none', color: t.danger,
                                        cursor: 'pointer', padding: '2px', display: 'flex', opacity: 0.7,
                                      }}>
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                onClick={() => handleGenerateToken(purchase.agent_name)}
                                disabled={generatingToken === purchase.agent_name}
                                className="wallet-btn"
                                style={{
                                  flex: 1, padding: '8px 12px', borderRadius: '6px',
                                  border: `1px solid ${t.border}`, background: t.surface,
                                  color: t.ts, fontSize: '12px', fontWeight: '500',
                                  cursor: generatingToken === purchase.agent_name ? 'not-allowed' : 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                  opacity: generatingToken === purchase.agent_name ? 0.6 : 1,
                                  transition: 'all 0.15s',
                                }}
                              >
                                {generatingToken === purchase.agent_name
                                  ? <Loader2 size={12} className="spin" />
                                  : <Key size={12} />
                                }
                                Generate Token
                              </button>
                              <button
                                onClick={() => navigate(`/marketplace/${purchase.agent_name}`)}
                                className="wallet-btn"
                                style={{
                                  padding: '8px 12px', borderRadius: '6px',
                                  border: `1px solid ${t.border}`, background: 'transparent',
                                  color: t.tm, fontSize: '12px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  transition: 'all 0.15s',
                                }}
                              >
                                <ExternalLink size={12} /> View
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ===== API TOKENS TAB ===== */}
            {activeTab === 'tokens' && (
              <div>
                {/* Token Header */}
                <div style={{
                  padding: '16px 20px', borderBottom: `1px solid ${t.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ color: t.ts, fontSize: '13px' }}>
                    {tokens.filter(tk => tk.is_active).length} active token{tokens.filter(tk => tk.is_active).length !== 1 ? 's' : ''}
                    {tokens.filter(tk => !tk.is_active).length > 0 && (
                      <span style={{ color: t.tm, marginLeft: '8px' }}>
                        / {tokens.filter(tk => !tk.is_active).length} revoked
                      </span>
                    )}
                  </div>
                </div>

                {tokens.length === 0 ? (
                  <EmptyState
                    icon={Key}
                    title="No API tokens"
                    description="Generate API tokens from your purchased agents to integrate them into your applications."
                  />
                ) : (
                  <div>
                    {/* Column Headers */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 140px 80px 100px 80px 60px 80px',
                      padding: '10px 20px', borderBottom: `1px solid ${t.border}`,
                      fontSize: '11px', fontWeight: '600', color: t.tm,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                    }}>
                      <span>Token</span>
                      <span>Agent</span>
                      <span>Status</span>
                      <span>Created</span>
                      <span>Last Used</span>
                      <span>Usage</span>
                      <span style={{ textAlign: 'right' }}>Actions</span>
                    </div>

                    {tokens.map((tk, i) => (
                      <div
                        key={tk.id || i}
                        className="wallet-row"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 140px 80px 100px 80px 60px 80px',
                          padding: '12px 20px', alignItems: 'center',
                          borderBottom: i < tokens.length - 1 ? `1px solid ${t.border}` : 'none',
                          transition: 'background 0.15s',
                          opacity: tk.is_active ? 1 : 0.5,
                          animation: `slideUp 0.3s ease ${i * 0.03}s both`,
                        }}
                      >
                        {/* Token Prefix */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            background: tk.is_active ? t.violetG : 'rgba(161,161,170,0.08)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Key size={12} color={tk.is_active ? t.violet : t.tm} />
                          </div>
                          <span style={{
                            fontFamily: t.mono, fontSize: '12px', color: t.ts,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {tk.token_prefix || 'guru_****'}...
                          </span>
                        </div>

                        {/* Agent Name */}
                        <span style={{
                          fontSize: '12px', color: t.ts, fontWeight: '500',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {(tk.agent_name || 'Unknown').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </span>

                        {/* Status */}
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '11px', fontWeight: '600',
                          color: tk.is_active ? t.success : t.danger,
                        }}>
                          <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: tk.is_active ? t.success : t.danger,
                            display: 'inline-block',
                          }} />
                          {tk.is_active ? 'Active' : 'Revoked'}
                        </span>

                        {/* Created */}
                        <span style={{ fontSize: '11px', color: t.tm }}>
                          {formatDate(tk.created_at)}
                        </span>

                        {/* Last Used */}
                        <span style={{ fontSize: '11px', color: t.tm }}>
                          {tk.last_used_at ? formatDate(tk.last_used_at) : 'Never'}
                        </span>

                        {/* Usage Count */}
                        <span style={{ fontFamily: t.mono, fontSize: '12px', color: t.ts, fontWeight: '500' }}>
                          {formatNumber(tk.usage_count || 0)}
                        </span>

                        {/* Actions */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end',
                        }}>
                          <button
                            onClick={() => handleCopyToken(tk.token_prefix)}
                            title="Copy token prefix"
                            style={{
                              width: '28px', height: '28px', borderRadius: '6px',
                              background: 'transparent', border: `1px solid ${t.border}`,
                              color: t.tm, cursor: 'pointer', display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <Copy size={12} />
                          </button>
                          {tk.is_active && (
                            <button
                              onClick={() => handleRevokeToken(tk.id)}
                              title="Revoke token"
                              style={{
                                width: '28px', height: '28px', borderRadius: '6px',
                                background: 'transparent', border: '1px solid rgba(239,68,68,0.2)',
                                color: t.danger, cursor: 'pointer', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
