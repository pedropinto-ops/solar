'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button, EmptyState } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api-client';
import { fmtCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  usePricingOverview,
  usePriceCalendar,
  useUpdateBasePrice,
  useCreateRatePeriod,
  useUpdateRatePeriod,
  useDeleteRatePeriod,
  type RatePeriodItem,
} from '@/lib/hooks';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const inputCls = 'w-full rounded-lg border border-sand-200 px-3 py-2 outline-none focus:border-teal-500 bg-cream text-sm';

function fmtRange(startDate: string, endDate: string): string {
  const f = (s: string) => { const [y, m, d] = s.split('-'); return `${d}/${m}`; };
  return startDate === endDate ? f(startDate) : `${f(startDate)} – ${f(endDate)}`;
}

export default function PrecosPage() {
  const { data, isLoading } = usePricingOverview();
  const roomType = data?.roomTypes[0];

  return (
    <AppShell>
      <PageHeader title="Preços" subtitle="Diárias, agenda e regras de tarifa por data" />
      <div className="px-5 md:px-8 py-5 md:py-6 max-w-4xl space-y-5">
        {isLoading && <div className="text-sm text-ink-500">Carregando…</div>}
        {data && roomType && (
          <>
            <BasePriceCard roomTypeId={roomType.id} name={roomType.name} basePrice={roomType.basePrice} />
            <ChildInfo childFee={data.childFee} freeMax={data.childFreeMaxAge} feeMax={data.childFeeMaxAge} />
            <PriceAgenda roomTypeId={roomType.id} />
            <RulesList periods={data.periods} roomTypeId={roomType.id} />
          </>
        )}
        {data && !roomType && (
          <EmptyState title="Sem categoria de quarto" description="Cadastre uma categoria para definir preços." />
        )}
      </div>
    </AppShell>
  );
}

function BasePriceCard({ roomTypeId, name, basePrice }: { roomTypeId: string; name: string; basePrice: number }) {
  const update = useUpdateBasePrice();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(basePrice));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const n = Number(value.replace(',', '.'));
    if (!(n > 0)) { setError('Valor inválido'); return; }
    try {
      await update.mutateAsync({ roomTypeId, basePrice: n });
      setEditing(false);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar');
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">Diária base — {name}</div>
          {!editing ? (
            <div className="font-serif-display text-2xl text-ink-950 mt-1">{fmtCurrency(basePrice)}<span className="text-sm text-ink-500"> / adulto</span></div>
          ) : (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-ink-500">R$</span>
              <input className={cn(inputCls, 'w-28')} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
            </div>
          )}
          {error && <div className="text-xs text-red-700 mt-1">{error}</div>}
        </div>
        {!editing ? (
          <Button size="sm" variant="secondary" onClick={() => { setValue(String(basePrice)); setEditing(true); }}>Editar</Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={update.isPending}>{update.isPending ? '…' : 'Salvar'}</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
          </div>
        )}
      </div>
      <p className="text-xs text-ink-500 mt-2">É a diária de um adulto quando nenhuma regra de data se aplica.</p>
    </Card>
  );
}

function ChildInfo({ childFee, freeMax, feeMax }: { childFee: number; freeMax: number; feeMax: number }) {
  return (
    <div className="text-xs text-ink-500 px-1">
      Crianças: até {freeMax} anos <strong>grátis</strong> · de {freeMax + 1} a {feeMax} anos <strong>{fmtCurrency(childFee)}/dia</strong> (fixo, não varia por data).
    </div>
  );
}

