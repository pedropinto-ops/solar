import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller.js';
import { WebhookController } from './webhook.controller.js';
import { PaymentService } from './payment.service.js';
import { AsaasService } from './asaas.service.js';
import { AuditModule } from '../../common/audit/audit.module.js';

@Module({
  imports: [ConfigModule, AuditModule],
  controllers: [PaymentController, WebhookController],
  providers: [PaymentService, AsaasService],
  exports: [PaymentService, AsaasService],
})
export class PaymentModule {}
