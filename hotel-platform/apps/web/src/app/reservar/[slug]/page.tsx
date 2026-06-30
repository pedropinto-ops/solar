'use client';

import { use, useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch, ApiError } from '@/lib/api-client';
import { fmtCurrency, toDateInput, addDays } from '@/lib/format';

type Step = 'search' | 'guest' | 'pix';

interface PropertyInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  checkInTime: string;
  checkOutTime: string;
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
    photos: string[];
    amenities: string[];
    maxOccupancy: number;
    bedConfig: string | null;
    sizeSqm: number | null;
    dailyRate: number;
    totalAmount: number;
    available: number;
    soldOut: boolean;
  }>;
}

interface ReservationCreatedResponse {
  reservation: {
    id: string;
    code: string;
    status: string;
    holdExpiresAt: string;
    totalAmount: number;
    depositAmount: number;
  };
  payment: {
    id: string;
    method: string;
    amount: number;
    pixQrCode: string | null;
    pixCopyPaste: string | null;
    pixExpiresAt: string;
  } | null;
}

export default function PublicReservePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [step, setStep] = useState<Step>('search');

  const today = useMemo(() => toDateInput(addDays(new Date(), 1)), []);
  const dayAfter = useMemo(() => toDateInput(addDays(new Date(), 2)), []);

  const [search, setSearch] = useState({
    checkInDate: today,
    checkOutDate: dayAfter,
    adults: 2,
    children: 0,
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

  const [result, setResult] = useState<ReservationCreatedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Carrega informações da propriedade
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['public-property', slug],
    queryFn: () => apiFetch<PropertyInfo>(`/public/property/${slug}`, { skipAuth: true }),
    retry: false,
  });

  // Busca de disponibilidade
  const availability = useMutation({
    mutationFn: () =>
      apiFetch<AvailabilityResponse>(
        `/public/property/${slug}/availability?` +
          new URLSearchParams({
            checkInDate: search.checkInDate,
            checkOutDate: search.checkOutDate,
            adults: String(search.adults),
            children: String(search.children),
          }),
        { skipAuth: true },
      ),
  });

  // Criação de reserva
  const createReservation = useMutation({
    mutationFn: (idempotencyKey: string) =>
      apiFetch<ReservationCreatedResponse>(`/public/property/${slug}/reservations`, {
        method: 'POST',
        skipAuth: true,
        body: {
          roomTypeId: selectedRoomTypeId,
          checkInDate: search.checkInDate,
          checkOutDate: search.checkOutDate,
          adults: search.adults,
          children: search.children,
          guest: {
            fullName: guest.fullName,
            documentType: guest.documentType,
            documentNumber: guest.documentNumber,
            email: guest.email,
            phone: guest.phone,
            consentMarketing: guest.consentMarketing,
          },
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
    if (!selectedRoomTypeId) return;
    try {
      // Gera idempotency key — se usuário clicar 2x, vira a mesma reserva
      const key = generateUuid();
      const r = await createReservation.mutateAsync(key);
      setResult(r);
      setStep('pix');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar reserva');
    }
  }

  if (propertyLoading) {
    return <div className="p-8 text-center text-gray-500">Carregando…</div>;
  }
  if (!property) {
    return (
      <div className="p-8 max-w-md mx-auto text-center">
        <div className="text-3xl mb-2">🏨</div>
        <div className="text-gray-700">Propriedade não encontrada.</div>
      </div>
    );
  }

  const selectedRoomType = availability.data?.roomTypes.find(
    (rt) => rt.id === selectedRoomTypeId,
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <header className="text-center">
        {property.logoUrl && (
          <img src={property.logoUrl} alt={property.name} className="h-16 mx-auto mb-3" />
        )}
        <h1 className="text-3xl font-bold text-gray-900">{property.name}</h1>
        {property.addressCity && (
          <p className="text-sm text-gray-500 mt-1">
            {property.addressCity}, {property.addressState}
          </p>
        )}
      </header>

      {/* Stepper */}
      <Stepper current={step} />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* Step 1: Busca */}
      {step === 'search' && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Quando você quer se hospedar?</h2>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Check-in</span>
              <input
                type="date"
                value={search.checkInDate}
                onChange={(e) => setSearch({ ...search, checkInDate: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Check-out</span>
              <input
                type="date"
                value={search.checkOutDate}
                onChange={(e) => setSearch({ ...search, checkOutDate: e.target.value })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Adultos</span>
              <input
                type="number"
                min={1}
                value={search.adults}
                onChange={(e) => setSearch({ ...search, adults: parseInt(e.target.value, 10) || 1 })}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-gray-600 mb-1">Crianças</span>
              <input
                type="number"
                min={0}
                value={search.children}
                onChange={(e) =>
                  setSearch({ ...search, children: parseInt(e.target.value, 10) || 0 })
                }
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            onClick={handleSearch}
            disabled={availability.isPending}
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {availability.isPending ? 'Buscando…' : 'Buscar disponibilidade'}
          </button>

          {/* Resultados */}
          {availability.data && (
            <div className="pt-4 border-t space-y-3">
              <div className="text-sm text-gray-600">
                {availability.data.nights} noite{availability.data.nights > 1 && 's'} ·{' '}
                {availability.data.roomTypes.filter((rt) => !rt.soldOut).length} categoria(s)
                disponível(is)
              </div>

              {availability.data.roomTypes.map((rt) => (
                <RoomTypeCard
                  key={rt.id}
                  roomType={rt}
                  onChoose={() => chooseRoomType(rt.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Dados do hóspede */}
      {step === 'guest' && selectedRoomType && availability.data && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <button
            onClick={() => setStep('search')}
            className="text-sm text-blue-600 hover:underline mb-2"
          >
            ← voltar
          </button>
          <div className="bg-blue-50 rounded p-3 text-sm">
            <div className="font-medium">{selectedRoomType.name}</div>
            <div className="text-gray-600 text-xs">
              {availability.data.checkInDate} → {availability.data.checkOutDate} ·{' '}
              {availability.data.nights} noites · {fmtCurrency(selectedRoomType.totalAmount)}
            </div>
          </div>

          <h2 className="font-semibold text-gray-900">Seus dados</h2>

          <input
            type="text"
            placeholder="Nome completo *"
            value={guest.fullName}
            onChange={(e) => setGuest({ ...guest, fullName: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={guest.documentType}
              onChange={(e) => setGuest({ ...guest, documentType: e.target.value })}
              className="rounded border px-2 py-2 text-sm"
            >
              <option value="CPF">CPF</option>
              <option value="PASSPORT">Passaporte</option>
            </select>
            <input
              type="text"
              placeholder={guest.documentType === 'CPF' ? 'CPF' : 'Passaporte'}
              value={guest.documentNumber}
              onChange={(e) => setGuest({ ...guest, documentNumber: e.target.value })}
              className="col-span-2 rounded border px-3 py-2 text-sm"
            />
          </div>
          <input
            type="email"
            placeholder="E-mail *"
            value={guest.email}
            onChange={(e) => setGuest({ ...guest, email: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <input
            type="tel"
            placeholder="WhatsApp (com DDD) *"
            value={guest.phone}
            onChange={(e) => setGuest({ ...guest, phone: e.target.value })}
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={guest.consentMarketing}
              onChange={(e) => setGuest({ ...guest, consentMarketing: e.target.checked })}
              className="mt-0.5"
            />
            Aceito receber comunicações sobre minhas reservas e promoções (LGPD).
          </label>

          <div className="border-t pt-4 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Total da estadia</span>
              <span className="font-mono">{fmtCurrency(selectedRoomType.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sinal (30%)</span>
              <span className="font-mono font-bold text-blue-700">
                {fmtCurrency(selectedRoomType.totalAmount * 0.3)}
              </span>
            </div>
            <div className="text-xs text-gray-500">Saldo será pago no check-in.</div>
          </div>

          <button
            onClick={submitReservation}
            disabled={
              !guest.fullName ||
              !guest.documentNumber ||
              !guest.email ||
              !guest.phone ||
              createReservation.isPending
            }
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {createReservation.isPending ? 'Reservando…' : 'Reservar e gerar Pix →'}
          </button>
        </div>
      )}

      {/* Step 3: Pix */}
      {step === 'pix' && result && (
        <div className="bg-white rounded-lg shadow p-6 space-y-4 text-center">
          <div className="text-3xl">✅</div>
          <h2 className="text-xl font-bold text-gray-900">Reserva pré-confirmada</h2>
          <div className="text-sm text-gray-600">
            Código: <strong>{result.reservation.code}</strong>
          </div>

          {result.payment ? (
            <>
              <div className="text-sm text-gray-600">
                Pague o sinal de{' '}
                <strong>{fmtCurrency(result.reservation.depositAmount)}</strong> via Pix
                para confirmar.
              </div>

              {result.payment.pixQrCode && (
                <img
                  src={
                    result.payment.pixQrCode.startsWith('data:')
                      ? result.payment.pixQrCode
                      : `data:image/png;base64,${result.payment.pixQrCode}`
                  }
                  alt="QR Code Pix"
                  className="mx-auto w-56 h-56 border rounded"
                />
              )}

              {result.payment.pixCopyPaste && (
                <div className="text-left">
                  <label className="block text-xs text-gray-600 mb-1">Pix copia e cola</label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={result.payment.pixCopyPaste}
                      className="flex-1 rounded border px-2 py-1.5 text-xs font-mono bg-gray-50"
                    />
                    <button
                      onClick={() =>
                        navigator.clipboard?.writeText(result.payment!.pixCopyPaste ?? '')
                      }
                      className="bg-gray-100 border text-xs px-3 rounded hover:bg-gray-200"
                    >
                      Copiar
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded p-3 text-xs text-amber-800 text-left">
                ⚠️ Sua reserva está reservada por 30 minutos. Após esse prazo sem
                pagamento, o quarto volta a ficar disponível. Após pagar, você receberá
                a confirmação por e-mail e WhatsApp.
              </div>
            </>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
              ⚠️ A reserva foi criada, mas o pagamento Pix não pôde ser gerado neste
              momento. A recepção entrará em contato pelo WhatsApp ({guest.phone}) para
              finalizar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const steps: Array<{ key: Step; label: string }> = [
    { key: 'search', label: 'Datas' },
    { key: 'guest', label: 'Seus dados' },
    { key: 'pix', label: 'Pagamento' },
  ];
  const idx = steps.findIndex((s) => s.key === current);
  return (
    <div className="flex justify-center gap-6">
      {steps.map((s, i) => (
        <div
          key={s.key}
          className={`text-sm font-medium ${
            i === idx ? 'text-blue-600' : i < idx ? 'text-gray-900' : 'text-gray-400'
          }`}
        >
          {i + 1}. {s.label}
        </div>
      ))}
    </div>
  );
}

function RoomTypeCard({
  roomType,
  onChoose,
}: {
  roomType: AvailabilityResponse['roomTypes'][number];
  onChoose: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 hover:border-blue-400 transition">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{roomType.name}</h3>
          {roomType.bedConfig && (
            <div className="text-xs text-gray-500">{roomType.bedConfig}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-gray-900">
            {fmtCurrency(roomType.dailyRate)}
          </div>
          <div className="text-xs text-gray-500">por noite</div>
        </div>
      </div>

      {roomType.description && (
        <p className="text-sm text-gray-600 mb-3">{roomType.description}</p>
      )}

      <div className="flex flex-wrap gap-1 mb-3">
        {roomType.amenities.slice(0, 6).map((a) => (
          <span key={a} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
            {a}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center pt-3 border-t">
        <div className="text-sm">
          {roomType.soldOut ? (
            <span className="text-red-600 font-medium">Esgotado</span>
          ) : (
            <span className="text-green-600">
              {roomType.available} disponíve{roomType.available === 1 ? 'l' : 'is'}
            </span>
          )}
        </div>
        <button
          onClick={onChoose}
          disabled={roomType.soldOut}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Total {fmtCurrency(roomType.totalAmount)} →
        </button>
      </div>
    </div>
  );
}

/**
 * UUID v4 simples para idempotency key (sem libs externas).
 */
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (não-criptográfico, suficiente pra idempotência)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
