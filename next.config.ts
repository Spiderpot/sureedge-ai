import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  // Force webpack bundler - Turbopack causes pages/_document conflicts on Vercel
  turbopack: undefined,

  poweredByHeader: false,
  reactStrictMode: true,

  images: {
    unoptimized: true,
    remotePatterns: [],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
