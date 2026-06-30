import { Module } from '@nestjs/common';
import { GuestController } from './guest.controller.js';
import { GuestService } from './guest.service.js';
import { AuditModule } from '../../common/audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [GuestController],
  providers: [GuestService],
  exports: [GuestService],
})
export class GuestModule {}
