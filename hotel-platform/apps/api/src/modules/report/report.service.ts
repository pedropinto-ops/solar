import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/** Status que ocupam quarto (contam para ocupação/receita de diárias). */
const OCCUPYING = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;
/** Reservas ainda ativas (vão gerar recebimento futuro). */
const ACTIVE = ['CONFIRMED', 'CHECKED_IN'] as const;
/** Lançamentos que somam receita além da diária (não estornados). */
const EXTRA_CHARGE_TYPES = ['CONSUMPTION', 'FEE', 'ADJUSTMENT'] as const;

/** Índice do dia (UTC) — datas @db.Date chegam como 00:00 UTC. */
const dayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

interface SummaryParams {
  propertyId: string;
  start: Date;
  end: Date;
}

/**
 * Relatórios gerenciais. Métrica de diárias por "room-night" (noite-quarto),
 * o padrão da hotelaria — garante que ocupação, ADR e RevPAR sejam coerentes.
 *
 *  - ocupação%  = room-nights vendidas / room-nights disponíveis
 *  - ADR        = receita de diárias / room-nights vendidas
 *  - RevPAR     = receita de diárias / room-nights disponíveis
 *
 * Receita de diárias é reconhecida por NOITE dentro do período (competência).
 * Consumos (frigobar/taxas) somam pela data do lançamento. "Recebido" vem dos
 * pagamentos confirmados; "a receber" é o saldo em aberto das reservas ativas.
 */
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async summary({ propertyId, start, end }: SummaryParams) {
    const spanDays = Math.max(1, dayIndex(end) - dayIndex(start));
    // Período anterior de MESMA duração, imediatamente antes.
    const prevStart = addDays(start, -spanDays);
    const prevEnd = start;

    const [current, previous, outstanding] = await Promise.all([
      this.computeCore(propertyId, start, end),
      this.computeCore(propertyId, prevStart, prevEnd),
      this.outstandingBalance(propertyId),
    ]);

    return {
      ...current,
      outstanding,
      previous: {
        roomRevenue: previous.roomRevenue,
        totalRevenue: previous.totalRevenue,
        consumptionRevenue: previous.consumptionRevenue,
        occupancyPercent: previous.occupancyPercent,
        adr: previous.adr,
        revpar: previous.revpar,
        roomNightsSold: previous.roomNightsSold,
        reservationsInPeriod: previous.reservationsInPeriod,
        receivedInPeriod: previous.receivedInPeriod,
      },
    };
  }

  /** Núcleo de cálculo de um período — reutilizado p/ período atual e anterior. */
  private async computeCore(propertyId: string, start: Date, end: Date) {
    const startIdx = dayIndex(start);
    const endIdx = dayIndex(end); // exclusivo
    const days = Math.max(0, endIdx - startIdx);

    const [totalRooms, reservations, consumAgg, paidAgg] = await Promise.all([
      this.prisma.room.count({ where: { propertyId, active: true } }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: { in: [...OCCUPYING] },
          checkInDate: { lt: end },
          checkOutDate: { gt: start },
        },
        select: { checkInDate: true, checkOutDate: true, dailyRate: true, source: true },
      }),
      this.prisma.chargeItem.aggregate({
        _sum: { totalAmount: true },
        where: {
          propertyId,
          voidedAt: null,
          type: { in: [...EXTRA_CHARGE_TYPES] },
          registeredAt: { gte: start, lt: end },
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          propertyId,
          status: 'PAID',
          OR: [
            { paidAt: { gte: start, lt: end } },
            { paidAt: null, createdAt: { gte: start, lt: end } },
          ],
        },
      }),
    ]);

    const availableRoomNights = totalRooms * days;

    let roomNightsSold = 0;
    let roomRevenue = 0;
    let reservationsInPeriod = 0;

    const dayOccupied = new Array(days).fill(0);
    const dayRevenue = new Array(days).fill(0);
    const bySourceMap = new Map<
      string,
      { reservations: number; roomNights: number; revenue: number }
    >();

    for (const r of reservations) {
      const from = Math.max(dayIndex(r.checkInDate), startIdx);
      const to = Math.min(dayIndex(r.checkOutDate), endIdx);
      const nights = to - from;
      if (nights <= 0) continue;

      const rate = Number(r.dailyRate);
      const revenue = nights * rate;

      roomNightsSold += nights;
      roomRevenue += revenue;
      reservationsInPeriod += 1;

      for (let d = from; d < to; d++) {
        dayOccupied[d - startIdx] += 1;
        dayRevenue[d - startIdx] += rate;
      }

      const src = bySourceMap.get(r.source) ?? { reservations: 0, roomNights: 0, revenue: 0 };
      src.reservations += 1;
      src.roomNights += nights;
      src.revenue += revenue;
      bySourceMap.set(r.source, src);
    }

    const consumptionRevenue = round2(Number(consumAgg._sum.totalAmount ?? 0));
    const totalRevenue = round2(roomRevenue + consumptionRevenue);
    const receivedInPeriod = round2(Number(paidAgg._sum.amount ?? 0));

    const byDay = Array.from({ length: days }, (_, i) => {
      const date = new Date((startIdx + i) * 86_400_000);
      return {
        date: date.toISOString().split('T')[0],
        occupiedRooms: dayOccupied[i],
        occupancyPercent: totalRooms > 0 ? round2((dayOccupied[i] / totalRooms) * 100) : 0,
        revenue: round2(dayRevenue[i]),
      };
    });

    const bySource = Array.from(bySourceMap.entries())
      .map(([source, v]) => ({
        source,
        reservations: v.reservations,
        roomNights: v.roomNights,
        revenue: round2(v.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      days,
      totalRooms,
      availableRoomNights,
      roomNightsSold,
      occupancyPercent:
        availableRoomNights > 0 ? round2((roomNightsSold / availableRoomNights) * 100) : 0,
      roomRevenue: round2(roomRevenue),
      consumptionRevenue,
      totalRevenue,
      adr: roomNightsSold > 0 ? round2(roomRevenue / roomNightsSold) : 0,
      revpar: availableRoomNights > 0 ? round2(roomRevenue / availableRoomNights) : 0,
      reservationsInPeriod,
      // Indicadores extras (baratos, dão profundidade).
      avgStayNights: reservationsInPeriod > 0 ? round2(roomNightsSold / reservationsInPeriod) : 0,
      ticketMedio: reservationsInPeriod > 0 ? round2(totalRevenue / reservationsInPeriod) : 0,
      receivedInPeriod,
      bySource,
      byDay,
    };
  }

  /** Saldo total em aberto das reservas ativas (a receber, visão de caixa). */
  private async outstandingBalance(propertyId: string): Promise<number> {
    const agg = await this.prisma.reservation.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { propertyId, status: { in: [...ACTIVE] } },
    });
    const total = Number(agg._sum.totalAmount ?? 0);
    const paid = Number(agg._sum.paidAmount ?? 0);
    return round2(Math.max(0, total - paid));
  }

  /**
   * Previsão: ocupação e receita JÁ confirmadas para os próximos dias (a partir
   * de hoje). Olha reservas ativas que tocam a janela e conta room-nights.
   */
  async forecast({ propertyId }: { propertyId: string }) {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    const horizonsDays = [7, 30];
    const maxDays = Math.max(...horizonsDays);
    const nowIdx = dayIndex(now);
    const maxEnd = addDays(now, maxDays);

    const [totalRooms, reservations] = await Promise.all([
      this.prisma.room.count({ where: { propertyId, active: true } }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: { in: [...ACTIVE] },
          checkInDate: { lt: maxEnd },
          checkOutDate: { gt: now },
        },
        select: { checkInDate: true, checkOutDate: true, dailyRate: true },
      }),
    ]);

    const horizons = horizonsDays.map((h) => {
      const endIdx = nowIdx + h;
      let roomNights = 0;
      let revenue = 0;
      const reservationSet = new Set<number>();
      reservations.forEach((r, i) => {
        const from = Math.max(dayIndex(r.checkInDate), nowIdx);
        const to = Math.min(dayIndex(r.checkOutDate), endIdx);
        const nights = to - from;
        if (nights <= 0) return;
        roomNights += nights;
        revenue += nights * Number(r.dailyRate);
        reservationSet.add(i);
      });
      const available = totalRooms * h;
      return {
        days: h,
        roomNights,
        revenue: round2(revenue),
        reservations: reservationSet.size,
        occupancyPercent: available > 0 ? round2((roomNights / available) * 100) : 0,
      };
    });

    return {
      generatedAt: now.toISOString().split('T')[0],
      totalRooms,
      horizons,
    };
  }
}
