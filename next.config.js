/** @type {import('next').NextConfig} */
const nextConfig = {
  // F005: Security headers for TLS enforcement
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // F005: Strict Transport Security - force HTTPS
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          // F023: XSS protection
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // F011: Prevent token leakage via referrer
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
