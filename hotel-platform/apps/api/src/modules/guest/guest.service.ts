import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
// Import de VALOR (não `import type`): Prisma.DbNull é usado em runtime para
// limpar colunas Json na anonimização.
import { Prisma } from '@prisma/client';

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Mascara documento para exibição em LISTA (minimização de dados — LGPD).
   * Mantém só os 2 últimos dígitos, o suficiente para o staff conferir sem
   * expor o CPF inteiro. O número completo só sai no getById (registro único).
   */
  private maskDocument(doc: string | null): string | null {
    if (!doc) return null;
    const clean = doc.trim();
    if (clean.length <= 2) return '••';
    return `${'•'.repeat(Math.max(clean.length - 2, 3))}${clean.slice(-2)}`;
  }

  async list(params: { propertyId: string; q?: string; limit?: number }) {
    const { propertyId, q } = params;
    // Teto rígido: sem isto, ?limit=9999999 exporta a base inteira de hóspedes
    // (CPF + contatos) numa requisição só. 100 é o máximo por página.
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);

    const where: Prisma.GuestWhereInput = {
      propertyId,
      deletedAt: null,
    };

    if (q && q.trim().length > 0) {
      const term = q.trim();
      where.OR = [
        { fullName: { contains: term, mode: 'insensitive' } },
        { documentNumber: { contains: term.replace(/\D/g, '') } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ];
    }

    const guests = await this.prisma.guest.findMany({
      where,
      orderBy: { fullName: 'asc' },
      take: limit,
      select: {
        id: true,
        fullName: true,
        documentType: true,
        documentNumber: true,
        email: true,
        phone: true,
        whatsapp: true,
        nationality: true,
        tags: true,
        companyId: true,
        company: { select: { tradeName: true } },
      },
    });

    // Minimização (LGPD): a lista devolve o documento MASCARADO. O CPF completo
    // exige abrir o hóspede (GET /guests/:id), o que reduz a superfície de
    // exposição e o impacto de um token vazado.
    return guests.map((g) => ({
      ...g,
      documentNumber: this.maskDocument(g.documentNumber),
    }));
  }

  async getById(propertyId: string, id: string) {
    const guest = await this.prisma.guest.findFirst({
      where: { id, propertyId, deletedAt: null },
      include: {
        company: { select: { id: true, tradeName: true } },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!guest) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Hóspede não encontrado',
      });
    }
    return guest;
  }

  /**
   * Busca por CPF/documento — usado para deduplicação na criação.
   */
  async findByDocument(propertyId: string, documentNumber: string) {
    const cleaned = documentNumber.replace(/\D/g, '');
    return this.prisma.guest.findFirst({
      where: {
        propertyId,
        documentNumber: cleaned.length > 0 ? cleaned : documentNumber,
        deletedAt: null,
      },
    });
  }

  async create(params: {
    propertyId: string;
    userId: string;
    data: Prisma.GuestUncheckedCreateInput;
  }) {
    const { propertyId, userId, data } = params;

    // Deduplicação por documento
    const existing = await this.findByDocument(propertyId, data.documentNumber);
    if (existing) {
      throw new ConflictException({
        errorCode: 'CONFLICT',
        title: 'Já existe hóspede com este documento',
        context: { existingGuestId: existing.id },
      });
    }

    const guest = await this.prisma.guest.create({
      data: {
        ...data,
        propertyId,
        consentDataAt: data.consentMarketing ? new Date() : data.consentDataAt,
      },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'guest.created',
      entityType: 'Guest',
      entityId: guest.id,
      // Nunca gravar o CPF cru aqui: o audit log é retido indefinidamente e
      // vira uma segunda base de dados pessoais fora do controle da LGPD.
      changes: {
        fullName: guest.fullName,
        documentNumber: this.maskDocument(guest.documentNumber),
      },
    });

    return guest;
  }

  async update(params: {
    propertyId: string;
    userId: string;
    id: string;
    data: Partial<Prisma.GuestUncheckedUpdateInput>;
  }) {
    const { propertyId, userId, id, data } = params;

    const existing = await this.prisma.guest.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Hóspede não encontrado',
      });
    }

    // Se mudou o documento, valida não-conflito
    if (data.documentNumber && data.documentNumber !== existing.documentNumber) {
      const conflict = await this.findByDocument(
        propertyId,
        String(data.documentNumber),
      );
      if (conflict && conflict.id !== id) {
        throw new ConflictException({
          errorCode: 'CONFLICT',
          title: 'Outro hóspede já usa este documento',
        });
      }
    }

    const updated = await this.prisma.guest.update({
      where: { id },
      data,
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'guest.updated',
      entityType: 'Guest',
      entityId: id,
      changes: { fields: Object.keys(data) },
    });

    return updated;
  }

  /**
   * Soft delete + anonimização para LGPD.
   * Mantém o registro para integridade financeira, mas zera dados pessoais.
   */
  async anonymize(params: { propertyId: string; userId: string; id: string }) {
    const { propertyId, userId, id } = params;

    const guest = await this.prisma.guest.findFirst({
      where: { id, propertyId },
    });
    if (!guest) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Hóspede não encontrado',
      });
    }

    // Verifica se há estadia em andamento
    const activeReservation = await this.prisma.reservation.findFirst({
      where: {
        primaryGuestId: id,
        status: { in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      },
    });
    if (activeReservation) {
      throw new BadRequestException({
        errorCode: 'CONFLICT',
        title: 'Hóspede tem reserva ativa. Cancele ou finalize antes de anonimizar.',
        context: { reservationCode: activeReservation.code },
      });
    }

    const now = new Date();

    // LGPD art. 18 (eliminação): a anonimização precisa remover TODO identificador
    // pessoal, não só nome/contato. Antes, CPF, nascimento e as fotos de documento
    // sobreviviam — o registro continuava plenamente identificável.
    await this.prisma.$transaction(async (tx) => {
      await tx.guest.update({
        where: { id },
        data: {
          fullName: `[ANONIMIZADO ${id.slice(-6)}]`,
          // Placeholder preserva o @@unique([propertyId, documentNumber])
          // sem manter o CPF real indexado e pesquisável.
          documentNumber: `ANON-${id.slice(-10)}`,
          documentIssuer: null,
          documentIssuedAt: null,
          birthDate: null,
          gender: null,
          occupation: null,
          email: null,
          phone: null,
          whatsapp: null,
          addressStreet: null,
          addressNumber: null,
          addressComplement: null,
          addressNeighborhood: null,
          addressCity: null,
          addressState: null,
          addressZip: null,
          travelOrigin: null,
          travelDestination: null,
          travelPurpose: null,
          transportMeans: null,
          tags: [],
          internalNotes: null,
          preferences: Prisma.DbNull,
          anonymizedAt: now,
          deletedAt: now,
        },
      });

      // Fotos de RG/passaporte (URLs no R2) são o dado mais sensível — some.
      await tx.guestDocument.deleteMany({ where: { guestId: id } });

      // O audit log guardava cópia do CPF/contatos em texto puro; sem limpar,
      // a "eliminação" seria contornável por esse armazenamento secundário.
      await tx.auditLog.updateMany({
        where: { entityType: 'Guest', entityId: id },
        data: { changes: { redacted: 'anonimizado-lgpd' }, metadata: Prisma.DbNull },
      });
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'guest.anonymized',
      entityType: 'Guest',
      entityId: id,
      changes: { anonymizedAt: now.toISOString() },
    });

    return { anonymized: true, anonymizedAt: now };
  }

  /**
   * Vincula um hóspede a uma reserva como acompanhante.
   */
  async addToReservation(params: {
    propertyId: string;
    userId: string;
    reservationId: string;
    guestId: string;
    isPrimary?: boolean;
  }) {
    const { propertyId, userId, reservationId, guestId, isPrimary = false } = params;

    const [reservation, guest] = await Promise.all([
      this.prisma.reservation.findFirst({
        where: { id: reservationId, propertyId },
        include: { roomType: true, guests: true },
      }),
      this.prisma.guest.findFirst({ where: { id: guestId, propertyId, deletedAt: null } }),
    ]);

    if (!reservation)
      throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Reserva não encontrada' });
    if (!guest)
      throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Hóspede não encontrado' });

    // Verifica ocupação máxima
    if (reservation.guests.length >= reservation.roomType.maxOccupancy) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: `Categoria comporta no máximo ${reservation.roomType.maxOccupancy} pessoas`,
      });
    }

    // Verifica duplicação
    const already = reservation.guests.find((g) => g.guestId === guestId);
    if (already) {
      throw new ConflictException({
        errorCode: 'CONFLICT',
        title: 'Hóspede já está vinculado a esta reserva',
      });
    }

    const link = await this.prisma.reservationGuest.create({
      data: { reservationId, guestId, isPrimary },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'reservation.guest_added',
      entityType: 'Reservation',
      entityId: reservationId,
      changes: { guestId, isPrimary },
    });

    return link;
  }
}
