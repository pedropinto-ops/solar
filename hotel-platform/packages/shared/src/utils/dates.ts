/**
 * Conta noites entre duas datas (check-out - check-in).
 * Considera apenas a parte de data (ignora hora).
 */
export function countNights(checkIn: Date | string, checkOut: Date | string): number {
  const ci = typeof checkIn === 'string' ? new Date(checkIn) : checkIn;
  const co = typeof checkOut === 'string' ? new Date(checkOut) : checkOut;
  const ciDay = Date.UTC(ci.getUTCFullYear(), ci.getUTCMonth(), ci.getUTCDate());
  const coDay = Date.UTC(co.getUTCFullYear(), co.getUTCMonth(), co.getUTCDate());
  return Math.round((coDay - ciDay) / (1000 * 60 * 60 * 24));
}

/**
 * Verifica se dois intervalos [aStart, aEnd) e [bStart, bEnd) se sobrepõem.
 * Atenção: usa intervalo semi-aberto (check-out é exclusivo, como em hotelaria).
 */
export function intervalsOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && ae > bs;
}

/**
 * Adiciona minutos a uma data.
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Formata data como YYYY-MM-DD (sem hora).
 */
export function formatDateISO(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Início do dia em UTC (zera horas/min/seg).
 */
export function startOfDayUTC(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
