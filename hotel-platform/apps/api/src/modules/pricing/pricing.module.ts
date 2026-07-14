import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller.js';
import { PricingService } from './pricing.service.js';

/**
 * Precificação: cotador central (usado por disponibilidade, reserva pública e
 * assistente) + gestão de diárias e regras de tarifa (aba "Preços").
 */
@Module({
  controllers: [PricingController],
  providers: [PricingService],
  exports: [PricingService],
})
export class PricingModule {}
