'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Volta automaticamente no histórico (mostra seta em mobile) */
  back?: boolean;
  /** Botões à direita (típicos: busca, sino, ações) */
  actions?: React.ReactNode;
}

/**
 * Cabeçalho de página padrão.
 * Em mobile: altura compacta, título único, botão voltar opcional.
 * Em desktop: mais espaçoso.
 */
export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  const router = useRouter();

  return (
    <header className="bg-cream border-b border-sand-200 px-5 md:px-8 py-4 md:py-5 flex items-center gap-3">
      {back && (
        <button
          onClick={() => router.back()}
          className="min-w-touch-sm min-h-touch-sm flex items-center justify-center -ml-2 rounded-lg text-ink-700 hover:bg-sand-100"
          aria-label="Voltar"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      <div className="flex-1 min-w-0">
        <h1 className="font-serif-display text-xl md:text-2xl text-ink-950 truncate">
          {title}
        </h1>
        {subtitle && <p className="text-xs md:text-sm text-ink-500 truncate mt-0.5">{subtitle}</p>}
      </div>

      {actions && <div className="flex items-center gap-1 md:gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Botão de ação primária flutuante — usado em mobile para a ação central.
 * Em desktop, escondido (uso da action na sidebar/topbar).
 */
export function FAB({
  href,
  onClick,
  label,
  icon,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  const className =
    'md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-teal-900 text-cream shadow-lg flex items-center justify-center hover:bg-teal-700 active:scale-95 transition-transform';

  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {icon}
      </Link>
    );
  }
  return (
    <button onClick={onClick} aria-label={label} className={className}>
      {icon}
    </button>
  );
}
