const express = require('express');
const db = require('../db');

const router = express.Router();

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

// POST /api/wallet/deposit — add credits (demo: simulated deposit)
router.post('/deposit', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: 'Invalid amount (1-100000)' });
    }
    const wallet = await db.depositCredits(req.user.userId, amount, 'Credit deposit');
    res.json(wallet);
  } catch (err) {
    console.error('[Wallet] Deposit error:', err.message);
    res.status(500).json({ error: 'Server error' });
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

module.exports = router;
