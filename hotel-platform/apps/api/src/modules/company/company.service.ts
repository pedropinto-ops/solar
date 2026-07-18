import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';

/**
 * Convênios corporativos (empresas) + faturamento.
 *
 * Uma reserva POSTPAID_CORPORATE nasce CONFIRMADA, vinculada a uma empresa, com
 * o saldo em aberto. As reservas em aberto de uma empresa são consolidadas numa
 * Fatura (Invoice); ao registrar o pagamento da fatura, as reservas são quitadas.
 */

type CompanyData = {
  legalName: string;
  tradeName?: string;
  cnpj: string;
  stateRegistration?: string;
  email?: string;
  phone?: string;
  contactName?: string;
  defaultRateOverride?: number;
  paymentTermDays?: number;
  billingDay?: number;
  creditLimit?: number;
  notes?: string;
  active?: boolean;
};

const FATURAVEL = {
  billingMode: 'POSTPAID_CORPORATE' as const,
  invoiceId: null,
  status: { notIn: ['CANCELLED', 'NO_SHOW'] as ('CANCELLED' | 'NO_SHOW')[] },
};

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private normalizeCnpj(cnpj: string) {
    return cnpj.replace(/\D/g, '');
  }

  // ============================ EMPRESAS ============================

  async list(propertyId: string, onlyActive = false) {
    const companies = await this.prisma.company.findMany({
      where: { propertyId, deletedAt: null, ...(onlyActive ? { active: true } : {}) },
      orderBy: [{ active: 'desc' }, { legalName: 'asc' }],
    });
    if (companies.length === 0) return [];
    // reservas em aberto (faturáveis) por empresa
    const open = await this.prisma.reservation.groupBy({
      by: ['companyId'],
      where: { propertyId, companyId: { in: companies.map((c) => c.id) }, ...FATURAVEL },
      _count: { _all: true },
      _sum: { totalAmount: true },
    });
    const openMap = new Map(open.map((o) => [o.companyId, o]));
    return companies.map((c) => ({
      ...c,
      openReservations: openMap.get(c.id)?._count._all ?? 0,
      openAmount: openMap.get(c.id)?._sum.totalAmount ?? new P.Decimal(0),
    }));
  }

  async getById(propertyId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, propertyId, deletedAt: null },
    });
    if (!company) {
      throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Convênio não encontrado' });
    }
    return company;
  }

  async create(params: { propertyId: string; userId: string; data: CompanyData }) {
    const { propertyId, userId, data } = params;
    const cnpj = this.normalizeCnpj(data.cnpj);
    if (cnpj.length !== 14) {
      throw new BadRequestException({ errorCode: 'VALIDATION_ERROR', title: 'CNPJ deve ter 14 dígitos' });
    }
    const dup = await this.prisma.company.findFirst({ where: { propertyId, cnpj } });
    if (dup) {
      throw new ConflictException({ errorCode: 'CONFLICT', title: 'Já existe um convênio com este CNPJ' });
    }
    const company = await this.prisma.company.create({
      data: {
        propertyId,
        legalName: data.legalName,
        tradeName: data.tradeName || null,
        cnpj,
        stateRegistration: data.stateRegistration || null,
        email: data.email || null,
        phone: data.phone || null,
        contactName: data.contactName || null,
        defaultRateOverride:
          data.defaultRateOverride != null ? new P.Decimal(data.defaultRateOverride) : null,
        paymentTermDays: data.paymentTermDays ?? 30,
        billingDay: data.billingDay ?? null,
        creditLimit: data.creditLimit != null ? new P.Decimal(data.creditLimit) : null,
        notes: data.notes || null,
      },
    });
    await this.audit.log({
      propertyId, userId, action: 'company.created', entityType: 'Company', entityId: company.id,
      changes: { legalName: company.legalName, cnpj },
    });
    return company;
  }

  async update(params: { propertyId: string; userId: string; id: string; data: Partial<CompanyData> }) {
    const { propertyId, userId, id, data } = params;
    await this.getById(propertyId, id);
    let cnpj: string | undefined;
    if (data.cnpj != null) {
      cnpj = this.normalizeCnpj(data.cnpj);
      if (cnpj.length !== 14) {
        throw new BadRequestException({ errorCode: 'VALIDATION_ERROR', title: 'CNPJ deve ter 14 dígitos' });
      }
      const dup = await this.prisma.company.findFirst({ where: { propertyId, cnpj, id: { not: id } } });
      if (dup) {
        throw new ConflictException({ errorCode: 'CONFLICT', title: 'Já existe um convênio com este CNPJ' });
      }
    }
    const set = (v: string | undefined | null) => (v ? v : null);
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        ...(data.legalName != null ? { legalName: data.legalName } : {}),
        ...(data.tradeName !== undefined ? { tradeName: set(data.tradeName) } : {}),
        ...(cnpj ? { cnpj } : {}),
        ...(data.stateRegistration !== undefined ? { stateRegistration: set(data.stateRegistration) } : {}),
        ...(data.email !== undefined ? { email: set(data.email) } : {}),
        ...(data.phone !== undefined ? { phone: set(data.phone) } : {}),
        ...(data.contactName !== undefined ? { contactName: set(data.contactName) } : {}),
        ...(data.defaultRateOverride !== undefined
          ? { defaultRateOverride: data.defaultRateOverride != null ? new P.Decimal(data.defaultRateOverride) : null }
          : {}),
        ...(data.paymentTermDays != null ? { paymentTermDays: data.paymentTermDays } : {}),
        ...(data.billingDay !== undefined ? { billingDay: data.billingDay ?? null } : {}),
        ...(data.creditLimit !== undefined
          ? { creditLimit: data.creditLimit != null ? new P.Decimal(data.creditLimit) : null }
          : {}),
        ...(data.notes !== undefined ? { notes: set(data.notes) } : {}),
        ...(data.active != null ? { active: data.active } : {}),
      },
    });
    await this.audit.log({
      propertyId, userId, action: 'company.updated', entityType: 'Company', entityId: id, changes: { ...data },
    });
    return company;
  }

  async remove(params: { propertyId: string; userId: string; id: string }) {
    const { propertyId, userId, id } = params;
    await this.getById(propertyId, id);
    const openRes = await this.prisma.reservation.count({ where: { propertyId, companyId: id, ...FATURAVEL } });
    if (openRes > 0) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: `Convênio tem ${openRes} reserva(s) em aberto — fature ou cancele antes de desativar`,
      });
    }
    const company = await this.prisma.company.update({
      where: { id }, data: { active: false, deletedAt: new Date() },
    });
    await this.audit.log({ propertyId, userId, action: 'company.deleted', entityType: 'Company', entityId: id });
    return company;
  }

  // ============================ FATURAS ============================

  /** Reservas faturáveis (POSTPAID, sem fatura) de uma empresa. */
  async openReservations(propertyId: string, companyId: string) {
    await this.getById(propertyId, companyId);
    return this.prisma.reservation.findMany({
      where: { propertyId, companyId, ...FATURAVEL },
      orderBy: { checkInDate: 'asc' },
      select: {
        id: true, code: true, status: true, checkInDate: true, checkOutDate: true,
        nights: true, totalAmount: true, corporatePO: true,
        primaryGuest: { select: { fullName: true } },
        room: { select: { number: true } },
      },
    });
  }

  async listInvoices(propertyId: string, companyId?: string) {
    return this.prisma.invoice.findMany({
      where: { propertyId, ...(companyId ? { companyId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        company: { select: { legalName: true, tradeName: true } },
        _count: { select: { reservations: true } },
      },
    });
  }

  async getInvoice(propertyId: string, id: string) {
    const inv = await this.prisma.invoice.findFirst({
      where: { id, propertyId },
      include: {
        company: true,
        reservations: {
          orderBy: { checkInDate: 'asc' },
          select: { id: true, code: true, checkInDate: true, checkOutDate: true, totalAmount: true, primaryGuest: { select: { fullName: true } } },
        },
        payments: true,
      },
    });
    if (!inv) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Fatura não encontrada' });
    return inv;
  }

  private async generateInvoiceNumber(tx: Prisma.TransactionClient, propertyId: string) {
    const year = new Date().getFullYear();
    const prefix = `FAT-${year}-`;
    const last = await tx.invoice.findFirst({
      where: { propertyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' }, select: { number: true },
    });
    const seq = last ? (parseInt(last.number.slice(prefix.length), 10) || 0) + 1 : 1;
    return `${prefix}${String(seq).padStart(3, '0')}`;
  }

  async createInvoice(params: {
    propertyId: string; userId: string; companyId: string;
    reservationIds: string[]; discount?: number; notes?: string;
  }) {
    const { propertyId, userId, companyId, reservationIds, discount = 0, notes } = params;
    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.findFirst({ where: { id: companyId, propertyId, deletedAt: null } });
      if (!company) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Convênio não encontrado' });

      const reservations = await tx.reservation.findMany({
        where: { id: { in: reservationIds }, propertyId, companyId, ...FATURAVEL },
        select: { id: true, checkInDate: true, checkOutDate: true, totalAmount: true },
      });
      if (reservations.length === 0) {
        throw new BadRequestException({ errorCode: 'VALIDATION_ERROR', title: 'Nenhuma reserva faturável selecionada' });
      }
      if (reservations.length !== reservationIds.length) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Alguma reserva não é faturável (já faturada, cancelada ou de outro convênio)',
        });
      }

      const resIds = reservations.map((r) => r.id);
      const subtotal = reservations.reduce((s, r) => s.add(r.totalAmount), new P.Decimal(0));
      const charges = await tx.chargeItem.findMany({
        where: { reservationId: { in: resIds }, voidedAt: null, type: { in: ['CONSUMPTION', 'FEE', 'ADJUSTMENT'] } },
        select: { totalAmount: true },
      });
      const consumptions = charges.reduce((s, c) => s.add(c.totalAmount), new P.Decimal(0));
      const disc = new P.Decimal(discount);
      const total = subtotal.add(consumptions).sub(disc);

      const periodStart = reservations.reduce((m, r) => (r.checkInDate < m ? r.checkInDate : m), reservations[0]!.checkInDate);
      const periodEnd = reservations.reduce((m, r) => (r.checkOutDate > m ? r.checkOutDate : m), reservations[0]!.checkOutDate);

      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + (company.paymentTermDays ?? 30));

      const number = await this.generateInvoiceNumber(tx, propertyId);
      const invoice = await tx.invoice.create({
        data: {
          propertyId, companyId, number, status: 'CLOSED',
          periodStart, periodEnd,
          subtotal, consumptions, discount: disc, totalAmount: total, paidAmount: new P.Decimal(0),
          issuedAt: now, dueDate, notes: notes || null,
        },
      });
      await tx.reservation.updateMany({ where: { id: { in: resIds } }, data: { invoiceId: invoice.id } });
      await this.audit.log({
        propertyId, userId, action: 'invoice.created', entityType: 'Invoice', entityId: invoice.id,
        changes: { number, total: total.toNumber(), reservas: resIds.length },
      }, tx);
      return invoice;
    });
  }

  async payInvoice(params: { propertyId: string; userId: string; id: string; method?: string; paidAt?: Date; notes?: string }) {
    const { propertyId, userId, id, method = 'BANK_TRANSFER', paidAt, notes } = params;
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, propertyId } });
      if (!invoice) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Fatura não encontrada' });
      if (invoice.status === 'PAID') return invoice;
      if (invoice.status === 'CANCELLED') {
        throw new BadRequestException({ errorCode: 'VALIDATION_ERROR', title: 'Fatura cancelada não pode ser paga' });
      }
      const when = paidAt ?? new Date();
      await tx.payment.create({
        data: {
          propertyId, invoiceId: id, amount: invoice.totalAmount, method: method as any,
          status: 'PAID', paidAt: when, notes: notes || 'Pagamento de fatura corporativa.',
        },
      });
      const updated = await tx.invoice.update({
        where: { id }, data: { status: 'PAID', paidAmount: invoice.totalAmount, paidAt: when },
      });
      const reservations = await tx.reservation.findMany({ where: { invoiceId: id }, select: { id: true, totalAmount: true } });
      for (const r of reservations) {
        await tx.reservation.update({ where: { id: r.id }, data: { paidAmount: r.totalAmount } });
      }
      await this.audit.log({
        propertyId, userId, action: 'invoice.paid', entityType: 'Invoice', entityId: id,
        changes: { amount: invoice.totalAmount.toNumber() },
      }, tx);
      return updated;
    });
  }

  async cancelInvoice(params: { propertyId: string; userId: string; id: string }) {
    const { propertyId, userId, id } = params;
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id, propertyId } });
      if (!invoice) throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Fatura não encontrada' });
      if (invoice.status === 'PAID') {
        throw new BadRequestException({ errorCode: 'VALIDATION_ERROR', title: 'Fatura paga não pode ser cancelada' });
      }
      await tx.reservation.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
      const updated = await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });
      await this.audit.log({ propertyId, userId, action: 'invoice.cancelled', entityType: 'Invoice', entityId: id }, tx);
      return updated;
    });
  }
}
