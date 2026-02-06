import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validatePassword } from '@/lib/validation';
import { logAuditEvent } from '@/lib/audit-log';

// F006: Password strength validation
// F009: Session invalidation on password change
// F007: Passwords never logged

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    // F007: Never log passwords - validate without logging
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current and new password are required' },
        { status: 400 }
      );
    }

    // F006: Validate new password strength
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: validation.errors },
        { status: 400 }
      );
    }

    // Verify current password by attempting re-auth
    // (Supabase doesn't have a direct verify password method)
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (verifyError) {
      await logAuditEvent('password_change', request, {
        userId: user.id,
        success: false,
        metadata: { reason: 'invalid_current_password' }
      });

      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      await logAuditEvent('password_change', request, {
        userId: user.id,
        success: false,
        metadata: { reason: updateError.message }
      });

      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      );
    }

    // F009: Invalidate all other sessions
    // Sign out globally to invalidate all refresh tokens
    await supabase.auth.signOut({ scope: 'global' });

    await logAuditEvent('password_change', request, {
      userId: user.id,
      success: true
    });

    await logAuditEvent('session_invalidated', request, {
      userId: user.id,
      success: true,
      metadata: { reason: 'password_change', scope: 'all_sessions' }
    });

    return NextResponse.json({
      success: true,
      message: 'Password updated. Please log in again.'
    });

  } catch (error) {
    console.error('Password change error:', error instanceof Error ? error.message : 'Unknown error');

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
