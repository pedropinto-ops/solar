'use client';

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getToken } from '@/lib/api-client';
import { Logo, Botanical } from '@/components/ui/logo';
import { APP_VERSION } from '@/lib/version';

const SLUG = 'solar-irara';
const RESERVAR = `/reservar/${SLUG}`;
const WHATSAPP = `https://wa.me/5575981492537?text=${encodeURIComponent(
  'Olá! Gostaria de fazer uma reserva no Solar Irará Hotel.',
)}`;

interface GalleryPhoto {
  url: string;
  category: string;
  caption?: string;
  sortOrder?: number;
}
interface PropertyPublic {
  name: string;
  addressCity: string | null;
  addressState: string | null;
  latitude: number | null;
  longitude: number | null;
  googleMapsUrl: string | null;
  instagramUrl: string | null;
  galleryPhotos: GalleryPhoto[];
}

const CAT_LABEL: Record<string, string> = {
  hotel: 'O hotel',
  quarto: 'Quartos',
  cafe: 'Café da manhã',
};
const CAT_ORDER = ['hotel', 'quarto', 'cafe'];

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
    else setReady(true);
  }, [router]);

  const { data: prop } = useQuery({
    queryKey: ['public-property', SLUG],
    queryFn: () => apiFetch<PropertyPublic>(`/public/property/${SLUG}`, { skipAuth: true }),
    enabled: ready,
  });

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50 text-ink-500">
        Carregando…
      </div>
    );
  }

  const photos = prop?.galleryPhotos ?? [];
  const byCat = CAT_ORDER.map((cat) => ({
    cat,
    items: photos
      .filter((p) => p.category === cat)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
  })).filter((g) => g.items.length > 0);

  const hasMap = prop?.latitude != null && prop?.longitude != null;

  return (
    <div className="min-h-screen bg-sand-50 text-ink-950 relative overflow-hidden flex flex-col">
      <Botanical className="pointer-events-none select-none absolute -top-10 -right-12 w-44 sm:w-60 opacity-90" />

      <header className="relative z-10 flex justify-end px-5 sm:px-8 py-4">
        <Link href="/login" className="text-xs sm:text-sm text-ink-500 hover:text-teal-900 transition-colors">
          Acesso da equipe →
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-5 pt-4 pb-10">
        <Logo className="w-40 sm:w-52 h-auto drop-shadow-sm mb-4" />
        <div className="text-sm text-ink-500 tracking-widest uppercase mb-6">Irará · Bahia</div>
        <h1 className="font-serif-display text-3xl sm:text-5xl text-teal-900 leading-tight max-w-2xl">
          Sua estadia acolhedora no coração de Irará
        </h1>
        <p className="text-ink-700 mt-4 max-w-lg text-sm sm:text-base">
          Conforto, tranquilidade e um atendimento próximo. Reserve online em poucos passos ou fale
          direto com a nossa recepção.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-md">
          <Link href={RESERVAR} className="flex-1 bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md flex items-center justify-center hover:bg-teal-700 transition-colors">
            Reservar agora
          </Link>
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="flex-1 bg-cream border border-sand-200 text-ink-700 font-semibold rounded-lg min-h-touch-md flex items-center justify-center gap-2 hover:bg-sand-50 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.1-4.7-4-4.9-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.6.1.3.7 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3z" /></svg>
            Falar no WhatsApp
          </a>
        </div>
      </main>

      {/* Galeria */}
      {byCat.length > 0 && (
        <section className="relative z-10 px-5 sm:px-8 pb-8 max-w-5xl mx-auto w-full">
          {byCat.map((g) => (
            <div key={g.cat} className="mb-8">
              <h2 className="font-serif-display text-xl sm:text-2xl text-ink-950 mb-3">{CAT_LABEL[g.cat] ?? g.cat}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
                {g.items.map((p) => (
                  <button
                    key={p.url}
                    onClick={() => setLightbox(p.url)}
                    className="snap-start shrink-0 rounded-xl overflow-hidden border border-sand-200 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    aria-label="Ampliar foto"
                  >
                    <img
                      src={p.url}
                      alt={p.caption ?? CAT_LABEL[g.cat] ?? ''}
                      loading="lazy"
                      className="h-52 sm:h-64 w-auto object-cover block"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Localização */}
      {hasMap && (
        <section className="relative z-10 px-5 sm:px-8 pb-10 max-w-5xl mx-auto w-full">
          <h2 className="font-serif-display text-xl sm:text-2xl text-ink-950 mb-3">Onde estamos</h2>
          <div className="rounded-xl overflow-hidden border border-sand-200">
            {/* OpenStreetMap embed: renderiza sem chave de API e sem bloqueio de
                iframe (o embed do Google exige chave/é bloqueado). O botão
                "Como chegar" abaixo abre a rota no Google Maps. */}
            <iframe
              title="Mapa do Solar Irará Hotel"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${prop!.longitude! - 0.028}%2C${prop!.latitude! - 0.008}%2C${prop!.longitude! + 0.028}%2C${prop!.latitude! + 0.008}&layer=mapnik&marker=${prop!.latitude}%2C${prop!.longitude}`}
              className="w-full h-64 sm:h-80 border-0"
              loading="lazy"
            />
          </div>
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-sm text-ink-500">
              {[prop?.addressCity, prop?.addressState].filter(Boolean).join(' · ') || 'Irará · Bahia'}
            </span>
            {prop?.googleMapsUrl && (
              <a href={prop.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-teal-900 hover:text-teal-700">
                Como chegar →
              </a>
            )}
          </div>
        </section>
      )}

      {/* Rodapé */}
      <footer className="relative z-10 border-t border-sand-200 px-5 sm:px-8 py-5 text-center">
        <div className="text-sm text-ink-700 font-medium">Solar Irará Hotel</div>
        <div className="text-xs text-ink-500 mt-1">
          Irará · Bahia ·{' '}
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-teal-900">(75) 98149-2537</a>
          {prop?.instagramUrl && (
            <>
              {' · '}
              <a href={prop.instagramUrl} target="_blank" rel="noopener noreferrer" className="hover:text-teal-900">@solarirara</a>
            </>
          )}
        </div>
        <div className="text-[11px] text-ink-300 mt-3">v{APP_VERSION}</div>
      </footer>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-lg" />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-cream text-2xl w-10 h-10 flex items-center justify-center"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
