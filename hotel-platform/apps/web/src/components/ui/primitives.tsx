import { cn } from '@/lib/utils';

// ============================================================
//  Card — container padrão
// ============================================================
export function Card({
  className,
  children,
  padding = 'default',
}: {
  className?: string;
  children: React.ReactNode;
  padding?: 'default' | 'lg' | 'none';
}) {
  return (
    <div
      className={cn(
        'rounded-xl bg-cream border border-sand-200',
        padding === 'default' && 'p-5',
        padding === 'lg' && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between mb-4">
      <div className="text-xs uppercase tracking-widest text-ink-500 font-medium">
        {title}
      </div>
      {action}
    </div>
  );
}

// ============================================================
//  Section Header — título grande de seção
// ============================================================
export function SectionHeader({
  title,
  badge,
  action,
}: {
  title: string;
  badge?: number | string;
  action?: { label: string; onClick?: () => void };
}) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div className="flex items-center gap-2">
        <h2 className="font-serif-display text-lg sm:text-xl text-ink-950">{title}</h2>
        {badge !== undefined && (
          <span className="text-xs px-2 py-0.5 rounded-full nums bg-sand-100 text-ink-500">
            {badge}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="text-sm text-teal-700 hover:text-teal-900"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// ============================================================
//  Button — primário, secundário, fantasma
// ============================================================
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'gold' | 'danger';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:   'bg-teal-900 text-cream hover:bg-teal-700',
  secondary: 'bg-cream border border-sand-200 text-ink-700 hover:bg-sand-50',
  ghost:     'text-ink-700 hover:bg-sand-100',
  gold:      'bg-gold-500 text-cream hover:bg-gold-700',
  danger:    'bg-cream border border-red-300 text-red-700 hover:bg-red-50',
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        buttonVariants[variant],
        size === 'sm' && 'px-3 py-1.5 text-xs min-h-touch-sm',
        size === 'md' && 'px-4 py-2 text-sm min-h-touch-sm',
        size === 'lg' && 'px-5 py-3 text-base min-h-touch-md',
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ============================================================
//  KpiCard — métrica destacada
// ============================================================
interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  trend?: number;
  highlight?: boolean;
  className?: string;
}

export function KpiCard({ label, value, sublabel, trend, highlight, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-4 sm:p-5',
        highlight ? 'bg-teal-900 text-cream' : 'bg-cream border border-sand-200 text-ink-950',
        className,
      )}
    >
      <div
        className={cn(
          'text-xs uppercase tracking-widest font-medium',
          highlight ? 'text-teal-100' : 'text-ink-500',
        )}
      >
        {label}
      </div>
      <div className="font-serif-display text-2xl sm:text-3xl nums mt-1.5">{value}</div>
      {sublabel && (
        <div
          className={cn(
            'text-xs mt-1',
            highlight ? 'text-teal-100' : 'text-ink-500',
          )}
        >
          {sublabel}
        </div>
      )}
      {trend !== undefined && (
        <div
          className={cn(
            'flex items-center gap-1 mt-2 text-xs',
            highlight
              ? trend >= 0 ? 'text-gold-500' : 'text-red-300'
              : trend >= 0 ? 'text-teal-700' : 'text-red-700',
          )}
        >
          <span aria-hidden="true">{trend >= 0 ? '↑' : '↓'}</span>
          <span>
            {trend >= 0 ? '+' : ''}
            {trend}% vs semana anterior
          </span>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  EmptyState — estado vazio
// ============================================================
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      {icon && <div className="text-4xl mb-3 opacity-50">{icon}</div>}
      <h3 className="font-serif-display text-lg text-ink-950 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-ink-500 mb-4 max-w-sm">{description}</p>
      )}
      {action}
    </div>
  );
}
