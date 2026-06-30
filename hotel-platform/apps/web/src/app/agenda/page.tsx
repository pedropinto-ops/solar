'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell, Icon } from '@/components/app-shell';
import { PageHeader, FAB } from '@/components/ui/page-header';
import { Button, EmptyState } from '@/components/ui/primitives';
import { StatusPill } from '@/components/ui/status-pill';
import { Avatar } from '@/components/ui/avatar';
import { useRooms, useReservations, type Reservation } from '@/lib/hooks';
import { fmtDate, addDays, toDateInput } from '@/lib/format';
import { cn } from '@/lib/utils';

export default function AgendaPage() {
  // Início da janela visível
  const [startDate, setStartDate] = useState<Date>(() => {
    const t = new Date();
    t.setUTCHours(0, 0, 0, 0);
    return t;
  });

  const [selectedDayIdx, setSelectedDayIdx] = useState(0); // só mobile

  return (
    <AppShell>
      {/* Mobile: lista por dia */}
      <div className="md:hidden">
        <AgendaMobile
          startDate={startDate}
          setStartDate={setStartDate}
          selectedDayIdx={selectedDayIdx}
          setSelectedDayIdx={setSelectedDayIdx}
        />
      </div>

      {/* Desktop: timeline grid */}
      <div className="hidden md:block">
        <AgendaDesktop startDate={startDate} setStartDate={setStartDate} />
      </div>

      <FAB
        href="/reservas/nova"
        label="Nova reserva"
        icon={<Icon name="plus" className="w-6 h-6" />}
      />
    </AppShell>
  );
}

// ============================================================
//  MOBILE
// ============================================================

