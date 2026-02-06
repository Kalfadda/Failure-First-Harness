import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mfaSchema, GENERIC_MFA_ERROR } from '@/lib/validation';
import { checkRateLimit, recordAttempt } from '@/lib/rate-limit';
import { createAuditLogger } from '@/lib/audit-log';

// F019: MFA enforcement
// F020: MFA codes are single-use (enforced by Supabase TOTP)
// F021: Rate limiting for MFA brute force

export async function POST(request: NextRequest) {
  const audit = createAuditLogger(request);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

  try {
    const body = await request.json();
    const { factorId, code } = body;

    // Validate MFA code format
    const parseResult = mfaSchema.safeParse({ code });
    if (!parseResult.success) {
      return NextResponse.json(
        { error: GENERIC_MFA_ERROR },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // F021: Check MFA rate limits
    const ipLimit = checkRateLimit('mfa:ip', ip);
    if (!ipLimit.allowed) {
      await audit.rateLimitTriggered(user.email || user.id, 'mfa_ip');
      return NextResponse.json(
        {
          error: 'Too many attempts. Please try again later.',
          retryAfter: Math.ceil((ipLimit.blockedUntil! - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    const accountLimit = checkRateLimit('mfa:account', user.id);
    if (!accountLimit.allowed) {
      await audit.accountLocked(user.email || user.id, 'mfa_rate_limit');
      return NextResponse.json(
        {
          error: 'Too many attempts. Please try again later.',
          retryAfter: Math.ceil((accountLimit.blockedUntil! - Date.now()) / 1000)
        },
        { status: 429 }
      );
    }

    // Create MFA challenge
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId
    });

    if (challengeError) {
      recordAttempt('mfa:ip', ip);
      recordAttempt('mfa:account', user.id);
      await audit.mfaFailure(user.id, 'challenge_failed');

      return NextResponse.json(
        { error: GENERIC_MFA_ERROR },
        { status: 400 }
      );
    }

    // F020: Verify the code (Supabase enforces single-use)
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: parseResult.data.code
    });

    if (verifyError) {
      // Record failed attempt
      recordAttempt('mfa:ip', ip);
      recordAttempt('mfa:account', user.id);
      await audit.mfaFailure(user.id, 'invalid_code');

      return NextResponse.json(
        { error: GENERIC_MFA_ERROR },
        { status: 400 }
      );
    }

    // Success
    await audit.mfaSuccess(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('MFA error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
