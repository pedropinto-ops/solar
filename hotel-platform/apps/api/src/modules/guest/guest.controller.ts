import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GuestService } from './guest.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createGuestSchema,
  updateGuestSchema,
  type CreateGuestInput,
  type UpdateGuestInput,
} from '@hotel/shared/schemas';
import { z } from 'zod';

const addToReservationSchema = z.object({
  guestId: z.string().cuid(),
  isPrimary: z.boolean().default(false),
});

@Controller('guests')
@UseGuards(JwtAuthGuard)
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.guestService.list({
      propertyId: user.propertyId,
      q,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('search')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async searchByDocument(
    @CurrentUser() user: AuthenticatedUser,
    @Query('document') document: string,
  ) {
    if (!document) return null;
    return this.guestService.findByDocument(user.propertyId, document);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.guestService.getById(user.propertyId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createGuestSchema)) dto: CreateGuestInput,
  ) {
    return this.guestService.create({
      propertyId: user.propertyId,
      userId: user.userId,
      data: dto as any,
    });
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateGuestSchema)) dto: UpdateGuestInput,
  ) {
    return this.guestService.update({
      propertyId: user.propertyId,
      userId: user.userId,
      id,
      data: dto as any,
    });
  }

  /**
   * DELETE /api/v1/guests/:id
   * Anonimiza (LGPD) — não apaga de fato para preservar integridade financeira.
   */
  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  async anonymize(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.guestService.anonymize({
      propertyId: user.propertyId,
      userId: user.userId,
      id,
    });
  }

  /**
   * POST /api/v1/guests/reservation/:reservationId/link
   * Adiciona hóspede existente como acompanhante de uma reserva.
   */
  @Post('reservation/:reservationId/link')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  async addToReservation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reservationId') reservationId: string,
    @Body(new ZodValidationPipe(addToReservationSchema))
    dto: { guestId: string; isPrimary: boolean },
  ) {
    return this.guestService.addToReservation({
      propertyId: user.propertyId,
      userId: user.userId,
      reservationId,
      guestId: dto.guestId,
      isPrimary: dto.isPrimary,
    });
  }
}
