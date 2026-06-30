import { z } from 'zod';
import { createGuestPublicSchema } from './guest.js';

/**
 * POST /public/property/:slug/reservations
 *
 * Schema explícito para criação pública. Mais restritivo que o
 * de recepção (não aceita roomId, dailyRate é calculado pelo backend, etc).
 */
export const createPublicReservationSchema = z
  .object({
    roomTypeId: z.string().cuid(),
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    adults: z.number().int().min(1).max(10),
    children: z.number().int().min(0).max(10).default(0),
    guest: createGuestPublicSchema,
    guestNotes: z.string().max(500).optional(),
    /**
     * Idempotency key (UUID v4) — gerada no frontend.
     * Mesma key + 24h = mesma resposta. Evita duplicação por duplo-clique.
     */
    idempotencyKey: z.string().uuid(),
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'checkOutDate deve ser posterior a checkInDate',
    path: ['checkOutDate'],
  });

export type CreatePublicReservationSchemaInput = z.infer<
  typeof createPublicReservationSchema
>;
