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

// ---- Combos / pacotes ----

export const packageKindEnum = z.enum(['CLOSED_PRICE', 'LOS_DISCOUNT']);

export const createPackageSchema = z
  .object({
    name: z.string().trim().min(2, 'Dê um nome ao combo').max(80),
    kind: packageKindEnum,
    roomTypeId: z.string().cuid().nullish(),
    // CLOSED_PRICE (pacote de N diárias, ± serviços):
    nights: z.coerce.number().int().min(1).max(60).nullish(),
    price: z.coerce.number().positive().nullish(),
    includedItems: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    description: z.string().trim().max(500).nullish(),
    // LOS_DISCOUNT (desconto por nº de noites):
    minNights: z.coerce.number().int().min(1).max(60).nullish(),
    discountPercent: z.coerce.number().positive().max(90).nullish(),
  })
  .superRefine((d, ctx) => {
    if (d.kind === 'CLOSED_PRICE') {
      if (!d.nights) ctx.addIssue({ code: 'custom', path: ['nights'], message: 'Informe o nº de diárias' });
      if (!d.price) ctx.addIssue({ code: 'custom', path: ['price'], message: 'Informe o preço do pacote' });
    } else {
      if (!d.minNights) ctx.addIssue({ code: 'custom', path: ['minNights'], message: 'Informe a partir de quantas noites' });
      if (!d.discountPercent) ctx.addIssue({ code: 'custom', path: ['discountPercent'], message: 'Informe o desconto' });
    }
  });
export type CreatePackageInput = z.infer<typeof createPackageSchema>;

export const updatePackageSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    roomTypeId: z.string().cuid().nullish(),
    nights: z.coerce.number().int().min(1).max(60).nullish(),
    price: z.coerce.number().positive().nullish(),
    includedItems: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    description: z.string().trim().max(500).nullish(),
    minNights: z.coerce.number().int().min(1).max(60).nullish(),
    discountPercent: z.coerce.number().positive().max(90).nullish(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Nada para atualizar' });
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
