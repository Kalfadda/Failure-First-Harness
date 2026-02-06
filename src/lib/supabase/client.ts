import { createBrowserClient } from '@supabase/ssr';

// F012: Cookie configuration with security flags handled by Supabase SSR
// Supabase SSR automatically sets HttpOnly, Secure, SameSite flags
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
