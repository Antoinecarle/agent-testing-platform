const express = require('express');
const db = require('../db');

const router = express.Router();

// Lazy-load stripe to avoid crash if key not set
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const PLATFORM_FEE_PERCENT = 20;

// POST /api/stripe-connect/onboard — create Express account + return onboarding link
router.post('/onboard', async (req, res) => {
  try {
    const stripe = getStripe();
    const userId = req.user.userId;
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let accountId = user.stripe_connect_account_id;

    if (!accountId) {
      // Create a new Express connected account
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        metadata: { user_id: userId },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      });
      accountId = account.id;
      await db.updateUserStripeConnect(userId, { stripe_connect_account_id: accountId });
    }

    const appUrl = process.env.APP_URL || 'https://guru-api-production.up.railway.app';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/settings?tab=payouts`,
      return_url: `${appUrl}/settings?tab=payouts`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url });
  } catch (err) {
    console.error('[StripeConnect] Onboard error:', err.message);
    res.status(500).json({ error: 'Failed to start onboarding' });
  }
});

// GET /api/stripe-connect/status — get connected account status (live from Stripe)
router.get('/status', async (req, res) => {
  try {
    const userId = req.user.userId;
    const connectData = await db.getUserStripeConnect(userId);

    if (!connectData || !connectData.stripe_connect_account_id) {
      return res.json({ connected: false });
    }

    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(connectData.stripe_connect_account_id);

    // Sync status to DB
    await db.updateUserStripeConnect(userId, {
      stripe_connect_onboarding_complete: account.details_submitted,
      stripe_connect_charges_enabled: account.charges_enabled,
      stripe_connect_payouts_enabled: account.payouts_enabled,
    });

    res.json({
      connected: true,
      account_id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    console.error('[StripeConnect] Status error:', err.message);
    res.status(500).json({ error: 'Failed to get connect status' });
  }
});

// POST /api/stripe-connect/dashboard-link — generate Stripe Express dashboard login link
router.post('/dashboard-link', async (req, res) => {
  try {
    const stripe = getStripe();
    const userId = req.user.userId;
    const connectData = await db.getUserStripeConnect(userId);

    if (!connectData || !connectData.stripe_connect_account_id) {
      return res.status(400).json({ error: 'No Stripe Connect account found' });
    }

    const loginLink = await stripe.accounts.createLoginLink(connectData.stripe_connect_account_id);
    res.json({ url: loginLink.url });
  } catch (err) {
    console.error('[StripeConnect] Dashboard link error:', err.message);
    res.status(500).json({ error: 'Failed to create dashboard link' });
  }
});

// POST /api/stripe-connect/create-payment — create PaymentIntent with application_fee for agent purchase
router.post('/create-payment', async (req, res) => {
  try {
    const stripe = getStripe();
    const buyerUserId = req.user.userId;
    const { agent_name, amount_cents, currency } = req.body;

    if (!agent_name || !amount_cents) {
      return res.status(400).json({ error: 'agent_name and amount_cents are required' });
    }

    // Get the agent to find the seller
    const agent = await db.getAgent(agent_name);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });

    const sellerUserId = agent.created_by;
    if (!sellerUserId) return res.status(400).json({ error: 'Agent has no seller' });

    // Check seller has Stripe Connect
    const sellerConnect = await db.getUserStripeConnect(sellerUserId);
    if (!sellerConnect || !sellerConnect.stripe_connect_account_id || !sellerConnect.stripe_connect_charges_enabled) {
      return res.status(400).json({ error: 'Seller has not connected Stripe' });
    }

    const platformFeeCents = Math.round(amount_cents * (PLATFORM_FEE_PERCENT / 100));
    const cur = currency || 'usd';

    // Create PaymentIntent with application_fee_amount for platform commission
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: cur,
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: sellerConnect.stripe_connect_account_id,
      },
      metadata: {
        buyer_user_id: buyerUserId,
        seller_user_id: sellerUserId,
        agent_name,
      },
    });

    // Record payment in DB
    await db.createConnectPayment({
      buyer_user_id: buyerUserId,
      seller_user_id: sellerUserId,
      agent_name,
      amount_cents,
      platform_fee_cents: platformFeeCents,
      currency: cur,
      stripe_payment_intent_id: paymentIntent.id,
    });

    res.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount_cents,
      platform_fee_cents: platformFeeCents,
    });
  } catch (err) {
    console.error('[StripeConnect] Create payment error:', err.message);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// GET /api/stripe-connect/earnings — seller earnings summary + recent transactions
router.get('/earnings', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [summary, payments] = await Promise.all([
      db.getSellerEarningsSummary(userId),
      db.getSellerPayments(userId, 20),
    ]);
    res.json({ summary, payments });
  } catch (err) {
    console.error('[StripeConnect] Earnings error:', err.message);
    res.status(500).json({ error: 'Failed to get earnings' });
  }
});

// POST /api/stripe-connect/disconnect — remove Stripe Connect account
router.post('/disconnect', async (req, res) => {
  try {
    const userId = req.user.userId;
    await db.updateUserStripeConnect(userId, {
      stripe_connect_account_id: null,
      stripe_connect_onboarding_complete: false,
      stripe_connect_charges_enabled: false,
      stripe_connect_payouts_enabled: false,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[StripeConnect] Disconnect error:', err.message);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

module.exports = router;

// Stripe Connect webhook handler (must be mounted BEFORE json body parser, uses raw body)
module.exports.stripeConnectWebhookHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('[StripeConnect] STRIPE_CONNECT_WEBHOOK_SECRET not set');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[StripeConnect] Webhook signature failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        // Find user by connect account ID and sync status
        const { data: users } = await db.supabase.from('users')
          .select('id')
          .eq('stripe_connect_account_id', account.id)
          .limit(1);
        if (users && users.length > 0) {
          await db.updateUserStripeConnect(users[0].id, {
            stripe_connect_onboarding_complete: account.details_submitted,
            stripe_connect_charges_enabled: account.charges_enabled,
            stripe_connect_payouts_enabled: account.payouts_enabled,
          });
          console.log(`[StripeConnect] Account ${account.id} updated: charges=${account.charges_enabled}, payouts=${account.payouts_enabled}`);
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object;
        const { buyer_user_id, seller_user_id, agent_name } = paymentIntent.metadata || {};

        if (buyer_user_id && agent_name) {
          // Mark payment complete
          const { data: payments } = await db.supabase.from('stripe_connect_payments')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .limit(1);
          if (payments && payments.length > 0) {
            await db.updateConnectPayment(payments[0].id, {
              status: 'completed',
              completed_at: new Date().toISOString(),
            });
          }

          // Create purchase record + generate API token (reuse existing wallet system)
          const alreadyPurchased = await db.hasUserPurchased(buyer_user_id, agent_name);
          if (!alreadyPurchased) {
            await db.purchaseAgent(buyer_user_id, agent_name, 0); // 0 credits since paid with real money
            await db.generateAgentToken(buyer_user_id, agent_name);
          }
          console.log(`[StripeConnect] Payment succeeded: ${agent_name} by user ${buyer_user_id}`);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        const { data: payments } = await db.supabase.from('stripe_connect_payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .limit(1);
        if (payments && payments.length > 0) {
          await db.updateConnectPayment(payments[0].id, { status: 'failed' });
        }
        console.log(`[StripeConnect] Payment failed: ${paymentIntent.id}`);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[StripeConnect] Webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing error' });
  }
};
