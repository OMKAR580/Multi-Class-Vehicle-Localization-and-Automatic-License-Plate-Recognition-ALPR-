/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // 'standalone' is for Docker production builds — slows down local dev
  // output: 'standalone',

  // Faster page transitions — prefetch links in viewport
  experimental: {
    optimisticClientCache: true,
  },

  // Cache static assets aggressively in dev
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
