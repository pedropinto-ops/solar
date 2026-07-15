import { describe, it, expect } from 'vitest';
import { PricingService } from './pricing.service.js';

/**
 * Fake mínimo do PrismaService: o cotador só toca em `ratePeriod.findMany`
 * (regras de tarifa por data) e `package.findMany` (descontos por nº de noites).
 */
function makeService(opts?: { periods?: any[]; losRules?: any[] }) {
  const fakePrisma: any = {
    ratePeriod: { findMany: async () => opts?.periods ?? [] },
    package: { findMany: async () => opts?.losRules ?? [] },
  };
  const fakeAudit: any = {};
  return new PricingService(fakePrisma, fakeAudit);
}

const d = (s: string) => new Date(s + 'T00:00:00.000Z');

describe('PricingService.personNightRate — preço por idade (Modelo A)', () => {
  const svc = makeService();
  it('0–8 anos é grátis', () => {
    expect(svc.personNightRate(0, 200)).toBe(0);
    expect(svc.personNightRate(8, 200)).toBe(0);
  });
  it('9–15 anos paga taxa fixa (R$50/dia), independente da diária', () => {
    expect(svc.personNightRate(9, 200)).toBe(50);
    expect(svc.personNightRate(15, 999)).toBe(50);
  });
  it('16+ paga a diária cheia do adulto', () => {
    expect(svc.personNightRate(16, 200)).toBe(200);
    expect(svc.personNightRate(40, 350)).toBe(350);
  });
});

describe('PricingService.resolveAdultRate — tarifa por data', () => {
  const svc = makeService();
  it('sem regras → basePrice', () => {
    expect(svc.resolveAdultRate(300, d('2027-01-10'), [])).toEqual({
      rate: 300,
      ruleName: null,
    });
  });
  it('regra ABSOLUTE dentro do intervalo sobrepõe o basePrice', () => {
    const rule: any = {
      name: 'Alta temporada',
      startDate: d('2027-01-01'),
      endDate: d('2027-01-31'),
      adjustType: 'ABSOLUTE',
      value: 500,
      priority: 1,
      createdAt: d('2027-01-01'),
    };
    expect(svc.resolveAdultRate(300, d('2027-01-10'), [rule]).rate).toBe(500);
  });
  it('regra PERCENT ajusta sobre o basePrice', () => {
    const rule: any = {
      name: '+20%',
      startDate: d('2027-01-01'),
      endDate: d('2027-01-31'),
      adjustType: 'PERCENT',
      value: 20,
      priority: 1,
      createdAt: d('2027-01-01'),
    };
    expect(svc.resolveAdultRate(300, d('2027-01-10'), [rule]).rate).toBe(360);
  });
  it('maior prioridade vence em caso de sobreposição', () => {
    const base = { startDate: d('2027-01-01'), endDate: d('2027-12-31'), adjustType: 'ABSOLUTE', createdAt: d('2027-01-01') };
    const low: any = { ...base, name: 'baixa', value: 100, priority: 1 };
    const high: any = { ...base, name: 'alta', value: 900, priority: 5 };
    const res = svc.resolveAdultRate(300, d('2027-06-10'), [low, high]);
    expect(res.rate).toBe(900);
    expect(res.ruleName).toBe('alta');
  });
});

describe('PricingService.quote — cotação completa', () => {
  it('2 adultos, 2 noites, sem regras: total = base × pessoas × noites', async () => {
    const svc = makeService();
    const q = await svc.quote({
      propertyId: 'p1',
      roomTypeId: 'rt1',
      basePrice: 150,
      checkIn: d('2027-03-10'),
      checkOut: d('2027-03-12'),
      ages: [30, 28],
    });
    expect(q.nights).toBe(2);
    expect(q.total).toBe(600);
    expect(q.perPerson).toEqual([300, 300]);
    expect(q.avgDailyRate).toBe(300);
    expect(q.discountPercent).toBe(0);
  });

  it('mistura de idades numa noite: adulto + criança grátis + criança taxada', async () => {
    const svc = makeService();
    const q = await svc.quote({
      propertyId: 'p1',
      roomTypeId: 'rt1',
      basePrice: 100,
      checkIn: d('2027-03-10'),
      checkOut: d('2027-03-11'),
      ages: [30, 5, 12],
    });
    expect(q.nights).toBe(1);
    expect(q.perPerson).toEqual([100, 0, 50]);
    expect(q.total).toBe(150);
  });

  it('desconto por noites (LOS) é aplicado', async () => {
    const svc = makeService({
      losRules: [{ name: '3+ noites', discountPercent: 10, minNights: 3, roomTypeId: null }],
    });
    const q = await svc.quote({
      propertyId: 'p1',
      roomTypeId: 'rt1',
      basePrice: 100,
      checkIn: d('2027-03-10'),
      checkOut: d('2027-03-13'), // 3 noites
      ages: [30],
    });
    expect(q.nights).toBe(3);
    expect(q.subtotal).toBe(300);
    expect(q.discountPercent).toBe(10);
    expect(q.total).toBe(270);
  });

  it('SEGURANÇA: desconto absurdo (>90%) é travado em 90% — o preço nunca zera', async () => {
    const svc = makeService({
      losRules: [{ name: 'bug', discountPercent: 150, minNights: 1, roomTypeId: null }],
    });
    const q = await svc.quote({
      propertyId: 'p1',
      roomTypeId: 'rt1',
      basePrice: 100,
      checkIn: d('2027-03-10'),
      checkOut: d('2027-03-11'),
      ages: [30],
    });
    expect(q.discountPercent).toBe(90);
    expect(q.total).toBe(10); // 100 × (1 - 0.90), nunca 0 nem negativo
    expect(q.total).toBeGreaterThan(0);
  });
});

