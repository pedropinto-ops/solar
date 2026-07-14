'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getToken, clearToken } from '@/lib/api-client';
import { canAccess, homeFor } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { APP_VERSION } from '@/lib/version';

interface NavItem {
  href: string;
  label: string;
  icon: string; // SVG path simples ou emoji — para MVP, mantemos string
}

// Visibilidade é derivada de canAccess(role, href) — fonte única em permissions.ts.
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Painel', icon: 'home' },
  { href: '/painel', label: 'Quartos ao vivo', icon: 'grid' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/quartos', label: 'Quartos', icon: 'bed' },
  { href: '/hospedes', label: 'Hóspedes', icon: 'users' },
  { href: '/housekeeping', label: 'Limpeza', icon: 'sparkles' },
  { href: '/minha-limpeza', label: 'Limpeza', icon: 'sparkles' },
  { href: '/almoxarifado', label: 'Almoxarifado', icon: 'box' },
  { href: '/relatorios', label: 'Relatórios', icon: 'chart' },
  { href: '/precos', label: 'Preços', icon: 'tag' },
  { href: '/usuarios', label: 'Usuários', icon: 'users' },
];

// Ícones inline (sem libs externas)
function Icon({ name, className }: { name: string; className?: string }) {
  const base = 'w-5 h-5';
  const c = cn(base, className);
  switch (name) {
    case 'home':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'bed':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4v16M22 12v8M2 12h20M6 12V8a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v4" />
          <circle cx="9" cy="9" r="1.5" />
        </svg>
      );
    case 'users':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
          <path d="M5 18l.7 2 2-0.7-2-0.7zM19 17l.5 1.5 1.5-0.5-1.5-0.5z" />
        </svg>
      );
    case 'plus':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      );
    case 'box':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
          <path d="M3 8l9 5 9-5" /><line x1="12" y1="13" x2="12" y2="21" />
        </svg>
      );
    case 'grid':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case 'chart':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="21" x2="21" y2="21" />
          <rect x="5" y="11" width="3.5" height="7" />
          <rect x="10.25" y="7" width="3.5" height="11" />
          <rect x="15.5" y="13" width="3.5" height="5" />
        </svg>
      );
    case 'tag':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
      );
    case 'logout':
      return (
        <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    default:
      return null;
  }
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      apiFetch<{ user: { name: string; role: string; email: string } }>('/auth/me'),
    enabled: ready,
  });

  // Bloqueio por CARGO: se o usuário abrir por URL uma rota que seu cargo não
  // pode, manda para a tela inicial dele (não basta esconder do menu).
  const role = me?.user.role;
  useEffect(() => {
    if (role && !canAccess(role, pathname)) {
      router.replace(homeFor(role));
    }
  }, [role, pathname, router]);

  function logout() {
    clearToken();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500">
        Carregando…
      </div>
    );
  }

  const visibleNav = NAV_ITEMS.filter((item) => canAccess(role, item.href));

  return (
    <div className="min-h-screen flex bg-sand-50">
      {/* Sidebar desktop (md+) */}
      <aside className="hidden md:flex w-60 shrink-0 bg-cream border-r border-sand-200 flex-col print:hidden">
        <div className="px-5 py-6 border-b border-sand-200 flex justify-center">
          <Logo className="w-24 h-auto" />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {visibleNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-teal-50 text-teal-900'
                    : 'text-ink-700 hover:bg-sand-100',
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </Link>
            );
          })}

          {(role === 'ADMIN' || role === 'MANAGER' || role === 'RECEPTION') && (
            <div className="pt-3 mt-3 border-t border-sand-200">
              <Link
                href="/reservas/nova"
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm bg-teal-900 text-cream font-semibold hover:bg-teal-700"
              >
                <Icon name="plus" className="w-4 h-4" />
                Nova reserva
              </Link>
            </div>
          )}
        </nav>

        <div className="px-4 py-4 border-t border-sand-200">
          <div className="flex items-center gap-3">
            {me && <Avatar name={me.user.name} size="sm" />}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate text-ink-950">{me?.user.name}</div>
              <div className="text-xs text-ink-500">{me?.user.role}</div>
            </div>
            <button
              onClick={logout}
              className="min-w-touch-sm min-h-touch-sm rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-950"
              aria-label="Sair"
            >
              <Icon name="logout" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Conteúdo principal */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        {children}
        <footer className="px-5 py-4 text-center text-[11px] text-ink-300">
          Solar Irará Hotel · v{APP_VERSION}
        </footer>
      </main>

      {/* Bottom nav mobile (md-) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-sand-200 flex safe-area-bottom z-30 print:hidden"
        style={{ minHeight: 64 }}
        aria-label="Navegação principal"
      >
        {visibleNav.slice(0, 5).map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 min-h-touch-md',
                active ? 'text-teal-900' : 'text-ink-500',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span className={cn('text-[10px]', active ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

// Re-exporta o Icon para outras telas reaproveitarem
export { Icon };
