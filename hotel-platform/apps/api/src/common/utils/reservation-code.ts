import type { Prisma } from '@prisma/client';

/**
 * Gera código de reserva no formato "RES-AAAA-NNNNN".
 *
 * Conta quantas reservas a propriedade tem no ano corrente
 * e incrementa o número. Não usa SEQUENCE global porque o
 * formato é por propriedade (RES-2026-00001 para hotel A
 * e RES-2026-00001 para hotel B são códigos distintos no
 * contexto de cada um).
 *
 * Atenção: corrida de geração de código pode produzir duplicatas
 * em raras condições. A constraint @@unique([propertyId, code])
 * protege; em caso de colisão, retry.
 */
export async function generateReservationCode(
  tx: Prisma.TransactionClient,
  propertyId: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00Z`);
  const yearEnd = new Date(`${year + 1}-01-01T00:00:00Z`);

  const count = await tx.reservation.count({
    where: {
      propertyId,
      bookedAt: { gte: yearStart, lt: yearEnd },
    },
  });

  const seq = String(count + 1).padStart(5, '0');
  return `RES-${year}-${seq}`;
}
