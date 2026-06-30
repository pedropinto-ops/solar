'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { AppShell, Icon } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardHeader, Button } from '@/components/ui/primitives';
import { StatusPill, Tag } from '@/components/ui/status-pill';
import { Avatar } from '@/components/ui/avatar';
import { Sheet, SheetItem } from '@/components/ui/sheet';
import { ChargeModal } from '@/components/charge-modal';
import {
  useReservation,
  useAvailableRooms,
  useAssignRoom,
  useCheckIn,
  useCheckOut,
  useCancelReservation,
} from '@/lib/hooks';
import { fmtDate, fmtCurrency, fmtDateTime } from '@/lib/format';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: res, isLoading } = useReservation(id);
  const [error, setError] = useState<string | null>(null);
  const [showCharge, setShowCharge] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const cancelMutation = useCancelReservation();

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-ink-500 text-sm">Carregando…</div>
      </AppShell>
    );
  }
  if (!res) {
    return (
      <AppShell>
        <div className="p-8 text-red-700 text-sm">Reserva não encontrada.</div>
      </AppShell>
    );
  }

  async function handleAction(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao executar ação');
    }
  }

  const nights = res.nights;
  const balance = res.folio.balance;
  const hasBalance = balance > 0.01;

  return (
    <AppShell>
      <PageHeader
        title={res.code}
        subtitle={`${fmtDate(res.checkInDate)} → ${fmtDate(res.checkOutDate)} · ${nights} noites`}
        back
        actions={
          <button
            onClick={() => setShowMore(true)}
            className="min-w-touch-sm min-h-touch-sm rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-950 md:hidden"
            aria-label="Mais opções"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="12" cy="19" r="1.2" />
            </svg>
          </button>
        }
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-5 pb-32 md:pb-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={res.status} size="md" />
          {res.primaryGuest?.tags.map((t) => <Tag key={t}>{t}</Tag>)}
        </div>

        {/* Layout responsivo: stack mobile, 2-col desktop */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Coluna principal */}
          <div className="md:col-span-2 space-y-5">
            {/* Hóspede */}
            <Card padding="lg">
              <CardHeader title="Hóspede titular" />
              {res.primaryGuest ? (
                <div className="flex items-start gap-4">
                  <Avatar name={res.primaryGuest.fullName} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="font-serif-display text-lg text-ink-950 mb-2">
                      {res.primaryGuest.fullName}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 text-sm text-ink-700">
                      <ContactRow icon="phone" text={res.primaryGuest.phone || '—'} />
                      <ContactRow icon="mail" text={res.primaryGuest.email || '—'} />
                      <ContactRow
                        icon="users"
                        text={`${res.adults} adulto${res.adults > 1 ? 's' : ''}${
                          res.children > 0 ? ` + ${res.children} criança${res.children > 1 ? 's' : ''}` : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-ink-300 text-sm">Sem titular vinculado.</div>
              )}
            </Card>

            {/* Folio */}
            <Card padding="none">
              <div className="px-5 py-4 border-b border-sand-100 flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-ink-500 font-medium">Folio</div>
              </div>
              {res.chargeItems.length === 0 ? (
                <div className="px-5 py-6 text-center text-sm text-ink-300">
                  Nenhum lançamento ainda.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {res.chargeItems.map((c, i) => (
                      <tr key={c.id} className={cn(i > 0 && 'border-t border-sand-100')}>
                        <td className="px-5 py-3 text-ink-500">{fmtDateTime(c.registeredAt)}</td>
                        <td className="px-5 py-3 text-ink-950">{c.description}</td>
                        <td className="px-5 py-3 text-right nums text-ink-950">
                          {fmtCurrency(c.totalAmount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-sand-200 bg-sand-50 font-medium">
                      <td colSpan={2} className="px-5 py-3 text-right text-sm">
                        Total
                      </td>
                      <td className="px-5 py-3 text-right font-serif-display text-lg nums">
                        {fmtCurrency(res.folio.totalCharges)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              )}
            </Card>

            {/* Pagamentos */}
            <Card padding="lg">
              <CardHeader title="Pagamentos" />
              {res.payments.length === 0 ? (
                <div className="text-ink-300 text-sm">Nenhum pagamento registrado.</div>
              ) : (
                <div className="space-y-3">
                  {res.payments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-lg bg-teal-50 text-teal-900 flex items-center justify-center text-xs font-semibold">
                          {p.method.slice(0, 3)}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-ink-950 truncate">
                            {p.method}
                          </div>
                          <div className="text-xs text-ink-500">
                            {fmtDateTime(p.paidAt || p.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm nums">{fmtCurrency(p.amount)}</span>
                        <StatusPill status={p.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar (desktop) ou abaixo (mobile) */}
          <div className="space-y-5">
            {/* Resumo financeiro destacado */}
            <div className="rounded-xl p-5 bg-teal-900 text-cream">
              <div className="text-xs uppercase tracking-widest text-teal-100 mb-4">
                Resumo financeiro
              </div>
              <div className="space-y-2 text-sm">
                <FinRow label="Diária" value={fmtCurrency(res.dailyRate)} />
                <FinRow label="Total" value={fmtCurrency(res.totalAmount)} />
                <FinRow label="Pago" value={fmtCurrency(res.folio.totalPaid)} muted />
                <div className="h-px my-1 bg-teal-700" />
                <div className="flex justify-between items-baseline pt-1">
                  <span className="text-xs uppercase tracking-widest text-teal-100">Saldo</span>
                  <span className={cn('font-serif-display text-2xl nums', hasBalance ? 'text-gold-500' : 'text-cream')}>
                    {fmtCurrency(balance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Acomodação */}
            <Card padding="lg">
              <CardHeader title="Acomodação" />
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-xs text-ink-500">Categoria</div>
                  <div className="font-medium mt-0.5">{res.roomType.name}</div>
                </div>
                <div>
                  <div className="text-xs text-ink-500">Quarto físico</div>
                  {res.room ? (
                    <div className="font-serif-display text-2xl text-teal-900">
                      {res.room.number}
                    </div>
                  ) : (
                    <RoomPicker reservationId={res.id} roomTypeId={res.roomType.id} checkIn={res.checkInDate} checkOut={res.checkOutDate} onError={setError} />
                  )}
                </div>
              </div>
            </Card>

            {/* Origem */}
            <Card padding="lg">
              <CardHeader title="Origem" />
              <div className="text-sm">{res.source}</div>
              {res.company && (
                <div className="mt-3">
                  <div className="text-xs text-ink-500">Empresa</div>
                  <div className="font-medium mt-0.5">{res.company.tradeName}</div>
                </div>
              )}
            </Card>

            {res.guestNotes && (
              <Card padding="lg">
                <CardHeader title="Notas do hóspede" />
                <div className="text-sm text-ink-700 whitespace-pre-wrap">{res.guestNotes}</div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Bottom action bar — mobile fixed, desktop inline acima */}
      <ActionBar
        reservation={res}
        balance={balance}
        onCharge={() => setShowCharge(true)}
        onCheckIn={() => handleAction(() => checkIn.mutateAsync({ id, earlyCheckIn: false }))}
        onCheckOut={() => handleAction(() => checkOut.mutateAsync({ id }))}
        onMore={() => setShowMore(true)}
      />

      {showCharge && (
        <ChargeModal
          reservationId={res.id}
          reservationCode={res.code}
          defaultAmount={Math.max(0, balance)}
          onClose={() => setShowCharge(false)}
        />
      )}

      <Sheet open={showMore} onClose={() => setShowMore(false)} title="Opções da reserva">
        {(res.status === 'PENDING' || res.status === 'CONFIRMED') && (
          <SheetItem
            label="Cancelar reserva"
            danger
            onClick={() => {
              const reason = prompt('Motivo do cancelamento:');
              if (reason) {
                setShowMore(false);
                handleAction(() => cancelMutation.mutateAsync({ id, reason }));
              }
            }}
          />
        )}
        <SheetItem
          label="Imprimir comprovante"
          onClick={() => {
            setShowMore(false);
            window.print();
          }}
        />
      </Sheet>
    </AppShell>
  );
}

function ActionBar({
  reservation,
  balance,
  onCharge,
  onCheckIn,
  onCheckOut,
  onMore,
}: {
  reservation: { status: string; room: unknown };
  balance: number;
  onCharge: () => void;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onMore: () => void;
}) {
  const { status } = reservation;
  const canCharge = ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(status);
  const hasBalance = balance > 0.01;

  return (
    <div className="fixed bottom-16 md:bottom-0 md:relative left-0 right-0 z-20 bg-cream border-t border-sand-200 safe-area-bottom md:border-t-0 md:bg-transparent">
      <div className="px-5 md:px-8 py-3 md:py-4 max-w-5xl flex gap-2">
        {canCharge && (
          <Button variant={hasBalance ? 'primary' : 'secondary'} size="lg" onClick={onCharge} className="flex-1 md:flex-none">
            💰 {hasBalance ? `Cobrar ${fmtCurrency(balance)}` : 'Nova cobrança'}
          </Button>
        )}
        {status === 'CONFIRMED' && (
          <Button variant="gold" size="lg" onClick={onCheckIn} disabled={!reservation.room} className="flex-1 md:flex-none">
            ✓ Check-in
          </Button>
        )}
        {status === 'CHECKED_IN' && (
          <Button variant="primary" size="lg" onClick={onCheckOut} className="flex-1 md:flex-none">
            ⇣ Check-out
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={onMore} className="md:hidden">
          ⋮
        </Button>
      </div>
    </div>
  );
}

function ContactRow({ icon, text }: { icon: 'phone' | 'mail' | 'users'; text: string }) {
  const paths: Record<string, JSX.Element> = {
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6" /></>,
    users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></>,
  };
  return (
    <div className="flex items-center gap-2">
      <svg className="w-3.5 h-3.5 text-ink-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[icon]}
      </svg>
      <span className="truncate">{text}</span>
    </div>
  );
}

function FinRow({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className={cn(muted ? 'text-teal-100/70' : 'text-cream/80')}>{label}</span>
      <span className={cn('font-mono nums', muted ? 'text-teal-100/70' : 'text-cream')}>{value}</span>
    </div>
  );
}

function RoomPicker({
  reservationId,
  roomTypeId,
  checkIn,
  checkOut,
  onError,
}: {
  reservationId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  onError: (e: string | null) => void;
}) {
  const { data: rooms, isLoading } = useAvailableRooms({
    roomTypeId,
    checkIn: checkIn.slice(0, 10),
    checkOut: checkOut.slice(0, 10),
  });
  const assignRoom = useAssignRoom();
  const [selected, setSelected] = useState('');

  async function assign() {
    if (!selected) return;
    onError(null);
    try {
      await assignRoom.mutateAsync({ id: reservationId, roomId: selected });
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao alocar quarto');
    }
  }

  if (isLoading) return <span className="text-ink-300 text-xs">buscando…</span>;
  if (!rooms || rooms.length === 0)
    return <span className="text-red-700 text-xs">Sem quartos disponíveis</span>;

  return (
    <div className="flex gap-2 mt-1">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="text-sm rounded-lg border border-sand-200 px-2 py-1.5 flex-1 bg-cream"
      >
        <option value="">Selecione…</option>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            Q{r.number}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={assign} disabled={!selected}>
        Alocar
      </Button>
    </div>
  );
}
