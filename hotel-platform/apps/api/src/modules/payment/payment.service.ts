import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AsaasService } from './asaas.service.js';
import type { Prisma } from '@prisma/client';
import { Prisma as P } from '@prisma/client';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly asaas: AsaasService,
  ) {}

  /**
   * Cria uma cobrança Pix vinculada a uma reserva.
   * Faz chamada ao Asaas, salva o Payment no estado PENDING.
   */
  async createPixCharge(params: {
    propertyId: string;
    userId: string | null;
    reservationId: string;
    amount: number;
    description?: string;
  }) {
    const { propertyId, userId, reservationId, amount } = params;

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
      include: { primaryGuest: true },
    });
    if (!reservation) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Reserva não encontrada',
      });
    }
    if (!reservation.primaryGuest) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: 'Reserva sem hóspede titular não pode receber cobrança',
      });
    }

    // 1. Cria/recupera customer no Asaas
    const customer = await this.asaas.findOrCreateCustomer({
      name: reservation.primaryGuest.fullName,
      cpfCnpj: reservation.primaryGuest.documentNumber,
      email: reservation.primaryGuest.email ?? undefined,
      phone: reservation.primaryGuest.phone ?? undefined,
    });

    // 2. Cria cobrança no Asaas (vencimento +1 dia)
    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const asaasPayment = await this.asaas.createPayment({
      customerId: customer.id,
      billingType: 'PIX',
      value: amount,
      dueDate,
      description: params.description || `Reserva ${reservation.code}`,
      externalReference: reservation.id,
    });

    // 3. Recupera QR Code Pix (Asaas só gera após criar payment)
    const qr = await this.asaas.getPixQrCode(asaasPayment.id);

    // 4. Persiste Payment local
    const payment = await this.prisma.payment.create({
      data: {
        propertyId,
        reservationId,
        amount: new P.Decimal(amount),
        method: 'PIX',
        status: 'PENDING',
        gatewayProvider: 'asaas',
        gatewayId: asaasPayment.id,
        pixQrCode: qr.encodedImage,
        pixCopyPaste: qr.payload,
        pixExpiresAt: new Date(qr.expirationDate),
        dueDate: new Date(dueDate),
      },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'payment.created',
      entityType: 'Payment',
      entityId: payment.id,
      changes: {
        method: 'PIX',
        amount,
        gatewayId: asaasPayment.id,
      },
    });

    return payment;
  }

  /**
   * Cria link de pagamento por cartão (redirect para o Asaas).
   */
  async createCardCharge(params: {
    propertyId: string;
    userId: string | null;
    reservationId: string;
    amount: number;
    installments?: number;
    description?: string;
  }) {
    const { propertyId, userId, reservationId, amount, installments } = params;

    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, propertyId },
      include: { primaryGuest: true },
    });
    if (!reservation || !reservation.primaryGuest) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Reserva ou hóspede não encontrado',
      });
    }

    const customer = await this.asaas.findOrCreateCustomer({
      name: reservation.primaryGuest.fullName,
      cpfCnpj: reservation.primaryGuest.documentNumber,
      email: reservation.primaryGuest.email ?? undefined,
      phone: reservation.primaryGuest.phone ?? undefined,
    });

    const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const asaasPayment = await this.asaas.createPayment({
      customerId: customer.id,
      billingType: 'CREDIT_CARD',
      value: amount,
      dueDate,
      description: params.description || `Reserva ${reservation.code}`,
      externalReference: reservation.id,
      installmentCount: installments,
    });

    const payment = await this.prisma.payment.create({
      data: {
        propertyId,
        reservationId,
        amount: new P.Decimal(amount),
        method: 'CREDIT_CARD',
        status: 'PENDING',
        gatewayProvider: 'asaas',
        gatewayId: asaasPayment.id,
        gatewayUrl: asaasPayment.invoiceUrl,
        installments,
        dueDate: new Date(dueDate),
      },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'payment.created',
      entityType: 'Payment',
      entityId: payment.id,
      changes: { method: 'CREDIT_CARD', amount, installments },
    });

    return payment;
  }

  /**
   * Confirma pagamento manual (dinheiro, transferência fora do Asaas).
   */
  async confirmManual(params: {
    propertyId: string;
    userId: string;
    paymentId: string;
    paidAt?: Date;
    notes?: string;
  }) {
    const { propertyId, userId, paymentId, paidAt, notes } = params;

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id: paymentId, propertyId },
      });
      if (!payment) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Pagamento não encontrado',
        });
      }
      if (payment.status === 'PAID') {
        return payment; // idempotente
      }
      if (['REFUNDED', 'CANCELLED'].includes(payment.status)) {
        throw new BadRequestException({
          errorCode: 'INVALID_RESERVATION_STATUS',
          title: `Pagamento em status ${payment.status} não pode ser confirmado`,
        });
      }

      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidAt: paidAt ?? new Date(),
          notes: notes ?? payment.notes,
        },
      });

      // Atualiza paidAmount da reserva (e CONFIRMA se atingiu o sinal)
      if (payment.reservationId) {
        await this.applyPaymentToReservation(tx, payment.reservationId);
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'payment.confirmed_manual',
          entityType: 'Payment',
          entityId: paymentId,
          changes: { paidAt: updated.paidAt?.toISOString() },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Estorno.
   * Se foi via Asaas, chama API de refund. Se manual, só registra.
   */
  async refund(params: {
    propertyId: string;
    userId: string;
    paymentId: string;
    amount?: number;
    reason: string;
  }) {
    const { propertyId, userId, paymentId, amount, reason } = params;

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, propertyId },
    });
    if (!payment) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Pagamento não encontrado',
      });
    }
    if (payment.status !== 'PAID') {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: `Apenas pagamentos PAID podem ser estornados (atual: ${payment.status})`,
      });
    }

    const refundAmount = amount ?? payment.amount.toNumber();
    if (refundAmount > payment.amount.toNumber()) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_ERROR',
        title: 'Valor do estorno excede o valor do pagamento',
      });
    }

    // Chama Asaas se foi via gateway
    if (payment.gatewayId && payment.gatewayProvider === 'asaas') {
      try {
        await this.asaas.refund(payment.gatewayId, refundAmount);
      } catch (err: any) {
        // Em sandbox/dev, o estorno pode falhar — logamos mas seguimos
        this.logger.warn(
          `Falha ao estornar no Asaas (continuando com refund local): ${err.message}`,
        );
      }
    }

    const partial = refundAmount < payment.amount.toNumber();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: partial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
          refundedAmount: new P.Decimal(refundAmount),
          refundedAt: new Date(),
          refundReason: reason,
        },
      });

      if (payment.reservationId) {
        await this.applyPaymentToReservation(tx, payment.reservationId);
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'payment.refunded',
          entityType: 'Payment',
          entityId: paymentId,
          changes: { amount: refundAmount, reason, partial },
        },
        tx,
      );

      return updated;
    });
  }

  /**
   * Webhook do Asaas — confirma pagamento + atualiza reserva.
   * Idempotente: se já está PAID, ignora.
   */
  async handleAsaasWebhook(params: {
    event: string;
    gatewayPaymentId: string;
    paidValue?: number;
    payload: Record<string, unknown>;
  }) {
    const { event, gatewayPaymentId, paidValue, payload } = params;

    const payment = await this.prisma.payment.findFirst({
      where: { gatewayId: gatewayPaymentId },
    });
    if (!payment) {
      this.logger.warn(`Webhook recebido para pagamento desconhecido: ${gatewayPaymentId}`);
      return { ignored: true };
    }

    // Idempotência: se já PAID, não reprocessa
    if (payment.status === 'PAID' && event !== 'PAYMENT_REFUNDED') {
      this.logger.log(`Webhook duplicado ignorado (já PAID): ${gatewayPaymentId}`);
      return { alreadyProcessed: true };
    }

    return this.prisma.$transaction(async (tx) => {
      const now = new Date();

      switch (event) {
        case 'PAYMENT_RECEIVED':
        case 'PAYMENT_CONFIRMED':
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'PAID',
              paidAt: now,
              webhookPayload: payload as Prisma.InputJsonValue,
            },
          });
          if (payment.reservationId) {
            await this.applyPaymentToReservation(tx, payment.reservationId);
          }
          await this.audit.log(
            {
              propertyId: payment.propertyId,
              userId: null,
              action: 'payment.webhook_confirmed',
              entityType: 'Payment',
              entityId: payment.id,
              changes: { event, paidValue },
            },
            tx,
          );
          break;

        case 'PAYMENT_REFUNDED':
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'REFUNDED',
              refundedAt: now,
              refundedAmount: paidValue ? new P.Decimal(paidValue) : payment.amount,
              webhookPayload: payload as Prisma.InputJsonValue,
            },
          });
          if (payment.reservationId) {
            await this.applyPaymentToReservation(tx, payment.reservationId);
          }
          break;

        case 'PAYMENT_OVERDUE':
        case 'PAYMENT_DELETED':
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: event === 'PAYMENT_OVERDUE' ? 'EXPIRED' : 'CANCELLED',
              webhookPayload: payload as Prisma.InputJsonValue,
            },
          });
          break;

        default:
          this.logger.log(`Webhook ${event} sem ação local`);
      }

      return { processed: true };
    });
  }

  /**
   * Recalcula paidAmount da reserva somando PAID payments,
   * e promove PENDING → CONFIRMED se atingiu o sinal mínimo.
   */
  private async applyPaymentToReservation(
    tx: Prisma.TransactionClient,
    reservationId: string,
  ) {
    const [reservation, paidPayments] = await Promise.all([
      tx.reservation.findUnique({ where: { id: reservationId } }),
      tx.payment.findMany({
        where: { reservationId, status: 'PAID' },
        select: { amount: true, refundedAmount: true },
      }),
    ]);

    if (!reservation) return;

    // Soma o que foi efetivamente recebido (descontando reembolsos)
    const totalPaid = paidPayments.reduce((sum, p) => {
      const refunded = p.refundedAmount ?? new P.Decimal(0);
      return sum.add(p.amount).sub(refunded);
    }, new P.Decimal(0));

    const updateData: Prisma.ReservationUpdateInput = {
      paidAmount: totalPaid,
    };

    // Se atingiu o sinal mínimo e ainda está PENDING, confirma
    if (reservation.status === 'PENDING' && reservation.depositPercent) {
      const required = reservation.totalAmount
        .mul(reservation.depositPercent)
        .div(100);
      if (totalPaid.gte(required)) {
        updateData.status = 'CONFIRMED';
        updateData.confirmedAt = new Date();
        updateData.holdExpiresAt = null;
      }
    }

    await tx.reservation.update({
      where: { id: reservationId },
      data: updateData,
    });
  }
}
