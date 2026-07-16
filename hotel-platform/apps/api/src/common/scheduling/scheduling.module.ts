import { Module } from '@nestjs/common';
import { HoldExpirationService } from './hold-expiration.service.js';
import { OverdueCleaningService } from './overdue-cleaning.service.js';

@Module({
  providers: [HoldExpirationService, OverdueCleaningService],
})
export class SchedulingModule {}
