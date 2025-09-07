/** @type {import('next').NextConfig} */
const nextConfig = {
  // Add '@supabase/realtime-js' to your existing array
  serverExternalPackages: ['@azure/ai-form-recognizer', '@supabase/realtime-js'],
  images: {
    domains: ['supabase.co', 'localhost'],
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
