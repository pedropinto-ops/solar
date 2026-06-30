import { cn } from '@/lib/utils';

interface StatusConfig {
  bg: string;
  text: string;
  dot: string;
  label: string;
}

// Mapeia os status do back-end para as cores e labels visuais
const STATUS: Record<string, StatusConfig> = {
  // Reserva
  PENDING:    { bg: 'bg-sand-100',  text: 'text-ink-500',  dot: 'bg-ink-300',   label: 'Pendente' },
  CONFIRMED:  { bg: 'bg-teal-50',   text: 'text-teal-900', dot: 'bg-teal-700',  label: 'Confirmada' },
  CHECKED_IN: { bg: 'bg-gold-100',  text: 'text-gold-700', dot: 'bg-gold-500',  label: 'Hospedado' },
  CHECKED_OUT:{ bg: 'bg-sand-100',  text: 'text-ink-700',  dot: 'bg-ink-500',   label: 'Finalizada' },
  CANCELLED:  { bg: 'bg-red-50',    text: 'text-red-700',  dot: 'bg-red-500',   label: 'Cancelada' },
  NO_SHOW:    { bg: 'bg-red-50',    text: 'text-red-700',  dot: 'bg-red-500',   label: 'No-show' },

  // Quarto
  AVAILABLE:  { bg: 'bg-teal-50',   text: 'text-teal-900', dot: 'bg-teal-500',  label: 'Disponível' },
  OCCUPIED:   { bg: 'bg-gold-100',  text: 'text-gold-700', dot: 'bg-gold-500',  label: 'Ocupado' },
  DIRTY:      { bg: 'bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Sujo' },
  CLEANING:   { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Em limpeza' },
  INSPECTION: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Inspeção' },
  MAINTENANCE:{ bg: 'bg-red-50',    text: 'text-red-700',  dot: 'bg-red-500',   label: 'Manutenção' },
  BLOCKED:    { bg: 'bg-ink-100',   text: 'text-ink-700',  dot: 'bg-ink-500',   label: 'Bloqueado' },
  OUT_OF_ORDER:{ bg: 'bg-ink-100',  text: 'text-ink-700',  dot: 'bg-ink-500',   label: 'Fora de operação' },

  // Cleaning Task
  IN_PROGRESS:        { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Em andamento' },
  AWAITING_INSPECTION:{ bg: 'bg-gold-100',  text: 'text-gold-700',   dot: 'bg-gold-500',   label: 'Aguardando inspeção' },
  COMPLETED:          { bg: 'bg-teal-50',   text: 'text-teal-900',   dot: 'bg-teal-500',   label: 'Concluída' },
  REJECTED:           { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Refazer' },

  // Pagamento
  PAID:               { bg: 'bg-teal-50',   text: 'text-teal-900', dot: 'bg-teal-500',  label: 'Pago' },
  EXPIRED:            { bg: 'bg-ink-100',   text: 'text-ink-700',  dot: 'bg-ink-500',   label: 'Expirado' },
  REFUNDED:           { bg: 'bg-ink-100',   text: 'text-ink-700',  dot: 'bg-ink-500',   label: 'Estornado' },
  PARTIALLY_REFUNDED: { bg: 'bg-orange-50', text: 'text-orange-800', dot: 'bg-orange-500', label: 'Est. parcial' },
};

interface StatusPillProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusPill({ status, size = 'sm' }: StatusPillProps) {
  const config = STATUS[status] || {
    bg: 'bg-ink-100',
    text: 'text-ink-700',
    dot: 'bg-ink-500',
    label: status,
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap font-medium',
        size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-xs',
        config.bg,
        config.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', config.dot)} />
      {config.label}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-gold-100 text-gold-700 font-medium">
      {children}
    </span>
  );
}
