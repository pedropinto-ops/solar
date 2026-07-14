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
import { EmailService } from '../email/email.service.js';
import { selectRoomsByCapacity, ROOM_OCCUPYING_STATUSES } from '../room/room.service.js';
import { PricingService } from '../pricing/pricing.service.js';
import { generateReservationCode } from '../../common/utils/reservation-code.js';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';

// Política de preço por idade e tarifas por data ficam no PricingService
// (fonte única). Este serviço apenas cota e grava.

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
    private readonly email: EmailService,
    private readonly pricing: PricingService,
  ) {}

  async createReservation(params: {
    propertyId: string;
    propertySlug: string;
    data: {
      roomTypeId: string;
      checkInDate: Date;
      checkOutDate: Date;
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
      companions: Array<{
        fullName: string;
        documentType: string;
        documentNumber: string;
        age: number;
      }>;
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
      const totalGuests = 1 + data.companions.length;

      // 2. Quartos LIVRES desta categoria no período (com capacidade real).
      const roomsOfType = await tx.room.findMany({
        where: {
          propertyId,
          roomTypeId: data.roomTypeId,
          active: true,
          status: { notIn: ['MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'] },
        },
        select: { id: true, maxOccupancy: true },
      });
      if (roomsOfType.length === 0) {
        throw new ConflictException({
          errorCode: 'ROOM_NO_LONGER_AVAILABLE',
          title: 'Não há quartos desta categoria',
        });
      }
      const roomIds = roomsOfType.map((r) => r.id);

      const conflicting = await tx.reservation.findMany({
        where: {
          propertyId,
          roomId: { in: roomIds },
          checkInDate: { lt: data.checkOutDate },
          checkOutDate: { gt: data.checkInDate },
          // Confirmada, hospedada OU solicitação pendente já alocada — todas
          // seguram o quarto físico no período.
          status: { in: [...ROOM_OCCUPYING_STATUSES] },
        },
        select: { roomId: true },
        distinct: ['roomId'],
      });
      const conflictingIds = new Set(
        conflicting.map((c) => c.roomId).filter((id): id is string => !!id),
      );
      const freeRooms = roomsOfType.filter((r) => !conflictingIds.has(r.id));

      // Aloca os QUARTOS CONCRETOS por capacidade real: menor quarto que caiba
      // o grupo; se nenhum couber sozinho, combina. Cada quarto escolhido vira
      // uma reserva com roomId já atribuído (alocação automática). O gestor pode
      // remanejar depois via PATCH /reservations/:id/assign-room.
      const chosenRooms = selectRoomsByCapacity(freeRooms, totalGuests);
      if (!chosenRooms) {
        throw new ConflictException({
          errorCode: 'NOT_ENOUGH_ROOMS',
          title:
            freeRooms.length === 0
              ? 'Não há quartos disponíveis para este período.'
              : `Não há quartos suficientes para acomodar ${totalGuests} hóspedes neste período.`,
        });
      }
      const roomsNeeded = chosenRooms.length;

      // 3. Cria/recupera cada hóspede (dedupe por documento). O titular
      //    carrega o contato (e-mail/telefone); acompanhantes só nome+doc.
      const upsertGuest = async (
        g: {
          fullName: string;
          documentType: string;
          documentNumber: string;
          birthDate?: Date | null;
        },
        contact?: {
          email: string;
          phone: string;
          whatsapp?: string | null;
          consentMarketing: boolean;
        },
      ) => {
        const docCleaned = g.documentNumber.replace(/\D/g, '') || g.documentNumber;
        const existing = await tx.guest.findFirst({
          where: { propertyId, documentNumber: docCleaned, deletedAt: null },
        });
        if (existing) {
          if (!contact) return existing;
          return tx.guest.update({
            where: { id: existing.id },
            data: {
              email: contact.email,
              phone: contact.phone,
              whatsapp: contact.whatsapp ?? contact.phone,
              consentMarketing: contact.consentMarketing || existing.consentMarketing,
              consentDataAt: existing.consentDataAt ?? new Date(),
            },
          });
        }
        return tx.guest.create({
          data: {
            propertyId,
            fullName: g.fullName,
            documentType: g.documentType as any,
            documentNumber: docCleaned,
            birthDate: g.birthDate ?? null,
            email: contact?.email ?? null,
            phone: contact?.phone ?? null,
            whatsapp: contact?.whatsapp ?? contact?.phone ?? null,
            consentMarketing: contact?.consentMarketing ?? false,
            consentDataAt: contact ? new Date() : null,
          },
        });
      };

      const booker = await upsertGuest(data.guest, {
        email: data.guest.email,
        phone: data.guest.phone,
        whatsapp: data.guest.whatsapp,
        consentMarketing: data.guest.consentMarketing,
      });
      const companionGuests: (typeof booker)[] = [];
      for (const c of data.companions) {
        companionGuests.push(await upsertGuest(c));
      }
      // Ordem: titular primeiro, depois acompanhantes na ordem informada.
      const partyGuests = [booker, ...companionGuests];

      // 4. Calcula valores
      const nights = Math.round(
        (data.checkOutDate.getTime() - data.checkInDate.getTime()) /
          (1000 * 60 * 60 * 24),
      );
      // Preço via COTADOR CENTRAL (aplica tarifas por data, se houver regras;
      // sem regras, usa basePrice → idêntico ao comportamento anterior).
      // ages alinha com partyGuests = [titular, ...acompanhantes]; titular=adulto.
      const quote = await this.pricing.quote({
        propertyId,
        roomTypeId: data.roomTypeId,
        basePrice: Number(roomType.basePrice),
        checkIn: data.checkInDate,
        checkOut: data.checkOutDate,
        ages: [30, ...data.companions.map((c) => c.age)],
      });
      // Total por pessoa ao longo de todas as noites (ordem de partyGuests).
      const partyTotals = quote.perPerson;

      // 5+6. Cria uma reserva por quarto alocado, distribuindo os hóspedes
      //      até a capacidade REAL de cada quarto (allocCaps). Tudo na mesma
      //      transação (atômico). Com mais de um quarto, marca todas com o
      //      mesmo grupo em sourceDetails p/ a recepção correlacionar.
      const groupTag = roomsNeeded > 1 ? `group:${data.idempotencyKey}` : null;
      const reservations: Array<{ id: string; code: string; status: string }> = [];

      let offset = 0;
      for (let i = 0; i < roomsNeeded; i++) {
        const chosenRoom = chosenRooms[i]!;
        const roomCap = chosenRoom.maxOccupancy;
        const slice = partyGuests.slice(offset, offset + roomCap);
        // Total do quarto = soma dos totais (por pessoa) dos seus ocupantes.
        const sliceTotals = partyTotals.slice(offset, offset + roomCap);
        offset += roomCap;
        const roomGuests = slice.length > 0 ? slice : [booker];
        const roomTotalNum = sliceTotals.reduce((s, r) => s + r, 0);
        const roomTotal = new P.Decimal(roomTotalNum);
        // dailyRate = média por noite (a diária pode variar por data).
        const roomDaily = new P.Decimal(nights > 0 ? roomTotalNum / nights : 0);
        // Código gerado dentro do loop: a contagem enxerga as reservas já
        // criadas nesta mesma transação, então incrementa corretamente.
        const code = await generateReservationCode(tx, propertyId);
        try {
          const reservation = await tx.reservation.create({
            data: {
              propertyId,
              code,
              primaryGuestId: roomGuests[0]!.id,
              roomTypeId: data.roomTypeId,
              // Quarto físico alocado automaticamente (o gestor pode trocar).
              roomId: chosenRoom.id,
              checkInDate: data.checkInDate,
              checkOutDate: data.checkOutDate,
              nights,
              adults: roomGuests.length,
              children: 0,
              totalAmount: roomTotal,
              dailyRate: roomDaily,
              paidAmount: new P.Decimal(0),
              billingMode: 'DEPOSIT_BALANCE',
              depositPercent: 30,
              source: 'DIRECT',
              sourceDetails: groupTag,
              status: 'PENDING',
              holdExpiresAt: null,
              guestNotes: data.guestNotes,
              contractAccepted: true,
              contractAcceptedAt: new Date(),
              contractVersion: data.contractVersion,
              contractAcceptedIp: ip ?? null,
              guests: {
                create: roomGuests.map((g, idx) => ({
                  guestId: g.id,
                  isPrimary: idx === 0,
                })),
              },
            },
            select: { id: true, code: true, status: true },
          });
          reservations.push(reservation);
        } catch (err: any) {
          if (err.code === 'P2010' || /no_overbooking/i.test(err.message ?? '')) {
            throw new ConflictException({
              errorCode: 'ROOM_NO_LONGER_AVAILABLE',
              title: 'Acabou de ser reservado por outra pessoa. Tente outra data.',
            });
          }
          throw err;
        }
      }

      await this.audit.log(
        {
          propertyId,
          userId: null,
          action: 'reservation.created_public',
          entityType: 'Reservation',
          entityId: reservations[0]!.id,
          changes: {
            codes: reservations.map((r) => r.code),
            rooms: roomsNeeded,
            guests: totalGuests,
            source: 'DIRECT',
            idempotencyKey: data.idempotencyKey,
          },
          metadata: { guestEmail: booker.email, guestPhone: booker.phone },
        },
        tx,
      );

      const grandTotal = quote.total;
      return {
        reservations,
        guest: booker,
        grandTotal,
        depositAmount: Math.round(grandTotal * 30) / 100,
      };
    });

    // 7. Sem pagamento online nesta fase: a reserva é uma SOLICITAÇÃO com
    //    contrato aceito. A recepção valida e combina o pagamento à parte.
    const responseBody = {
      reservations: result.reservations,
      roomsQuantity: result.reservations.length,
      totalAmount: result.grandTotal,
      depositAmount: result.depositAmount,
      payment: null,
    };

    // E-mail único de "solicitação recebida" (lista todos os quartos) —
    // dispara e esquece. O EmailService engole qualquer erro internamente,
    // mas o void + catch garante que uma rejeição jamais escape do fluxo.
    void this.email
      .sendReservationReceived(result.reservations.map((r) => r.id))
      .catch((err) =>
        this.logger.error(`Falha ao enviar e-mail de reserva: ${err?.message}`),
      );

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
