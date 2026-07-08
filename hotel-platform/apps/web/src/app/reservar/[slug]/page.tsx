'use client';

/* eslint-disable @next/next/no-img-element */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fmtCurrency, toDateInput, addDays } from '@/lib/format';
import { Logo } from '@/components/ui/logo';
import {
  CONTRACT_VERSION,
  CONTRACT_TITLE,
  CONTRACT_INTRO,
  CONTRACT_CLAUSES,
} from '@/lib/contract';

type Step = 'search' | 'guest' | 'contract' | 'done';

interface PropertyInfo {
  id: string;
  name: string;
  addressCity: string | null;
  addressState: string | null;
}

interface AvailabilityResponse {
  nights: number;
  checkInDate: string;
  checkOutDate: string;
  roomTypes: Array<{
    id: string;
    name: string;
    description: string | null;
    amenities: string[];
    bedConfig: string | null;
    maxOccupancy: number;
    dailyRate: number;
    totalAmount: number;
    available: number;
    roomsNeeded: number;
    guests: number;
    soldOut: boolean;
  }>;
}

interface Companion {
  fullName: string;
  documentType: string;
  documentNumber: string;
  age: string;
}

// Preço por pessoa por idade (Modelo A). ESPELHA a regra do backend em
// public-reservation.service.ts — manter em sincronia.
const CHILD_FREE_MAX_AGE = 8;
const CHILD_FEE_MAX_AGE = 15;
const CHILD_DAILY_FEE = 50;
function personDailyRate(age: number, adultRate: number): number {
  if (age <= CHILD_FREE_MAX_AGE) return 0;
  if (age <= CHILD_FEE_MAX_AGE) return CHILD_DAILY_FEE;
  return adultRate;
}

interface ReservationCreatedResponse {
  reservations: Array<{ id: string; code: string; status: string }>;
  roomsQuantity: number;
  totalAmount: number;
  depositAmount: number;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('T')[0].split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

export default function PublicReservePage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const [step, setStep] = useState<Step>('search');

  const tomorrow = useMemo(() => toDateInput(addDays(new Date(), 1)), []);
  const dayAfter = useMemo(() => toDateInput(addDays(new Date(), 2)), []);

