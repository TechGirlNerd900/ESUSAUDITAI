/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@supabase/realtime-js'],
  images: {
    domains: ['supabase.co', 'localhost'],
  },
  experimental: {
    serverComponentsExternalPackages: ['@supabase/realtime-js'],
    // Add Edge Runtime configuration
    runtime: 'nodejs',
    fallbackNodePolyfills: false,
    nodeMiddleware: true // Enable Node.js middleware support
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
