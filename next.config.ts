import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // standalone = Docker only. Vercel has its own build pipeline — setting this breaks it.
  // VERCEL env var is auto-set by Vercel; absent in Docker builds.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),

  // Prevents Prisma from being bundled — loads at runtime instead of build time
  serverExternalPackages: ['@prisma/client', 'prisma'],

  images: {
    unoptimized: true,
    remotePatterns: [],
  },

  // Security: remove X-Powered-By header
  poweredByHeader: false,
  reactStrictMode: true,

  // Backup security headers at Next.js level (in addition to NGINX)
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
