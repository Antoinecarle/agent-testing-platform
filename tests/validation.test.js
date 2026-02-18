import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-create schemas from validate.js for testing
const loginSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(1, 'Password required').max(128),
});

const registerSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  displayName: z.string().max(100).optional().default(''),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format').max(255),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

const kebabCase = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Must be kebab-case').max(100);

describe('Validation: Login Schema', () => {
  it('accepts valid login data', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: 'pass123' });
    expect(result.success).toBe(true);
  });

  it('rejects missing email', () => {
    const result = loginSchema.safeParse({ password: 'pass123' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email format', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'pass123' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'test@test.com', password: '' });
    expect(result.success).toBe(false);
  });

  it('rejects overly long email', () => {
    const longEmail = 'a'.repeat(256) + '@test.com';
    const result = loginSchema.safeParse({ email: longEmail, password: 'pass123' });
    expect(result.success).toBe(false);
  });
});

describe('Validation: Register Schema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'new@user.com',
      password: 'secure123',
      displayName: 'New User',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({
      email: 'new@user.com',
      password: '12345', // Only 5 chars
    });
    expect(result.success).toBe(false);
  });

  it('allows missing displayName with default', () => {
    const result = registerSchema.safeParse({
      email: 'new@user.com',
      password: 'secure123',
    });
    expect(result.success).toBe(true);
    expect(result.data.displayName).toBe('');
  });
});

describe('Validation: Password Reset Schemas', () => {
  it('forgot-password accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@test.com' });
    expect(result.success).toBe(true);
  });

  it('forgot-password rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-email' });
    expect(result.success).toBe(false);
  });

  it('reset-password accepts valid token and password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'some-jwt-token',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(true);
  });

  it('reset-password rejects short password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'some-jwt-token',
      newPassword: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('reset-password rejects empty token', () => {
    const result = resetPasswordSchema.safeParse({
      token: '',
      newPassword: 'newpass123',
    });
    expect(result.success).toBe(false);
  });
});

describe('Validation: Agent Names (kebab-case)', () => {
  it('accepts valid kebab-case names', () => {
    expect(kebabCase.safeParse('my-agent').success).toBe(true);
    expect(kebabCase.safeParse('web-designer-v2').success).toBe(true);
    expect(kebabCase.safeParse('agent123').success).toBe(true);
  });

  it('rejects path traversal attempts', () => {
    expect(kebabCase.safeParse('../../../etc').success).toBe(false);
    expect(kebabCase.safeParse('..\\windows\\system32').success).toBe(false);
  });

  it('rejects spaces, underscores, and capitals', () => {
    expect(kebabCase.safeParse('My Agent').success).toBe(false);
    expect(kebabCase.safeParse('my_agent').success).toBe(false);
    expect(kebabCase.safeParse('MyAgent').success).toBe(false);
  });

  it('rejects names over 100 chars', () => {
    const longName = 'a'.repeat(101);
    expect(kebabCase.safeParse(longName).success).toBe(false);
  });
});
