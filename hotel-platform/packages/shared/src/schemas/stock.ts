import { z } from 'zod';

export const productCategoryEnum = z.enum([
  'MINIBAR',
  'RESTAURANT',
  'BAR',
  'ROOM_SERVICE',
  'LAUNDRY',
  'SPA',
  'EXTRA_SERVICE',
  'AMENITY',
  'SUPPLIES',
  'LINEN',
  'MAINTENANCE',
]);
export type ProductCategoryValue = z.infer<typeof productCategoryEnum>;

/**
 * POST /stock/products — cadastra um bem/produto do almoxarifado.
 */
export const createProductSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(1).max(40).optional(), // se ausente, gerado do nome
  category: productCategoryEnum.default('SUPPLIES'),
  unitMeasure: z.string().min(1).max(10).default('UN'),
  unitPrice: z.coerce.number().min(0).default(0),
  unitCost: z.coerce.number().min(0).optional(),
  initialQuantity: z.coerce.number().min(0).default(0),
  minLevel: z.coerce.number().min(0).optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * PATCH /stock/products/:id
 */
export const updateProductSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: productCategoryEnum.optional(),
  unitMeasure: z.string().min(1).max(10).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
  unitCost: z.coerce.number().min(0).optional(),
  minLevel: z.coerce.number().min(0).nullable().optional(),
  active: z.boolean().optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

/**
 * POST /stock/movements — movimenta o estoque do almoxarifado.
 * quantity é SEMPRE positiva; o tipo define o sinal.
 * ADJUSTMENT: quantity é a NOVA quantidade contada (contagem física).
 */
export const stockMoveSchema = z.object({
  productId: z.string().cuid(),
  type: z.enum(['IN', 'OUT', 'LOSS', 'ADJUSTMENT']),
  quantity: z.coerce.number().min(0),
  reason: z.string().max(300).optional(),
});
export type StockMoveInput = z.infer<typeof stockMoveSchema>;
