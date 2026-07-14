import { Module } from '@nestjs/common';
import { RoomController } from './room.controller.js';
import { RoomService } from './room.service.js';
import { RoomTypeService } from './room-type.service.js';
import { HousekeepingModule } from '../housekeeping/housekeeping.module.js';
import { PricingModule } from '../pricing/pricing.module.js';

@Module({
  imports: [HousekeepingModule, PricingModule],
  controllers: [RoomController],
  providers: [RoomService, RoomTypeService],
  exports: [RoomService, RoomTypeService],
})
export class RoomModule {}
