'use client';

import Link from 'next/link';
import { AppShell, Icon } from '@/components/app-shell';
import { PageHeader, FAB } from '@/components/ui/page-header';
import { Card, CardHeader, KpiCard, SectionHeader } from '@/components/ui/primitives';
import { StatusPill } from '@/components/ui/status-pill';
import { Avatar } from '@/components/ui/avatar';
import { useDashboard, useReservations, useMe, type Reservation } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';

export default function DashboardPage() {
  const { data: dash, isLoading: dashLoading } = useDashboard();
  const { data: reservations } = useReservations({ status: 'CONFIRMED,CHECKED_IN' });
  const { data: me } = useMe();

  const now = new Date();
  const hour = now.getHours();
  const salute = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = me?.user.name?.trim().split(/\s+/)[0] ?? '';
  const greeting = firstName ? `${salute}, ${firstName}` : salute;

  const today = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  return (
    <AppShell>
      <PageHeader
        title={greeting}
        subtitle={today}
        actions={
          <Link
            href="/reservas/nova"
            className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-teal-900 text-cream hover:bg-teal-700 font-semibold"
          >
            <Icon name="plus" className="w-4 h-4" /> Nova reserva
          </Link>
        }
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-7xl space-y-6">
        {/* KPIs */}
        {dashLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : dash ? (
          <>
            {/* Mobile: 1 KPI principal grande + 4 secundários em grid 2x2 */}
            <div className="md:hidden space-y-3">
              <KpiCard
                label="Ocupação hoje"
                value={`${dash.occupancyPercent}%`}
                sublabel={`${dash.inHouse} hóspedes no hotel`}
                highlight
              />
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Chegadas" value={dash.arrivalsToday} sublabel="hoje" />
                <KpiCard label="Saídas" value={dash.departuresToday} sublabel="hoje" />
                <KpiCard label="Pendentes" value={dash.pending} />
                <KpiCard label="Total quartos" value={dash.totalRooms} />
              </div>
            </div>

            {/* Desktop: 4 KPIs em linha */}
            <div className="hidden md:grid md:grid-cols-4 gap-4">
              <KpiCard
                label="Ocupação"
                value={`${dash.occupancyPercent}%`}
                sublabel={`${dash.inHouse} in-house`}
                highlight
              />
              <KpiCard label="Chegadas hoje" value={dash.arrivalsToday} />
              <KpiCard label="Saídas hoje" value={dash.departuresToday} />
              <KpiCard label="Pendentes" value={dash.pending} />
            </div>
          </>
        ) : null}

        {/* Próximas reservas */}
        <section>
          <SectionHeader
            title="Próximas reservas"
            badge={reservations?.length ?? 0}
            action={{ label: 'Ver todas →' }}
          />

          {/* Mobile: cards verticais */}
          <div className="md:hidden space-y-2">
            {(reservations ?? []).slice(0, 6).map((r) => (
              <ReservationCard key={r.id} reservation={r} />
            ))}
            {reservations && reservations.length === 0 && (
              <Card padding="lg" className="text-center text-sm text-ink-500">
                Nenhuma reserva ativa.
              </Card>
            )}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden md:block rounded-xl overflow-hidden bg-cream border border-sand-200">
            <table className="w-full text-sm">
              <thead className="bg-sand-50">
                <tr>
                  <Th>Hóspede</Th>
                  <Th>Código</Th>
                  <Th>Categoria</Th>
                  <Th>Quarto</Th>
                  <Th>Check-in</Th>
                  <Th>Check-out</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {(reservations ?? []).slice(0, 10).map((r) => (
                  <tr key={r.id} className="border-t border-sand-100 hover:bg-sand-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/reservas/${r.id}`}
                        className="flex items-center gap-3 font-medium text-ink-950 hover:text-teal-700"
                      >
                        <Avatar name={r.primaryGuest?.fullName ?? '?'} size="sm" />
                        {r.primaryGuest?.fullName ?? '—'}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-ink-500">{r.code}</td>
                    <td className="px-5 py-3 text-ink-500">{r.roomType.name}</td>
                    <td className="px-5 py-3">{r.room?.number ?? '—'}</td>
                    <td className="px-5 py-3 text-ink-500">{fmtDate(r.checkInDate)}</td>
                    <td className="px-5 py-3 text-ink-500">{fmtDate(r.checkOutDate)}</td>
                    <td className="px-5 py-3">
                      <StatusPill status={r.status} />
                    </td>
                  </tr>
                ))}
                {reservations && reservations.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-ink-500 text-sm">
                      Nenhuma reserva ativa.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <FAB
        href="/reservas/nova"
        label="Nova reserva"
        icon={<Icon name="plus" className="w-6 h-6" />}
      />
    </AppShell>
  );
}

function ReservationCard({ reservation: r }: { reservation: Reservation }) {
  return (
    <Link
      href={`/reservas/${r.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-cream border border-sand-200 hover:border-sand-200/60"
    >
      <Avatar name={r.primaryGuest?.fullName ?? '?'} size="md" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-ink-950 truncate">
          {r.primaryGuest?.fullName ?? '—'}
        </div>
        <div className="text-xs text-ink-500 mt-0.5 truncate">
          {r.room ? `Q${r.room.number} · ` : ''}{r.roomType.name}
        </div>
        <div className="text-xs text-ink-500 mt-0.5">
          {fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <StatusPill status={r.status} />
        <svg className="w-4 h-4 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </Link>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest text-ink-500">
      {children}
    </th>
  );
}
