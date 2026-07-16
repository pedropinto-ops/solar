import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { generateReservationCode } from '../../common/utils/reservation-code.js';
import { ROOM_OCCUPYING_STATUSES } from '../room/room.service.js';
import { EmailService } from '../email/email.service.js';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';
import { FNRH_REQUIRED_FIELDS } from '@hotel/shared/schemas';

/**
 * Distribui um valor total (em reais) por N noites de forma que a SOMA das
 * parcelas seja idêntica ao total, ao centavo. Trabalha em centavos e joga os
 * centavos de resto nas primeiras noites. Fonte da verdade das diárias no
 * check-in — evita saldo residual que travava o check-out.
 */
export function distributeAmountToNights(total: number, nights: number): number[] {
  if (nights <= 0) return [];
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / nights);
  const remainderCents = totalCents - baseCents * nights;
  return Array.from({ length: nights }, (_, i) =>
    (baseCents + (i < remainderCents ? 1 : 0)) / 100,
  );
}

@Injectable()
export class ReservationService {
  private readonly logger = new Logger(ReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  // ===========================================================
  //  LEITURA
  // ===========================================================

  async list(params: {
    propertyId: string;
    status?: string[];
    from?: Date;
    to?: Date;
    q?: string;
    limit?: number;
  }) {
    const { propertyId, status, from, to, q, limit = 100 } = params;

    const where: Prisma.ReservationWhereInput = { propertyId };

    if (status && status.length > 0) {
      where.status = { in: status as any };
    }

    if (from && to) {
      where.AND = [{ checkInDate: { lt: to } }, { checkOutDate: { gt: from } }];
    } else if (from) {
      where.checkOutDate = { gte: from };
    } else if (to) {
      where.checkInDate = { lte: to };
    }

    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { code: { contains: term, mode: 'insensitive' } },
        {
          primaryGuest: {
            OR: [
              { fullName: { contains: term, mode: 'insensitive' } },
              { documentNumber: { contains: term.replace(/\D/g, '') } },
            ],
          },
        },
      ];
    }

    return this.prisma.reservation.findMany({
      where,
      include: {
        primaryGuest: {
          select: { id: true, fullName: true, phone: true, email: true, tags: true },
        },
        roomType: { select: { id: true, name: true } },
        room: { select: { id: true, number: true } },
        company: { select: { id: true, tradeName: true } },
      },
      orderBy: [{ checkInDate: 'asc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  async getById(propertyId: string, id: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, propertyId },
      include: {
        primaryGuest: true,
        roomType: true,
        room: true,
        company: true,
        guests: { include: { guest: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        chargeItems: {
          where: { voidedAt: null },
          orderBy: { registeredAt: 'asc' },
          include: { product: { select: { name: true, category: true } } },
        },
        fiscalDocuments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!reservation) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Reserva não encontrada',
      });
    }

    const totalCharges = reservation.chargeItems.reduce(
      (s, c) => s + c.totalAmount.toNumber(),
      0,
    );
    const totalPaid = reservation.payments
      .filter((p) => p.status === 'PAID')
      .reduce((s, p) => s + p.amount.toNumber(), 0);
    const balance = totalCharges - totalPaid;

    return {
      ...reservation,
      folio: { totalCharges, totalPaid, balance },
    };
  }

  async dashboardCounts(propertyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [arrivals, departures, inHouse, pending] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          propertyId,
          status: 'CONFIRMED',
          checkInDate: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.reservation.count({
        where: {
          propertyId,
          status: 'CHECKED_IN',
          checkOutDate: { gte: today, lt: tomorrow },
        },
      }),
      this.prisma.reservation.count({
        where: { propertyId, status: 'CHECKED_IN' },
      }),
      this.prisma.reservation.count({
        where: { propertyId, status: 'PENDING' },
      }),
    ]);

    const totalRooms = await this.prisma.room.count({
      where: { propertyId, active: true },
    });
    const occupancy = totalRooms > 0 ? Math.round((inHouse / totalRooms) * 100) : 0;

    return {
      arrivalsToday: arrivals,
      departuresToday: departures,
      inHouse,
      pending,
      totalRooms,
      occupancyPercent: occupancy,
    };
  }