function AgendaMobile({
  startDate,
  setStartDate,
  selectedDayIdx,
  setSelectedDayIdx,
}: {
  startDate: Date;
  setStartDate: (d: Date) => void;
  selectedDayIdx: number;
  setSelectedDayIdx: (i: number) => void;
}) {
  // 14 dias clicáveis no scroll horizontal
  const days = useMemo(
    () => Array.from({ length: 14 }, (_, i) => addDays(startDate, i)),
    [startDate],
  );

  const selectedDay = days[selectedDayIdx]!;
  const nextDay = addDays(selectedDay, 1);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // Reservas que se intersectam com o dia selecionado
  const { data: reservations, isLoading } = useReservations({
    from: toDateInput(selectedDay),
    to: toDateInput(nextDay),
    status: 'CONFIRMED,CHECKED_IN,PENDING',
  });

  // Separa por tipo de evento do dia
  const arrivals = (reservations ?? []).filter(
    (r) => toDateInput(new Date(r.checkInDate)) === toDateInput(selectedDay),
  );
  const departures = (reservations ?? []).filter(
    (r) => toDateInput(new Date(r.checkOutDate)) === toDateInput(selectedDay),
  );
  const inHouse = (reservations ?? []).filter((r) => r.status === 'CHECKED_IN');

  return (
    <>
      <PageHeader title="Agenda" />

      {/* Seletor horizontal de dias */}
      <div className="bg-cream border-b border-sand-200 px-3 py-3 overflow-x-auto hide-scroll">
        <div className="flex gap-2 w-max">
          {days.map((d, i) => {
            const active = selectedDayIdx === i;
            const isToday = toDateInput(d) === toDateInput(today);
            return (
              <button
                key={i}
                onClick={() => setSelectedDayIdx(i)}
                className={cn(
                  'flex flex-col items-center justify-center px-3 rounded-xl min-w-touch-md',
                  'h-16 transition-colors',
                  active
                    ? 'bg-teal-900 text-cream'
                    : 'border border-sand-200 text-ink-700 hover:bg-sand-50',
                  !active && isToday && 'text-teal-700 border-teal-700',
                )}
              >
                <span className="text-xs uppercase opacity-80">
                  {d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                </span>
                <span className="font-serif-display text-lg nums font-semibold">
                  {d.getUTCDate()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Resumo do dia */}
      <div className="px-5 py-3 bg-sand-100 grid grid-cols-3 gap-3 text-center">
        <DayStat label="Chegadas" value={arrivals.length} color="text-teal-700" />
        <DayStat label="Saídas" value={departures.length} color="text-gold-700" />
        <DayStat label="In-house" value={inHouse.length} color="text-ink-700" />
      </div>

      {/* Listas */}
      <div className="px-5 py-5 space-y-6 pb-24">
        {isLoading && <div className="text-ink-300 text-sm">Carregando…</div>}

        {!isLoading && arrivals.length === 0 && departures.length === 0 && inHouse.length === 0 && (
          <EmptyState
            icon="📅"
            title="Sem movimento neste dia"
            description="Não há chegadas, saídas ou hóspedes ativos."
          />
        )}

        {arrivals.length > 0 && (
          <ReservationListSection title="Chegadas" reservations={arrivals} accent="teal" />
        )}
        {departures.length > 0 && (
          <ReservationListSection title="Saídas" reservations={departures} accent="gold" />
        )}
        {inHouse.length > 0 && (
          <ReservationListSection
            title="In-house"
            reservations={inHouse.filter((r) => !arrivals.includes(r) && !departures.includes(r))}
            accent="ink"
          />
        )}
      </div>
    </>
  );
}

function DayStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-ink-500">{label}</div>
      <div className={cn('font-serif-display text-xl nums', color)}>{value}</div>
    </div>
  );
}

function ReservationListSection({
  title,
  reservations,
  accent,
}: {
  title: string;
  reservations: Reservation[];
  accent: 'teal' | 'gold' | 'ink';
}) {
  if (reservations.length === 0) return null;
  const accentBorder = {
    teal: 'border-l-teal-700',
    gold: 'border-l-gold-500',
    ink: 'border-l-ink-300',
  }[accent];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="font-serif-display text-lg text-ink-950">{title}</h2>
        <span className="text-xs nums text-ink-500">{reservations.length}</span>
      </div>
      <div className="space-y-2">
        {reservations.map((r) => (
          <Link
            key={r.id}
            href={`/reservas/${r.id}`}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl bg-cream border border-sand-200 border-l-4',
              accentBorder,
            )}
          >
            <Avatar name={r.primaryGuest?.fullName ?? '?'} size="md" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-950 truncate">
                {r.primaryGuest?.fullName ?? '—'}
              </div>
              <div className="text-xs text-ink-500 mt-0.5 truncate">
                {r.room ? `Q${r.room.number} · ` : ''}{r.roomType.name}
              </div>
              <div className="mt-1.5">
                <StatusPill status={r.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ============================================================
//  DESKTOP — timeline grid
// ============================================================

const DAYS_RANGE = 14;
const CELL_WIDTH = 88;

function AgendaDesktop({
  startDate,
  setStartDate,
}: {
  startDate: Date;
  setStartDate: (d: Date) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: DAYS_RANGE }, (_, i) => addDays(startDate, i)),
    [startDate],
  );
  const endDate = useMemo(() => addDays(startDate, DAYS_RANGE), [startDate]);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { data: rooms, isLoading: roomsLoading } = useRooms();
  const { data: reservations } = useReservations({
    from: toDateInput(startDate),
    to: toDateInput(endDate),
    status: 'CONFIRMED,CHECKED_IN,PENDING',
  });

  const reservationsByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>();
    for (const r of reservations ?? []) {
      if (!r.room?.id) continue;
      const arr = map.get(r.room.id) ?? [];
      arr.push(r);
      map.set(r.room.id, arr);
    }
    return map;
  }, [reservations]);

  function shift(deltaDays: number) {
    setStartDate(addDays(startDate, deltaDays));
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        subtitle={`${fmtDate(startDate)} — ${fmtDate(addDays(startDate, DAYS_RANGE - 1))}`}
        actions={
          <>
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => shift(-7)} aria-label="Semana anterior">
                ←
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { const t = new Date(); t.setUTCHours(0,0,0,0); setStartDate(t); }}>
                Hoje
              </Button>
              <Button variant="secondary" size="sm" onClick={() => shift(7)} aria-label="Próxima semana">
                →
              </Button>
            </div>
            <Link
              href="/reservas/nova"
              className="ml-2 inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-teal-900 text-cream hover:bg-teal-700 font-semibold"
            >
              <Icon name="plus" className="w-4 h-4" /> Nova reserva
            </Link>
          </>
        }
      />

      <div className="overflow-auto">
        {roomsLoading ? (
          <div className="p-8 text-ink-500">Carregando…</div>
        ) : (
          <div className="inline-block min-w-full">
            {/* Header dias */}
            <div className="sticky top-0 z-10 flex bg-cream border-b border-sand-200">
              <div className="w-44 shrink-0 px-5 py-3 text-xs font-medium uppercase tracking-widest text-ink-500 border-r border-sand-200">
                Quarto
              </div>
              {days.map((d, i) => {
                const isToday = toDateInput(d) === toDateInput(today);
                const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                return (
                  <div
                    key={i}
                    style={{ width: CELL_WIDTH }}
                    className={cn(
                      'py-3 text-center shrink-0 border-r border-sand-100',
                      isToday && 'bg-teal-50',
                      isWeekend && !isToday && 'bg-sand-50',
                    )}
                  >
                    <div className={cn('text-xs uppercase', isToday ? 'text-teal-700' : 'text-ink-500')}>
                      {d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                    </div>
                    <div
                      className={cn(
                        'text-base mt-0.5 nums',
                        isToday ? 'font-serif-display text-teal-900 font-bold' : 'text-ink-950 font-medium',
                      )}
                    >
                      {d.getUTCDate()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Linhas por quarto */}
            {(rooms ?? []).map((room) => (
              <div key={room.id} className="flex border-b border-sand-100">
                <div className="w-44 shrink-0 px-5 py-3 border-r border-sand-200">
                  <div className="font-serif-display text-sm text-ink-950">Quarto {room.number}</div>
                  <div className="text-xs text-ink-500">{room.roomType.name}</div>
                </div>
                <div className="relative flex" style={{ height: 56 }}>
                  {days.map((d, i) => {
                    const isToday = toDateInput(d) === toDateInput(today);
                    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
                    return (
                      <div
                        key={i}
                        style={{ width: CELL_WIDTH }}
                        className={cn(
                          'border-r border-sand-100',
                          isToday && 'bg-teal-50/50',
                          isWeekend && !isToday && 'bg-sand-50/50',
                        )}
                      />
                    );
                  })}

                  {(reservationsByRoom.get(room.id) ?? []).map((res) => {
                    const bar = computeBarPosition(res, startDate, DAYS_RANGE);
                    if (!bar) return null;
                    const color = barColor(res.status);
                    return (
                      <Link
                        key={res.id}
                        href={`/reservas/${res.id}`}
                        style={{ left: bar.left, width: bar.width }}
                        className={cn(
                          'absolute top-2 bottom-2 px-2.5 rounded-lg flex items-center text-xs font-medium border-l-[3px]',
                          color,
                        )}
                        title={`${res.code} · ${res.primaryGuest?.fullName ?? ''}`}
                      >
                        <span className="truncate">{res.primaryGuest?.fullName ?? '(sem hóspede)'}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Reservas sem quarto */}
            <UnassignedRow reservations={(reservations ?? []).filter((r) => !r.room?.id)} />
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="bg-cream border-t border-sand-200 px-8 py-3 flex gap-6 text-xs text-ink-500">
        <LegendItem dotClass="bg-teal-700" label="Confirmada" />
        <LegendItem dotClass="bg-gold-500" label="In-house" />
        <LegendItem dotClass="bg-ink-300" label="Pendente" />
        <span className="ml-auto">Clique numa reserva para abrir detalhes</span>
      </div>
    </>
  );
}

function UnassignedRow({ reservations }: { reservations: Reservation[] }) {
  if (reservations.length === 0) return null;
  return (
    <div className="border-t-2 border-gold-100 bg-gold-50/50">
      <div className="px-5 py-2 text-xs font-medium uppercase tracking-widest text-gold-700">
        Sem quarto alocado ({reservations.length})
      </div>
      <div className="px-5 pb-3 flex flex-wrap gap-2">
        {reservations.map((res) => (
          <Link
            key={res.id}
            href={`/reservas/${res.id}`}
            className="bg-cream border border-gold-100 rounded-lg px-3 py-1.5 text-xs hover:shadow-sm"
          >
            <span className="font-mono text-ink-500">{res.code}</span>{' '}
            · <span className="font-medium text-ink-950">{res.primaryGuest?.fullName}</span>
            · <span className="text-ink-500">{res.roomType.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function LegendItem({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={cn('w-2.5 h-2.5 rounded', dotClass)} />
      {label}
    </span>
  );
}

function barColor(status: string): string {
  switch (status) {
    case 'CONFIRMED':
      return 'bg-teal-50 text-teal-900 border-teal-700 hover:bg-teal-100';
    case 'CHECKED_IN':
      return 'bg-gold-100 text-gold-700 border-gold-500 hover:bg-gold-50';
    case 'PENDING':
      return 'bg-sand-100 text-ink-700 border-ink-300 hover:bg-sand-50';
    default:
      return 'bg-sand-50 text-ink-700 border-ink-300';
  }
}

function computeBarPosition(
  res: Reservation,
  rangeStart: Date,
  daysCount: number,
): { left: number; width: number } | null {
  const ci = new Date(res.checkInDate);
  const co = new Date(res.checkOutDate);
  ci.setUTCHours(0, 0, 0, 0);
  co.setUTCHours(0, 0, 0, 0);

  const rangeEnd = addDays(rangeStart, daysCount);
  if (co <= rangeStart || ci >= rangeEnd) return null;

  const visibleStart = ci < rangeStart ? rangeStart : ci;
  const visibleEnd = co > rangeEnd ? rangeEnd : co;

  const dayMs = 24 * 60 * 60 * 1000;
  const leftDays = (visibleStart.getTime() - rangeStart.getTime()) / dayMs;
  const widthDays = (visibleEnd.getTime() - visibleStart.getTime()) / dayMs;

  return {
    left: leftDays * CELL_WIDTH + 4,
    width: widthDays * CELL_WIDTH - 8,
  };
}
