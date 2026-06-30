'use client';

import { useState } from 'react';
import { useCreateCharge, type Payment } from '@/lib/hooks';
import { fmtCurrency } from '@/lib/format';
import { ApiError } from '@/lib/api-client';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

interface Props {
  reservationId: string;
  defaultAmount: number;
  reservationCode: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChargeModal({
  reservationId,
  defaultAmount,
  reservationCode,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<'form' | 'pix' | 'card' | 'cash'>('form');
  const [amount, setAmount] = useState(defaultAmount);
  const [method, setMethod] = useState<'PIX' | 'CREDIT_CARD' | 'CASH'>('PIX');
  const [installments, setInstallments] = useState(1);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createCharge = useCreateCharge();

  async function submit() {
    setError(null);
    if (method === 'CASH') {
      setStep('cash');
      return;
    }
    try {
      const result = await createCharge.mutateAsync({
        reservationId,
        amount,
        method,
        installments: method === 'CREDIT_CARD' ? installments : undefined,
      });
      setPayment(result);
      setStep(method === 'PIX' ? 'pix' : 'card');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro');
    }
  }

  async function copyPix() {
    if (!payment?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(payment.pixCopyPaste);
    } catch {}
  }

  return (
    <Sheet open onClose={onClose} title={`Cobrar — ${reservationCode}`}>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {step === 'form' && (
        <div className="space-y-4">
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1.5 font-medium">Valor a cobrar</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
              className="w-full rounded-lg border border-sand-200 px-3 outline-none focus:border-teal-500 min-h-touch-md bg-cream"
            />
            <span className="text-xs text-ink-300 mt-1 block">
              Saldo sugerido: {fmtCurrency(defaultAmount)}
            </span>
          </label>

          <div>
            <span className="block text-xs text-ink-500 mb-2 font-medium">Método</span>
            <div className="grid grid-cols-3 gap-2">
              <MethodButton emoji="💸" label="Pix" active={method === 'PIX'} onClick={() => setMethod('PIX')} />
              <MethodButton emoji="💳" label="Cartão" active={method === 'CREDIT_CARD'} onClick={() => setMethod('CREDIT_CARD')} />
              <MethodButton emoji="💵" label="Dinheiro" active={method === 'CASH'} onClick={() => setMethod('CASH')} />
            </div>
          </div>

          {method === 'CREDIT_CARD' && (
            <label className="block">
              <span className="block text-xs text-ink-500 mb-1.5 font-medium">Parcelas</span>
              <select
                value={installments}
                onChange={(e) => setInstallments(parseInt(e.target.value, 10))}
                className="w-full rounded-lg border border-sand-200 px-3 bg-cream min-h-touch-md"
              >
                {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}x de {fmtCurrency(amount / n)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <Button
            fullWidth
            size="lg"
            onClick={submit}
            disabled={!amount || amount <= 0 || createCharge.isPending}
          >
            {createCharge.isPending ? 'Criando…' : 'Gerar cobrança →'}
          </Button>
        </div>
      )}

      {step === 'pix' && payment && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="text-sm text-ink-700 mb-3">
              Pix de <strong>{fmtCurrency(amount)}</strong>
            </div>
            {payment.pixQrCode ? (
              <img
                src={
                  payment.pixQrCode.startsWith('data:')
                    ? payment.pixQrCode
                    : `data:image/png;base64,${payment.pixQrCode}`
                }
                alt="QR Code Pix"
                className="mx-auto w-56 h-56 border border-sand-200 rounded-lg"
              />
            ) : (
              <div className="text-gold-700 text-sm">QR Code não disponível.</div>
            )}
          </div>

          {payment.pixCopyPaste && (
            <div>
              <label className="block text-xs text-ink-500 mb-1.5 font-medium">Pix copia e cola</label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={payment.pixCopyPaste}
                  className="flex-1 rounded-lg border border-sand-200 px-2 text-xs font-mono bg-sand-50 min-h-touch-sm"
                />
                <Button variant="secondary" size="sm" onClick={copyPix}>
                  Copiar
                </Button>
              </div>
            </div>
          )}

          {payment.pixExpiresAt && (
            <div className="text-xs text-ink-500 text-center">
              Válido até {new Date(payment.pixExpiresAt).toLocaleString('pt-BR')}
            </div>
          )}

          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-teal-900">
            💡 Envie o QR Code ou o código pelo WhatsApp ao hóspede. O pagamento será
            confirmado automaticamente via webhook.
          </div>

          <Button fullWidth variant="secondary" onClick={() => { onSuccess?.(); onClose(); }}>
            Fechar
          </Button>
        </div>
      )}

      {step === 'card' && payment && (
        <div className="space-y-4">
          <div className="text-center text-sm text-ink-700">
            Cartão de <strong>{fmtCurrency(amount)}</strong> em {installments}x
          </div>

          {payment.gatewayUrl ? (
            <>
              <a
                href={payment.gatewayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-teal-900 text-cream py-3 rounded-lg text-sm font-semibold text-center hover:bg-teal-700"
              >
                Abrir página de pagamento →
              </a>
              <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-teal-900">
                💡 Compartilhe o link com o hóspede.
              </div>
            </>
          ) : (
            <div className="text-gold-700 text-sm">Link não disponível.</div>
          )}

          <Button fullWidth variant="secondary" onClick={() => { onSuccess?.(); onClose(); }}>
            Fechar
          </Button>
        </div>
      )}

      {step === 'cash' && (
        <div className="space-y-4">
          <div className="bg-gold-50 border border-gold-100 rounded-lg p-3 text-sm text-gold-700">
            ⚠ Pagamentos em dinheiro precisam ser registrados manualmente.
          </div>
          <Button fullWidth variant="secondary" onClick={onClose}>
            Entendi
          </Button>
        </div>
      )}
    </Sheet>
  );
}

function MethodButton({ emoji, label, active, onClick }: { emoji: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'border-2 rounded-xl p-3 text-center transition-all min-h-touch-md',
        active ? 'border-teal-500 bg-teal-50 text-teal-900' : 'border-sand-200 hover:border-sand-200',
      )}
    >
      <div className="text-xl">{emoji}</div>
      <div className="mt-1 text-xs font-medium">{label}</div>
    </button>
  );
}
