'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button } from '@/components/ui/primitives';
import {
  useRoomTypes,
  useCreateGuest,
  useCreateReservation,
  type Guest,
} from '@/lib/hooks';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fmtCurrency, toDateInput, addDays } from '@/lib/format';
import { cn } from '@/lib/utils';

type Step = 'guest' | 'reservation' | 'review';

export default function NewReservationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('guest');
  const [guest, setGuest] = useState<Guest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => toDateInput(new Date()), []);
  const tomorrow = useMemo(() => toDateInput(addDays(new Date(), 1)), []);
  const [form, setForm] = useState({
    roomTypeId: '',
    checkInDate: today,
    checkOutDate: tomorrow,
    adults: 2,
    children: 0,
    billingMode: 'DEPOSIT_BALANCE',
    depositPercent: 30,
    dailyRate: 0,
    source: 'RECEPTION' as const,
    guestNotes: '',
  });

  const { data: roomTypes } = useRoomTypes();
  const createReservation = useCreateReservation();
  const selectedRoomType = useMemo(
    () => roomTypes?.find((rt) => rt.id === form.roomTypeId),
    [roomTypes, form.roomTypeId],
  );

  useEffect(() => {
    if (selectedRoomType && form.dailyRate === 0) {
      setForm((f) => ({ ...f, dailyRate: parseFloat(selectedRoomType.basePrice) }));
    }
  }, [selectedRoomType]);

  const nights = useMemo(() => {
    const ci = new Date(form.checkInDate);
    const co = new Date(form.checkOutDate);
    return Math.max(0, Math.round((co.getTime() - ci.getTime()) / 86400000));
  }, [form.checkInDate, form.checkOutDate]);

  const total = nights * form.dailyRate;

  async function handleSubmit() {
    if (!guest) return;
    setError(null);
    try {
      const res = await createReservation.mutateAsync({
        roomTypeId: form.roomTypeId,
        primaryGuestId: guest.id,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        adults: form.adults,
        children: form.children,
        billingMode: form.billingMode,
        depositPercent: form.depositPercent,
        dailyRate: form.dailyRate,
        source: form.source,
        guestNotes: form.guestNotes || undefined,
      });
      router.push(`/reservas/${(res as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar reserva');
    }
  }

  return (
    <AppShell>
      <PageHeader title="Nova reserva" back />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-2xl space-y-5">
        <Stepper current={step} />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {step === 'guest' && (
          <GuestStep
            selected={guest}
            onSelect={(g) => { setGuest(g); setStep('reservation'); }}
          />
        )}

        {step === 'reservation' && (
          <ReservationStep
            guest={guest!}
            form={form}
            onChange={setForm}
            roomTypes={roomTypes || []}
            nights={nights}
            total={total}
            onBack={() => setStep('guest')}
            onNext={() => setStep('review')}
          />
        )}

        {step === 'review' && (
          <ReviewStep
            guest={guest!}
            form={form}
            roomTypeName={selectedRoomType?.name || ''}
            nights={nights}
            total={total}
            onBack={() => setStep('reservation')}
            onConfirm={handleSubmit}
            loading={createReservation.isPending}
          />
        )}
      </div>
    </AppShell>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'guest', label: 'Hóspede' },
    { key: 'reservation', label: 'Reserva' },
    { key: 'review', label: 'Revisão' },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex gap-2">
      {steps.map((s, i) => (
        <div
          key={s.key}
          className={cn(
            'flex-1 text-center text-sm py-2 border-b-2',
            i === idx ? 'border-teal-700 text-teal-700 font-semibold' :
            i < idx ? 'border-ink-300 text-ink-700' :
            'border-sand-200 text-ink-300',
          )}
        >
          {i + 1}. {s.label}
        </div>
      ))}
    </div>
  );
}

function GuestStep({ selected, onSelect }: { selected: Guest | null; onSelect: (g: Guest) => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Guest[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function search() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const data = await apiFetch<Guest[]>(`/guests?q=${encodeURIComponent(q)}`);
      setResults(data);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Card padding="lg" className="space-y-4">
      <h2 className="font-serif-display text-lg text-ink-950">Quem está se hospedando?</h2>

      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Buscar por nome, CPF, e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1 rounded-lg border border-sand-200 px-3 outline-none focus:border-teal-500 min-h-touch-md bg-cream text-sm"
        />
        <Button variant="secondary" size="md" onClick={search}>
          Buscar
        </Button>
      </div>

      {searching && <div className="text-sm text-ink-300">Buscando…</div>}

      {results.length > 0 && (
        <div className="border border-sand-200 rounded-xl divide-y divide-sand-100 max-h-64 overflow-auto">
          {results.map((g) => (
            <button
              key={g.id}
              onClick={() => onSelect(g)}
              className="w-full text-left px-3 py-3 hover:bg-sand-50 flex justify-between items-center min-h-touch-md"
            >
              <div>
                <div className="font-medium text-sm">{g.fullName}</div>
                <div className="text-xs text-ink-500">
                  {g.documentType} {g.documentNumber}
                </div>
              </div>
              <span className="text-xs text-teal-700">Usar →</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-4 border-t border-sand-100">
        <button
          onClick={() => setShowNew(!showNew)}
          className="text-sm text-teal-700 hover:text-teal-900"
        >
          {showNew ? '← Cancelar' : '+ Cadastrar novo hóspede'}
        </button>
      </div>

      {showNew && <NewGuestForm onCreated={onSelect} />}
    </Card>
  );
}

function NewGuestForm({ onCreated }: { onCreated: (g: Guest) => void }) {
  const createGuest = useCreateGuest();
  const [data, setData] = useState({
    fullName: '', documentType: 'CPF', documentNumber: '',
    email: '', phone: '', consentMarketing: false,
  });
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      const guest = await createGuest.mutateAsync({
        fullName: data.fullName,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        email: data.email || undefined,
        phone: data.phone || undefined,
        consentMarketing: data.consentMarketing,
      });
      onCreated(guest);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    }
  }

  return (
    <div className="bg-sand-50 rounded-xl p-4 space-y-3 border border-sand-200">
      <h3 className="font-medium text-sm">Cadastrar hóspede</h3>
      {error && <div className="text-red-700 text-xs bg-red-50 p-2 rounded-lg">{error}</div>}

      <Field label="Nome completo *">
        <input
          type="text"
          value={data.fullName}
          onChange={(e) => setData({ ...data, fullName: e.target.value })}
          className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Tipo documento">
          <select
            value={data.documentType}
            onChange={(e) => setData({ ...data, documentType: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          >
            <option value="CPF">CPF</option>
            <option value="PASSPORT">Passaporte</option>
            <option value="RG">RG</option>
            <option value="CNH">CNH</option>
          </select>
        </Field>
        <Field label="Número *">
          <input
            type="text"
            value={data.documentNumber}
            onChange={(e) => setData({ ...data, documentNumber: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="E-mail">
          <input
            type="email"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Telefone (com DDD)">
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => setData({ ...data, phone: e.target.value })}
            placeholder="+5511987654321"
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-500">
        <input
          type="checkbox"
          checked={data.consentMarketing}
          onChange={(e) => setData({ ...data, consentMarketing: e.target.checked })}
        />
        Hóspede consente em receber comunicações de marketing
      </label>

      <Button
        fullWidth
        size="md"
        onClick={submit}
        disabled={!data.fullName || !data.documentNumber || createGuest.isPending}
      >
        {createGuest.isPending ? 'Cadastrando…' : 'Cadastrar e continuar'}
      </Button>
    </div>
  );
}

function ReservationStep({
  guest, form, onChange, roomTypes, nights, total, onBack, onNext,
}: {
  guest: Guest;
  form: any;
  onChange: (f: any) => void;
  roomTypes: { id: string; name: string; basePrice: string; maxOccupancy: number }[];
  nights: number;
  total: number;
  onBack: () => void;
  onNext: () => void;
}) {
  const valid = form.roomTypeId && nights > 0 && form.adults >= 1 && form.dailyRate > 0;

  return (
    <Card padding="lg" className="space-y-4">
      <div className="bg-teal-50 rounded-lg p-3 text-sm">
        Hóspede: <span className="font-medium">{guest.fullName}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Check-in *">
          <input
            type="date"
            value={form.checkInDate}
            onChange={(e) => onChange({ ...form, checkInDate: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Check-out *">
          <input
            type="date"
            value={form.checkOutDate}
            onChange={(e) => onChange({ ...form, checkOutDate: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Categoria *" className="sm:col-span-2">
          <select
            value={form.roomTypeId}
            onChange={(e) => {
              const rt = roomTypes.find((r) => r.id === e.target.value);
              onChange({ ...form, roomTypeId: e.target.value, dailyRate: rt ? parseFloat(rt.basePrice) : form.dailyRate });
            }}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          >
            <option value="">Selecione…</option>
            {roomTypes.map((rt) => (
              <option key={rt.id} value={rt.id}>
                {rt.name} (até {rt.maxOccupancy} pessoas) — {fmtCurrency(rt.basePrice)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Diária (R$) *">
          <input
            type="number"
            step="0.01"
            value={form.dailyRate}
            onChange={(e) => onChange({ ...form, dailyRate: parseFloat(e.target.value) || 0 })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Origem">
          <select
            value={form.source}
            onChange={(e) => onChange({ ...form, source: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          >
            <option value="RECEPTION">Recepção</option>
            <option value="PHONE">Telefone</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">E-mail</option>
            <option value="WALK_IN">Walk-in</option>
            <option value="DIRECT">Direta (site)</option>
          </select>
        </Field>
        <Field label="Adultos">
          <input
            type="number" min={1}
            value={form.adults}
            onChange={(e) => onChange({ ...form, adults: parseInt(e.target.value, 10) || 1 })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Crianças">
          <input
            type="number" min={0}
            value={form.children}
            onChange={(e) => onChange({ ...form, children: parseInt(e.target.value, 10) || 0 })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          />
        </Field>
        <Field label="Modo de cobrança" className="sm:col-span-2">
          <select
            value={form.billingMode}
            onChange={(e) => onChange({ ...form, billingMode: e.target.value })}
            className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
          >
            <option value="DEPOSIT_BALANCE">Sinal + Saldo (B2C)</option>
            <option value="POSTPAID_CORPORATE">Pós-pago corporativo</option>
          </select>
        </Field>
      </div>

      <Field label="Notas do hóspede (opcional)">
        <textarea
          rows={2}
          value={form.guestNotes}
          onChange={(e) => onChange({ ...form, guestNotes: e.target.value })}
          className="w-full rounded-lg border border-sand-200 px-3 py-2 bg-cream text-sm"
          placeholder="Cama extra, alergias…"
        />
      </Field>

      <div className="bg-sand-50 rounded-lg p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-ink-500">Noites:</span>
          <span className="font-medium nums">{nights}</span>
        </div>
        <div className="flex justify-between text-lg font-bold border-t border-sand-200 pt-2 mt-2">
          <span className="font-serif-display">Total:</span>
          <span className="font-serif-display nums">{fmtCurrency(total)}</span>
        </div>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="secondary" onClick={onBack}>← Voltar</Button>
        <Button onClick={onNext} disabled={!valid}>Continuar →</Button>
      </div>
    </Card>
  );
}

function ReviewStep({
  guest, form, roomTypeName, nights, total, onBack, onConfirm, loading,
}: any) {
  return (
    <Card padding="lg" className="space-y-5">
      <h2 className="font-serif-display text-lg text-ink-950">Confirme os detalhes</h2>

      <div className="space-y-2 text-sm">
        <Row label="Hóspede" value={guest.fullName} />
        <Row label="Documento" value={`${guest.documentType} ${guest.documentNumber}`} />
        <Row label="Categoria" value={roomTypeName} />
        <Row label="Período" value={`${form.checkInDate} → ${form.checkOutDate} (${nights} noites)`} />
        <Row label="Pessoas" value={`${form.adults} adultos${form.children > 0 ? ` + ${form.children} crianças` : ''}`} />
        <Row label="Diária" value={fmtCurrency(form.dailyRate)} />
        <Row
          label="Cobrança"
          value={form.billingMode === 'DEPOSIT_BALANCE' ? `Sinal ${form.depositPercent}% + Saldo` : 'Pós-pago corporativo'}
        />
        <Row label="Origem" value={form.source} />
      </div>

      <div className="bg-teal-900 text-cream rounded-xl p-4 flex justify-between items-baseline">
        <span className="text-sm uppercase tracking-widest">Total</span>
        <span className="font-serif-display text-2xl nums">{fmtCurrency(total)}</span>
      </div>

      <div className="flex justify-between gap-2 pt-2">
        <Button variant="secondary" onClick={onBack} disabled={loading}>← Voltar</Button>
        <Button onClick={onConfirm} disabled={loading} size="lg">
          {loading ? 'Criando…' : '✓ Confirmar'}
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="block text-xs text-ink-500 mb-1.5 font-medium">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-sand-100 pb-2 gap-2">
      <span className="text-ink-500 shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
