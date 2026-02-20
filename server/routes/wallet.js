const express = require('express');
const db = require('../db');
const { encryptApiKey, decryptApiKey } = require('../lib/key-encryption');
const { testProviderKey, fetchProviderModels, PROVIDER_CONFIGS } = require('../lib/llm-providers');

const router = express.Router();

// Lazy-load stripe to avoid crash if key not set
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Stripe is not configured. Set STRIPE_SECRET_KEY environment variable.');
  }
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

// Credit packages: 1 credit = $0.01
const CREDIT_PACKAGES = [
  { credits: 500, price_cents: 500, label: 'Starter' },
  { credits: 2000, price_cents: 2000, label: 'Popular' },
  { credits: 5000, price_cents: 5000, label: 'Pro' },
  { credits: 10000, price_cents: 10000, label: 'Enterprise' },
];

// GET /api/wallet — get user wallet
router.get('/', async (req, res) => {
  try {
    const wallet = await db.getOrCreateWallet(req.user.userId);
    res.json(wallet);
  } catch (err) {
    console.error('[Wallet] Get error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/deposit — create Stripe Checkout session to purchase credits
router.post('/deposit', async (req, res) => {
  try {
    const stripe = getStripe();
    const { amount } = req.body;
    if (!amount || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: 'Invalid amount (1-100000)' });
    }

    const credits = Number(amount);
    const priceCents = credits; // 1 credit = 1 cent

    // Determine origin for redirect URLs
    const origin = req.headers.origin || req.headers.referer?.replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: priceCents,
          product_data: {
            name: `${credits.toLocaleString()} GURU Credits`,
            description: `Purchase ${credits.toLocaleString()} credits for the GURU platform`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        user_id: req.user.userId,
        credits_amount: String(credits),
      },
      success_url: `${origin}/wallet?purchase=success`,
      cancel_url: `${origin}/wallet?purchase=canceled`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Wallet] Deposit error:', err.message);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// GET /api/wallet/transactions — list transactions
router.get('/transactions', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const transactions = await db.getWalletTransactions(req.user.userId, limit);
    res.json(transactions);
  } catch (err) {
    console.error('[Wallet] Transactions error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wallet/purchases — list user's purchased agents
router.get('/purchases', async (req, res) => {
  try {
    const purchases = await db.getUserPurchases(req.user.userId);
    // Enrich with agent info
    const enriched = await Promise.all(purchases.map(async (p) => {
      const agent = await db.getAgent(p.agent_name);
      return {
        ...p,
        agent: agent ? { name: agent.name, description: agent.description, category: agent.category, model: agent.model, token_symbol: agent.token_symbol } : null,
      };
    }));
    res.json(enriched);
  } catch (err) {
    console.error('[Wallet] Purchases error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wallet/tokens — list all user API tokens
router.get('/tokens', async (req, res) => {
  try {
    const tokens = await db.getUserApiTokens(req.user.userId);
    res.json(tokens);
  } catch (err) {
    console.error('[Wallet] Tokens error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/tokens/:agentName/generate — generate new token for purchased agent
router.post('/tokens/:agentName/generate', async (req, res) => {
  try {
    const hasPurchased = await db.hasUserPurchased(req.user.userId, req.params.agentName);
    if (!hasPurchased) {
      return res.status(403).json({ error: 'You must purchase this agent first' });
    }
    const token = await db.generateAgentToken(req.user.userId, req.params.agentName);
    res.json(token);
  } catch (err) {
    console.error('[Wallet] Generate token error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/wallet/tokens/:tokenId — revoke a token
router.delete('/tokens/:tokenId', async (req, res) => {
  try {
    await db.revokeApiToken(req.params.tokenId, req.user.userId);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Wallet] Revoke token error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===================== LLM KEYS (BYOK) =====================

// GET /api/wallet/llm-keys — list user's configured LLM keys (metadata only, no encrypted_key)
router.get('/llm-keys', async (req, res) => {
  try {
    const keys = await db.getUserLlmKeys(req.user.userId);
    res.json(keys);
  } catch (err) {
    console.error('[Wallet] LLM keys list error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/wallet/llm-providers — list providers with live models fetched from APIs
router.get('/llm-providers', async (req, res) => {
  const SERVER_KEY_ENV = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', google: 'GOOGLE_AI_API_KEY' };

  // Also check user's own BYOK keys
  let userKeys = [];
  try {
    userKeys = await db.getUserLlmKeys(req.user.userId);
  } catch (_) {}

  const enriched = {};
  const fetchPromises = [];

  for (const [provId, cfg] of Object.entries(PROVIDER_CONFIGS)) {
    const serverKey = process.env[SERVER_KEY_ENV[provId]];
    const userKey = userKeys.find(k => k.provider === provId);
    let apiKeyForFetch = null;

    // Use user's key if available, else server key, to fetch live models
    if (userKey && userKey.encrypted_key) {
      try { apiKeyForFetch = decryptApiKey(userKey.encrypted_key); } catch (_) {}
    }
    if (!apiKeyForFetch && serverKey) {
      apiKeyForFetch = serverKey;
    }

    enriched[provId] = {
      name: cfg.name,
      keyPrefix: cfg.keyPrefix,
      models: cfg.models, // static fallback
      hasServerKey: !!serverKey,
    };

    if (apiKeyForFetch) {
      fetchPromises.push(
        fetchProviderModels(provId, apiKeyForFetch)
          .then(liveModels => {
            if (liveModels && liveModels.length > 0) {
              enriched[provId].models = liveModels;
            }
          })
          .catch(() => {}) // keep static fallback on error
      );
    }
  }

  // Fetch all providers in parallel, with 5s timeout
  await Promise.race([
    Promise.all(fetchPromises),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);

  res.json(enriched);
});

// POST /api/wallet/llm-keys/:provider/models — fetch available models from provider API
router.post('/llm-keys/:provider/models', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!PROVIDER_CONFIGS[provider]) {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
    const { apiKey } = req.body;
    if (!apiKey) {
      return res.status(400).json({ error: 'apiKey is required' });
    }
    const models = await fetchProviderModels(provider, apiKey);
    res.json({ provider, models });
  } catch (err) {
    console.error('[Wallet] Fetch models error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to fetch models' });
  }
});

// PUT /api/wallet/llm-keys/:provider — save/update an LLM key
router.put('/llm-keys/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!PROVIDER_CONFIGS[provider]) {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
    const { apiKey, model, displayName } = req.body;
    if (!apiKey || !model) {
      return res.status(400).json({ error: 'apiKey and model are required' });
    }
    // Model validation: accept any model string (since user can fetch dynamic models)
    const encrypted = encryptApiKey(apiKey);
    await db.upsertUserLlmKey(req.user.userId, provider, encrypted, model, displayName || '');
    res.json({ ok: true, provider, model });
  } catch (err) {
    console.error('[Wallet] LLM key save error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/wallet/llm-keys/:provider — remove an LLM key
router.delete('/llm-keys/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    await db.deleteUserLlmKey(req.user.userId, provider);
    res.json({ ok: true });
  } catch (err) {
    console.error('[Wallet] LLM key delete error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/llm-keys/:provider/activate — set provider as active
router.post('/llm-keys/:provider/activate', async (req, res) => {
  try {
    const { provider } = req.params;
    const result = await db.setActiveUserLlmKey(req.user.userId, provider);
    if (!result) {
      return res.status(404).json({ error: `No key found for provider: ${provider}` });
    }
    res.json({ ok: true, active: result });
  } catch (err) {
    console.error('[Wallet] Activate provider error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/wallet/llm-keys/:provider/test — test a key without saving
router.post('/llm-keys/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    if (!PROVIDER_CONFIGS[provider]) {
      return res.status(400).json({ error: `Unsupported provider: ${provider}` });
    }
    const { apiKey, model } = req.body;
    if (!apiKey || !model) {
      return res.status(400).json({ error: 'apiKey and model are required' });
    }
    const result = await testProviderKey(provider, apiKey, model);
    res.json(result);
  } catch (err) {
    console.error('[Wallet] LLM key test error:', err.message);
    res.status(400).json({ error: err.message || 'Key test failed' });
  }
});

// Stripe webhook handler for wallet credit purchases (mounted before JSON parser in index.js)
async function stripeWalletWebhookHandler(req, res) {
  let stripe;
  try {
    stripe = getStripe();
  } catch (err) {
    console.error('[Wallet Webhook] Stripe not configured:', err.message);
    return res.status(500).send('Stripe not configured');
  }
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WALLET_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Wallet Webhook] STRIPE_WALLET_WEBHOOK_SECRET not set');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Wallet Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const creditsAmount = parseInt(session.metadata?.credits_amount, 10);

    if (!userId || !creditsAmount || isNaN(creditsAmount)) {
      console.error('[Wallet Webhook] Missing metadata:', session.metadata);
      return res.status(400).send('Missing metadata');
    }

    try {
      await db.depositCredits(userId, creditsAmount, 'Stripe purchase');
      console.log(`[Wallet Webhook] Deposited ${creditsAmount} credits for user ${userId}`);
    } catch (err) {
      console.error('[Wallet Webhook] Deposit failed:', err.message);
      return res.status(500).send('Deposit failed');
    }
  }

  res.json({ received: true });
}

router.stripeWalletWebhookHandler = stripeWalletWebhookHandler;
module.exports = router;
