'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, KpiCard, Button, EmptyState } from '@/components/ui/primitives';
import { useReportSummary, useReportForecast } from '@/lib/hooks';
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

/** Variação % vs período anterior; undefined quando não há base de comparação. */
function pctDelta(cur: number, prev: number): number | undefined {
  if (!prev || prev <= 0) return undefined;
  return Math.round(((cur - prev) / prev) * 100);
}

export default function RelatoriosPage() {
  const opts = useMemo(presets, []);
  const [range, setRange] = useState({
    start: toDateInput(opts[0].start),
    end: toDateInput(opts[0].end),
  });
  const [copied, setCopied] = useState(false);

  const { data, isLoading, error } = useReportSummary(range.start, range.end);
  const { data: forecast } = useReportForecast();

  const maxOcc = useMemo(
    () => Math.max(1, ...(data?.byDay ?? []).map((d) => d.occupiedRooms)),
    [data],
  );
  const showChart = (data?.byDay.length ?? 0) > 0 && (data?.byDay.length ?? 0) <= 62;

  function buildSummaryText(): string {
    if (!data) return '';
    const dRev = pctDelta(data.totalRevenue, data.previous.totalRevenue);
    const dOcc = pctDelta(data.occupancyPercent, data.previous.occupancyPercent);
    const l = (n?: number) => (n === undefined ? '' : ` (${n >= 0 ? '+' : ''}${n}% vs anterior)`);
    const f7 = forecast?.horizons.find((h) => h.days === 7);
    return [
      `📊 Solar Irará — Relatório`,
      `${fmtDate(data.start)} a ${fmtDate(data.end)}`,
      ``,
      `Receita total: ${fmtCurrency(data.totalRevenue)}${l(dRev)}`,
      `  • Diárias: ${fmtCurrency(data.roomRevenue)}`,
      `  • Consumos: ${fmtCurrency(data.consumptionRevenue)}`,
      `Ocupação: ${data.occupancyPercent}%${l(dOcc)}`,
      `Diária média (ADR): ${fmtCurrency(data.adr)}`,
      `Recebido no período: ${fmtCurrency(data.receivedInPeriod)}`,
      `A receber (saldo aberto): ${fmtCurrency(data.outstanding)}`,
      f7 ? `\nPróximos 7 dias: ${f7.occupancyPercent}% ocupação · ${fmtCurrency(f7.revenue)} previstos` : ``,
    ].filter(Boolean).join('\n');
  }

  async function doShare() {
    const text = buildSummaryText();
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Relatório Solar Irará', text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      /* usuário cancelou o compartilhamento — silencioso */
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Relatórios"
        subtitle="Desempenho do hotel por período"
        actions={
          data ? (
            <div className="flex gap-2 print:hidden">
              <Button size="sm" variant="secondary" onClick={doShare}>
                {copied ? 'Copiado!' : 'Compartilhar'}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                PDF
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-5">
        {/* Seletor de período */}
        <Card className="p-4 space-y-3 print:hidden">
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
            <div className="hidden print:block text-sm text-ink-500">
              Solar Irará · {fmtDate(data.start)} a {fmtDate(data.end)}
            </div>

            {/* KPIs principais com variação vs período anterior */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KpiCard
                label="Receita total"
                value={fmtCurrency(data.totalRevenue)}
                sublabel={`diárias + consumos`}
                trend={pctDelta(data.totalRevenue, data.previous.totalRevenue)}
                highlight
              />
              <KpiCard
                label="Ocupação"
                value={`${data.occupancyPercent}%`}
                sublabel={`${data.roomNightsSold}/${data.availableRoomNights} diárias`}
                trend={pctDelta(data.occupancyPercent, data.previous.occupancyPercent)}
              />
              <KpiCard
                label="Diária média (ADR)"
                value={fmtCurrency(data.adr)}
                trend={pctDelta(data.adr, data.previous.adr)}
              />
              <KpiCard
                label="RevPAR"
                value={fmtCurrency(data.revpar)}
                sublabel="receita ÷ quartos disp."
                trend={pctDelta(data.revpar, data.previous.revpar)}
              />
            </div>

            {/* Receita detalhada + caixa */}
            <Card className="p-4">
              <h2 className="font-serif-display text-lg text-ink-950 mb-3">Receita e caixa</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <Row label="Diárias" value={fmtCurrency(data.roomRevenue)} />
                <Row label="Consumos (frigobar, taxas)" value={fmtCurrency(data.consumptionRevenue)} />
                <Row label="Receita total" value={fmtCurrency(data.totalRevenue)} strong />
                <Row label="Ticket médio / reserva" value={fmtCurrency(data.ticketMedio)} />
                <Row label="Recebido no período" value={fmtCurrency(data.receivedInPeriod)} accent="teal" />
                <Row label="A receber (saldo aberto)" value={fmtCurrency(data.outstanding)} accent="amber" />
              </div>
            </Card>

            {/* Previsão */}
            {forecast && (
              <Card className="p-4">
                <h2 className="font-serif-display text-lg text-ink-950 mb-1">
                  Previsão (reservas já confirmadas)
                </h2>
                <p className="text-xs text-ink-500 mb-3">A partir de hoje · {forecast.totalRooms} quartos</p>
                <div className="grid grid-cols-2 gap-3">
                  {forecast.horizons.map((h) => (
                    <div key={h.days} className="rounded-xl border border-sand-200 p-4 bg-sand-50">
                      <div className="text-xs uppercase tracking-widest text-ink-500">
                        Próximos {h.days} dias
                      </div>
                      <div className="font-serif-display text-2xl text-ink-950 mt-1">
                        {h.occupancyPercent}%
                      </div>
                      <div className="text-xs text-ink-500">ocupação prevista</div>
                      <div className="mt-2 text-sm text-ink-700">
                        {fmtCurrency(h.revenue)} <span className="text-ink-500">previstos</span>
                      </div>
                      <div className="text-xs text-ink-500">{h.reservations} reserva{h.reservations !== 1 ? 's' : ''}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="text-sm text-ink-500">
              {data.days} dia{data.days > 1 ? 's' : ''} · {data.reservationsInPeriod} reserva
              {data.reservationsInPeriod !== 1 ? 's' : ''} · estadia média {data.avgStayNights} noite
              {data.avgStayNights !== 1 ? 's' : ''}
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

            {/* Por origem — barras (mobile-friendly) */}
            <Card className="p-4">
              <h2 className="font-serif-display text-lg text-ink-950 mb-3">Por origem da reserva</h2>
              {data.bySource.length === 0 ? (
                <EmptyState title="Sem reservas no período" description="Ajuste as datas acima." />
              ) : (
                <div className="space-y-3">
                  {data.bySource.map((s) => {
                    const maxRev = Math.max(...data.bySource.map((x) => x.revenue), 1);
                    return (
                      <div key={s.source}>
                        <div className="flex justify-between items-baseline text-sm">
                          <span className="text-ink-950 font-medium">
                            {SOURCE_LABEL[s.source] ?? s.source}
                          </span>
                          <span className="font-medium text-ink-950">{fmtCurrency(s.revenue)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-sand-100 mt-1 overflow-hidden">
                          <div
                            className="h-full bg-teal-700 rounded-full"
                            style={{ width: `${(s.revenue / maxRev) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs text-ink-500 mt-0.5">
                          {s.reservations} reserva{s.reservations !== 1 ? 's' : ''} · {s.roomNights} diárias
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <p className="text-xs text-ink-500">
              Diárias reconhecidas por noite dentro do período (competência). Consumos pela data do
              lançamento. "Recebido" = pagamentos confirmados; "a receber" = saldo em aberto das
              reservas ativas. Considera reservas confirmadas, hospedadas e finalizadas.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string;
  value: string;
  strong?: boolean;
  accent?: 'teal' | 'amber';
}) {
  return (
    <div className="flex justify-between items-baseline py-1 border-b border-sand-100">
      <span className="text-ink-500">{label}</span>
      <span
        className={cn(
          'font-medium nums',
          strong && 'text-base text-ink-950',
          accent === 'teal' && 'text-teal-700',
          accent === 'amber' && 'text-amber-700',
          !strong && !accent && 'text-ink-950',
        )}
      >
        {value}
      </span>
    </div>
  );
}
