/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@hotel/shared'],
  // Next 15: typedRoutes saiu de experimental para o nível raiz.
  typedRoutes: false,
  /**
   * Cabeçalhos de segurança do site. O helmet só protege a API; o portal que
   * o hóspede e a equipe abrem no navegador não tinha proteção nenhuma.
   *
   * Nota: as diretivas de CSP aqui são deliberadamente as que NÃO quebram o
   * Next (frame-ancestors/base-uri/form-action). Restringir script-src/
   * connect-src exige nonce e a URL da API na allowlist — fica para um passo
   * seguinte, testado em homologação antes de ligar em produção.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Impede que o portal seja embutido em iframe de terceiros
          // (clickjacking: sobrepor um botão invisível de "confirmar").
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
          // Força HTTPS por 2 anos, evitando downgrade/interceptação.
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          // Bloqueia MIME sniffing (upload que "vira" script).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Não vaza a URL interna (que pode conter ids) para sites externos.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Nada de câmera/microfone/geolocalização/pagamento.
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
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
