// F025: Audit logging for all authentication events
// F007: Ensure passwords are NEVER logged

export type AuditEvent =
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'mfa_challenge'
  | 'mfa_success'
  | 'mfa_failure'
  | 'password_change'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'session_invalidated'
  | 'oauth_start'
  | 'oauth_callback'
  | 'oauth_failure'
  | 'rate_limit_triggered'
  | 'account_locked';

interface AuditLogEntry {
  timestamp: string;
  event: AuditEvent;
  userId?: string;
  email?: string;
  ip: string;
  userAgent: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}

// F007: Fields that must NEVER be logged
const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'mfaSecret',
  'recoveryCode',
  'apiKey'
]);

function sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // F007: Redact any sensitive field
    if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function getClientIp(request: Request): string {
  // Check standard headers for proxied requests
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take first IP (client IP)
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback - in production this should come from the connection
  return 'unknown';
}

export async function logAuditEvent(
  event: AuditEvent,
  request: Request,
  options: {
    userId?: string;
    email?: string;
    success: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    event,
    userId: options.userId,
    email: options.email,
    ip: getClientIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    success: options.success,
    metadata: sanitizeMetadata(options.metadata)
  };

  // F007: Verify no sensitive data before logging
  const entryString = JSON.stringify(entry);
  for (const field of SENSITIVE_FIELDS) {
    // Check for actual values, not field names
    if (entryString.includes(`"${field}":"`) && !entryString.includes(`"${field}":"[REDACTED]"`)) {
      console.error(`SECURITY: Attempted to log sensitive field: ${field}`);
      entry.metadata = { error: 'Log sanitization failed - metadata redacted' };
      break;
    }
  }

  // In production, send to secure audit log service
  // For now, log to console in structured format
  console.log(JSON.stringify({
    type: 'AUDIT',
    ...entry
  }));

  // TODO: Send to Supabase audit table or external SIEM
  // await supabase.from('audit_logs').insert(entry);
}

// F025: Helper for common audit patterns
export function createAuditLogger(request: Request) {
  return {
    loginAttempt: (email: string) =>
      logAuditEvent('login_attempt', request, { email, success: false }),

    loginSuccess: (userId: string, email: string) =>
      logAuditEvent('login_success', request, { userId, email, success: true }),

    loginFailure: (email: string, reason: string) =>
      logAuditEvent('login_failure', request, { email, success: false, metadata: { reason } }),

    mfaChallenge: (userId: string) =>
      logAuditEvent('mfa_challenge', request, { userId, success: true }),

    mfaSuccess: (userId: string) =>
      logAuditEvent('mfa_success', request, { userId, success: true }),

    mfaFailure: (userId: string, reason: string) =>
      logAuditEvent('mfa_failure', request, { userId, success: false, metadata: { reason } }),

    logout: (userId: string) =>
      logAuditEvent('logout', request, { userId, success: true }),

    rateLimitTriggered: (email: string, type: string) =>
      logAuditEvent('rate_limit_triggered', request, { email, success: false, metadata: { type } }),

    accountLocked: (email: string, reason: string) =>
      logAuditEvent('account_locked', request, { email, success: false, metadata: { reason } })
  };
}
