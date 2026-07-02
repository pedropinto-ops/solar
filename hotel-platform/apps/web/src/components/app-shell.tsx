'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, getToken, clearToken } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { Logo } from '@/components/ui/logo';
import { APP_VERSION } from '@/lib/version';

interface NavItem {
  href: string;
  label: string;
  icon: string; // SVG path simples ou emoji — para MVP, mantemos string
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Painel', icon: 'home' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  { href: '/quartos', label: 'Quartos', icon: 'bed' },
  { href: '/hospedes', label: 'Hóspedes', icon: 'users', roles: ['ADMIN', 'MANAGER', 'RECEPTION'] },
  {
    href: '/housekeeping',
    label: 'Limpeza',
    icon: 'sparkles',
    roles: ['ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR'],
  },
  {
    href: '/minha-limpeza',
    label: 'Limpeza',
    icon: 'sparkles',
    roles: ['HOUSEKEEPER'],
  },
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

  const role = me?.user.role;
  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (role && item.roles.includes(role)),
  );

  return (
    <div className="min-h-screen flex bg-sand-50">
      {/* Sidebar desktop (md+) */}
      <aside className="hidden md:flex w-60 shrink-0 bg-cream border-r border-sand-200 flex-col">
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
        className="md:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-sand-200 flex safe-area-bottom z-30"
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
