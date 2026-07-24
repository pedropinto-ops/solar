import type { MetadataRoute } from 'next';

/**
 * Web App Manifest — torna o painel do Hotel instalável no celular (PWA).
 *
 * O Next serve isto automaticamente em /manifest.webmanifest e injeta a
 * tag <link rel="manifest"> no <head>. Junto com o service worker (public/sw.js)
 * é o que faz o Android/iPhone oferecerem "Adicionar à tela de início".
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Solar Irará Hotel',
    short_name: 'Solar Irará',
    description: 'Painel de gestão do Solar Irará Hotel',
    lang: 'pt-BR',
    // Ao abrir pelo ícone, entra direto no painel. Sem sessão, o app manda
    // para o login; cada cargo é roteado para a sua tela inicial.
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FFFBF4', // creme da marca (tela de abertura)
    theme_color: '#9E4620', // terracota da marca (barra do sistema)
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
