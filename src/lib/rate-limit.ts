// F001: Rate limiting for brute force protection
// F021: Rate limiting for MFA brute force protection
// F002: Account-level rate limiting for credential stuffing

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
  blockedUntil?: number;
}

// In production, use Redis or similar distributed store
const rateLimitStore = new Map<string, RateLimitEntry>();

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

const configs: Record<string, RateLimitConfig> = {
  // F001: Login attempts per IP
  'login:ip': {
    maxAttempts: parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5'),
    windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000'), // 15 min
    blockDurationMs: 900000 // 15 min block
  },
  // F002: Login attempts per account (prevents credential stuffing)
  'login:account': {
    maxAttempts: 5,
    windowMs: 3600000, // 1 hour
    blockDurationMs: 3600000 // 1 hour block
  },
  // F021: MFA attempts
  'mfa:ip': {
    maxAttempts: parseInt(process.env.RATE_LIMIT_MFA_MAX || '3'),
    windowMs: parseInt(process.env.RATE_LIMIT_MFA_WINDOW_MS || '300000'), // 5 min
    blockDurationMs: 1800000 // 30 min block
  },
  // F021: MFA attempts per account
  'mfa:account': {
    maxAttempts: 5,
    windowMs: 600000, // 10 min
    blockDurationMs: 3600000 // 1 hour block
  }
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  blockedUntil?: number;
}

function getKey(type: string, identifier: string): string {
  return `${type}:${identifier}`;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(type: string, identifier: string): RateLimitResult {
  const config = configs[type];
  if (!config) {
    throw new Error(`Unknown rate limit type: ${type}`);
  }

  const key = getKey(type, identifier);
  const now = Date.now();

  // Periodic cleanup
  if (Math.random() < 0.01) cleanupExpired();

  let entry = rateLimitStore.get(key);

  // Check if currently blocked
  if (entry?.blocked && entry.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      blockedUntil: entry.blockedUntil
    };
  }

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
      blocked: false
    };
  }

  // Check if would exceed limit
  if (entry.count >= config.maxAttempts) {
    entry.blocked = true;
    entry.blockedUntil = now + config.blockDurationMs;
    rateLimitStore.set(key, entry);

    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      blockedUntil: entry.blockedUntil
    };
  }

  return {
    allowed: true,
    remaining: config.maxAttempts - entry.count,
    resetAt: entry.resetAt
  };
}

export function recordAttempt(type: string, identifier: string): void {
  const config = configs[type];
  if (!config) return;

  const key = getKey(type, identifier);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    entry = {
      count: 1,
      resetAt: now + config.windowMs,
      blocked: false
    };
  } else {
    entry.count++;
  }

  rateLimitStore.set(key, entry);
}

export function resetRateLimit(type: string, identifier: string): void {
  const key = getKey(type, identifier);
  rateLimitStore.delete(key);
}
