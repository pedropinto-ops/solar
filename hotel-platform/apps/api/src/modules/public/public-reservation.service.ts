import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { PaymentService } from '../payment/payment.service.js';
import { generateReservationCode } from '../../common/utils/reservation-code.js';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';

/**
 * Encapsula o Fluxo 1 inteiro: validação de disponibilidade → criação
 * de Guest (ou recuperação) → criação de Reservation PENDING com hold
 * → criação de Payment Pix via Asaas → resposta com QR Code.
 *
 * Idempotência via `idempotencyKey`: a mesma chave em até 24h retorna
 * a mesma reserva (não duplica).
 */
@Injectable()
export class PublicReservationService {
  private readonly logger = new Logger(PublicReservationService.name);

  // Cache simples em memória de idempotency keys.
  // Em produção: Redis com TTL. Para MVP single-instance, suficiente.
  private idempotencyCache = new Map<
    string,
    { result: any; expiresAt: number }
  >();

  // Tempo de hold (minutos) — reserva PENDING que não recebe pagamento neste prazo
  // será cancelada pelo cron.
  private readonly HOLD_MINUTES = 30;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly paymentService: PaymentService,
  ) {}

  async createReservation(params: {
    propertyId: string;
    propertySlug: string;
    data: {
      roomTypeId: string;
      checkInDate: Date;
      checkOutDate: Date;
      adults: number;
      children: number;
      guest: {
        fullName: string;
        documentType: string;
        documentNumber: string;
        email: string;
        phone: string;
        whatsapp?: string | null;
        birthDate?: Date | null;
        consentMarketing: boolean;
      };
      guestNotes?: string;
      contractAccepted: boolean;
      contractVersion: string;
      idempotencyKey: string;
    };
    ip?: string;
  }) {
    const { propertyId, propertySlug, ip, data } = params;

    // Idempotência
    const cacheKey = `${propertySlug}:${data.idempotencyKey}`;
    const cached = this.idempotencyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      this.logger.log(`Idempotency hit: ${cacheKey}`);
      return cached.result;
    }

    // Validação básica de datas
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (data.checkInDate < today) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: 'Data de check-in não pode ser no passado',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Valida RoomType
      const roomType = await tx.roomType.findFirst({
        where: { id: data.roomTypeId, propertyId, active: true },
      });
      if (!roomType) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Categoria de quarto não encontrada',
        });
      }
      if (data.adults + data.children > roomType.maxOccupancy) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Categoria comporta no máximo ${roomType.maxOccupancy} pessoas`,
        });
      }

      // 2. Verifica disponibilidade da categoria no período
      const roomsOfType = await tx.room.findMany({
        where: {
          propertyId,
          roomTypeId: data.roomTypeId,
          active: true,
          status: { notIn: ['MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'] },
        },
        select: { id: true },
      });
      const roomIds = roomsOfType.map((r) => r.id);
      if (roomIds.length === 0) {
        throw new ConflictException({
          errorCode: 'ROOM_NO_LONGER_AVAILABLE',
          title: 'Não há quartos desta categoria',
        });
      }

      // Conta quantos têm conflito no período
      const conflicting = await tx.reservation.findMany({
        where: {
          propertyId,
          roomId: { in: roomIds },
          checkInDate: { lt: data.checkOutDate },
          checkOutDate: { gt: data.checkInDate },
          OR: [
            { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
            {
              status: 'PENDING',
              holdExpiresAt: { gt: new Date() },
            },
          ],
        },
        select: { roomId: true },
        distinct: ['roomId'],
      });

      const conflictingIds = new Set(
        conflicting.map((c) => c.roomId).filter((id): id is string => !!id),
      );
      const available = roomIds.length - conflictingIds.size;

      if (available <= 0) {
        throw new ConflictException({
          errorCode: 'ROOM_NO_LONGER_AVAILABLE',
          title: 'Quarto não está mais disponível para o período',
        });
      }

      // 3. Cria ou recupera Guest (deduplicação por documento)
      const docCleaned = data.guest.documentNumber.replace(/\D/g, '') || data.guest.documentNumber;
      let guest = await tx.guest.findFirst({
        where: {
          propertyId,
          documentNumber: docCleaned,
          deletedAt: null,
        },
      });

      if (guest) {
        // Atualiza contato (pode ter mudado)
        guest = await tx.guest.update({
          where: { id: guest.id },
          data: {
            email: data.guest.email,
            phone: data.guest.phone,
            whatsapp: data.guest.whatsapp ?? data.guest.phone,
            consentMarketing: data.guest.consentMarketing || guest.consentMarketing,
            consentDataAt: guest.consentDataAt ?? new Date(),
          },
        });
      } else {
        guest = await tx.guest.create({
          data: {
            propertyId,
            fullName: data.guest.fullName,
            documentType: data.guest.documentType as any,
            documentNumber: docCleaned,
            email: data.guest.email,
            phone: data.guest.phone,
            whatsapp: data.guest.whatsapp ?? data.guest.phone,
            birthDate: data.guest.birthDate,
            consentMarketing: data.guest.consentMarketing,
            consentDataAt: new Date(),
          },
        });
      }

      // 4. Calcula valores
      const nights = Math.round(
        (data.checkOutDate.getTime() - data.checkInDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const totalAmount = roomType.basePrice.mul(nights);

      // 5. Gera código
      const code = await generateReservationCode(tx, propertyId);

      // 6. Cria a solicitação de reserva (PENDING, sem pagamento online).
      //    Sem holdExpiresAt: não é cancelada pelo cron; aguarda confirmação do hotel.
      let reservation;
      try {
        reservation = await tx.reservation.create({
          data: {
            propertyId,
            code,
            primaryGuestId: guest.id,
            roomTypeId: data.roomTypeId,
            // roomId: null — alocação no check-in
            checkInDate: data.checkInDate,
            checkOutDate: data.checkOutDate,
            nights,
            adults: data.adults,
            children: data.children,
            totalAmount,
            dailyRate: roomType.basePrice,
            paidAmount: new P.Decimal(0),
            billingMode: 'DEPOSIT_BALANCE',
            depositPercent: 30,
            source: 'DIRECT',
            status: 'PENDING',
            holdExpiresAt: null,
            guestNotes: data.guestNotes,
            contractAccepted: true,
            contractAcceptedAt: new Date(),
            contractVersion: data.contractVersion,
            contractAcceptedIp: ip ?? null,
            guests: { create: { guestId: guest.id, isPrimary: true } },
          },
        });
      } catch (err: any) {
        if (err.code === 'P2010' || /no_overbooking/i.test(err.message ?? '')) {
          throw new ConflictException({
            errorCode: 'ROOM_NO_LONGER_AVAILABLE',
            title: 'Acabou de ser reservado por outra pessoa. Tente outra data.',
          });
        }
        throw err;
      }

      await this.audit.log(
        {
          propertyId,
          userId: null,
          action: 'reservation.created_public',
          entityType: 'Reservation',
          entityId: reservation.id,
          changes: {
            code: reservation.code,
            source: 'DIRECT',
            idempotencyKey: data.idempotencyKey,
          },
          metadata: { guestEmail: guest.email, guestPhone: guest.phone },
        },
        tx,
      );

      return { reservation, guest, depositAmount: totalAmount.mul(30).div(100).toNumber() };
    });

    // 7. Sem pagamento online nesta fase: a reserva é uma SOLICITAÇÃO com
    //    contrato aceito. A recepção valida e combina o pagamento à parte.
    const responseBody = {
      reservation: {
        id: result.reservation.id,
        code: result.reservation.code,
        status: result.reservation.status,
        totalAmount: result.reservation.totalAmount.toNumber(),
        depositAmount: result.depositAmount,
      },
      payment: null,
    };

    // Cacheia idempotência por 24h
    this.idempotencyCache.set(cacheKey, {
      result: responseBody,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    // Limpa cache antigo periodicamente (simples, não otimizado)
    this.cleanExpiredCache();

    return responseBody;
  }

  private cleanExpiredCache() {
    if (this.idempotencyCache.size < 100) return; // só limpa quando ficar grande
    const now = Date.now();
    for (const [key, entry] of this.idempotencyCache.entries()) {
      if (entry.expiresAt < now) this.idempotencyCache.delete(key);
    }
  }
}
