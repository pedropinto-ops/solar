import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReservationService } from './reservation.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createReservationSchema,
  assignRoomSchema,
  checkInSchema,
  checkOutSchema,
  type CreateReservationInput,
} from '@hotel/shared/schemas';
import { z } from 'zod';

const cancelSchema = z.object({
  reason: z.string().min(3).max(500),
});

@Controller('reservations')
@UseGuards(JwtAuthGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  // ---- Leitura ----

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reservationService.list({
      propertyId: user.propertyId,
      status: status ? status.split(',') : undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reservationService.dashboardCounts(user.propertyId);
  }

  @Get(':id')
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reservationService.getById(user.propertyId, id);
  }

  // ---- Ações ----

  /**
   * POST /api/v1/reservations
   * Cria reserva manualmente (recepção, telefone, walk-in).
   */
  @Post()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createReservationSchema)) dto: CreateReservationInput,
  ) {
    return this.reservationService.create({
      propertyId: user.propertyId,
      userId: user.userId,
      data: dto,
    });
  }

  /**
   * PATCH /api/v1/reservations/:id/assign-room
   * Aloca quarto físico à reserva.
   */
  @Patch(':id/assign-room')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async assignRoom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignRoomSchema)) dto: { roomId: string },
  ) {
    return this.reservationService.assignRoom({
      propertyId: user.propertyId,
      userId: user.userId,
      reservationId: id,
      roomId: dto.roomId,
    });
  }

  /**
   * POST /api/v1/reservations/:id/check-in
   */
  @Post(':id/check-in')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async checkIn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkInSchema))
    dto: { earlyCheckIn: boolean; notes?: string },
  ) {
    return this.reservationService.checkIn({
      propertyId: user.propertyId,
      userId: user.userId,
      reservationId: id,
      earlyCheckIn: dto.earlyCheckIn,
      notes: dto.notes,
    });
  }

  /**
   * POST /api/v1/reservations/:id/check-out
   */
  @Post(':id/check-out')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async checkOut(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(checkOutSchema))
    dto: { skipNFSe: boolean },
  ) {
    return this.reservationService.checkOut({
      propertyId: user.propertyId,
      userId: user.userId,
      reservationId: id,
      skipFiscal: dto.skipNFSe,
    });
  }

  /**
   * POST /api/v1/reservations/:id/cancel
   */
  @Post(':id/cancel')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(cancelSchema)) dto: { reason: string },
  ) {
    return this.reservationService.cancel({
      propertyId: user.propertyId,
      userId: user.userId,
      reservationId: id,
      reason: dto.reason,
    });
  }
}
