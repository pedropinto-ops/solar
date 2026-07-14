import { z } from 'zod';

export const rateAdjustTypeEnum = z.enum(['ABSOLUTE', 'PERCENT']);

/** Criação de regra de tarifa por período (temporada/feriado/evento). */
export const createRatePeriodSchema = z
  .object({
    name: z.string().trim().min(2, 'Dê um nome à regra').max(80),
    roomTypeId: z.string().cuid().nullish(), // null/ausente = todas as categorias
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    adjustType: rateAdjustTypeEnum,
    /** ABSOLUTE: novo valor do adulto (R$). PERCENT: acréscimo (ex.: 30 = +30%). */
    value: z.coerce.number().positive('Informe um valor maior que zero'),
    priority: z.coerce.number().int().min(0).max(1000).default(0),
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'A data final não pode ser antes da inicial',
    path: ['endDate'],
  });
export type CreateRatePeriodInput = z.infer<typeof createRatePeriodSchema>;

/** Edição de regra — todos os campos opcionais (PATCH). */
export const updateRatePeriodSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    roomTypeId: z.string().cuid().nullish(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    adjustType: rateAdjustTypeEnum.optional(),
    value: z.coerce.number().positive().optional(),
    priority: z.coerce.number().int().min(0).max(1000).optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar' });
export type UpdateRatePeriodInput = z.infer<typeof updateRatePeriodSchema>;

/** Edição da diária base de uma categoria. */
export const updateBasePriceSchema = z.object({
  basePrice: z.coerce.number().positive('A diária deve ser maior que zero').max(100000),
});
export type UpdateBasePriceInput = z.infer<typeof updateBasePriceSchema>;
