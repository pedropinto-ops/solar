import { z } from 'zod';

/**
 * POST /reservations/:id/charge
 * Cria uma cobrança vinculada à reserva.
 */
export const createChargeSchema = z.object({
  amount: z.coerce.number().positive(),
  method: z.enum(['PIX', 'CREDIT_CARD', 'CASH', 'BANK_TRANSFER']),
  description: z.string().max(200).optional(),
  installments: z.number().int().min(1).max(12).optional(),
  dueDate: z.coerce.date().optional(),
});
export type CreateChargeInput = z.infer<typeof createChargeSchema>;

/**
 * POST /payments/:id/confirm-manual
 * Para pagamentos em dinheiro ou que não passaram pelo gateway.
 */
export const confirmManualSchema = z.object({
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});

/**
 * POST /payments/:id/refund
 */
export const refundPaymentSchema = z.object({
  amount: z.coerce.number().positive().optional(),
  reason: z.string().min(3).max(500),
});
