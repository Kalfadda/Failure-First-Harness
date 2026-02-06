import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { loginSchema, GENERIC_AUTH_ERROR } from '@/lib/validation';
import { checkRateLimit, recordAttempt } from '@/lib/rate-limit';
import { createAuditLogger } from '@/lib/audit-log';

// F001: Rate limiting for brute force protection
// F002: Account-level rate limiting for credential stuffing
// F003: Generic error messages to prevent enumeration
// F007: Passwords never logged
// F022: Input validation via Zod (parameterized - no SQL injection risk)
// F025: Comprehensive audit logging

export async function POST(request: NextRequest) {
  const audit = createAuditLogger(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    // Parse and validate input
    const body = await request.json();

    // F022: Validate input structure
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      // F003: Don't reveal which field is wrong
      return NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;

    // F001: Check IP-based rate limit
    const ipLimit = checkRateLimit('login:ip', ip);
    if (!ipLimit.allowed) {
      await audit.rateLimitTriggered(email, 'ip');
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((ipLimit.blockedUntil! - Date.now()) / 1000)
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((ipLimit.blockedUntil! - Date.now()) / 1000))
          }
        }
      );
    }

    // F002: Check account-based rate limit
    const accountLimit = checkRateLimit('login:account', email);
    if (!accountLimit.allowed) {
      await audit.accountLocked(email, 'rate_limit');
      // F003: Same error message to prevent enumeration
      return NextResponse.json(
        {
          error: 'Too many login attempts. Please try again later.',
          retryAfter: Math.ceil((accountLimit.blockedUntil! - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    // Log attempt (F025) - F007: Password NOT included
    await audit.loginAttempt(email);

    // Create Supabase client
    const supabase = await createClient();

    // F022: Supabase uses parameterized queries internally - no SQL injection risk
    // F010: Supabase generates cryptographically secure tokens
    // F013: Supabase uses HS256 with secure secret or RS256
    // F014: Token expiration configured at Supabase project level
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      // Record failed attempt for rate limiting
      recordAttempt('login:ip', ip);
      recordAttempt('login:account', email);

      // F003: Generic error message - don't reveal if user exists
      await audit.loginFailure(email, 'invalid_credentials');

      return NextResponse.json(
        { error: GENERIC_AUTH_ERROR },
        { status: 401 }
      );
    }

    // Check if MFA is required
    // F019: MFA enforcement
    if (process.env.REQUIRE_MFA === 'true') {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      if (factors && factors.totp && factors.totp.length > 0) {
        // User has MFA enrolled - require verification
        await audit.mfaChallenge(data.user.id);

        return NextResponse.json({
          mfaRequired: true,
          factorId: factors.totp[0].id
        });
      } else {
        // User needs to enroll in MFA
        return NextResponse.json({
          mfaEnrollmentRequired: true,
          message: 'MFA enrollment is required for this account'
        });
      }
    }

    // Success - F025: Log success
    await audit.loginSuccess(data.user.id, email);

    // F015: Supabase handles refresh token rotation automatically
    // F012: Secure cookies set by Supabase SSR

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email
      }
    });

  } catch (error) {
    // F007: Never log the actual error if it might contain sensitive data
    console.error('Login error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
