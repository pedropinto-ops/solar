import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createChargeSchema,
  confirmManualSchema,
  refundPaymentSchema,
  type CreateChargeInput,
} from '@hotel/shared/schemas';

@Controller()
@UseGuards(JwtAuthGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * POST /reservations/:id/charge
   * Cria uma cobrança vinculada a uma reserva (recepção).
   */
  @Post('reservations/:id/charge')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async charge(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reservationId: string,
    @Body(new ZodValidationPipe(createChargeSchema)) dto: CreateChargeInput,
  ) {
    if (dto.method === 'PIX') {
      return this.paymentService.createPixCharge({
        propertyId: user.propertyId,
        userId: user.userId,
        reservationId,
        amount: dto.amount,
        description: dto.description,
      });
    }

    if (dto.method === 'CREDIT_CARD') {
      return this.paymentService.createCardCharge({
        propertyId: user.propertyId,
        userId: user.userId,
        reservationId,
        amount: dto.amount,
        installments: dto.installments,
        description: dto.description,
      });
    }

    // CASH e BANK_TRANSFER: cria localmente como PAID já (confirmação manual)
    // Para isso usamos um caminho diferente — recepcionista lança e marca pago
    // Aqui criamos PENDING, recepção marca como pago via confirm-manual
    throw new Error(
      'Para CASH/BANK_TRANSFER, use o fluxo de criação manual de pagamento (endpoint não implementado no MVP — criar Payment direto no banco via futuro endpoint).',
    );
  }

  /**
   * POST /payments/:id/confirm-manual
   * Marca pagamento como pago manualmente (dinheiro, transferência fora do Asaas).
   */
  @Post('payments/:id/confirm-manual')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async confirmManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body(new ZodValidationPipe(confirmManualSchema))
    dto: { paidAt?: Date; notes?: string },
  ) {
    return this.paymentService.confirmManual({
      propertyId: user.propertyId,
      userId: user.userId,
      paymentId,
      paidAt: dto.paidAt,
      notes: dto.notes,
    });
  }

  /**
   * POST /payments/:id/refund
   */
  @Post('payments/:id/refund')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER')
  async refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') paymentId: string,
    @Body(new ZodValidationPipe(refundPaymentSchema))
    dto: { amount?: number; reason: string },
  ) {
    return this.paymentService.refund({
      propertyId: user.propertyId,
      userId: user.userId,
      paymentId,
      amount: dto.amount,
      reason: dto.reason,
    });
  }
}
