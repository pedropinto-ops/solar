import { z } from 'zod';
import { emailSchema } from '../utils/validators.js';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userRoleEnum = z.enum([
  'ADMIN',
  'MANAGER',
  'RECEPTION',
  'HOUSEKEEPING_SUPERVISOR',
  'HOUSEKEEPER',
  'READONLY',
]);

export const createUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(128),
  name: z.string().trim().min(3).max(120),
  phone: z.string().optional(),
  role: userRoleEnum,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
