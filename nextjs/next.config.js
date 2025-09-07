/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // Remove X-Powered-By header for security

  images: {
    domains: ['i.pravatar.cc', 'ui-avatars.com'],
    // Add Supabase storage domain if using Supabase storage
    ...(process.env.NEXT_PUBLIC_SUPABASE_URL && {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.replace(
            /^[^.]+\./,
            '*.'
          ),
          pathname: '/storage/v1/object/public/**',
        },
      ],
    }),
  },

  // Security headers configuration
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
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
        ],
      },
      {
        // Additional headers for API routes
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },

  // Environment variable validation
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Webpack configuration for security
  webpack: (config, { dev, isServer }) => {
    // Security-related webpack configurations
    if (!dev && !isServer) {
      // Remove source maps in production for security
      config.devtool = false;
    }

    return config;
  },

  // Experimental features
  experimental: {
    // Enable modern JavaScript features
    esmExternals: true,
  },
};

module.exports = nextConfig;
