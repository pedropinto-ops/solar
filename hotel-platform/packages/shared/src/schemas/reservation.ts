import { z } from 'zod';

export const reservationStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED',
  'NO_SHOW',
]);

export const billingModeEnum = z.enum([
  'DEPOSIT_BALANCE',
  'POSTPAID_CORPORATE',
  'FULL_PREPAID',
  'GUARANTEE_CARD',
]);

export const reservationSourceEnum = z.enum([
  'DIRECT',
  'WALK_IN',
  'PHONE',
  'WHATSAPP',
  'EMAIL',
  'RECEPTION',
  'BOOKING_COM',
  'AIRBNB',
  'EXPEDIA',
  'OTHER',
]);

export const paymentMethodEnum = z.enum([
  'PIX',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'CASH',
  'BANK_TRANSFER',
  'OTHER',
]);

/**
 * Range de datas válido — checkOut > checkIn.
 */
const dateRangeRefine = (data: { checkInDate: Date; checkOutDate: Date }) =>
  data.checkOutDate > data.checkInDate;

/**
 * GET availability (link público).
 */
export const availabilityQuerySchema = z
  .object({
    checkInDate: z.coerce.date(),
    checkOutDate: z.coerce.date(),
    adults: z.coerce.number().int().min(1).max(10).default(1),
    children: z.coerce.number().int().min(0).max(10).default(0),
  })
  .refine(dateRangeRefine, {
    message: 'checkOutDate deve ser posterior a checkInDate',
    path: ['checkOutDate'],
  })
  .refine(
    (d) => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      return d.checkInDate >= today;
    },
    { message: 'checkInDate não pode estar no passado', path: ['checkInDate'] },
  )
  .refine(
    (d) => {
      const diffDays = Math.round(
        (d.checkOutDate.getTime() - d.checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      return diffDays <= 30;
    },
    { message: 'Estadia máxima de 30 dias no link público', path: ['checkOutDate'] },
  );
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

/**
 * POST /reservations (recepção cria manualmente).
 */
export const createReservationSchema = z.object({
  roomTypeId: z.string().cuid(),
  roomId: z.string().cuid().optional(), // pode alocar quarto direto
  primaryGuestId: z.string().cuid(),
  checkInDate: z.coerce.date(),
  checkOutDate: z.coerce.date(),
  adults: z.number().int().min(1).max(10),
  children: z.number().int().min(0).max(10).default(0),
  billingMode: billingModeEnum.default('DEPOSIT_BALANCE'),
  depositPercent: z.number().int().min(0).max(100).default(30),
  companyId: z.string().cuid().optional(),
  corporatePO: z.string().max(80).optional(),
  dailyRate: z.coerce.number().positive(),
  source: reservationSourceEnum.default('RECEPTION'),
  guestNotes: z.string().max(500).optional(),
  internalNotes: z.string().max(500).optional(),
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;

/**
 * POST /reservations/{id}/assign-room
 */
export const assignRoomSchema = z.object({
  roomId: z.string().cuid(),
});

/**
 * POST /reservations/{id}/check-in
 */
export const checkInSchema = z.object({
  earlyCheckIn: z.boolean().default(false),
  notes: z.string().max(500).optional(),
});

/**
 * POST /reservations/{id}/check-out
 */
export const checkOutSchema = z.object({
  skipNFSe: z.boolean().default(false),
  sendNFSeBy: z.enum(['EMAIL', 'WHATSAPP', 'BOTH', 'NONE']).default('EMAIL'),
  earlyCheckout: z.boolean().default(false),
});
