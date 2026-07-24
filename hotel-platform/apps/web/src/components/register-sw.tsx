'use client';

import { useEffect } from 'react';

/**
 * Registra o service worker (/sw.js) — passo necessário para o painel ser
 * instalável como app no celular. Montado no layout raiz. Não renderiza nada.
 */
export function RegisterSW() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Falha ao registrar não pode quebrar o app — segue sem PWA.
      });
    };

    // Registra depois do load para não competir com o carregamento inicial.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