function PriceAgenda({ roomTypeId }: { roomTypeId: string }) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState<{ start: string; end: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const start = ymd(cursor.y, cursor.m, 1);
  const nextM = cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 };
  const end = ymd(nextM.y, nextM.m, 1);
  const { data: cal } = usePriceCalendar(roomTypeId, start, end);

  const priceByDate = useMemo(() => {
    const map = new Map<string, { adultRate: number; ruleName: string | null }>();
    cal?.days.forEach((d) => map.set(d.date, { adultRate: d.adultRate, ruleName: d.ruleName }));
    return map;
  }, [cal]);

  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();

  function clickDay(dateStr: string) {
    if (!sel || sel.end) setSel({ start: dateStr, end: null });
    else {
      const [a, b] = [sel.start, dateStr].sort();
      setSel({ start: a, end: b });
    }
  }
  function inSel(dateStr: string): boolean {
    if (!sel) return false;
    if (!sel.end) return dateStr === sel.start;
    return dateStr >= sel.start && dateStr <= sel.end;
  }

  function prev() { setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 })); setSel(null); }
  function next() { setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 })); setSel(null); }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif-display text-lg text-ink-950">Agenda de preços</h2>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="w-8 h-8 rounded-lg border border-sand-200 hover:bg-sand-50" aria-label="Mês anterior">‹</button>
          <span className="text-sm font-medium min-w-[120px] text-center">{MONTHS[cursor.m]} {cursor.y}</span>
          <button onClick={next} className="w-8 h-8 rounded-lg border border-sand-200 hover:bg-sand-50" aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[11px] text-ink-400 font-medium py-1">{w}</div>
        ))}
        {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
          const dateStr = ymd(cursor.y, cursor.m, day);
          const info = priceByDate.get(dateStr);
          const special = !!info?.ruleName;
          const selected = inSel(dateStr);
          return (
            <button
              key={day}
              onClick={() => clickDay(dateStr)}
              className={cn(
                'aspect-square rounded-lg border text-left p-1.5 flex flex-col justify-between transition-colors',
                selected ? 'border-teal-900 bg-teal-50 ring-1 ring-teal-900' : 'border-sand-200 hover:border-teal-500',
                special && !selected && 'bg-gold-50 border-gold-300',
              )}
              title={info?.ruleName ?? undefined}
            >
              <span className="text-xs font-medium text-ink-700">{day}</span>
              {info && (
                <span className={cn('text-[10px] leading-tight nums', special ? 'text-gold-700 font-semibold' : 'text-ink-500')}>
                  {info.adultRate}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 text-[11px] text-ink-500">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-cream border border-sand-200" /> tarifa base</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gold-50 border border-gold-300" /> tem regra</span>
      </div>

      {sel && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-sand-50 border border-sand-200 p-3">
          <span className="text-sm text-ink-700">
            Selecionado: <strong>{fmtRange(sel.start, sel.end ?? sel.start)}</strong>
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>Criar tarifa</Button>
            <Button size="sm" variant="ghost" onClick={() => setSel(null)}>Limpar</Button>
          </div>
        </div>
      )}

      {createOpen && sel && (
        <RuleSheet
          roomTypeId={roomTypeId}
          initial={{ startDate: sel.start, endDate: sel.end ?? sel.start }}
          onClose={() => { setCreateOpen(false); setSel(null); }}
        />
      )}
    </Card>
  );
}

function RulesList({ periods, roomTypeId }: { periods: RatePeriodItem[]; roomTypeId: string }) {
  const del = useDeleteRatePeriod();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RatePeriodItem | null>(null);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-serif-display text-lg text-ink-950">Regras de tarifa</h2>
        <Button size="sm" onClick={() => setCreating(true)}>Nova regra</Button>
      </div>
      {periods.length === 0 ? (
        <EmptyState title="Nenhuma regra ainda" description="Sem regras, todas as datas usam a diária base. Crie uma pela agenda ou aqui." />
      ) : (
        <div className="space-y-2">
          {periods.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-sand-200 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-950 truncate">{p.name}</span>
                  {!p.active && <span className="text-[10px] text-ink-300 uppercase">inativa</span>}
                </div>
                <div className="text-xs text-ink-500">
                  {fmtRange(p.startDate, p.endDate)} ·{' '}
                  {p.adjustType === 'ABSOLUTE' ? fmtCurrency(p.value) : `+${p.value}%`}
                  {p.priority > 0 ? ` · prioridade ${p.priority}` : ''}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Editar</Button>
                <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Excluir a regra "${p.name}"?`)) del.mutate(p.id); }}>Excluir</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <RuleSheet roomTypeId={roomTypeId} onClose={() => setCreating(false)} />}
      {editing && <RuleSheet roomTypeId={roomTypeId} editItem={editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RuleSheet({
  roomTypeId,
  editItem,
  initial,
  onClose,
}: {
  roomTypeId: string;
  editItem?: RatePeriodItem;
  initial?: { startDate: string; endDate: string };
  onClose: () => void;
}) {
  const create = useCreateRatePeriod();
  const update = useUpdateRatePeriod();
  const [form, setForm] = useState({
    name: editItem?.name ?? '',
    startDate: editItem?.startDate ?? initial?.startDate ?? '',
    endDate: editItem?.endDate ?? initial?.endDate ?? '',
    adjustType: editItem?.adjustType ?? ('ABSOLUTE' as 'ABSOLUTE' | 'PERCENT'),
    value: editItem ? String(editItem.value) : '',
    priority: editItem ? String(editItem.priority) : '0',
  });
  const [error, setError] = useState<string | null>(null);
  const pending = create.isPending || update.isPending;

  async function submit() {
    setError(null);
    const value = Number(form.value.replace(',', '.'));
    if (!form.name.trim()) { setError('Dê um nome à regra'); return; }
    if (!form.startDate || !form.endDate) { setError('Informe o período'); return; }
    if (!(value > 0)) { setError('Informe um valor maior que zero'); return; }
    const body = {
      name: form.name.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      adjustType: form.adjustType,
      value,
      priority: Number(form.priority) || 0,
    };
    try {
      if (editItem) await update.mutateAsync({ id: editItem.id, ...body });
      else await create.mutateAsync({ ...body, roomTypeId });
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Erro ao salvar');
    }
  }

  return (
    <Sheet open onClose={onClose} title={editItem ? 'Editar regra' : 'Nova regra de tarifa'} maxWidth="md">
      <div className="space-y-3">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{error}</div>}
        <Field label="Nome (ex.: Alta temporada, Réveillon)">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="De"><input type="date" className={inputCls} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Até (inclusivo)"><input type="date" className={inputCls} value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
        </div>
        <Field label="Tipo de ajuste">
          <div className="flex gap-2">
            <button type="button" onClick={() => setForm({ ...form, adjustType: 'ABSOLUTE' })} className={cn('flex-1 rounded-lg border px-3 py-2 text-sm', form.adjustType === 'ABSOLUTE' ? 'bg-teal-900 text-cream border-teal-900' : 'border-sand-200')}>Valor fixo (R$)</button>
            <button type="button" onClick={() => setForm({ ...form, adjustType: 'PERCENT' })} className={cn('flex-1 rounded-lg border px-3 py-2 text-sm', form.adjustType === 'PERCENT' ? 'bg-teal-900 text-cream border-teal-900' : 'border-sand-200')}>Percentual (+%)</button>
          </div>
        </Field>
        <Field label={form.adjustType === 'ABSOLUTE' ? 'Nova diária do adulto (R$)' : 'Acréscimo sobre a base (%)'}>
          <input className={inputCls} value={form.value} inputMode="decimal" onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder={form.adjustType === 'ABSOLUTE' ? '250' : '30'} />
        </Field>
        <Field label="Prioridade (maior vence quando duas regras batem no mesmo dia)">
          <input className={inputCls} value={form.priority} inputMode="numeric" onChange={(e) => setForm({ ...form, priority: e.target.value })} />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button fullWidth onClick={submit} disabled={pending}>{pending ? 'Salvando…' : 'Salvar'}</Button>
          <Button fullWidth variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-500 mb-1.5 font-medium">{label}</span>
      {children}
    </label>
  );
}
