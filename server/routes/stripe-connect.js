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

// POST /api/stripe-connect/onboard — create Custom account (in-app onboarding, no redirect)
router.post('/onboard', async (req, res) => {
  try {
    const stripe = getStripe();
    const userId = req.user.userId;
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // If already has a fully onboarded account, return early
    if (user.stripe_connect_account_id) {
      try {
        const existing = await stripe.accounts.retrieve(user.stripe_connect_account_id);
        if (existing.details_submitted) {
          return res.json({ already_connected: true, account_id: existing.id });
        }
        // Delete incomplete account to recreate
        await stripe.accounts.del(user.stripe_connect_account_id);
        await db.updateUserStripeConnect(userId, { stripe_connect_account_id: null });
      } catch (e) {
        // Account doesn't exist on Stripe anymore, clear it
        await db.updateUserStripeConnect(userId, { stripe_connect_account_id: null });
      }
    }

    const {
      business_type = 'individual',
      first_name, last_name,
      dob_day, dob_month, dob_year,
      address_line1, address_city, address_postal_code, address_country,
      iban,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    if (!address_line1 || !address_city || !address_postal_code || !address_country) {
      return res.status(400).json({ error: 'Complete address is required' });
    }
    if (!iban) {
      return res.status(400).json({ error: 'IBAN / account number is required' });
    }

    const country = address_country.toUpperCase();
    const email = user.email;

    // Create account token (required for platforms to set individual details + TOS)
    const tokenData = {
      business_type,
      individual: {
        first_name,
        last_name,
        email,
        address: {
          line1: address_line1,
          city: address_city,
          postal_code: address_postal_code,
          country,
        },
      },
      tos_shown_and_accepted: true,
    };
    if (dob_day && dob_month && dob_year) {
      tokenData.individual.dob = {
        day: parseInt(dob_day),
        month: parseInt(dob_month),
        year: parseInt(dob_year),
      };
    }

    const accountToken = await stripe.tokens.create({ account: tokenData });

    // Derive bank country from IBAN (first 2 chars)
    const bankCountry = iban.substring(0, 2).toUpperCase();
    const isIban = /^[A-Z]{2}\d{2}/.test(iban.toUpperCase());
    const currency = ['GB'].includes(bankCountry) ? 'gbp' : ['US'].includes(bankCountry) ? 'usd' : 'eur';

    // Create Custom connected account
    const account = await stripe.accounts.create({
      type: 'custom',
      country,
      email,
      account_token: accountToken.id,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      external_account: {
        object: 'bank_account',
        country: isIban ? bankCountry : country,
        currency,
        account_number: iban,
        account_holder_name: `${first_name} ${last_name}`,
        account_holder_type: business_type === 'company' ? 'company' : 'individual',
      },
      metadata: { user_id: userId },
    });

    // Save to DB
    await db.updateUserStripeConnect(userId, {
      stripe_connect_account_id: account.id,
      stripe_connect_onboarding_complete: account.details_submitted,
      stripe_connect_charges_enabled: account.charges_enabled,
      stripe_connect_payouts_enabled: account.payouts_enabled,
    });

    res.json({
      success: true,
      account_id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    });
  } catch (err) {
    console.error('[StripeConnect] Onboard error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to create account' });
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

// POST /api/stripe-connect/dashboard-link — generate dashboard link (Express only, Custom accounts managed in-app)
router.post('/dashboard-link', async (req, res) => {
  try {
    const stripe = getStripe();
    const userId = req.user.userId;
    const connectData = await db.getUserStripeConnect(userId);

    if (!connectData || !connectData.stripe_connect_account_id) {
      return res.status(400).json({ error: 'No Stripe Connect account found' });
    }

    // Check account type - login links only work for Express accounts
    const account = await stripe.accounts.retrieve(connectData.stripe_connect_account_id);
    if (account.type === 'custom') {
      return res.json({ type: 'custom', message: 'Custom accounts are managed in-app. Payouts are handled automatically by Stripe.' });
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

// POST /api/stripe-connect/verify-payment — verify payment succeeded and record purchase (called by client after confirmPayment)
router.post('/verify-payment', async (req, res) => {
  try {
    const stripe = getStripe();
    const buyerUserId = req.user.userId;
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({ error: 'payment_intent_id is required' });
    }

    // Retrieve PaymentIntent from Stripe to verify it actually succeeded
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: `Payment not succeeded (status: ${paymentIntent.status})` });
    }

    const { buyer_user_id, seller_user_id, agent_name } = paymentIntent.metadata || {};

    // Security: verify the buyer matches the authenticated user
    if (buyer_user_id !== buyerUserId) {
      return res.status(403).json({ error: 'Payment does not belong to this user' });
    }

    if (!agent_name) {
      return res.status(400).json({ error: 'No agent_name in payment metadata' });
    }

    // Mark payment as completed in DB
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

    // Create purchase record + generate API token (idempotent)
    const alreadyPurchased = await db.hasUserPurchased(buyer_user_id, agent_name);
    if (!alreadyPurchased) {
      await db.purchaseAgent(buyer_user_id, agent_name, 0); // 0 credits since paid with real money
      await db.generateAgentToken(buyer_user_id, agent_name);
    }

    console.log(`[StripeConnect] Payment verified & purchase recorded: ${agent_name} by user ${buyer_user_id}`);
    res.json({ success: true, agent_name, purchased: true });
  } catch (err) {
    console.error('[StripeConnect] Verify payment error:', err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
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
