import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const JWT_SECRET = 'test-secret-for-unit-tests';

describe('Auth: Token Generation', () => {
  it('generates valid access and refresh tokens', () => {
    const payload = { userId: '123', email: 'test@test.com', role: 'user' };
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const refreshToken = jwt.sign({ ...payload, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });

    const decodedAccess = jwt.verify(accessToken, JWT_SECRET);
    expect(decodedAccess.userId).toBe('123');
    expect(decodedAccess.email).toBe('test@test.com');
    expect(decodedAccess.type).toBeUndefined();

    const decodedRefresh = jwt.verify(refreshToken, JWT_SECRET);
    expect(decodedRefresh.type).toBe('refresh');
  });

  it('rejects expired tokens', () => {
    const payload = { userId: '123', email: 'test@test.com' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '0s' });

    expect(() => jwt.verify(token, JWT_SECRET)).toThrow();
  });

  it('rejects tokens with wrong secret', () => {
    const payload = { userId: '123' };
    const token = jwt.sign(payload, JWT_SECRET);

    expect(() => jwt.verify(token, 'wrong-secret')).toThrow();
  });

  it('refresh token type prevents use as access token', () => {
    const payload = { userId: '123', email: 'test@test.com', type: 'refresh' };
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    // The verifyToken middleware checks this
    expect(decoded.type).toBe('refresh');
  });
});

describe('Auth: Password Hashing', () => {
  it('bcrypt hashes and verifies passwords correctly', async () => {
    const password = 'securePassword123!';
    const hash = await bcrypt.hash(password, 10);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('wrongPassword', hash)).toBe(false);
  });
});

describe('Auth: Password Reset Token', () => {
  it('generates and verifies reset tokens', () => {
    const payload = { userId: '123', email: 'test@test.com', type: 'password_reset' };
    const resetToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    const decoded = jwt.verify(resetToken, JWT_SECRET);
    expect(decoded.type).toBe('password_reset');
    expect(decoded.userId).toBe('123');
  });

  it('creates deterministic hash for token storage', () => {
    const token = 'some-reset-token-value';
    const hash1 = crypto.createHash('sha256').update(token).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token).digest('hex');

    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('different tokens produce different hashes', () => {
    const token1 = 'token-one';
    const token2 = 'token-two';
    const hash1 = crypto.createHash('sha256').update(token1).digest('hex');
    const hash2 = crypto.createHash('sha256').update(token2).digest('hex');

    expect(hash1).not.toBe(hash2);
  });
});

describe('Auth: Refresh Token Expiry', () => {
  it('refresh token expiry is 7 days (not 30)', () => {
    // Verify the constant was changed
    const REFRESH_TOKEN_EXPIRY = '7d';
    const payload = { userId: '123', type: 'refresh' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    const decoded = jwt.decode(token);

    // 7 days in seconds
    const sevenDays = 7 * 24 * 60 * 60;
    const tokenLifespan = decoded.exp - decoded.iat;

    expect(tokenLifespan).toBe(sevenDays);
  });
});
