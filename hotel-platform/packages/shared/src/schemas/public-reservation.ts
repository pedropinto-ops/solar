import { z } from 'zod';
import { createGuestPublicSchema, createCompanionSchema } from './guest.js';

/** Normaliza documento para comparação (CPF sem máscara). */
const normDoc = (s: string) => s.replace(/\D/g, '') || s.trim().toUpperCase();

/**
 * POST /public/property/:slug/reservations
 *
 * Schema explícito para criação pública. Mais restritivo que o
 * de recepção (não aceita roomId, dailyRate é calculado pelo backend, etc).
 *
 * O hóspede informa o TITULAR (com contato) + todos os ACOMPANHANTES. O
 * backend calcula quantos quartos abrir a partir do total de pessoas e da
 * lotação da categoria, e distribui as pessoas nos quartos.
 */
export const createPublicReservationSchema = z
  .object({
    roomTypeId: z.string().cuid(),
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    /** Titular da reserva (contato: e-mail + telefone). */
    guest: createGuestPublicSchema,
    /** Demais hóspedes (nome + documento). Pode ser vazio. */
    companions: z.array(createCompanionSchema).max(29).default([]),
    guestNotes: z.string().max(500).optional(),
    /**
     * Aceite eletrônico do contrato de hospedagem (obrigatório).
     * contractAccepted precisa ser true; contractVersion identifica o texto aceito.
     */
    contractAccepted: z.literal(true, {
      errorMap: () => ({ message: 'É necessário aceitar o contrato de hospedagem' }),
    }),
    contractVersion: z.string().min(1).max(100),
    /**
     * Idempotency key (UUID v4) — gerada no frontend.
     * Mesma key + 24h = mesma resposta. Evita duplicação por duplo-clique.
     */
    idempotencyKey: z.string().uuid(),
  })
  .refine((d) => d.checkOutDate > d.checkInDate, {
    message: 'checkOutDate deve ser posterior a checkInDate',
    path: ['checkOutDate'],
  })
  .refine(
    (d) => {
      const docs = [d.guest.documentNumber, ...d.companions.map((c) => c.documentNumber)].map(
        normDoc,
      );
      return new Set(docs).size === docs.length;
    },
    {
      message: 'Há documentos repetidos entre os hóspedes',
      path: ['companions'],
    },
  );

export type CreatePublicReservationSchemaInput = z.infer<
  typeof createPublicReservationSchema
>;
