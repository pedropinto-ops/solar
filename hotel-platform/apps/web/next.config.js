/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hotel/shared'],
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
