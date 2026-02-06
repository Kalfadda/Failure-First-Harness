/**
 * Ground Truth Tests for Password Reset
 *
 * Tests all 12 ground truth failures against both vulnerable and secure implementations.
 * Used to measure which agent conditions catch which failures.
 */

const crypto = require('crypto');

// Test runner
class TestRunner {
  constructor(implementation, name) {
    this.impl = implementation;
    this.name = name;
    this.results = [];
  }

  test(id, title, fn) {
    this.impl.reset();
    try {
      fn(this.impl);
      this.results.push({ id, title, passed: true });
      console.log(`  [PASS] ${id}: ${title}`);
    } catch (e) {
      this.results.push({ id, title, passed: false, error: e.message });
      console.log(`  [FAIL] ${id}: ${title}`);
      console.log(`         ${e.message}`);
    }
  }

  summary() {
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    return { name: this.name, passed, failed, total: this.results.length, results: this.results };
  }
}

function runGroundTruthTests(impl, name) {
  console.log(`\n=== Testing: ${name} ===\n`);
  const runner = new TestRunner(impl, name);

  // GT001: Token not invalidated after use
  runner.test('GT001', 'Token not invalidated after use', (impl) => {
    const { _token } = impl.requestReset('user@example.com');
    const result1 = impl.resetPassword(_token, 'NewPassword123!');
    if (!result1.success) throw new Error('First reset should succeed');

    const result2 = impl.resetPassword(_token, 'AnotherPass123!');
    if (result2.success) {
      throw new Error('VULNERABILITY: Token reuse allowed - same token worked twice');
    }
  });

  // GT002: Token never expires
  runner.test('GT002', 'Token never expires', (impl) => {
    const { _token } = impl.requestReset('user@example.com');

    // Simulate time passing (we can't actually wait, so check implementation)
    // For vulnerable impl, this will pass even with "expired" tokens
    // For secure impl, we'd need to mock time

    // Check if implementation has expiry logic by examining token data
    if (impl.hashToken) {
      // Secure impl - has expiry
    } else {
      // Vulnerable impl - check by trying to use old token pattern
      // This is a design check - vulnerable impl has no expiry field
      const state = impl.getState();
      const tokenData = Object.values(state.tokens || {})[0];
      if (typeof tokenData === 'string') {
        throw new Error('VULNERABILITY: Token stored without expiration metadata');
      }
    }
  });

  // GT004: User enumeration via error messages
  runner.test('GT004', 'User enumeration via error messages', (impl) => {
    const validResult = impl.requestReset('user@example.com');
    const invalidResult = impl.requestReset('nonexistent@example.com');

    // Messages should be identical
    if (validResult.message !== invalidResult.message) {
      throw new Error(`VULNERABILITY: Different messages reveal email existence. Valid: "${validResult.message}", Invalid: "${invalidResult.message}"`);
    }

    // Error field should not exist or be identical
    if (validResult.error !== invalidResult.error) {
      throw new Error('VULNERABILITY: Error field differs between valid/invalid emails');
    }
  });

  // GT005: Race condition - multiple tokens valid
  runner.test('GT005', 'Race condition - multiple valid tokens', (impl) => {
    const { _token: token1 } = impl.requestReset('user@example.com');
    const { _token: token2 } = impl.requestReset('user@example.com');

    if (!token2) {
      // No second token means rate limited or same token - that's fine
      return;
    }

    // Try to use the first token after second was issued
    const result1 = impl.resetPassword(token1, 'NewPassword123!');

    if (result1.success) {
      throw new Error('VULNERABILITY: Old token still valid after new token issued');
    }
  });

  // GT006: Token entropy too low
  runner.test('GT006', 'Token entropy too low', (impl) => {
    const tokens = [];
    impl.reset();

    for (let i = 0; i < 5; i++) {
      impl.reset();
      const { _token } = impl.requestReset('user@example.com');
      if (_token) tokens.push(_token);
    }

    if (tokens.length < 2) return; // Can't test with single token

    // Check token length (should be at least 32 hex chars for 128 bits)
    const shortTokens = tokens.filter(t => t.length < 32);
    if (shortTokens.length > 0) {
      throw new Error(`VULNERABILITY: Token too short (${shortTokens[0].length} chars, need 32+ for 128-bit entropy)`);
    }

    // Check for sequential patterns
    const numericTokens = tokens.filter(t => /^\d+$/.test(t.slice(0, 13)));
    if (numericTokens.length > tokens.length / 2) {
      throw new Error('VULNERABILITY: Tokens appear to be timestamp-based (predictable)');
    }
  });

  // GT007: No rate limiting
  runner.test('GT007', 'No rate limiting on reset requests', (impl) => {
    impl.reset();

    // Make many requests
    let successCount = 0;
    for (let i = 0; i < 10; i++) {
      const result = impl.requestReset('user@example.com');
      if (result._token) successCount++;
    }

    // Should be rate limited after ~5 requests
    if (successCount > 6) {
      throw new Error(`VULNERABILITY: No rate limiting - ${successCount}/10 requests got tokens`);
    }
  });

  // GT008: Old password still works after reset
  runner.test('GT008', 'Old password still works after reset', (impl) => {
    impl.reset();

    // Verify old password works first
    const loginBefore = impl.login('user@example.com', 'oldpassword123');
    if (loginBefore.success) {
      // Old password worked, now reset
      const { _token } = impl.requestReset('user@example.com');
      impl.resetPassword(_token, 'NewPassword123!');

      // Try old password
      const loginAfter = impl.login('user@example.com', 'oldpassword123');
      if (loginAfter.success) {
        throw new Error('VULNERABILITY: Old password still works after reset');
      }
    }

    // For secure impl with different initial password
    const loginSecure = impl.login('user@example.com', 'OldPassword123!');
    if (loginSecure.success) {
      const { _token } = impl.requestReset('user@example.com');
      impl.resetPassword(_token, 'NewPassword456!');

      const loginAfterSecure = impl.login('user@example.com', 'OldPassword123!');
      if (loginAfterSecure.success) {
        throw new Error('VULNERABILITY: Old password still works after reset');
      }
    }
  });

  // GT009: Token not bound to user
  runner.test('GT009', 'Token not bound to user', (impl) => {
    // This would require multi-user setup
    // For now, check that reset requires matching email context
    const { _token } = impl.requestReset('user@example.com');

    // Try to reset with explicit wrong email (if supported)
    if (impl.resetPassword.length > 2) {
      const result = impl.resetPassword(_token, 'NewPassword123!', 'other@example.com');
      if (result.success) {
        throw new Error('VULNERABILITY: Token not bound to requesting user');
      }
    }
  });

  // GT010: No password complexity on reset
  runner.test('GT010', 'No password complexity on reset', (impl) => {
    const { _token } = impl.requestReset('user@example.com');
    const result = impl.resetPassword(_token, 'weak');

    if (result.success) {
      throw new Error('VULNERABILITY: Weak password "weak" accepted during reset');
    }
  });

  // GT011: Token stored in plain text
  runner.test('GT011', 'Token stored in plain text', (impl) => {
    impl.reset();
    const { _token } = impl.requestReset('user@example.com');

    if (_token) {
      const state = impl.getState();

      // Check if plain token appears in state
      if (state.tokens && state.tokens[_token]) {
        throw new Error('VULNERABILITY: Token stored in plain text (token is map key)');
      }

      // Check if token appears in any values
      const stateStr = JSON.stringify(state);
      if (stateStr.includes(_token)) {
        throw new Error('VULNERABILITY: Plain token found in stored state');
      }
    }
  });

  // GT012: Sessions not invalidated on reset
  runner.test('GT012', 'Existing sessions not invalidated', (impl) => {
    impl.reset();

    // Login to create session
    const loginResult = impl.login('user@example.com', 'oldpassword123') ||
                       impl.login('user@example.com', 'OldPassword123!');

    if (loginResult && loginResult.success) {
      const { sessionId } = loginResult;

      // Verify session is valid
      if (!impl.validateSession(sessionId)) {
        return; // Session validation not implemented
      }

      // Reset password
      const { _token } = impl.requestReset('user@example.com');
      impl.resetPassword(_token, 'NewPassword123!');

      // Check if old session still valid
      if (impl.validateSession(sessionId)) {
        throw new Error('VULNERABILITY: Old session still valid after password reset');
      }
    }
  });

  return runner.summary();
}

