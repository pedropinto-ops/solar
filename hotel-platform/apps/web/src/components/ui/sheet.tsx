'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /**
   * Em telas pequenas é bottom-sheet, em telas grandes é modal central.
   * Use 'sheet' para forçar bottom-sheet em ambos.
   */
  variant?: 'auto' | 'sheet' | 'modal';
  /** Tamanho máximo no desktop */
  maxWidth?: 'sm' | 'md' | 'lg';
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  variant = 'auto',
  maxWidth = 'md',
}: SheetProps) {
  // Bloqueia scroll do body enquanto aberto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC fecha
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const maxW = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
  }[maxWidth];

  const isSheetOnly = variant === 'sheet';
  const isModalOnly = variant === 'modal';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center animate-fade-in"
      style={{ background: 'rgba(15, 31, 38, 0.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'sheet-title' : undefined}
    >
      <div
        className={cn(
          'w-full bg-cream max-h-[90vh] overflow-auto animate-slide-up safe-area-bottom',
          isSheetOnly
            ? 'rounded-t-2xl'
            : isModalOnly
            ? `rounded-2xl ${maxW} m-4`
            : `rounded-t-2xl sm:rounded-2xl ${maxW} sm:m-4`,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle visual (só mobile, só em modo sheet) */}
        {!isModalOnly && (
          <div className="flex justify-center pt-2 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-sand-200" />
          </div>
        )}

        {title && (
          <div className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-sand-100">
            <h2 id="sheet-title" className="font-serif-display text-lg text-ink-950">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="min-w-touch-sm min-h-touch-sm flex items-center justify-center -mr-2 rounded-lg text-ink-500 hover:text-ink-950"
              aria-label="Fechar"
            >
              ✕
            </button>
          </div>
        )}

        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/**
 * SheetItem — linha de ação dentro de um bottom sheet (menu de opções).
 */
export function SheetItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-sm font-medium min-h-touch-md hover:bg-sand-50',
        danger ? 'text-red-700' : 'text-ink-950',
      )}
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );
}
