import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAuditLogger } from '@/lib/audit-log';

// F008: Session invalidation on logout
// F025: Audit logging

export async function POST(request: NextRequest) {
  const audit = createAuditLogger(request);

  try {
    const supabase = await createClient();

    // Get current user before logout for audit
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // F008: Invalidate the session server-side
      // This invalidates the refresh token, making the session unusable
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error('Logout error:', error.message);
        return NextResponse.json(
          { error: 'Failed to logout' },
          { status: 500 }
        );
      }

      // F025: Log the logout
      await audit.logout(user.id);
    }

    // Return response that clears cookies
    const response = NextResponse.json({ success: true });

    // F008: Clear all auth-related cookies
    response.cookies.delete('sb-access-token');
    response.cookies.delete('sb-refresh-token');

    return response;

  } catch (error) {
    console.error('Logout error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
