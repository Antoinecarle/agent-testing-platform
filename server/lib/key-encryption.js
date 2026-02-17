const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const raw = process.env.LLM_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) throw new Error('No encryption key available (set LLM_ENCRYPTION_KEY or JWT_SECRET)');
  // Derive a 32-byte key from whatever string is provided
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypt an API key using AES-256-GCM
 * @param {string} plaintext - The API key to encrypt
 * @returns {string} Format: iv:ciphertext:authTag (all hex)
 */
function encryptApiKey(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt an API key encrypted with encryptApiKey
 * @param {string} blob - Format: iv:ciphertext:authTag (all hex)
 * @returns {string} The decrypted API key
 */
function decryptApiKey(blob) {
  const key = getEncryptionKey();
  const parts = blob.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted key format');
  const [ivHex, cipherHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encryptApiKey, decryptApiKey };
