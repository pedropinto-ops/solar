'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, KpiCard, EmptyState } from '@/components/ui/primitives';
import { useReportSummary } from '@/lib/hooks';
import { fmtCurrency, fmtDate, toDateInput, addDays } from '@/lib/format';
import { cn } from '@/lib/utils';

const SOURCE_LABEL: Record<string, string> = {
  DIRECT: 'Site (direto)',
  WALK_IN: 'Sem reserva',
  PHONE: 'Telefone',
  WHATSAPP: 'WhatsApp',
  EMAIL: 'E-mail',
  RECEPTION: 'Recepção',
  BOOKING_COM: 'Booking.com',
  AIRBNB: 'Airbnb',
  EXPEDIA: 'Expedia',
  OTHER: 'Outros',
};

/** Presets de período. `end` é exclusivo (dia seguinte ao último contado). */
function presets() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const firstThisMonth = new Date(y, m, 1);
  const firstNextMonth = new Date(y, m + 1, 1);
  const firstLastMonth = new Date(y, m - 1, 1);
  const firstThisYear = new Date(y, 0, 1);
  const tomorrow = addDays(now, 1);
  return [
    { key: 'mtd', label: 'Este mês', start: firstThisMonth, end: tomorrow },
    { key: 'last', label: 'Mês passado', start: firstLastMonth, end: firstThisMonth },
    { key: '30d', label: 'Últimos 30 dias', start: addDays(now, -29), end: tomorrow },
    { key: 'ytd', label: 'Este ano', start: firstThisYear, end: tomorrow },
  ];
}

export default function RelatoriosPage() {
  const opts = useMemo(presets, []);
  const [range, setRange] = useState({
    start: toDateInput(opts[0].start),
    end: toDateInput(opts[0].end),
  });

  const { data, isLoading, error } = useReportSummary(range.start, range.end);

  const maxOcc = useMemo(
    () => Math.max(1, ...(data?.byDay ?? []).map((d) => d.occupiedRooms)),
    [data],
  );
  const showChart = (data?.byDay.length ?? 0) > 0 && (data?.byDay.length ?? 0) <= 62;

  return (
    <AppShell>
      <PageHeader title="Relatórios" subtitle="Desempenho do hotel por período" />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-5">
        {/* Seletor de período */}
        <Card className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {opts.map((p) => {
              const active =
                range.start === toDateInput(p.start) && range.end === toDateInput(p.end);
              return (
                <button
                  key={p.key}
                  onClick={() => setRange({ start: toDateInput(p.start), end: toDateInput(p.end) })}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm border transition-colors',
                    active
                      ? 'bg-teal-900 text-cream border-teal-900'
                      : 'bg-cream text-ink-700 border-sand-200 hover:border-teal-700',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="block text-ink-500 mb-1">De</span>
              <input
                type="date"
                value={range.start}
                max={range.end}
                onChange={(e) => setRange({ ...range, start: e.target.value })}
                className="rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="block text-ink-500 mb-1">Até (exclusivo)</span>
              <input
                type="date"
                value={range.end}
                min={range.start}
                onChange={(e) => setRange({ ...range, end: e.target.value })}
                className="rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
              />
            </label>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            Não foi possível carregar o relatório.
          </div>
        )}

        {isLoading && <div className="text-sm text-ink-500">Carregando…</div>}

        {data && (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Ocupação"
                value={`${data.occupancyPercent}%`}
                sublabel={`${data.roomNightsSold}/${data.availableRoomNights} diárias`}
                highlight={data.occupancyPercent >= 70}
              />
              <KpiCard label="Receita (diárias)" value={fmtCurrency(data.roomRevenue)} />
              <KpiCard
                label="Diária média (ADR)"
                value={fmtCurrency(data.adr)}
                sublabel="por quarto ocupado"
              />
              <KpiCard
                label="RevPAR"
                value={fmtCurrency(data.revpar)}
                sublabel="receita ÷ quartos disp."
              />
            </div>

            <div className="text-sm text-ink-500">
              {data.days} dia{data.days > 1 ? 's' : ''} · {data.totalRooms} quartos ·{' '}
              {data.reservationsInPeriod} reserva{data.reservationsInPeriod !== 1 ? 's' : ''} no período
            </div>

            {/* Curva diária de ocupação */}
            {showChart && (
              <Card className="p-4">
                <h2 className="font-serif-display text-lg text-ink-950 mb-3">Ocupação por dia</h2>
                <div className="flex items-end gap-[3px] h-32">
                  {data.byDay.map((d) => (
                    <div
                      key={d.date}
                      className="flex-1 min-w-[3px] bg-teal-700/80 hover:bg-teal-900 rounded-t transition-colors"
                      style={{ height: `${Math.max(2, (d.occupiedRooms / maxOcc) * 100)}%` }}
                      title={`${fmtDate(d.date)} · ${d.occupiedRooms} quarto(s) · ${d.occupancyPercent}% · ${fmtCurrency(d.revenue)}`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-ink-500 mt-2">
                  <span>{fmtDate(data.byDay[0].date)}</span>
                  <span>{fmtDate(data.byDay[data.byDay.length - 1].date)}</span>
                </div>
              </Card>
            )}

            {/* Por origem */}
            <Card className="p-4">
              <h2 className="font-serif-display text-lg text-ink-950 mb-3">Por origem da reserva</h2>
              {data.bySource.length === 0 ? (
                <EmptyState title="Sem reservas no período" description="Ajuste as datas acima." />
              ) : (
                <div className="divide-y divide-sand-200">
                  <div className="grid grid-cols-4 gap-2 text-xs text-ink-500 pb-2">
                    <span>Origem</span>
                    <span className="text-right">Reservas</span>
                    <span className="text-right">Diárias</span>
                    <span className="text-right">Receita</span>
                  </div>
                  {data.bySource.map((s) => (
                    <div key={s.source} className="grid grid-cols-4 gap-2 text-sm py-2">
                      <span className="text-ink-950">{SOURCE_LABEL[s.source] ?? s.source}</span>
                      <span className="text-right text-ink-700">{s.reservations}</span>
                      <span className="text-right text-ink-700">{s.roomNights}</span>
                      <span className="text-right font-medium text-ink-950">
                        {fmtCurrency(s.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <p className="text-xs text-ink-500">
              Receita reconhecida por noite dentro do período (competência). Considera reservas
              confirmadas, hospedadas e finalizadas.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
