import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicReservationService } from './public-reservation.service.js';
import { AssistantController } from './assistant.controller.js';
import { AssistantService } from './assistant.service.js';
import { PropertyModule } from '../property/property.module.js';
import { RoomModule } from '../room/room.module.js';
import { PaymentModule } from '../payment/payment.module.js';
import { AuditModule } from '../../common/audit/audit.module.js';

@Module({
  imports: [PropertyModule, RoomModule, PaymentModule, AuditModule],
  controllers: [PublicController, AssistantController],
  providers: [PublicReservationService, AssistantService],
})
export class PublicModule {}
