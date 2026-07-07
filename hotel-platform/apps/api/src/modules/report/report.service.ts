import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/** Status que ocupam quarto (contam para ocupação/receita de diárias). */
const OCCUPYING = ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] as const;

/** Índice do dia (UTC) — datas @db.Date chegam como 00:00 UTC. */
const dayIndex = (d: Date) => Math.floor(d.getTime() / 86_400_000);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface SummaryParams {
  propertyId: string;
  start: Date;
  end: Date;
}

/**
 * Relatórios gerenciais. Métrica de diárias por "room-night" (noite-quarto),
 * o padrão da hotelaria — garante que ocupação, ADR e RevPAR sejam coerentes
 * entre si.
 *
 *  - ocupação%  = room-nights vendidas / room-nights disponíveis
 *  - ADR        = receita de diárias / room-nights vendidas
 *  - RevPAR     = receita de diárias / room-nights disponíveis
 *
 * Receita é reconhecida por NOITE dentro do período (competência), não pelo
 * total da reserva — assim uma estadia que cruza a borda do mês entra só com
 * as noites daquele mês.
 */
@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}

  async summary({ propertyId, start, end }: SummaryParams) {
    const startIdx = dayIndex(start);
    const endIdx = dayIndex(end); // exclusivo
    const days = Math.max(0, endIdx - startIdx);

    const [totalRooms, reservations] = await Promise.all([
      this.prisma.room.count({ where: { propertyId, active: true } }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: { in: [...OCCUPYING] },
          checkInDate: { lt: end },
          checkOutDate: { gt: start },
        },
        select: {
          checkInDate: true,
          checkOutDate: true,
          dailyRate: true,
          source: true,
        },
      }),
    ]);

    const availableRoomNights = totalRooms * days;

    let roomNightsSold = 0;
    let roomRevenue = 0;
    let reservationsInPeriod = 0;

    // Curva diária: ocupação e receita por dia do período.
    const dayOccupied = new Array(days).fill(0);
    const dayRevenue = new Array(days).fill(0);

    // Por origem (DIRECT, PHONE, OTA...).
    const bySourceMap = new Map<
      string,
      { reservations: number; roomNights: number; revenue: number }
    >();

    for (const r of reservations) {
      const ci = dayIndex(r.checkInDate);
      const co = dayIndex(r.checkOutDate);
      const from = Math.max(ci, startIdx);
      const to = Math.min(co, endIdx);
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

      const src = bySourceMap.get(r.source) ?? {
        reservations: 0,
        roomNights: 0,
        revenue: 0,
      };
      src.reservations += 1;
      src.roomNights += nights;
      src.revenue += revenue;
      bySourceMap.set(r.source, src);
    }

    const byDay = Array.from({ length: days }, (_, i) => {
      const date = new Date((startIdx + i) * 86_400_000);
      return {
        date: date.toISOString().split('T')[0],
        occupiedRooms: dayOccupied[i],
        occupancyPercent:
          totalRooms > 0 ? round2((dayOccupied[i] / totalRooms) * 100) : 0,
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
        availableRoomNights > 0
          ? round2((roomNightsSold / availableRoomNights) * 100)
          : 0,
      roomRevenue: round2(roomRevenue),
      adr: roomNightsSold > 0 ? round2(roomRevenue / roomNightsSold) : 0,
      revpar:
        availableRoomNights > 0 ? round2(roomRevenue / availableRoomNights) : 0,
      reservationsInPeriod,
      bySource,
      byDay,
    };
  }
}
