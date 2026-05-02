import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  poweredByHeader: false,
  reactStrictMode: true,

  // Disable Turbopack for production builds — fixes /404 prerender crash
  // Turbopack is dev-only, webpack is used for production by default in Next.js 14
  // In 15.x Vercel forces Turbopack — we override it here
  experimental: {},

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
