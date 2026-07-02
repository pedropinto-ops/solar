import { z } from 'zod';

export const cleaningTypeEnum = z.enum([
  'CHECKOUT',
  'DAILY',
  'TURNDOWN',
  'DEEP_CLEAN',
  'MAINTENANCE',
]);

export const cleaningStatusEnum = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'AWAITING_INSPECTION',
  'COMPLETED',
  'REJECTED',
]);

export const roomStatusEnum = z.enum([
  'AVAILABLE',
  'OCCUPIED',
  'DIRTY',
  'CLEANING',
  'INSPECTION',
  'MAINTENANCE',
  'BLOCKED',
  'OUT_OF_ORDER',
]);

/**
 * POST /cleaning-tasks
 * Cria tarefa manualmente (ex: deep clean programada, after-maintenance).
 */
export const createCleaningTaskSchema = z.object({
  roomId: z.string().cuid(),
  type: cleaningTypeEnum.default('CHECKOUT'),
  priority: z.number().int().min(0).max(1000).optional(),
  assignedToId: z.string().cuid().optional(),
  scheduledFor: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});
export type CreateCleaningTaskInput = z.infer<typeof createCleaningTaskSchema>;

/**
 * PATCH /cleaning-tasks/:id/assign
 */
export const assignCleaningSchema = z.object({
  userId: z.string().cuid(),
});

/**
 * POST /cleaning-tasks/:id/issue
 * Reporta problema durante limpeza.
 */
export const reportIssueSchema = z.object({
  description: z.string().min(3).max(500),
  photos: z.array(z.string().url()).max(10).optional(),
});

/**
 * POST /cleaning-tasks/:id/reject
 */
export const rejectCleaningSchema = z.object({
  reason: z.string().min(3).max(500),
});

/**
 * Checklist que a camareira preenche ao concluir a limpeza.
 * frigobarItens: mapa item -> reposto? (ex.: { "Água 500ml": true }).
 */
export const cleaningChecklistSchema = z.object({
  camaArrumada: z.boolean().default(false),
  banheiroLimpo: z.boolean().default(false),
  pisoLimpo: z.boolean().default(false),
  enxovalTrocado: z.boolean().default(false), // lençóis e toalhas
  frigobarReposto: z.boolean().default(false),
  frigobarItens: z.record(z.boolean()).optional(),
  observacoes: z.string().max(500).optional(),
});
export type CleaningChecklist = z.infer<typeof cleaningChecklistSchema>;

/**
 * POST /cleaning-tasks/:id/complete
 */
export const completeCleaningSchema = z.object({
  checklist: cleaningChecklistSchema.optional(),
});
export type CompleteCleaningInput = z.infer<typeof completeCleaningSchema>;

/**
 * PATCH /rooms/:id/status
 * Mudança manual de status do quarto (manutenção, bloqueio).
 */
export const updateRoomStatusSchema = z.object({
  status: roomStatusEnum,
  reason: z.string().min(3).max(500),
});
