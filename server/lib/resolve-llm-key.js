/**
 * LLM Key Resolution Helper
 * Resolves which API key + provider + model to use for a given user request.
 * Priority: user's requested provider key > user's active key > server fallback
 */

const db = require('../db');
const { decryptApiKey } = require('./key-encryption');

const DEFAULT_MODELS = {
  openai: 'gpt-5-mini-2025-08-07',
  anthropic: 'claude-sonnet-4-20250514',
  google: 'gemini-2.5-flash',
};

const SERVER_KEY_ENV = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_AI_API_KEY',
};

/**
 * Resolve the LLM config for a user request.
 * @param {string} userId
 * @param {string} [requestedProvider] - e.g. 'openai', 'anthropic', 'google'
 * @param {string} [requestedModel] - specific model ID override
 * @returns {{ provider: string, model: string, apiKey: string, source: 'user'|'server', keyId?: string }}
 */
async function resolveUserLLMConfig(userId, requestedProvider, requestedModel) {
  // 1. If a specific provider was requested, try to get that key
  if (requestedProvider) {
    const keyRow = await db.getUserLlmKey(userId, requestedProvider);
    if (keyRow && keyRow.encrypted_key) {
      try {
        const apiKey = decryptApiKey(keyRow.encrypted_key);
        // Update last_used timestamp in background
        db.updateUserLlmKeyLastUsed(keyRow.id).catch(() => {});
        return {
          provider: requestedProvider,
          model: requestedModel || keyRow.model || getDefaultModel(requestedProvider),
          apiKey,
          source: 'user',
          keyId: keyRow.id,
        };
      } catch (err) {
        console.warn(`[resolve-llm] Failed to decrypt key for ${requestedProvider}:`, err.message);
        db.updateUserLlmKeyError(keyRow.id, `Decryption failed: ${err.message}`).catch(() => {});
      }
    }
  }

  // 2. No specific provider — try user's active key
  if (!requestedProvider) {
    const activeRow = await db.getActiveUserLlmKey(userId);
    if (activeRow && activeRow.encrypted_key) {
      try {
        const apiKey = decryptApiKey(activeRow.encrypted_key);
        db.updateUserLlmKeyLastUsed(activeRow.id).catch(() => {});
        return {
          provider: activeRow.provider,
          model: requestedModel || activeRow.model || getDefaultModel(activeRow.provider),
          apiKey,
          source: 'user',
          keyId: activeRow.id,
        };
      } catch (err) {
        console.warn(`[resolve-llm] Failed to decrypt active key:`, err.message);
        db.updateUserLlmKeyError(activeRow.id, `Decryption failed: ${err.message}`).catch(() => {});
      }
    }
  }

  // 3. Fallback to any available server key
  for (const [p, envName] of Object.entries(SERVER_KEY_ENV)) {
    if (process.env[envName]) {
      return {
        provider: p,
        model: requestedModel || DEFAULT_MODELS[p],
        apiKey: process.env[envName],
        source: 'server',
      };
    }
  }

  throw new Error('No LLM API key available (no user key configured and no server key set)');
}

function getDefaultModel(provider) {
  return DEFAULT_MODELS[provider] || DEFAULT_MODELS.openai;
}

module.exports = { resolveUserLLMConfig };
