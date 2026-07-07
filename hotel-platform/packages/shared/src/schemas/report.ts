import { z } from 'zod';

/**
 * GET /reports/summary — parâmetros do relatório gerencial por período.
 *
 * start/end são datas (YYYY-MM-DD). O período é [start, end) — inclui o dia
 * `start` e vai até a véspera de `end`, coerente com a lógica de diárias
 * (uma diária é a NOITE entre check-in e check-out).
 */
export const reportQuerySchema = z
  .object({
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((d) => d.end > d.start, {
    message: 'A data final deve ser posterior à inicial',
    path: ['end'],
  })
  .refine(
    (d) => (d.end.getTime() - d.start.getTime()) / 86_400_000 <= 400,
    { message: 'Período máximo de 400 dias', path: ['end'] },
  );

export type ReportQuery = z.infer<typeof reportQuerySchema>;
