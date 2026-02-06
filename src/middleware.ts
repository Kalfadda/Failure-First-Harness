import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// F005: HTTPS enforcement middleware
// F012: Secure cookie handling
// F019: MFA enforcement check

export async function middleware(request: NextRequest) {
  // F005: Redirect HTTP to HTTPS in production
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') !== 'https'
  ) {
    const httpsUrl = new URL(request.url);
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl, 301);
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers
    }
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // F012: Enforce security flags on all cookies
            const secureOptions: CookieOptions = {
              ...options,
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/'
            };
            request.cookies.set(name, value);
            response.cookies.set(name, value, secureOptions);
          });
        }
      }
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // F019: MFA enforcement for protected routes
  const protectedRoutes = ['/dashboard', '/settings', '/admin'];
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && user) {
    // Check if MFA is required and verified
    const { data: { session } } = await supabase.auth.getSession();

    if (process.env.REQUIRE_MFA === 'true') {
      const aal = session?.aal;

      // If user hasn't completed MFA challenge, redirect to MFA page
      if (aal !== 'aal2') {
        const mfaUrl = new URL('/auth/mfa', request.url);
        mfaUrl.searchParams.set('redirect', request.nextUrl.pathname);
        return NextResponse.redirect(mfaUrl);
      }
    }
  }

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login/signup
  const authRoutes = ['/login', '/signup'];
  const isAuthRoute = authRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};
