import { Module } from '@nestjs/common';
import { HoldExpirationService } from './hold-expiration.service.js';

@Module({
  providers: [HoldExpirationService],
})
export class SchedulingModule {}
