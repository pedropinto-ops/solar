import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RoomService } from './room.service.js';
import { RoomTypeService } from './room-type.service.js';
import { HousekeepingService } from '../housekeeping/housekeeping.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { updateRoomStatusSchema } from '@hotel/shared/schemas';

@Controller('rooms')
@UseGuards(JwtAuthGuard)
export class RoomController {
  constructor(
    private readonly roomService: RoomService,
    private readonly roomTypeService: RoomTypeService,
    private readonly housekeeping: HousekeepingService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.roomService.listAll(user.propertyId);
  }

  @Get('types')
  async listTypes(@CurrentUser() user: AuthenticatedUser) {
    return this.roomTypeService.list(user.propertyId);
  }

  @Get('available')
  async available(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roomTypeId') roomTypeId: string,
    @Query('checkIn') checkIn: string,
    @Query('checkOut') checkOut: string,
  ) {
    return this.roomService.listAvailable({
      propertyId: user.propertyId,
      roomTypeId,
      checkInDate: new Date(checkIn),
      checkOutDate: new Date(checkOut),
    });
  }

  /**
   * PATCH /rooms/:id/status
   * Mudança manual de status (manutenção, bloqueio, etc).
   * Atalho para quartos sem fluxo de housekeeping.
   */
  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR', 'RECEPTION')
  async updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRoomStatusSchema))
    dto: { status: string; reason: string },
  ) {
    return this.housekeeping.updateRoomStatus({
      propertyId: user.propertyId,
      userId: user.userId,
      roomId: id,
      status: dto.status,
      reason: dto.reason,
    });
  }
}
