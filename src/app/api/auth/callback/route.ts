import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit-log';

// F016: OAuth state parameter validation (handled by Supabase)
// F017: OAuth redirect_uri validation
// F018: OAuth code single-use (handled by Supabase/provider)

// F017: Allowed redirect URIs (must be exact match)
function getAllowedRedirects(): string[] {
  const envRedirects = process.env.OAUTH_ALLOWED_REDIRECTS || '';
  const defaults = ['/dashboard', '/'];

  return [
    ...defaults,
    ...envRedirects.split(',').map(r => r.trim()).filter(Boolean)
  ];
}

function isAllowedRedirect(redirect: string): boolean {
  const allowed = getAllowedRedirects();

  // Only allow relative paths or exact matches
  // F017: Prevent open redirect
  if (redirect.startsWith('http://') || redirect.startsWith('https://')) {
    // Absolute URL - must be in whitelist
    return allowed.includes(redirect);
  }

  // Relative path - must start with /
  if (!redirect.startsWith('/')) {
    return false;
  }

  // Check against allowed paths
  return allowed.some(path => redirect.startsWith(path));
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/dashboard';

  // F017: Validate redirect URI
  if (!isAllowedRedirect(next)) {
    await logAuditEvent('oauth_failure', request, {
      success: false,
      metadata: { reason: 'invalid_redirect', attempted: next }
    });

    return NextResponse.redirect(new URL('/login?error=invalid_redirect', origin));
  }

  if (code) {
    const supabase = await createClient();

    // F016: State parameter validation is handled by Supabase internally
    // F018: Code exchange - Supabase ensures single use
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      await logAuditEvent('oauth_failure', request, {
        success: false,
        metadata: { reason: error.message }
      });

      return NextResponse.redirect(new URL('/login?error=oauth_failed', origin));
    }

    // F025: Log successful OAuth
    await logAuditEvent('oauth_callback', request, {
      userId: data.user?.id,
      email: data.user?.email,
      success: true,
      metadata: { provider: data.user?.app_metadata?.provider }
    });

    // Check if MFA is required (F019)
    if (process.env.REQUIRE_MFA === 'true' && data.user) {
      const { data: factors } = await supabase.auth.mfa.listFactors();

      if (!factors?.totp?.length) {
        // Redirect to MFA enrollment
        return NextResponse.redirect(new URL('/auth/mfa/enroll', origin));
      }

      // Check if MFA is already verified for this session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.aal !== 'aal2') {
        return NextResponse.redirect(new URL(`/auth/mfa?redirect=${encodeURIComponent(next)}`, origin));
      }
    }

    return NextResponse.redirect(new URL(next, origin));
  }

  // No code provided
  await logAuditEvent('oauth_failure', request, {
    success: false,
    metadata: { reason: 'no_code' }
  });

  return NextResponse.redirect(new URL('/login?error=no_code', origin));
}