/**
 * PRECIFICAÇÃO DINÂMICA (RatePeriod) — trava os cenários verificados ao vivo em
 * produção (8/8) como regressão permanente, + combinações caras de testar ao vivo.
 * base = R$150/adulto/noite. Regras escopadas por data (inclusivo nas 2 pontas).
 */
describe('PricingService.quote — precificação dinâmica por data', () => {
  // Regra de tarifa com defaults; sobrescreva o que precisar.
  const period = (o: any) => ({
    name: 'regra',
    startDate: d('2028-06-10'),
    endDate: d('2028-06-12'),
    adjustType: 'ABSOLUTE',
    value: 0,
    priority: 0,
    createdAt: d('2027-01-01'),
    roomTypeId: null,
    ...o,
  });
  const BASE = 150;
  const svcWith = (periods: any[]) => makeService({ periods });
  // Estadia padrão de 3 noites: 10, 11, 12/jun (checkout 13 não é cobrado).
  const stay = { checkIn: d('2028-06-10'), checkOut: d('2028-06-13') };
  const run = (svc: any, ages: number[], extra?: any) =>
    svc.quote({ propertyId: 'p1', roomTypeId: 'rt1', basePrice: BASE, ...stay, ages, ...extra });

  it('ABSOLUTE 500 em todas as noites: 2 adultos × 3 noites = 3000 (== RES ao vivo)', async () => {
    const svc = svcWith([period({ adjustType: 'ABSOLUTE', value: 500 })]);
    const q = await run(svc, [30, 30]);
    expect(q.total).toBe(3000);
    expect(q.avgDailyRate).toBe(1000);
  });

  it('PERCENT +50%: adulto 225/noite', async () => {
    const svc = svcWith([period({ adjustType: 'PERCENT', value: 50 })]);
    const q = await run(svc, [30, 30]);
    expect(q.total).toBe(1350); // 2 × 3 × 225
  });

  it('PERCENT -20%: adulto 120/noite (promoção)', async () => {
    const svc = svcWith([period({ adjustType: 'PERCENT', value: -20 })]);
    const q = await run(svc, [30, 30]);
    expect(q.total).toBe(720); // 2 × 3 × 120
  });

  it('PRIORIDADE: em sobreposição, a regra de maior prioridade vence (900 > 400)', async () => {
    const svc = svcWith([
      period({ name: 'baixa', adjustType: 'ABSOLUTE', value: 400, priority: 1 }),
      period({ name: 'alta', adjustType: 'ABSOLUTE', value: 900, priority: 5 }),
    ]);
    const q = await run(svc, [30, 30]);
    expect(q.total).toBe(5400); // 2 × 3 × 900
  });

  it('NOITES MISTAS: só a noite do meio tem regra → preço por noite é misto', async () => {
    // Regra ABS 600 só em 11/jun; 10 e 12 ficam base 150.
    const svc = svcWith([
      period({ startDate: d('2028-06-11'), endDate: d('2028-06-11'), adjustType: 'ABSOLUTE', value: 600 }),
    ]);
    const q = await run(svc, [30, 30]);
    // por adulto: 150 + 600 + 150 = 900 → 2 adultos = 1800
    expect(q.total).toBe(1800);
    expect(q.avgDailyRate).toBe(600);
  });

  it('SEM VAZAMENTO: regra fora do período da estadia não afeta o preço', async () => {
    const svc = svcWith([
      period({ startDate: d('2028-07-01'), endDate: d('2028-07-05'), adjustType: 'ABSOLUTE', value: 999 }),
    ]);
    const q = await run(svc, [30, 30]);
    expect(q.total).toBe(900); // base intacta: 2 × 3 × 150
  });

  it('CRIANÇA + tarifa dinâmica: adulto acompanha a diária alta, mas a criança 9–15 continua R$50 fixo e a ≤8 grátis', async () => {
    const svc = svcWith([period({ adjustType: 'ABSOLUTE', value: 500 })]);
    // 1 noite só p/ isolar: adulto 500, criança 12 = 50, criança 5 = 0
    const q = await svc.quote({
      propertyId: 'p1', roomTypeId: 'rt1', basePrice: BASE,
      checkIn: d('2028-06-11'), checkOut: d('2028-06-12'), ages: [30, 12, 5],
    });
    expect(q.perPerson).toEqual([500, 50, 0]);
    expect(q.total).toBe(550);
  });

  it('DESCONTO por noites + tarifa dinâmica: aplica sobre o total já com a diária alta', async () => {
    const svc = makeService({
      periods: [period({ adjustType: 'ABSOLUTE', value: 500 })],
      losRules: [{ name: '3+ noites', discountPercent: 10, minNights: 3, roomTypeId: null }],
    });
    const q = await run(svc, [30]); // 1 adulto, 3 noites @500 = 1500
    expect(q.subtotal).toBe(1500);
    expect(q.discountPercent).toBe(10);
    expect(q.total).toBe(1350); // 1500 × 0,90
  });
});
