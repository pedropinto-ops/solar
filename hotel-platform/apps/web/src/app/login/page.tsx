'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, setToken, ApiError } from '@/lib/api-client';

interface AuthResponse {
  token: string;
  user: { id: string; email: string; name: string; role: string; propertyId: string };
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
        skipAuth: true,
      });
      setToken(data.token);
      const dest = data.user.role === 'HOUSEKEEPER' ? '/minha-limpeza' : '/dashboard';
      router.replace(dest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sand-50 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="font-serif-display text-3xl text-teal-900 mb-1">Pousada Vista Mar</div>
          <div className="text-sm text-ink-500">Plataforma de gestão</div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-cream rounded-2xl border border-sand-200 p-6 space-y-4"
        >
          <h1 className="font-serif-display text-xl text-ink-950">Entrar</h1>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}

          <label className="block">
            <span className="block text-xs text-ink-500 mb-1.5 font-medium">E-mail</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
      </div>
    </div>
  );
}
