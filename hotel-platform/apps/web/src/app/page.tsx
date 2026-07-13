'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getToken } from '@/lib/api-client';
import { Logo, Botanical } from '@/components/ui/logo';
import { APP_VERSION } from '@/lib/version';

const RESERVAR = '/reservar/solar-irara';
const WHATSAPP = `https://wa.me/5575981492537?text=${encodeURIComponent(
  'Olá! Gostaria de fazer uma reserva no Solar Irará Hotel.',
)}`;

export default function HomePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Funcionário logado vai direto ao painel; visitante vê a landing pública.
  useEffect(() => {
    if (getToken()) router.replace('/dashboard');
    else setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50 text-ink-500">
        Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand-50 text-ink-950 relative overflow-hidden flex flex-col">
      {/* Botânicos decorativos da marca */}
      <Botanical className="pointer-events-none select-none absolute -top-10 -right-12 w-44 sm:w-60 opacity-90" />
      <Botanical className="pointer-events-none select-none absolute -bottom-12 -left-14 w-48 sm:w-64 opacity-90 rotate-180" />

      {/* Topo: acesso discreto da equipe */}
      <header className="relative z-10 flex justify-end px-5 sm:px-8 py-4">
        <Link
          href="/login"
          className="text-xs sm:text-sm text-ink-500 hover:text-teal-900 transition-colors"
        >
          Acesso da equipe →
        </Link>
      </header>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-5 py-8">
        <Logo className="w-40 sm:w-52 h-auto drop-shadow-sm mb-4" />
        <div className="text-sm text-ink-500 tracking-widest uppercase mb-6">
          Irará · Bahia
        </div>

        <h1 className="font-serif-display text-3xl sm:text-5xl text-teal-900 leading-tight max-w-2xl">
          Sua estadia acolhedora no coração de Irará
        </h1>
        <p className="text-ink-700 mt-4 max-w-lg text-sm sm:text-base">
          Conforto, tranquilidade e um atendimento próximo. Reserve online em
          poucos passos ou fale direto com a nossa recepção.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mt-8 w-full max-w-md">
          <Link
            href={RESERVAR}
            className="flex-1 bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md flex items-center justify-center hover:bg-teal-700 transition-colors"
          >
            Reservar agora
          </Link>
          <a
            href={WHATSAPP}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-cream border border-sand-200 text-ink-700 font-semibold rounded-lg min-h-touch-md flex items-center justify-center gap-2 hover:bg-sand-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.5A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.9-1.1-4.7-4-4.9-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.3c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .5l-.4.6c-.2.2-.3.4-.1.6.1.3.7 1.1 1.4 1.8 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.6-.1l1.8.9c.3.1.4.2.5.3.1.2.1.7-.1 1.3z" />
            </svg>
            Falar no WhatsApp
          </a>
        </div>
      </main>

      {/* Três pilares */}
      <section className="relative z-10 px-5 sm:px-8 pb-10">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Pilar
            title="Reserva sem burocracia"
            text="Escolha as datas, informe os hóspedes e confirme em minutos, direto pelo site."
          />
          <Pilar
            title="Atendimento próximo"
            text="Precisa de ajuda? Fale com a nossa recepção pelo WhatsApp a qualquer momento."
          />
          <Pilar
            title="No coração de Irará"
            text="Bem localizado, para você aproveitar o melhor da cidade e da Bahia."
          />
        </div>
      </section>

      {/* Rodapé */}
      <footer className="relative z-10 border-t border-sand-200 px-5 sm:px-8 py-5 text-center">
        <div className="text-sm text-ink-700 font-medium">Solar Irará Hotel</div>
        <div className="text-xs text-ink-500 mt-1">
          Irará · Bahia ·{' '}
          <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className="hover:text-teal-900">
            (75) 98149-2537
          </a>
        </div>
        <div className="text-[11px] text-ink-300 mt-3">v{APP_VERSION}</div>
      </footer>
    </div>
  );
}

function Pilar({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-cream border border-sand-200 rounded-xl p-5 text-left">
      <div className="w-9 h-9 rounded-lg bg-gold-100 flex items-center justify-center mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-gold-500" aria-hidden="true" />
      </div>
      <h3 className="font-serif-display text-lg text-ink-950">{title}</h3>
      <p className="text-sm text-ink-500 mt-1.5">{text}</p>
    </div>
  );
}
