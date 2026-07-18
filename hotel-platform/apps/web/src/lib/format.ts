export const fmtCurrency = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(n);
};

export const fmtDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  // Datas da API são campos @db.Date (data pura) serializados como
  // "AAAA-MM-DDT00:00:00.000Z". Formatar em UTC mostra o dia do calendário
  // exatamente como gravado — sem "voltar" um dia no fuso do Brasil (UTC-3).
  if (typeof value === 'string') {
    return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
  }
  // Date construído no cliente (ex.: seletor da agenda) representa o dia em
  // horário local — mantém a formatação local.
  return value.toLocaleDateString('pt-BR');
};

export const fmtDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

/**
 * "YYYY-MM-DD" para inputs type="date".
 */
export const toDateInput = (value: string | Date): string => {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
};

/**
 * Adiciona dias a uma data (em UTC) e retorna ISO date string.
 */
export const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};
