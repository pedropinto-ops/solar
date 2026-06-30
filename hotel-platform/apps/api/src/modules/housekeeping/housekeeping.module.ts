import { Module } from '@nestjs/common';
import { HousekeepingController } from './housekeeping.controller.js';
import { HousekeepingService } from './housekeeping.service.js';
import { AuditModule } from '../../common/audit/audit.module.js';

@Module({
  imports: [AuditModule],
  controllers: [HousekeepingController],
  providers: [HousekeepingService],
  exports: [HousekeepingService],
})
export class HousekeepingModule {}