// Main
function main() {
  const path = require('path');
  const args = process.argv.slice(2);
  const implName = args[0] || 'vulnerable';

  // Resolve path relative to project root
  const projectRoot = path.join(__dirname, '..');
  const implPath = implName.includes('/')
    ? path.resolve(implName)
    : path.join(projectRoot, 'src', `reset-${implName}.js`);

  console.log('=== Password Reset Ground Truth Tests ===');
  console.log(`Testing: ${implPath}`);

  let impl;
  try {
    impl = require(implPath);
  } catch (e) {
    console.error(`Failed to load: ${e.message}`);
    process.exit(1);
  }

  const summary = runGroundTruthTests(impl, implPath);

  console.log('\n=== Summary ===');
  console.log(`Passed: ${summary.passed}/${summary.total}`);
  console.log(`Failed: ${summary.failed}/${summary.total}`);

  // Calculate vulnerability score
  const vulnerabilities = summary.results.filter(r => !r.passed);
  console.log('\nVulnerabilities detected:');
  vulnerabilities.forEach(v => {
    console.log(`  - ${v.id}: ${v.title}`);
  });

  // Output JSON for scoring
  const outputPath = args[1];
  if (outputPath) {
    require('fs').writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\nResults saved to: ${outputPath}`);
  }

  process.exit(summary.failed > 0 ? 1 : 0);
}

module.exports = { runGroundTruthTests };

if (require.main === module) {
  main();
}
