/*
 * Service worker mínimo do Solar Irará Hotel.
 *
 * Objetivo ÚNICO: habilitar a instalação do PWA (o navegador só oferece
 * "Adicionar à tela de início" quando existe um SW com handler de fetch).
 *
 * DECISÃO IMPORTANTE: NÃO fazemos cache de páginas nem da API. Só os ícones
 * e a marca ficam em cache. Assim o app sempre carrega a versão mais nova das
 * telas e o aviso de "nova versão disponível" (VersionChecker) continua
 * funcionando — um SW que cacheia HTML costuma "prender" a equipe numa versão
 * velha até limpar o cache.
 */
const CACHE = 'solar-static-v1';
const ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/brand/logo.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).catch(() => {}),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isStatic =
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/'));

  // Só os estáticos da marca saem do cache (cache-first, com rede de reserva).
  // Todo o resto — páginas e API — NÃO é interceptado: vai direto para a rede.
  if (isStatic) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
  }
});
