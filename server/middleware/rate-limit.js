const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Strict rate limit for auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
  keyGenerator: ipKeyGenerator,
});

// General API rate limit (per IP)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down' },
  keyGenerator: ipKeyGenerator,
});

// Stricter limit for expensive operations (AI generation, orchestrator)
const heavyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI requests, please wait' },
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),
});

// Upload/import limiter
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please slow down' },
  keyGenerator: (req) => req.user?.userId || ipKeyGenerator(req),
});

module.exports = {
  authLimiter,
  apiLimiter,
  heavyLimiter,
  uploadLimiter,
};
