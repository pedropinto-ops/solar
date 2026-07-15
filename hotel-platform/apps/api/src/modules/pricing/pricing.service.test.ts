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
