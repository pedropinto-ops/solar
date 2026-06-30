'use client';

import { useMemo } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { SectionHeader } from '@/components/ui/primitives';
import { useRooms } from '@/lib/hooks';
import { cn } from '@/lib/utils';

const STATUS_ACCENT: Record<string, string> = {
  AVAILABLE: 'border-l-teal-500',
  OCCUPIED:  'border-l-gold-500',
  DIRTY:     'border-l-orange-500',
  CLEANING:  'border-l-purple-500',
  INSPECTION:'border-l-purple-500',
  MAINTENANCE:'border-l-red-500',
  BLOCKED:   'border-l-ink-500',
  OUT_OF_ORDER:'border-l-ink-500',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Disponível',
  OCCUPIED: 'Ocupado',
  DIRTY: 'Sujo',
  CLEANING: 'Em limpeza',
  MAINTENANCE: 'Manutenção',
  BLOCKED: 'Bloqueado',
};

export default function RoomsPage() {
  const { data: rooms, isLoading } = useRooms();

  const groupedByFloor = useMemo(() => {
    const map = new Map<number, typeof rooms>();
    for (const r of rooms ?? []) {
      const f = r.floor ?? 0;
      const list = map.get(f) ?? [];
      list.push(r);
      map.set(f, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [rooms]);

  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rooms ?? []) {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
    }
    return counts;
  }, [rooms]);

  return (
    <AppShell>
      <PageHeader
        title="Quartos"
        subtitle={rooms ? `${rooms.length} unidades` : 'Status em tempo real'}
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-6xl space-y-6">
        {/* Resumo de status */}
        {/* Mobile: scroll horizontal de chips */}
        <div className="md:hidden -mx-5 px-5 overflow-x-auto hide-scroll">
          <div className="flex gap-3 w-max">
            {(['AVAILABLE', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'BLOCKED'] as const).map(
              (s) => (
                <SummaryChip key={s} status={s} value={summary[s] ?? 0} />
              ),
            )}
          </div>
        </div>

        {/* Desktop: grid de cards */}
        <div className="hidden md:grid md:grid-cols-6 gap-3">
          {(['AVAILABLE', 'OCCUPIED', 'DIRTY', 'CLEANING', 'MAINTENANCE', 'BLOCKED'] as const).map(
            (s) => (
              <SummaryCard key={s} status={s} value={summary[s] ?? 0} />
            ),
          )}
        </div>

        {/* Lista por andar */}
        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : (
          groupedByFloor.map(([floor, list]) => (
            <section key={floor}>
              <SectionHeader title={floor === 0 ? 'Sem andar' : `Andar ${floor}`} />
              {/* 3 colunas em mobile, 6 em desktop */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2.5 md:gap-3">
                {(list ?? []).map((r) => (
                  <button
                    key={r.id}
                    className={cn(
                      'rounded-xl p-3 text-left bg-cream border border-sand-200 border-l-[3px]',
                      'min-h-touch-md hover:shadow-md transition-shadow',
                      STATUS_ACCENT[r.status] ?? 'border-l-ink-300',
                    )}
                  >
                    <div className="font-serif-display text-xl nums text-ink-950">
                      {r.number}
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5 truncate">
                      {r.roomType.name}
                    </div>
                    <div className="mt-2">
                      <StatusPill status={r.status} />
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}

function SummaryChip({ status, value }: { status: string; value: number }) {
  return (
    <div className="bg-sand-50 rounded-xl px-4 py-3 min-w-[110px]">
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        <StatusDot status={status} />
        {STATUS_LABEL[status] ?? status}
      </div>
      <div className="font-serif-display text-2xl nums mt-1">{value}</div>
    </div>
  );
}

function SummaryCard({ status, value }: { status: string; value: number }) {
  return (
    <div className="rounded-xl p-4 bg-cream border border-sand-200">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-ink-500">
        <StatusDot status={status} />
        {STATUS_LABEL[status] ?? status}
      </div>
      <div className="font-serif-display text-2xl nums mt-1">{value}</div>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    AVAILABLE: 'bg-teal-500',
    OCCUPIED: 'bg-gold-500',
    DIRTY: 'bg-orange-500',
    CLEANING: 'bg-purple-500',
    MAINTENANCE: 'bg-red-500',
    BLOCKED: 'bg-ink-500',
  };
  return <span className={cn('w-2 h-2 rounded-full', colors[status] ?? 'bg-ink-300')} />;
}
