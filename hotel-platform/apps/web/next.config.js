/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hotel/shared'],
  experimental: {
    typedRoutes: false,
  },
  // Link curto de divulgação (Google, Instagram, WhatsApp) -> fluxo de reserva.
  async redirects() {
    return [
      {
        source: '/reservar',
        destination: '/reservar/solar-irara',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
