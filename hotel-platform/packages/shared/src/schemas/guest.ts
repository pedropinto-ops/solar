import { z } from 'zod';
import { cpfSchema, emailSchema, phoneSchema } from '../utils/validators.js';

export const documentTypeEnum = z.enum(['CPF', 'RG', 'CNH', 'PASSPORT', 'OTHER']);
export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'NOT_INFORMED']);
export const travelPurposeEnum = z.enum([
  'LEISURE',
  'BUSINESS',
  'EVENT',
  'HEALTH',
  'EDUCATION',
  'FAMILY',
  'OTHER',
]);
export const transportMeansEnum = z.enum([
  'OWN_CAR',
  'RENTED_CAR',
  'BUS',
  'PLANE',
  'TRAIN',
  'BOAT',
  'MOTORCYCLE',
  'OTHER',
]);

/**
 * Validação condicional do documento:
 *  - Se CPF → valida com checksum
 *  - Se PASSPORT/RG → mínimo 4 chars
 */
const documentNumberByType = z.discriminatedUnion('documentType', [
  z.object({ documentType: z.literal('CPF'), documentNumber: cpfSchema }),
  z.object({
    documentType: z.literal('PASSPORT'),
    documentNumber: z.string().trim().min(4, 'Passaporte muito curto').max(20),
  }),
  z.object({
    documentType: z.literal('RG'),
    documentNumber: z.string().trim().min(4).max(20),
  }),
  z.object({
    documentType: z.literal('CNH'),
    documentNumber: z.string().trim().min(4).max(20),
  }),
  z.object({
    documentType: z.literal('OTHER'),
    documentNumber: z.string().trim().min(2).max(30),
  }),
]);

const guestBaseFields = {
  fullName: z.string().trim().min(3, 'Nome muito curto').max(120),
  birthDate: z.coerce.date().optional().nullable(),
  gender: genderEnum.optional().nullable(),
  nationality: z.string().length(2).default('BR'),
  occupation: z.string().max(80).optional().nullable(),

  email: emailSchema.optional().nullable(),
  phone: phoneSchema.optional().nullable(),
  whatsapp: phoneSchema.optional().nullable(),

  addressStreet: z.string().max(200).optional().nullable(),
  addressNumber: z.string().max(20).optional().nullable(),
  addressComplement: z.string().max(80).optional().nullable(),
  addressNeighborhood: z.string().max(80).optional().nullable(),
  addressCity: z.string().max(80).optional().nullable(),
  addressState: z.string().max(60).optional().nullable(),
  addressZip: z.string().max(15).optional().nullable(),
  addressCountry: z.string().length(2).default('BR'),

  travelOrigin: z.string().max(80).optional().nullable(),
  travelDestination: z.string().max(80).optional().nullable(),
  travelPurpose: travelPurposeEnum.optional().nullable(),
  transportMeans: transportMeansEnum.optional().nullable(),

  consentMarketing: z.boolean().default(false),
};

/**
 * Schema para criação de hóspede (uso completo).
 */
export const createGuestSchema = z.intersection(
  z.object(guestBaseFields),
  documentNumberByType,
);
export type CreateGuestInput = z.infer<typeof createGuestSchema>;

/**
 * Schema para criação de hóspede no formulário público (link de reserva).
 * Mais permissivo — campos da FNRH preenchidos no check-in.
 */
export const createGuestPublicSchema = z.intersection(
  z.object({
    fullName: guestBaseFields.fullName,
    email: emailSchema,
    phone: phoneSchema,
    whatsapp: phoneSchema.optional().nullable(),
    birthDate: guestBaseFields.birthDate,
    consentMarketing: z.boolean().default(false),
  }),
  documentNumberByType,
);
export type CreateGuestPublicInput = z.infer<typeof createGuestPublicSchema>;

/**
 * Schema de ACOMPANHANTE na reserva pública. Nome + documento (CPF
 * obrigatório com checksum, ou passaporte etc.). Sem contato próprio — o
 * contato da reserva é o do titular.
 */
export const createCompanionSchema = z.intersection(
  z.object({
    fullName: guestBaseFields.fullName,
    birthDate: guestBaseFields.birthDate,
  }),
  documentNumberByType,
);
export type CreateCompanionInput = z.infer<typeof createCompanionSchema>;

/**
 * Schema para atualização parcial (PATCH).
 */
export const updateGuestSchema = z
  .object(guestBaseFields)
  .partial()
  .extend({
    documentType: documentTypeEnum.optional(),
    documentNumber: z.string().optional(),
  });
export type UpdateGuestInput = z.infer<typeof updateGuestSchema>;

/**
 * Lista de campos obrigatórios da FNRH (Embratur).
 * Usado para bloquear check-in se faltar algum.
 */
export const FNRH_REQUIRED_FIELDS = [
  'fullName',
  'documentType',
  'documentNumber',
  'nationality',
  'addressCity',
  'addressCountry',
] as const;
