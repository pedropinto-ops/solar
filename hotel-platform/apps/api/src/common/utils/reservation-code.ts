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
  const prefix = `RES-${year}-`;

  // Usa o MAIOR número já emitido no ano + 1 (não a CONTAGEM): contagem quebra
  // quando reservas são apagadas — o count cai abaixo do máximo e o gerador
  // reemite códigos existentes, colidindo com o @@unique. Como o sufixo é
  // numérico com zero-pad de 5 dígitos, ordenar por code desc = ordem numérica.
  const last = await tx.reservation.findFirst({
    where: { propertyId, code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const lastSeq = last ? parseInt(last.code.slice(prefix.length), 10) || 0 : 0;

  const seq = String(lastSeq + 1).padStart(5, '0');
  return `${prefix}${seq}`;
}
