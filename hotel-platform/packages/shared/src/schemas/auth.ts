import { z } from 'zod';

/** Login por nome de usuário OU e-mail (campo único "login"). */
export const loginSchema = z.object({
  login: z.string().trim().min(3, 'Informe usuário ou e-mail').max(160),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Nome de usuário de login: letras, números, ponto, hífen e underscore. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Usuário deve ter ao menos 3 caracteres')
  .max(60)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use apenas letras, números, ponto, hífen ou _');

/** E-mail opcional (aceita vazio). */
export const optionalEmailSchema = z
  .string()
  .email('E-mail inválido')
  .max(160)
  .optional()
  .or(z.literal(''));

export const userRoleEnum = z.enum([
  'ADMIN',
  'MANAGER',
  'RECEPTION',
  'HOUSEKEEPING_SUPERVISOR',
  'HOUSEKEEPER',
  'READONLY',
]);

export const createUserSchema = z.object({
  username: usernameSchema,
  email: optionalEmailSchema,
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(128),
  name: z.string().trim().min(3).max(120),
  phone: z.string().optional(),
  role: userRoleEnum,
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/** Edição de funcionário (gestão). Todos os campos opcionais (PATCH). */
export const updateUserSchema = z
  .object({
    username: usernameSchema.optional(),
    email: optionalEmailSchema,
    name: z.string().trim().min(3).max(120).optional(),
    phone: z.string().max(30).optional(),
    role: userRoleEnum.optional(),
    active: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Nada para atualizar',
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/** Redefinição de senha provisória pelo gestor. */
export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
