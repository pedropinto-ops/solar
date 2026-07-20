'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setToken, ApiError } from '@/lib/api-client';
import { homeFor } from '@/lib/permissions';
import { Logo, Botanical } from '@/components/ui/logo';
import { APP_VERSION } from '@/lib/version';

interface AuthResponse {
  token: string;
  user: { id: string; email: string | null; username: string | null; name: string; role: string; propertyId: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  // Lido de window (e não de useSearchParams) para não exigir Suspense na
  // pré-renderização estática desta página.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('expirada')) {
      setExpired(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { login, password },
        skipAuth: true,
      });
      setToken(data.token);
      router.replace(homeFor(data.user.role));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 px-5 py-10 relative overflow-hidden">
      <Botanical className="pointer-events-none select-none absolute -top-8 -right-10 w-40 sm:w-48 opacity-95" />
      <Botanical className="pointer-events-none select-none absolute -bottom-10 -left-12 w-44 sm:w-52 opacity-95 rotate-180" />
      <div className="w-full max-w-sm relative">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="w-36 h-auto mb-2 drop-shadow-sm" />
          <div className="text-sm text-ink-500 tracking-wide">Irará · Bahia</div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-cream rounded-2xl border border-sand-200 p-6 space-y-4"
        >
          <h1 className="font-serif-display text-xl text-ink-950">Entrar</h1>

          {expired && !error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
              Sua sessão expirou. Entre novamente para continuar.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <label className="block">
            <span className="block text-xs text-ink-500 mb-1.5 font-medium">Usuário ou e-mail</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-3 outline-none focus:border-teal-500 min-h-touch-md bg-cream"
            />
          </label>

          <label className="block">
            <span className="block text-xs text-ink-500 mb-1.5 font-medium">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-3 outline-none focus:border-teal-500 min-h-touch-md bg-cream"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md hover:bg-teal-700 disabled:opacity-50"
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>

          <div className="text-xs text-ink-500 text-center pt-2 border-t border-sand-100">
            Esqueceu sua senha? Fale com o administrador.
          </div>
        </form>

        <div className="text-center text-[11px] text-ink-300 mt-6">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
