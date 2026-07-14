import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { Prisma as P } from '@prisma/client';
import type { RatePeriod } from '@prisma/client';

/**
 * Política de preço por idade (Modelo A — diária por pessoa):
 *   0–8 anos  → grátis
 *   9–15 anos → taxa fixa/dia (não varia por data)
 *   16+ anos  → diária do adulto (pode variar por data via RatePeriod)
 *
 * FONTE ÚNICA do preço. Antes essa regra estava copiada em
 * public-reservation.service, no front e no assistente — agora todos cotam aqui.
 */
export const CHILD_FREE_MAX_AGE = 8;
export const CHILD_FEE_MAX_AGE = 15;
export const CHILD_DAILY_FEE = 50;

const dayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface NightRate {
  date: string; // YYYY-MM-DD
  adultRate: number; // diária do adulto naquela noite
  ruleName: string | null; // nome da regra aplicada (null = tarifa base)
}

export interface Quote {
  nights: number;
  perNight: NightRate[];
  /** Total por pessoa, na ordem das idades recebidas. */
  perPerson: number[];
  total: number;
  /** Média por noite (compat. com Reservation.dailyRate). */
  avgDailyRate: number;
}

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Regras ativas da propriedade — globais (roomTypeId null) ou da categoria. */
  async getActivePeriods(propertyId: string, roomTypeId?: string): Promise<RatePeriod[]> {
    return this.prisma.ratePeriod.findMany({
      where: {
        propertyId,
        active: true,
        OR: [{ roomTypeId: null }, ...(roomTypeId ? [{ roomTypeId }] : [])],
      },
    });
  }

  /**
   * Diária do ADULTO numa data: regra ativa de maior prioridade que contém a
   * data (intervalo inclusivo). Sem regra → basePrice (comportamento atual).
   */
  resolveAdultRate(
    basePrice: number,
    date: Date,
    periods: RatePeriod[],
  ): { rate: number; ruleName: string | null } {
    const di = dayIndex(date);
    const applicable = periods.filter(
      (p) => di >= dayIndex(p.startDate) && di <= dayIndex(p.endDate),
    );
    if (applicable.length === 0) return { rate: round2(basePrice), ruleName: null };

    // Maior prioridade vence; empate → a mais recente.
    applicable.sort(
      (a, b) => b.priority - a.priority || b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const rule = applicable[0]!;
    const val = Number(rule.value);
    const rate = rule.adjustType === 'ABSOLUTE' ? val : basePrice * (1 + val / 100);
    return { rate: round2(rate), ruleName: rule.name };
  }

  /** Diária de UMA pessoa numa noite, dada a idade e a tarifa do adulto. */
  personNightRate(age: number, adultRate: number): number {
    if (age <= CHILD_FREE_MAX_AGE) return 0;
    if (age <= CHILD_FEE_MAX_AGE) return CHILD_DAILY_FEE;
    return adultRate;
  }

  /**
   * Cotação completa: percorre cada noite [checkIn, checkOut), resolve a tarifa
   * do adulto da data e soma por pessoa (por idade). `ages` inclui o titular.
   */
  async quote(params: {
    propertyId: string;
    roomTypeId: string;
    basePrice: number;
    checkIn: Date;
    checkOut: Date;
    ages: number[];
  }): Promise<Quote> {
    const { propertyId, roomTypeId, basePrice, checkIn, checkOut, ages } = params;
    const periods = await this.getActivePeriods(propertyId, roomTypeId);

    const startIdx = dayIndex(checkIn);
    const endIdx = dayIndex(checkOut);
    const nights = Math.max(0, endIdx - startIdx);

    const perNight: NightRate[] = [];
    const perPerson = new Array(ages.length).fill(0);
    let total = 0;

    for (let i = 0; i < nights; i++) {
      const date = new Date((startIdx + i) * 86_400_000);
      const { rate: adultRate, ruleName } = this.resolveAdultRate(basePrice, date, periods);
      perNight.push({ date: date.toISOString().split('T')[0]!, adultRate, ruleName });
      ages.forEach((age, idx) => {
        const r = this.personNightRate(age, adultRate);
        perPerson[idx] += r;
        total += r;
      });
    }

    return {
      nights,
      perNight,
      perPerson: perPerson.map(round2),
      total: round2(total),
      avgDailyRate: nights > 0 ? round2(total / nights) : 0,
    };
  }

  /**
   * Calendário de preços: diária do adulto para cada dia de [start, end).
   * Alimenta a agenda visual da aba "Preços". Reusa a resolução do cotador.
   */
  async priceCalendar(params: {
    propertyId: string;
    roomTypeId: string;
    start: Date;
    end: Date;
  }) {
    const { propertyId, roomTypeId, start, end } = params;
    const rt = await this.prisma.roomType.findFirst({
      where: { id: roomTypeId, propertyId },
      select: { basePrice: true },
    });
    const basePrice = rt ? Number(rt.basePrice) : 0;
    const periods = await this.getActivePeriods(propertyId, roomTypeId);

    const startIdx = dayIndex(start);
    const endIdx = dayIndex(end);
    const days: Array<{ date: string; adultRate: number; ruleName: string | null }> = [];
    for (let d = startIdx; d < endIdx; d++) {
      const date = new Date(d * 86_400_000);
      const { rate, ruleName } = this.resolveAdultRate(basePrice, date, periods);
      days.push({ date: date.toISOString().split('T')[0]!, adultRate: rate, ruleName });
    }
    return { basePrice, days };
  }

  // ===========================================================
  //  GESTÃO (ADMIN/MANAGER) — a aba "Preços"
  // ===========================================================

  /** Diárias base por categoria + regras de tarifa cadastradas. */
  async pricingOverview(propertyId: string) {
    const [roomTypes, periods] = await Promise.all([
      this.prisma.roomType.findMany({
        where: { propertyId, active: true },
        select: { id: true, name: true, basePrice: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.ratePeriod.findMany({
        where: { propertyId },
        orderBy: [{ startDate: 'asc' }, { priority: 'desc' }],
      }),
    ]);
    return {
      childFee: CHILD_DAILY_FEE,
      childFreeMaxAge: CHILD_FREE_MAX_AGE,
      childFeeMaxAge: CHILD_FEE_MAX_AGE,
      roomTypes: roomTypes.map((rt) => ({
        id: rt.id,
        name: rt.name,
        basePrice: Number(rt.basePrice),
      })),
      periods: periods.map((p) => ({
        id: p.id,
        name: p.name,
        roomTypeId: p.roomTypeId,
        startDate: p.startDate.toISOString().split('T')[0],
        endDate: p.endDate.toISOString().split('T')[0],
        adjustType: p.adjustType,
        value: Number(p.value),
        priority: p.priority,
        active: p.active,
      })),
    };
  }

  async updateBasePrice(params: {
    propertyId: string;
    userId: string;
    roomTypeId: string;
    basePrice: number;
  }) {
    const rt = await this.prisma.roomType.findFirst({
      where: { id: params.roomTypeId, propertyId: params.propertyId },
    });
    if (!rt) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Categoria não encontrada' });

    const updated = await this.prisma.roomType.update({
      where: { id: params.roomTypeId },
      data: { basePrice: new P.Decimal(params.basePrice) },
      select: { id: true, name: true, basePrice: true },
    });
    await this.audit.log({
      propertyId: params.propertyId,
      userId: params.userId,
      action: 'pricing.base_price_updated',
      entityType: 'RoomType',
      entityId: params.roomTypeId,
      changes: { from: Number(rt.basePrice), to: params.basePrice },
    });
    return { ...updated, basePrice: Number(updated.basePrice) };
  }

  async createPeriod(params: {
    propertyId: string;
    userId: string;
    data: {
      name: string;
      roomTypeId?: string | null;
      startDate: Date;
      endDate: Date;
      adjustType: 'ABSOLUTE' | 'PERCENT';
      value: number;
      priority: number;
    };
  }) {
    const { propertyId, userId, data } = params;
    const created = await this.prisma.ratePeriod.create({
      data: {
        propertyId,
        roomTypeId: data.roomTypeId ?? null,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        adjustType: data.adjustType,
        value: new P.Decimal(data.value),
        priority: data.priority,
      },
    });
    await this.audit.log({
      propertyId,
      userId,
      action: 'pricing.period_created',
      entityType: 'RatePeriod',
      entityId: created.id,
      changes: { name: data.name, adjustType: data.adjustType, value: data.value },
    });
    return created;
  }

  async updatePeriod(params: {
    propertyId: string;
    userId: string;
    id: string;
    data: Partial<{
      name: string;
      roomTypeId: string | null;
      startDate: Date;
      endDate: Date;
      adjustType: 'ABSOLUTE' | 'PERCENT';
      value: number;
      priority: number;
      active: boolean;
    }>;
  }) {
    const { propertyId, userId, id, data } = params;
    const existing = await this.prisma.ratePeriod.findFirst({ where: { id, propertyId } });
    if (!existing) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Regra não encontrada' });

    const updated = await this.prisma.ratePeriod.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.roomTypeId !== undefined ? { roomTypeId: data.roomTypeId } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate } : {}),
        ...(data.adjustType !== undefined ? { adjustType: data.adjustType } : {}),
        ...(data.value !== undefined ? { value: new P.Decimal(data.value) } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
    await this.audit.log({
      propertyId,
      userId,
      action: 'pricing.period_updated',
      entityType: 'RatePeriod',
      entityId: id,
      changes: data as Record<string, unknown>,
    });
    return updated;
  }

  async removePeriod(params: { propertyId: string; userId: string; id: string }) {
    const { propertyId, userId, id } = params;
    const existing = await this.prisma.ratePeriod.findFirst({ where: { id, propertyId } });
    if (!existing) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Regra não encontrada' });
    await this.prisma.ratePeriod.delete({ where: { id } });
    await this.audit.log({
      propertyId,
      userId,
      action: 'pricing.period_deleted',
      entityType: 'RatePeriod',
      entityId: id,
      changes: { name: existing.name },
    });
    return { ok: true };
  }
}
