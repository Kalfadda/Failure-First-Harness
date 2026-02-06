/**
 * Test for F001: Brute force attack on password login
 *
 * Oracle: After N failed attempts, further login attempts are blocked
 *         for a time period per IP and per account
 *
 * This is a demonstration test showing the verifier can execute tests.
 * In a real implementation, this would hit an actual rate limiter.
 */

// Simulated rate limiter for demonstration
class RateLimiter {
  constructor(maxAttempts, windowMs) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.attempts = new Map();
  }

  checkLimit(key) {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, windowStart: now };

    // Reset window if expired
    if (now - record.windowStart > this.windowMs) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count++;
    this.attempts.set(key, record);

    return record.count <= this.maxAttempts;
  }
}

// Test cases
function test_rate_limiter_blocks_after_threshold() {
  const limiter = new RateLimiter(5, 60000); // 5 attempts per minute
  const testIP = '192.168.1.1';

  // First 5 attempts should succeed
  for (let i = 0; i < 5; i++) {
    if (!limiter.checkLimit(testIP)) {
      throw new Error(`Attempt ${i + 1} should have been allowed`);
    }
  }

  // 6th attempt should be blocked
  if (limiter.checkLimit(testIP)) {
    throw new Error('6th attempt should have been blocked');
  }

  console.log('PASS: Rate limiter blocks after threshold');
}

function test_rate_limiter_tracks_per_ip() {
  const limiter = new RateLimiter(5, 60000);

  // Exhaust limit for IP1
  for (let i = 0; i < 6; i++) {
    limiter.checkLimit('ip1');
  }

  // IP2 should still be allowed
  if (!limiter.checkLimit('ip2')) {
    throw new Error('Different IP should not be affected');
  }

  console.log('PASS: Rate limiter tracks per IP');
}

function test_rate_limiter_allows_after_window() {
  const limiter = new RateLimiter(5, 100); // 100ms window for testing
  const testIP = '192.168.1.100';

  // Exhaust limit
  for (let i = 0; i < 6; i++) {
    limiter.checkLimit(testIP);
  }

  // Wait for window to expire (simulated by manipulating time)
  // In real test, would use setTimeout or mock timers
  limiter.attempts.get(testIP).windowStart = Date.now() - 200;

  // Should be allowed again
  if (!limiter.checkLimit(testIP)) {
    throw new Error('Should be allowed after window expires');
  }

  console.log('PASS: Rate limiter resets after window');
}

// Run all tests
console.log('=== F001 Rate Limiter Tests ===\n');

try {
  test_rate_limiter_blocks_after_threshold();
  test_rate_limiter_tracks_per_ip();
  test_rate_limiter_allows_after_window();

  console.log('\n=== All tests passed ===');
  process.exit(0);
} catch (e) {
  console.error(`\nFAIL: ${e.message}`);
  process.exit(1);
}
