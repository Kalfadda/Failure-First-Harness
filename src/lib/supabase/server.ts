import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// F012: Server-side Supabase client with secure cookie configuration
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // F012: Enforce security flags on all auth cookies
              const secureOptions: CookieOptions = {
                ...options,
                httpOnly: true,      // Prevent XSS access
                secure: true,        // HTTPS only
                sameSite: 'lax',     // CSRF protection
                path: '/'
              };
              cookieStore.set(name, value, secureOptions);
            });
          } catch {
            // Called from Server Component - ignore
          }
        }
      }
    }
  );
}
