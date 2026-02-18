import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { X, Loader2, CreditCard, Check, AlertCircle } from 'lucide-react';
import { api } from '../api';

const t = {
  bg: '#0f0f0f', surface: '#1a1a1b', surfaceEl: '#242426',
  border: 'rgba(255,255,255,0.08)', borderS: 'rgba(255,255,255,0.15)',
  violet: '#8B5CF6', violetM: 'rgba(139,92,246,0.2)', violetG: 'rgba(139,92,246,0.12)',
  tp: '#F4F4F5', ts: '#A1A1AA', tm: '#52525B',
  success: '#22c55e', warning: '#f59e0b', danger: '#ef4444',
  mono: '"JetBrains Mono","Fira Code",monospace',
};

// Lazily load stripe - publishable key injected as global env
let stripePromise = null;
function getStripePromise() {
  if (!stripePromise) {
    // Vite env variable
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
    if (key) stripePromise = loadStripe(key);
  }
  return stripePromise;
}

function CheckoutForm({ onSuccess, onError, agentName, amountCents, paymentIntentId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    const appUrl = window.location.origin;
    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${appUrl}/marketplace/${encodeURIComponent(agentName)}?payment=success`,
      },
      redirect: 'if_required',
    });

    if (submitError) {
      setError(submitError.message);
      setProcessing(false);
      if (onError) onError(submitError.message);
    } else {
      // Payment succeeded — verify and record purchase on server
      try {
        await api('/api/stripe-connect/verify-payment', {
          method: 'POST',
          body: JSON.stringify({ payment_intent_id: paymentIntentId }),
        });
      } catch (verifyErr) {
        console.warn('[StripePayment] verify-payment call failed (webhook will handle):', verifyErr.message);
      }
      if (onSuccess) onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: '8px', marginTop: '16px',
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <AlertCircle size={14} style={{ color: t.danger, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: t.danger }}>{error}</span>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || processing}
        style={{
          width: '100%', marginTop: '20px', padding: '12px', borderRadius: '10px',
          fontSize: '13px', fontWeight: '700', cursor: processing ? 'wait' : 'pointer',
          background: `linear-gradient(135deg, ${t.violet}, #a78bfa)`,
          color: '#fff', border: 'none',
          opacity: (!stripe || processing) ? 0.6 : 1,
          boxShadow: `0 4px 16px rgba(139,92,246,0.3)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        {processing ? (
          <>
            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            Processing...
          </>
        ) : (
          <>
            <CreditCard size={14} />
            Pay ${(amountCents / 100).toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}

export default function StripePaymentModal({ isOpen, onClose, onSuccess, agentName, agentDisplayName, amountCents, priceCurrency }) {
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !agentName || !amountCents) return;
    setLoading(true);
    setError(null);
    setClientSecret(null);
    setPaymentIntentId(null);

    api('/api/stripe-connect/create-payment', {
      method: 'POST',
      body: JSON.stringify({
        agent_name: agentName,
        amount_cents: amountCents,
        currency: priceCurrency || 'usd',
      }),
    })
      .then((data) => {
        setClientSecret(data.client_secret);
        setPaymentIntentId(data.payment_intent_id);
      })
      .catch((err) => {
        setError(err.message || 'Failed to create payment');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, agentName, amountCents, priceCurrency]);

  if (!isOpen) return null;

  const stripeP = getStripePromise();
  const platformFee = Math.round(amountCents * 0.2);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: t.surface, border: `1px solid ${t.violet}40`, borderRadius: '16px',
        padding: '32px', maxWidth: '460px', width: '100%',
        boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${t.violetG}`,
        position: 'relative',
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', color: t.tm,
            cursor: 'pointer', padding: '4px',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 16px',
            background: t.violetG, border: `1px solid ${t.violet}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CreditCard size={24} style={{ color: t.violet }} />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px 0', color: t.tp }}>
            Purchase {agentDisplayName || agentName}
          </h3>
          <p style={{ fontSize: '13px', color: t.ts, margin: 0 }}>
            Secure payment via Stripe
          </p>
        </div>

        {/* Price breakdown */}
        <div style={{
          padding: '14px 16px', borderRadius: '10px', marginBottom: '20px',
          background: t.surfaceEl, border: `1px solid ${t.border}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', color: t.ts }}>Agent price</span>
            <span style={{ fontSize: '12px', fontWeight: '700', color: t.tp, fontFamily: t.mono }}>
              ${(amountCents / 100).toFixed(2)}
            </span>
          </div>
          <div style={{ height: '1px', background: t.border, margin: '8px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: t.ts }}>Total</span>
            <span style={{ fontSize: '14px', fontWeight: '700', fontFamily: t.mono, color: t.violet }}>
              ${(amountCents / 100).toFixed(2)} {(priceCurrency || 'usd').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Payment form */}
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: t.ts }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
            <div style={{ fontSize: '12px' }}>Preparing payment...</div>
          </div>
        )}

        {error && (
          <div style={{
            padding: '14px', borderRadius: '8px',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <AlertCircle size={14} style={{ color: t.danger, flexShrink: 0 }} />
            <span style={{ fontSize: '12px', color: t.danger }}>{error}</span>
          </div>
        )}

        {clientSecret && stripeP && (
          <Elements
            stripe={stripeP}
            options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: t.violet,
                  colorBackground: t.bg,
                  colorText: t.tp,
                  colorDanger: t.danger,
                  borderRadius: '6px',
                  fontFamily: 'Inter, sans-serif',
                  fontSizeBase: '13px',
                },
              },
            }}
          >
            <CheckoutForm
              onSuccess={() => { if (onSuccess) onSuccess(); }}
              onError={(msg) => setError(msg)}
              agentName={agentName}
              amountCents={amountCents}
              paymentIntentId={paymentIntentId}
            />
          </Elements>
        )}

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
