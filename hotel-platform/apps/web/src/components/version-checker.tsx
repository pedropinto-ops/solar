'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_VERSION } from '@/lib/version';

/**
 * Detecta quando um novo deploy subiu (compara a versão do bundle em execução
 * com a do endpoint /version) e oferece um pop-up para atualizar.
 */
export function VersionChecker() {
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const dismissed = useRef<string | null>(null);

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const res = await fetch('/version', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        const v = data?.version;
        if (active && v && v !== APP_VERSION && v !== dismissed.current) {
          setNewVersion(v);
        }
      } catch {
        // offline / falha de rede — ignora silenciosamente
      }
    }

    check();
    const interval = setInterval(check, 120_000); // a cada 2 min
    const onFocus = () => check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      active = false;
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!newVersion) return null;

  function dismiss() {
    dismissed.current = newVersion;
    setNewVersion(null);
  }

  return (
    <div className="fixed z-50 bottom-4 inset-x-4 md:inset-x-auto md:right-4 md:max-w-sm safe-area-bottom animate-slide-up">
      <div className="bg-cream border border-sand-200 rounded-2xl shadow-lg p-4 flex items-start gap-3">
        <div className="w-9 h-9 shrink-0 rounded-full bg-teal-50 text-teal-900 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-3-6.7" />
            <path d="M21 4v5h-5" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif-display text-base text-ink-950 leading-tight">Nova versão disponível</div>
          <div className="text-xs text-ink-500 mt-0.5">
            Versão {newVersion} pronta. Atualize para ver as novidades.
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => window.location.reload()}
              className="bg-teal-900 text-cream text-sm font-semibold rounded-lg px-4 min-h-touch-sm hover:bg-teal-700"
            >
              Atualizar
            </button>
            <button
              onClick={dismiss}
              className="text-sm text-ink-500 rounded-lg px-3 min-h-touch-sm hover:text-ink-950"
            >
              Agora não
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="text-ink-300 hover:text-ink-700 shrink-0"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
