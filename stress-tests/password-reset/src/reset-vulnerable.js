/**
 * VULNERABLE Password Reset Implementation
 *
 * This implementation has multiple security flaws that represent
 * what a single-agent workflow might produce when focused on
 * "making it work" rather than systematic failure analysis.
 *
 * Vulnerabilities:
 * - GT001: Token not invalidated after use
 * - GT002: Token never expires
 * - GT004: User enumeration via error messages
 * - GT006: Weak token entropy (timestamp-based)
 * - GT007: No rate limiting
 * - GT008: Old password still works
 * - GT009: Token not bound to user (can be reused)
 * - GT010: No password complexity check
 * - GT011: Token stored in plain text
 * - GT012: Sessions not invalidated
 */

const crypto = require('crypto');

// Simulated database
const users = new Map();
const resetTokens = new Map(); // token -> email (plain text!)
const sessions = new Map();

// Initialize test user
users.set('user@example.com', {
  email: 'user@example.com',
  password: 'oldpassword123',
  createdAt: Date.now()
});

function requestReset(email) {
  // GT004: User enumeration - different messages
  const user = users.get(email);
  if (!user) {
    return { success: false, error: 'Email not found' }; // VULNERABLE: reveals email doesn't exist
  }

  // GT006: Weak token - timestamp based, predictable
  const token = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // GT011: Store token in plain text
  // GT005: Doesn't invalidate previous tokens
  resetTokens.set(token, email);

  // GT007: No rate limiting

  return {
    success: true,
    message: 'Reset email sent',
    // In real impl this would be emailed, exposing for testing
    _token: token
  };
}

function resetPassword(token, newPassword) {
  // GT009: Token lookup doesn't verify it's for the right user
  const email = resetTokens.get(token);

  if (!email) {
    return { success: false, error: 'Invalid token' };
  }

  // GT002: No expiration check

  // GT010: No password complexity validation

  const user = users.get(email);
  if (!user) {
    return { success: false, error: 'User not found' };
  }

  // GT008: Just update password, old one was valid until now
  user.password = newPassword;

  // GT001: Don't invalidate token - can be reused!
  // resetTokens.delete(token); // MISSING!

  // GT012: Don't invalidate sessions
  // sessions would remain valid

  return { success: true, message: 'Password updated' };
}

function login(email, password) {
  const user = users.get(email);
  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid credentials' };
  }

  const sessionId = crypto.randomBytes(16).toString('hex');
  sessions.set(sessionId, { email, createdAt: Date.now() });

  return { success: true, sessionId };
}

function validateSession(sessionId) {
  return sessions.has(sessionId);
}

// Expose for testing
function getState() {
  return {
    users: Object.fromEntries(users),
    tokens: Object.fromEntries(resetTokens),
    sessions: Object.fromEntries(sessions)
  };
}

function reset() {
  users.clear();
  resetTokens.clear();
  sessions.clear();
  users.set('user@example.com', {
    email: 'user@example.com',
    password: 'oldpassword123',
    createdAt: Date.now()
  });
}

module.exports = {
  requestReset,
  resetPassword,
  login,
  validateSession,
  getState,
  reset
};
