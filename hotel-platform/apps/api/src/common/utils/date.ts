/**
 * Datas do hotel no fuso local (Irará-BA → America/Bahia, UTC-3).
 *
 * POR QUE ISTO EXISTE: o servidor (Railway) roda em UTC. Usar `new Date()` +
 * setUTCHours(0,...) faz o "hoje" virar no horário errado — à noite no Brasil já
 * é o dia seguinte em UTC, então chegadas/saídas do dia seguinte apareciam como
 * "hoje" no painel. Os campos @db.Date são gravados à meia-noite UTC, então
 * ancoramos o "hoje do hotel" também à meia-noite UTC do dia-calendário local.
 */
export const HOTEL_TIMEZONE = 'America/Bahia';

/** Dia-calendário atual no fuso do hotel, como Date à meia-noite UTC. */
export function hotelToday(timeZone: string = HOTEL_TIMEZONE): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()); // ex.: "2026-07-17"
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

/** Intervalo [hoje, amanhã) do hotel, à meia-noite UTC — para filtros @db.Date. */
export function hotelTodayRange(timeZone: string = HOTEL_TIMEZONE): {
  today: Date;
  tomorrow: Date;
} {
  const today = hotelToday(timeZone);
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return { today, tomorrow };
}