  const [search, setSearch] = useState({
    checkInDate: tomorrow,
    checkOutDate: dayAfter,
    guests: 2,
  });
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);

  const [guest, setGuest] = useState({
    fullName: '',
    documentType: 'CPF',
    documentNumber: '',
    email: '',
    phone: '',
    consentMarketing: false,
  });
  // Acompanhantes: tamanho = total de hóspedes − 1 (o titular).
  const [companions, setCompanions] = useState<Companion[]>([
    { fullName: '', documentType: 'CPF', documentNumber: '', age: '' },
  ]);

  function setGuestsCount(n: number) {
    const g = Math.max(1, Math.min(30, Number.isFinite(n) ? n : 1));
    setSearch((s) => ({ ...s, guests: g }));
    setCompanions((prev) => {
      const next = prev.slice(0, g - 1);
      while (next.length < g - 1) {
        next.push({ fullName: '', documentType: 'CPF', documentNumber: '', age: '' });
      }
      return next;
    });
  }

  function setCompanion(i: number, patch: Partial<Companion>) {
    setCompanions((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  const [accepted, setAccepted] = useState(false);
  const [result, setResult] = useState<ReservationCreatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['public-property', slug],
    queryFn: () => apiFetch<PropertyInfo>(`/public/property/${slug}`, { skipAuth: true }),
    retry: false,
  });

  const availability = useMutation({
    mutationFn: () =>
      apiFetch<AvailabilityResponse>(
        `/public/property/${slug}/availability?` +
          new URLSearchParams({
            checkInDate: search.checkInDate,
            checkOutDate: search.checkOutDate,
            guests: String(search.guests),
          }),
        { skipAuth: true },
      ),
  });

  const createReservation = useMutation({
    mutationFn: (idempotencyKey: string) =>
      apiFetch<ReservationCreatedResponse>(`/public/property/${slug}/reservations`, {
        method: 'POST',
        skipAuth: true,
        body: {
          roomTypeId: selectedRoomTypeId,
          checkInDate: search.checkInDate,
          checkOutDate: search.checkOutDate,
          guest: {
            fullName: guest.fullName,
            documentType: guest.documentType,
            documentNumber: guest.documentNumber,
            email: guest.email,
            phone: guest.phone,
            consentMarketing: guest.consentMarketing,
          },
          companions: companions.map((c) => ({
            fullName: c.fullName,
            documentType: c.documentType,
            documentNumber: c.documentNumber,
            age: Number(c.age),
          })),
          contractAccepted: true,
          contractVersion: CONTRACT_VERSION,
          idempotencyKey,
        },
      }),
  });

  async function handleSearch() {
    setError(null);
    try {
      await availability.mutateAsync();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao buscar');
    }
  }

  function chooseRoomType(id: string) {
    setSelectedRoomTypeId(id);
    setStep('guest');
  }

  async function submitReservation() {
    setError(null);
    if (!selectedRoomTypeId || !accepted) return;
    try {
      const r = await createReservation.mutateAsync(generateUuid());
      setResult(r);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao enviar solicitação');
    }
  }

  if (propertyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50 text-ink-500">
        Carregando…
      </div>
    );
  }
  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sand-50 px-6 text-center">
        <div className="text-ink-700">Hotel não encontrado.</div>
      </div>
    );
  }

  const selectedRoomType = availability.data?.roomTypes.find(
    (rt) => rt.id === selectedRoomTypeId,
  );

  // Total estimado por idade (titular = adulto/diária integral).
  const nights = availability.data?.nights ?? 0;
  const estimatedTotal = selectedRoomType
    ? (selectedRoomType.dailyRate +
        companions.reduce(
          (s, c) => s + personDailyRate(Number(c.age) || 0, selectedRoomType.dailyRate),
          0,
        )) *
      nights
    : 0;

  return (
    <div className="min-h-screen bg-sand-50">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        <header className="flex flex-col items-center text-center">
          <Logo className="w-28 h-auto mb-1" />
          <p className="text-sm text-ink-500">
            {property.addressCity ? `${property.addressCity} · ${property.addressState}` : 'Bahia'}
          </p>
        </header>

        {step !== 'done' && <Stepper current={step} />}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Passo 1: Datas / disponibilidade */}
        {step === 'search' && (
          <div className="bg-cream rounded-2xl border border-sand-200 p-5 space-y-4">
            <h2 className="font-serif-display text-xl text-ink-950">Quando você quer se hospedar?</h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Check-in">
                <input type="date" value={search.checkInDate}
                  onChange={(e) => setSearch({ ...search, checkInDate: e.target.value })}
                  className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
              </Field>
              <Field label="Check-out">
                <input type="date" value={search.checkOutDate}
                  onChange={(e) => setSearch({ ...search, checkOutDate: e.target.value })}
                  className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
              </Field>
              <Field label="Hóspedes (total)">
                <input type="number" min={1} max={30} value={search.guests}
                  onChange={(e) => setGuestsCount(parseInt(e.target.value, 10))}
                  className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
              </Field>
              <div className="flex items-end">
                <p className="text-xs text-ink-500 pb-2">
                  Você (titular) + acompanhantes. Diária por pessoa: até 8 anos grátis,
                  9–15 anos {fmtCurrency(CHILD_DAILY_FEE)}/dia, 16+ diária integral.
                </p>
              </div>
            </div>

            <button onClick={handleSearch} disabled={availability.isPending}
              className="w-full bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md hover:bg-teal-700 disabled:opacity-50">
              {availability.isPending ? 'Buscando…' : 'Buscar disponibilidade'}
            </button>

            {availability.data && (
              <div className="pt-4 border-t border-sand-200 space-y-3">
                <div className="text-sm text-ink-500">
                  {availability.data.nights} noite{availability.data.nights > 1 ? 's' : ''} ·{' '}
                  grupo de {search.guests} hóspede{search.guests > 1 ? 's' : ''}
                </div>

                {availability.data.roomTypes.filter((rt) => !rt.soldOut).length === 0 ? (
                  <div className="rounded-xl border border-sand-200 bg-sand-50 p-4 text-sm text-ink-500">
                    Não temos quartos suficientes para{' '}
                    <strong className="text-ink-950">
                      {search.guests} hóspede{search.guests > 1 ? 's' : ''}
                    </strong>{' '}
                    nessas datas. Tente outras datas ou fale com a recepção.
                  </div>
                ) : (
                  availability.data.roomTypes
                    .filter((rt) => !rt.soldOut)
                    .map((rt) => (
                      <RoomTypeCard key={rt.id} roomType={rt} onChoose={() => chooseRoomType(rt.id)} />
                    ))
                )}
              </div>
            )}
          </div>
        )}

        {/* Passo 2: Dados do hóspede */}
        {step === 'guest' && selectedRoomType && availability.data && (
          <div className="bg-cream rounded-2xl border border-sand-200 p-5 space-y-4">
            <button onClick={() => setStep('search')} className="text-sm text-teal-700 hover:underline">← voltar</button>

            <SummaryBox roomType={selectedRoomType.name} rooms={selectedRoomType.roomsNeeded}
              checkIn={availability.data.checkInDate} checkOut={availability.data.checkOutDate}
              nights={availability.data.nights} total={estimatedTotal} />

            {selectedRoomType.roomsNeeded > 1 && (
              <div className="text-xs bg-teal-50 border border-teal-100 text-teal-900 rounded-lg p-3">
                Seu grupo de <strong>{search.guests} pessoas</strong> ocupará{' '}
                <strong>{selectedRoomType.roomsNeeded} quartos</strong> (até {selectedRoomType.maxOccupancy} por quarto).
              </div>
            )}

            <h2 className="font-serif-display text-xl text-ink-950">Titular da reserva</h2>

            <input type="text" placeholder="Nome completo *" value={guest.fullName}
              onChange={(e) => setGuest({ ...guest, fullName: e.target.value })}
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
            <div className="grid grid-cols-3 gap-2">
              <select value={guest.documentType}
                onChange={(e) => setGuest({ ...guest, documentType: e.target.value })}
                className="rounded-lg border border-sand-200 px-2 min-h-touch-md bg-cream text-sm">
                <option value="CPF">CPF</option>
                <option value="PASSPORT">Passaporte</option>
              </select>
              <input type="text" placeholder={guest.documentType === 'CPF' ? 'CPF' : 'Passaporte'}
                value={guest.documentNumber}
                onChange={(e) => setGuest({ ...guest, documentNumber: e.target.value })}
                className="col-span-2 rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
            </div>
            <input type="email" placeholder="E-mail *" value={guest.email}
              onChange={(e) => setGuest({ ...guest, email: e.target.value })}
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
            <input type="tel" placeholder="WhatsApp (com DDD) *" value={guest.phone}
              onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
            <label className="flex items-start gap-2 text-xs text-ink-500">
              <input type="checkbox" checked={guest.consentMarketing}
                onChange={(e) => setGuest({ ...guest, consentMarketing: e.target.checked })} className="mt-0.5" />
              Aceito receber comunicações sobre minhas reservas e promoções (LGPD).
            </label>

            {companions.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-sand-200">
                <h3 className="font-serif-display text-lg text-ink-950">
                  Acompanhantes ({companions.length})
                </h3>
                {companions.map((c, i) => {
                  const ageNum = Number(c.age);
                  const rate =
                    c.age !== '' && selectedRoomType
                      ? personDailyRate(ageNum, selectedRoomType.dailyRate)
                      : null;
                  return (
                    <div key={i} className="space-y-2 border border-sand-200 rounded-lg p-3">
                      <input type="text" placeholder={`Nome do acompanhante ${i + 1} *`} value={c.fullName}
                        onChange={(e) => setCompanion(i, { fullName: e.target.value })}
                        className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
                      <div className="grid grid-cols-3 gap-2">
                        <select value={c.documentType}
                          onChange={(e) => setCompanion(i, { documentType: e.target.value })}
                          className="rounded-lg border border-sand-200 px-2 min-h-touch-md bg-cream text-sm">
                          <option value="CPF">CPF</option>
                          <option value="PASSPORT">Passaporte</option>
                        </select>
                        <input type="text" placeholder={c.documentType === 'CPF' ? 'CPF' : 'Passaporte'}
                          value={c.documentNumber}
                          onChange={(e) => setCompanion(i, { documentNumber: e.target.value })}
                          className="col-span-2 rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min={0} max={120} placeholder="Idade *" value={c.age}
                          onChange={(e) => setCompanion(i, { age: e.target.value })}
                          className="w-24 rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm" />
                        {rate !== null && (
                          <span className="text-xs text-ink-500">
                            {rate === 0
                              ? 'Grátis (até 8 anos)'
                              : `${fmtCurrency(rate)}/noite`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button onClick={() => { setError(null); setStep('contract'); }}
              disabled={
                !guest.fullName || !guest.documentNumber || !guest.email || !guest.phone ||
                companions.some((c) => !c.fullName.trim() || !c.documentNumber.trim() || c.age.trim() === '')
              }
              className="w-full bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md hover:bg-teal-700 disabled:opacity-50">
              Continuar para o contrato →
            </button>
          </div>
        )}

        {/* Passo 3: Contrato + aceite */}
        {step === 'contract' && selectedRoomType && availability.data && (
          <div className="bg-cream rounded-2xl border border-sand-200 p-5 space-y-4">
            <button onClick={() => setStep('guest')} className="text-sm text-teal-700 hover:underline">← voltar</button>

            <SummaryBox roomType={selectedRoomType.name} rooms={selectedRoomType.roomsNeeded}
              checkIn={availability.data.checkInDate} checkOut={availability.data.checkOutDate}
              nights={availability.data.nights} total={estimatedTotal}
              guestName={guest.fullName} />

            <h2 className="font-serif-display text-xl text-ink-950">{CONTRACT_TITLE}</h2>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-sand-200 bg-sand-50 p-3 text-xs text-ink-700 space-y-2 leading-relaxed">
              <p>{CONTRACT_INTRO}</p>
              {CONTRACT_CLAUSES.map((c) => (
                <div key={c.title}>
                  <p className="font-semibold text-ink-950 mt-2">{c.title}</p>
                  {c.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              ))}
            </div>

            <label className="flex items-start gap-2.5 text-sm text-ink-950 bg-teal-50 border border-teal-100 rounded-lg p-3">
              <input type="checkbox" checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 w-4 h-4" />
              Li e aceito os termos do contrato de hospedagem do Solar Irará Hotel.
            </label>

            <button onClick={submitReservation}
              disabled={!accepted || createReservation.isPending}
              className="w-full bg-teal-900 text-cream font-semibold rounded-lg min-h-touch-md hover:bg-teal-700 disabled:opacity-50">
              {createReservation.isPending ? 'Enviando…' : 'Confirmar solicitação de reserva'}
            </button>
            <p className="text-[11px] text-ink-400 text-center">
              O pagamento é combinado diretamente com o hotel após a confirmação.
            </p>
          </div>
        )}

        {/* Passo 4: Confirmação */}
        {step === 'done' && result && (
          <div className="bg-cream rounded-2xl border border-sand-200 p-6 space-y-4 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-teal-50 text-teal-900 flex items-center justify-center">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h2 className="font-serif-display text-2xl text-teal-900">Solicitação enviada!</h2>
            <div className="text-sm text-ink-700">
              {result.roomsQuantity > 1 ? (
                <>Sua solicitação de <strong>{result.roomsQuantity} quartos</strong> foi registrada com os códigos{' '}
                  <strong className="text-ink-950">{result.reservations.map((r) => r.code).join(', ')}</strong>{' '}
                  e o contrato foi aceito.</>
              ) : (
                <>Sua solicitação de reserva foi registrada com o código{' '}
                  <strong className="text-ink-950">{result.reservations[0]?.code}</strong> e o contrato foi aceito.</>
              )}
            </div>
            <div className="bg-sand-50 rounded-lg p-3 text-xs text-ink-600 text-left space-y-1">
              <div>O <strong>Solar Irará Hotel</strong> vai entrar em contato pelo WhatsApp{' '}
                <strong>{guest.phone}</strong> ou e-mail <strong>{guest.email}</strong> para
                confirmar a disponibilidade e combinar o pagamento.</div>
              <div>Total estimado da estadia: <strong>{fmtCurrency(result.totalAmount)}</strong>.</div>
            </div>
            <p className="text-[11px] text-ink-400">
              Guarde {result.roomsQuantity > 1 ? 'os códigos' : 'o código'} da sua solicitação.
            </p>
          </div>
        )}

        <footer className="text-center text-[11px] text-ink-300 pt-2">
          Solar Irará Hotel · Irará-BA
        </footer>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function SummaryBox({
  roomType, checkIn, checkOut, nights, total, guestName, rooms,
}: {
  roomType: string; checkIn: string; checkOut: string; nights: number; total: number; guestName?: string; rooms?: number;
}) {
  return (
    <div className="bg-sand-50 rounded-lg border border-sand-200 p-3 text-sm">
      <div className="font-medium text-ink-950">{rooms && rooms > 1 ? `${rooms} × ${roomType}` : roomType}</div>
      <div className="text-ink-500 text-xs mt-0.5">
        {fmtDate(checkIn)} → {fmtDate(checkOut)} · {nights} noite{nights > 1 ? 's' : ''}
      </div>
      {guestName && <div className="text-ink-500 text-xs">Hóspede: {guestName}</div>}
      <div className="text-teal-900 font-semibold mt-1">Total: {fmtCurrency(total)}</div>
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'search', label: 'Datas' },
    { key: 'guest', label: 'Seus dados' },
    { key: 'contract', label: 'Contrato' },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex justify-center gap-5">
      {steps.map((s, i) => (
        <div key={s.key} className={`text-xs font-medium ${i === idx ? 'text-teal-900' : i < idx ? 'text-ink-700' : 'text-ink-300'}`}>
          {i + 1}. {s.label}
        </div>
      ))}
    </div>
  );
}

function RoomTypeCard({
  roomType, onChoose,
}: {
  roomType: AvailabilityResponse['roomTypes'][number];
  onChoose: () => void;
}) {
  return (
    <div className="border border-sand-200 rounded-xl p-4 bg-cream">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-serif-display text-lg text-ink-950 leading-tight">{roomType.name}</h3>
          {roomType.bedConfig && <div className="text-xs text-ink-500">{roomType.bedConfig}</div>}
        </div>
        <div className="text-right">
          <div className="font-semibold text-ink-950">{fmtCurrency(roomType.dailyRate)}</div>
          <div className="text-xs text-ink-500">por noite</div>
        </div>
      </div>

      {roomType.description && <p className="text-sm text-ink-500 mb-3">{roomType.description}</p>}

      {roomType.amenities.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {roomType.amenities.slice(0, 6).map((a) => (
            <span key={a} className="bg-sand-100 text-ink-700 text-xs px-2 py-0.5 rounded">{a}</span>
          ))}
        </div>
      )}

      {roomType.roomsNeeded > 1 && (
        <div className="text-xs bg-teal-50 border border-teal-100 text-teal-900 rounded-lg p-2.5 mb-3">
          {roomType.guests} hóspedes ocupam <strong>{roomType.roomsNeeded} quartos</strong>{' '}
          (até {roomType.maxOccupancy} por quarto).
        </div>
      )}

      <div className="flex justify-between items-center pt-3 border-t border-sand-200">
        <div className="text-sm">
          <div className="text-ink-950 font-semibold">
            {fmtCurrency(roomType.dailyRate)}{' '}
            <span className="text-xs font-normal text-ink-500">por adulto/noite</span>
          </div>
          <div className="text-xs text-teal-700">
            {roomType.available} disponíve{roomType.available === 1 ? 'l' : 'is'}
          </div>
        </div>
        <button onClick={onChoose}
          className="bg-teal-900 text-cream text-sm font-semibold px-4 min-h-touch-sm rounded-lg hover:bg-teal-700 disabled:opacity-50">
          Selecionar →
        </button>
      </div>
    </div>
  );
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
