const express = require('express');
const db = require('../db');
const { PLAN_LIMITS } = require('../middleware/rbac');

const router = express.Router();

// Lazy-load stripe to avoid crash if key not set
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Plan definitions with Stripe price IDs (set via env vars)
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    stripe_price_id: null,
    ...PLAN_LIMITS.free,
  },
  pro: {
    name: 'Pro',
    price: 29,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || null,
    ...PLAN_LIMITS.pro,
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID || null,
    ...PLAN_LIMITS.enterprise,
  },
};

// GET /api/billing/plans — list available plans
router.get('/plans', (req, res) => {
  res.json(Object.entries(PLANS).map(([id, plan]) => ({
    id,
    name: plan.name,
    price: plan.price,
    max_projects: plan.max_projects,
    max_agents: plan.max_agents,
    max_members: plan.max_members,
    max_storage_mb: plan.max_storage_mb,
  })));
});

// POST /api/billing/checkout — create Stripe checkout session
router.post('/checkout', async (req, res) => {
  try {
    const stripe = getStripe();
    const { organization_id, plan } = req.body;

    if (!organization_id || !plan) {
      return res.status(400).json({ error: 'organization_id and plan are required' });
    }

    if (!PLANS[plan] || plan === 'free') {
      return res.status(400).json({ error: 'Invalid plan' });
    }

    const org = await db.getOrganization(organization_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const role = await db.getUserOrgRole(organization_id, req.user.userId);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only org owner/admin can manage billing' });
    }

    const priceId = PLANS[plan].stripe_price_id;
    if (!priceId) {
      return res.status(503).json({ error: 'Stripe price ID not configured for this plan' });
    }

    // Create or reuse Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const user = await db.getUserById(req.user.userId);
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { organization_id, organization_name: org.name },
      });
      customerId = customer.id;
      await db.updateOrganization(organization_id, { stripe_customer_id: customerId });
    }

    const appUrl = process.env.APP_URL || `https://guru-api-production.up.railway.app`;
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?success=true`,
      cancel_url: `${appUrl}/settings/billing?canceled=true`,
      metadata: { organization_id, plan },
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error('[Billing] Checkout error:', err.message);
    res.status(500).json({ error: 'Billing service error' });
  }
});

// POST /api/billing/portal — create Stripe customer portal session
router.post('/portal', async (req, res) => {
  try {
    const stripe = getStripe();
    const { organization_id } = req.body;

    if (!organization_id) {
      return res.status(400).json({ error: 'organization_id is required' });
    }

    const org = await db.getOrganization(organization_id);
    if (!org) return res.status(404).json({ error: 'Organization not found' });
    if (!org.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account. Subscribe to a plan first.' });
    }

    const role = await db.getUserOrgRole(organization_id, req.user.userId);
    if (role !== 'owner' && role !== 'admin') {
      return res.status(403).json({ error: 'Only org owner/admin can manage billing' });
    }

    const appUrl = process.env.APP_URL || `https://guru-api-production.up.railway.app`;
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${appUrl}/settings/billing`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Billing] Portal error:', err.message);
    res.status(500).json({ error: 'Billing service error' });
  }
});

// GET /api/billing/status/:orgId — get billing status for an org
router.get('/status/:orgId', async (req, res) => {
  try {
    const org = await db.getOrganization(req.params.orgId);
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const role = await db.getUserOrgRole(req.params.orgId, req.user.userId);
    if (!role) return res.status(403).json({ error: 'Not a member' });

    const counts = await db.getOrgResourceCounts(req.params.orgId);
    const plan = org.plan || 'free';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;

    res.json({
      plan,
      plan_name: PLANS[plan]?.name || 'Free',
      stripe_customer_id: (role === 'owner' || role === 'admin') ? org.stripe_customer_id : undefined,
      stripe_subscription_id: (role === 'owner' || role === 'admin') ? org.stripe_subscription_id : undefined,
      limits,
      usage: counts,
    });
  } catch (err) {
    console.error('[Billing] Status error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

// Stripe webhook handler (must be mounted BEFORE json body parser, uses raw body)
module.exports.stripeWebhookHandler = async (req, res) => {
  try {
    const stripe = getStripe();
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
      console.error('[Billing] STRIPE_WEBHOOK_SECRET not set');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error('[Billing] Webhook signature failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orgId = session.metadata?.organization_id;
        const plan = session.metadata?.plan;
        // Validate plan is a known tier before storing
        if (orgId && plan && PLAN_LIMITS[plan]) {
          const limits = PLAN_LIMITS[plan];
          await db.updateOrganization(orgId, {
            plan,
            stripe_subscription_id: session.subscription,
            ...limits,
          });
          console.log(`[Billing] Org ${orgId} upgraded to ${plan}`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const org = await db.getOrganizationBySubscriptionId(subscription.id);
        if (org) {
          if (subscription.status === 'active') {
            console.log(`[Billing] Subscription ${subscription.id} active for org ${org.id}`);
          } else if (subscription.status === 'past_due') {
            console.log(`[Billing] Subscription ${subscription.id} past_due for org ${org.id}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const org = await db.getOrganizationBySubscriptionId(subscription.id);
        if (org) {
          const limits = PLAN_LIMITS.free;
          await db.updateOrganization(org.id, {
            plan: 'free',
            stripe_subscription_id: null,
            ...limits,
          });
          console.log(`[Billing] Org ${org.id} downgraded to free (subscription canceled)`);
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('[Billing] Webhook error:', err.message);
    res.status(500).json({ error: 'Webhook processing error' });
  }
};
