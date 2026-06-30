import { z } from 'zod';

/**
 * Valida CPF brasileiro (com checksum dos dígitos verificadores).
 */
export function isValidCpf(cpf: string): boolean {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false; // todos iguais

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cleaned.charAt(9), 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  return digit === parseInt(cleaned.charAt(10), 10);
}

/**
 * Valida CNPJ brasileiro.
 */
export function isValidCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * weights1[i]!;
  }
  let digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (digit !== parseInt(cleaned.charAt(12), 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned.charAt(i), 10) * weights2[i]!;
  }
  digit = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  return digit === parseInt(cleaned.charAt(13), 10);
}

/**
 * Zod refinement para CPF.
 *  z.string().refine(...cpfRefinement)
 */
export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCpf, { message: 'CPF inválido' });

export const cnpjSchema = z
  .string()
  .transform((v) => v.replace(/\D/g, ''))
  .refine(isValidCnpj, { message: 'CNPJ inválido' });

/**
 * Valida telefone em formato E.164 (+5511999998888) ou brasileiro com DDD.
 * Normaliza para E.164.
 */
export const phoneSchema = z
  .string()
  .transform((v) => {
    const cleaned = v.replace(/\D/g, '');
    if (cleaned.startsWith('55')) return `+${cleaned}`;
    if (cleaned.length === 10 || cleaned.length === 11) return `+55${cleaned}`;
    return `+${cleaned}`;
  })
  .refine((v) => /^\+\d{10,15}$/.test(v), {
    message: 'Telefone inválido (use formato com DDD)',
  });

/**
 * E-mail (case-insensitive, normalizado).
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('E-mail inválido');