  // ===========================================================
  //  CRIAÇÃO MANUAL (recepção)
  // ===========================================================

  async create(params: {
    propertyId: string;
    userId: string;
    data: {
      roomTypeId: string;
      roomId?: string;
      primaryGuestId: string;
      checkInDate: Date;
      checkOutDate: Date;
      adults: number;
      children: number;
      billingMode: string;
      depositPercent: number;
      companyId?: string;
      corporatePO?: string;
      dailyRate: number;
      source: string;
      guestNotes?: string;
      internalNotes?: string;
    };
  }) {
    const { propertyId, userId, data } = params;

    // Validações básicas
    if (data.checkOutDate <= data.checkInDate) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: 'Data de check-out deve ser posterior ao check-in',
      });
    }

    const created = await this.prisma.$transaction(async (tx) => {
      // Serializa criação por propriedade (mesmo lock da reserva pública),
      // fechando a corrida de overbooking entre reservas PENDING concorrentes
      // que o EXCLUDE constraint não cobre.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${propertyId}, 0))`;

      // Valida room type
      const roomType = await tx.roomType.findFirst({
        where: { id: data.roomTypeId, propertyId, active: true },
      });
      if (!roomType) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Categoria de quarto não encontrada',
        });
      }

      // Valida guest
      const guest = await tx.guest.findFirst({
        where: { id: data.primaryGuestId, propertyId, deletedAt: null },
      });
      if (!guest) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Hóspede não encontrado',
        });
      }

      // Valida ocupação
      if (data.adults + data.children > roomType.maxOccupancy) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Categoria comporta no máximo ${roomType.maxOccupancy} pessoas`,
        });
      }

      // Valida quarto físico (se foi atribuído já)
      if (data.roomId) {
        const room = await tx.room.findFirst({
          where: { id: data.roomId, propertyId, roomTypeId: data.roomTypeId, active: true },
        });
        if (!room) {
          throw new BadRequestException({
            errorCode: 'VALIDATION_ERROR',
            title: 'Quarto inválido para esta categoria',
          });
        }
        // Conflito explícito: o EXCLUDE constraint do banco só cobre
        // CONFIRMED/CHECKED_IN. Uma reserva PENDING já alocada nesse quarto
        // e período também o segura (ROOM_OCCUPYING_STATUSES) e precisa ser
        // checada aqui — protegida pelo advisory lock acima.
        const conflict = await tx.reservation.findFirst({
          where: {
            propertyId,
            roomId: data.roomId,
            checkInDate: { lt: data.checkOutDate },
            checkOutDate: { gt: data.checkInDate },
            status: { in: [...ROOM_OCCUPYING_STATUSES] },
          },
          select: { id: true },
        });
        if (conflict) {
          throw new ConflictException({
            errorCode: 'ROOM_NOT_AVAILABLE',
            title: 'Quarto já reservado para o período selecionado',
          });
        }
      }

      // Valida company (se POSTPAID_CORPORATE)
      if (data.billingMode === 'POSTPAID_CORPORATE') {
        if (!data.companyId) {
          throw new BadRequestException({
            errorCode: 'VALIDATION_ERROR',
            title: 'companyId é obrigatório para reservas pós-pagas corporativas',
          });
        }
        const company = await tx.company.findFirst({
          where: { id: data.companyId, propertyId, active: true },
        });
        if (!company) {
          throw new NotFoundException({
            errorCode: 'NOT_FOUND',
            title: 'Empresa não encontrada',
          });
        }
      }

      const nights = Math.round(
        (data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );
      const totalAmount = new P.Decimal(data.dailyRate).mul(nights);

      const code = await generateReservationCode(tx, propertyId);

      try {
        const reservation = await tx.reservation.create({
          data: {
            propertyId,
            code,
            primaryGuestId: data.primaryGuestId,
            roomTypeId: data.roomTypeId,
            roomId: data.roomId,
            checkInDate: data.checkInDate,
            checkOutDate: data.checkOutDate,
            nights,
            adults: data.adults,
            children: data.children,
            totalAmount,
            dailyRate: new P.Decimal(data.dailyRate),
            paidAmount: new P.Decimal(0),
            billingMode: data.billingMode as any,
            depositPercent: data.depositPercent,
            companyId: data.companyId,
            corporatePO: data.corporatePO,
            source: data.source as any,
            status: data.billingMode === 'POSTPAID_CORPORATE' ? 'CONFIRMED' : 'PENDING',
            confirmedAt: data.billingMode === 'POSTPAID_CORPORATE' ? new Date() : null,
            guestNotes: data.guestNotes,
            internalNotes: data.internalNotes,
            guests: {
              create: { guestId: data.primaryGuestId, isPrimary: true },
            },
          },
          include: {
            primaryGuest: true,
            roomType: true,
            room: true,
          },
        });

        await this.audit.log(
          {
            propertyId,
            userId,
            action: 'reservation.created',
            entityType: 'Reservation',
            entityId: reservation.id,
            changes: {
              code: reservation.code,
              source: data.source,
              totalAmount: totalAmount.toNumber(),
            },
          },
          tx,
        );

        return reservation;
      } catch (err: any) {
        // Captura violação de EXCLUDE constraint (anti-overbooking)
        if (err.code === 'P2010' || /no_overbooking/i.test(err.message ?? '')) {
          throw new ConflictException({
            errorCode: 'ROOM_NOT_AVAILABLE',
            title: 'Quarto já reservado para o período selecionado',
          });
        }
        throw err;
      }
    });

    // Aviso à GESTÃO de nova reserva (recepção) — dispara e esquece, nunca
    // derruba a criação.
    void this.email
      .sendNewReservationToManagement([created.id])
      .catch((err) =>
        this.logger.error(`Falha ao avisar a gestão da reserva: ${err?.message}`),
      );

    return created;
  }

  // ===========================================================
  //  ATRIBUIÇÃO DE QUARTO
  // ===========================================================

  async assignRoom(params: {
    propertyId: string;
    userId: string;
    reservationId: string;
    roomId: string;
  }) {
    const { propertyId, userId, reservationId, roomId } = params;

    return this.prisma.$transaction(async (tx) => {
      // Mesmo lock por propriedade: serializa realocação vs. criação
      // concorrente para o mesmo quarto/período.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${propertyId}, 0))`;

      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, propertyId },
      });
      if (!reservation) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Reserva não encontrada',
        });
      }

      if (['CHECKED_OUT', 'CANCELLED', 'NO_SHOW'].includes(reservation.status)) {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: `Reserva em status ${reservation.status} não pode ter quarto realocado`,
        });
      }

      const room = await tx.room.findFirst({
        where: { id: roomId, propertyId, active: true },
      });
      if (!room) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Quarto não encontrado',
        });
      }

      // Valida categoria (a menos que seja upgrade autorizado — futuro)
      if (room.roomTypeId !== reservation.roomTypeId) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Quarto pertence a categoria diferente da reserva',
        });
      }

      // Conflito explícito (cobre PENDING, que o EXCLUDE não pega),
      // ignorando a própria reserva.
      const conflict = await tx.reservation.findFirst({
        where: {
          propertyId,
          roomId,
          id: { not: reservationId },
          checkInDate: { lt: reservation.checkOutDate },
          checkOutDate: { gt: reservation.checkInDate },
          status: { in: [...ROOM_OCCUPYING_STATUSES] },
        },
        select: { id: true },
      });
      if (conflict) {
        throw new ConflictException({
          errorCode: 'ROOM_NOT_AVAILABLE',
          title: 'Quarto já tem reserva conflitante neste período',
        });
      }

      const previousRoomId = reservation.roomId;

      try {
        const updated = await tx.reservation.update({
          where: { id: reservationId },
          data: { roomId },
          include: { room: true, primaryGuest: true },
        });

        await this.audit.log(
          {
            propertyId,
            userId,
            action: 'reservation.room_assigned',
            entityType: 'Reservation',
            entityId: reservationId,
            changes: { previousRoomId, newRoomId: roomId },
          },
          tx,
        );

        return updated;
      } catch (err: any) {
        if (err.code === 'P2010' || /no_overbooking/i.test(err.message ?? '')) {
          throw new ConflictException({
            errorCode: 'ROOM_NOT_AVAILABLE',
            title: 'Quarto já tem reserva conflitante neste período',
          });
        }
        throw err;
      }
    });
  }

  // ===========================================================
  //  CHECK-IN
  // ===========================================================

  async checkIn(params: {
    propertyId: string;
    userId: string;
    reservationId: string;
    earlyCheckIn?: boolean;
    notes?: string;
  }) {
    const { propertyId, userId, reservationId, earlyCheckIn = false, notes } = params;

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, propertyId },
        include: {
          room: true,
          payments: true,
          guests: { include: { guest: true } },
        },
      });

      if (!reservation) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Reserva não encontrada',
        });
      }

      // Validações de status
      if (reservation.status !== 'CONFIRMED') {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: `Reserva em status ${reservation.status} não pode fazer check-in`,
        });
      }

      if (!reservation.roomId || !reservation.room) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Atribua um quarto físico antes do check-in',
        });
      }

      if (reservation.room.status !== 'AVAILABLE') {
        throw new ConflictException({
          errorCode: 'ROOM_NOT_AVAILABLE',
          title: `Quarto ${reservation.room.number} está em status ${reservation.room.status}`,
        });
      }

      // Validação de data (early check-in)
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const checkInDay = new Date(reservation.checkInDate);
      checkInDay.setUTCHours(0, 0, 0, 0);

      if (today < checkInDay && !earlyCheckIn) {
        throw new BadRequestException({
          errorCode: 'CHECKIN_TOO_EARLY',
          title: 'Check-in antecipado requer autorização (earlyCheckIn=true)',
        });
      }

      // Validação FNRH — campos obrigatórios em cada hóspede
      const missingFnrh: Array<{ guestName: string; fields: string[] }> = [];
      for (const rg of reservation.guests) {
        const g = rg.guest;
        const missing: string[] = [];
        for (const field of FNRH_REQUIRED_FIELDS) {
          if (!g[field]) missing.push(field);
        }
        if (missing.length > 0) {
          missingFnrh.push({ guestName: g.fullName || '(sem nome)', fields: missing });
        }
      }
      if (missingFnrh.length > 0) {
        throw new BadRequestException({
          errorCode: 'FNRH_FIELDS_MISSING',
          title: 'Campos obrigatórios da FNRH faltando',
          context: { missingFnrh },
        });
      }

      // Validação financeira (não aplica a corporativo)
      if (reservation.billingMode === 'DEPOSIT_BALANCE') {
        const totalPaid = reservation.payments
          .filter((p) => p.status === 'PAID')
          .reduce((s, p) => s.add(p.amount), new P.Decimal(0));
        const minRequired = reservation.totalAmount
          .mul(reservation.depositPercent ?? 30)
          .div(100);

        if (totalPaid.lt(minRequired)) {
          throw new BadRequestException({
            errorCode: 'PAYMENT_INSUFFICIENT',
            title: `Pagamento insuficiente: pago R$ ${totalPaid.toFixed(2)}, mínimo R$ ${minRequired.toFixed(2)}`,
            context: {
              paid: totalPaid.toNumber(),
              required: minRequired.toNumber(),
            },
          });
        }
      }

      const now = new Date();

      // Mutações
      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CHECKED_IN',
          checkedInAt: now,
          internalNotes: notes
            ? `${reservation.internalNotes ?? ''}\n[${now.toISOString()}] Check-in: ${notes}`.trim()
            : reservation.internalNotes,
        },
        include: { room: true, primaryGuest: true },
      });

      await tx.room.update({
        where: { id: reservation.roomId },
        data: { status: 'OCCUPIED' },
      });

      await tx.roomStatusLog.create({
        data: {
          roomId: reservation.roomId,
          previousStatus: 'AVAILABLE',
          newStatus: 'OCCUPIED',
          reason: `Check-in: ${reservation.code}`,
          changedById: userId,
        },
      });

      // Gera ChargeItems das diárias (snapshot do valor)
      await this.generateRoomNightCharges(tx, propertyId, reservation, userId);

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'reservation.checked_in',
          entityType: 'Reservation',
          entityId: reservationId,
          changes: { checkedInAt: now.toISOString(), earlyCheckIn },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Gera ChargeItems do tipo ROOM_NIGHT (uma por noite).
   * Idempotente: só cria se ainda não existir.
   */
  private async generateRoomNightCharges(
    tx: Prisma.TransactionClient,
    propertyId: string,
    reservation: {
      id: string;
      checkInDate: Date;
      checkOutDate: Date;
      dailyRate: P.Decimal;
      totalAmount: P.Decimal;
      roomType?: { name: string } | null;
    },
    userId: string,
  ) {
    const existing = await tx.chargeItem.count({
      where: { reservationId: reservation.id, type: 'ROOM_NIGHT', voidedAt: null },
    });
    if (existing > 0) return;

    const start = new Date(reservation.checkInDate);
    const end = new Date(reservation.checkOutDate);
    const oneDay = 24 * 60 * 60 * 1000;

    // Coleta as datas das noites.
    const dates: string[] = [];
    for (let d = new Date(start); d < end; d = new Date(d.getTime() + oneDay)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    const nights = dates.length;
    if (nights === 0) return;

    // Distribui o TOTAL exato da reserva pelas noites, para que a soma das
    // diárias seja idêntica ao totalAmount (evita saldo residual de centavos
    // que travava o check-out). A dailyRate é apenas uma média; o total é a
    // fonte da verdade.
    const nightAmounts = distributeAmountToNights(
      Number(reservation.totalAmount),
      nights,
    );

    const charges: Prisma.ChargeItemCreateManyInput[] = dates.map((dateStr, i) => {
      const nightAmount = new P.Decimal(nightAmounts[i]!);
      return {
        propertyId,
        reservationId: reservation.id,
        type: 'ROOM_NIGHT' as const,
        description: `Diária ${dateStr}`,
        quantity: new P.Decimal(1),
        unitPrice: nightAmount,
        totalAmount: nightAmount,
        registeredById: userId,
        registeredAt: new Date(),
      };
    });

    if (charges.length > 0) {
      await tx.chargeItem.createMany({ data: charges });
    }
  }

  // ===========================================================
  //  CHECK-OUT
  // ===========================================================

  async checkOut(params: {
    propertyId: string;
    userId: string;
    reservationId: string;
    skipFiscal?: boolean;
  }) {
    const { propertyId, userId, reservationId, skipFiscal = false } = params;

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, propertyId },
        include: {
          room: true,
          payments: true,
          chargeItems: { where: { voidedAt: null } },
          primaryGuest: true,
          company: true,
        },
      });

      if (!reservation) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Reserva não encontrada',
        });
      }

      if (reservation.status !== 'CHECKED_IN') {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: `Reserva em status ${reservation.status} não permite check-out`,
        });
      }

      // Calcula saldo
      const totalCharges = reservation.chargeItems.reduce(
        (s, c) => s.add(c.totalAmount),
        new P.Decimal(0),
      );
      const totalPaid = reservation.payments
        .filter((p) => p.status === 'PAID')
        .reduce((s, p) => s.add(p.amount), new P.Decimal(0));
      const balance = totalCharges.sub(totalPaid);

      // Saldo deve estar zerado, EXCETO corporativo (vai na fatura mensal)
      if (reservation.billingMode === 'DEPOSIT_BALANCE') {
        if (balance.gt(new P.Decimal('0.01'))) {
          throw new BadRequestException({
            errorCode: 'BALANCE_NOT_ZERO',
            title: `Saldo a pagar: R$ ${balance.toFixed(2)}. Cobre antes do check-out.`,
            context: { balance: balance.toNumber() },
          });
        }
        if (balance.lt(new P.Decimal('-0.01'))) {
          throw new BadRequestException({
            errorCode: 'BALANCE_NOT_ZERO',
            title: `Há saldo a devolver: R$ ${balance.abs().toFixed(2)}. Faça o estorno antes.`,
            context: { balance: balance.toNumber() },
          });
        }
      }

      const now = new Date();

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: { status: 'CHECKED_OUT', checkedOutAt: now },
        include: { room: true, primaryGuest: true },
      });

      // Quarto vira DIRTY
      if (reservation.roomId) {
        await tx.room.update({
          where: { id: reservation.roomId },
          data: { status: 'DIRTY' },
        });

        await tx.roomStatusLog.create({
          data: {
            roomId: reservation.roomId,
            previousStatus: 'OCCUPIED',
            newStatus: 'DIRTY',
            reason: `Check-out: ${reservation.code}`,
            changedById: userId,
          },
        });

        // Cria CleaningTask automaticamente
        await tx.cleaningTask.create({
          data: {
            propertyId,
            roomId: reservation.roomId,
            type: 'CHECKOUT',
            status: 'PENDING',
            priority: await this.calculateCleaningPriority(tx, reservation.roomId),
          },
        });
      }

      // Cria FiscalDocument PENDING (será processado por job assíncrono futuramente)
      if (!skipFiscal && reservation.billingMode === 'DEPOSIT_BALANCE') {
        await tx.fiscalDocument.create({
          data: {
            propertyId,
            type: 'NFSE',
            status: 'PENDING',
            reservationId: reservation.id,
            serviceAmount: totalCharges,
            netAmount: totalCharges,
            issRate: new P.Decimal(0),
            taxpayerName: reservation.primaryGuest?.fullName ?? '',
            taxpayerDocument: reservation.primaryGuest?.documentNumber ?? '',
            taxpayerEmail: reservation.primaryGuest?.email ?? null,
          },
        });
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'reservation.checked_out',
          entityType: 'Reservation',
          entityId: reservationId,
          changes: {
            checkedOutAt: now.toISOString(),
            totalCharges: totalCharges.toNumber(),
            totalPaid: totalPaid.toNumber(),
          },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Calcula prioridade de tarefa de limpeza.
   * Heurística documentada no critical-flows.md.
   */
  private async calculateCleaningPriority(
    tx: Prisma.TransactionClient,
    roomId: string,
  ): Promise<number> {
    let priority = 0;

    const nextReservation = await tx.reservation.findFirst({
      where: {
        roomId,
        status: 'CONFIRMED',
        checkInDate: { gte: new Date() },
      },
      orderBy: { checkInDate: 'asc' },
      include: { primaryGuest: { select: { tags: true } } },
    });

    if (nextReservation) {
      const hoursUntil =
        (nextReservation.checkInDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 6) priority += 100;
      else if (hoursUntil < 24) priority += 50;
      else if (hoursUntil < 48) priority += 20;

      if (nextReservation.primaryGuest?.tags.includes('VIP')) priority += 30;
    }

    return priority;
  }

  // ===========================================================
  //  CANCELAMENTO
  // ===========================================================

  async cancel(params: {
    propertyId: string;
    userId: string;
    reservationId: string;
    reason: string;
  }) {
    const { propertyId, userId, reservationId, reason } = params;

    return this.prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findFirst({
        where: { id: reservationId, propertyId },
      });

      if (!reservation) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Reserva não encontrada',
        });
      }

      if (['CHECKED_IN', 'CHECKED_OUT'].includes(reservation.status)) {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: `Reserva em status ${reservation.status} não pode ser cancelada. Use check-out ou estorno.`,
        });
      }

      if (reservation.status === 'CANCELLED') {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: 'Reserva já cancelada',
        });
      }

      const updated = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
      });

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'reservation.cancelled',
          entityType: 'Reservation',
          entityId: reservationId,
          changes: { reason, previousStatus: reservation.status },
        },
        tx,
      );

      return updated;
    });
  }
}
