import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { PaymentService } from './payment.service.js';
import { Public } from '../auth/auth.guards.js';

interface AsaasWebhookPayload {
  event?: string;
  payment?: {
    id?: string;
    value?: number;
    status?: string;
    externalReference?: string;
  };
  [key: string]: unknown;
}

/**
 * Endpoint público para receber webhooks. Autenticado pelo header
 * `asaas-access-token` definido nas config do Asaas.
 *
 * Idempotência: PaymentService.handleAsaasWebhook trata pagamentos
 * já PAID retornando sem efeito.
 */
@Controller('webhooks')
@Public()
@SkipThrottle()
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly paymentService: PaymentService,
  ) {}

  @Post('asaas')
  @HttpCode(200)
  async asaas(
    @Headers('asaas-access-token') token: string,
    @Body() body: AsaasWebhookPayload,
  ) {
    const expected = this.config.get<string>('ASAAS_WEBHOOK_TOKEN');
    if (!expected) {
      this.logger.warn('ASAAS_WEBHOOK_TOKEN não configurado — recusando webhook');
      throw new UnauthorizedException('Webhook não configurado no servidor');
    }
    if (token !== expected) {
      this.logger.warn('Webhook recebido com token inválido');
      throw new UnauthorizedException();
    }

    if (!body?.event || !body?.payment?.id) {
      this.logger.warn('Webhook com payload inválido', body);
      return { ignored: true, reason: 'invalid_payload' };
    }

    this.logger.log(
      `Webhook Asaas: ${body.event} para ${body.payment.id}${
        body.payment.externalReference ? ` (ref: ${body.payment.externalReference})` : ''
      }`,
    );

    return this.paymentService.handleAsaasWebhook({
      event: body.event,
      gatewayPaymentId: body.payment.id,
      paidValue: body.payment.value,
      payload: body as Record<string, unknown>,
    });
  }
}
