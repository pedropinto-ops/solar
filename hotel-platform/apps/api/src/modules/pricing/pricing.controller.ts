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
import { PricingService } from './pricing.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createRatePeriodSchema,
  updateRatePeriodSchema,
  updateBasePriceSchema,
  type CreateRatePeriodInput,
  type UpdateRatePeriodInput,
  type UpdateBasePriceInput,
} from '@hotel/shared/schemas';

/** Aba "Preços" — gestão de diárias e regras de tarifa. Só ADMIN/MANAGER. */
@Controller('pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Get('overview')
  @Roles('ADMIN', 'MANAGER')
  async overview(@CurrentUser() user: AuthenticatedUser) {
    return this.pricing.pricingOverview(user.propertyId);
  }

  /** Agenda de preços: diária de cada dia em [start, end) para uma categoria. */
  @Get('calendar')
  @Roles('ADMIN', 'MANAGER')
  async calendar(
    @CurrentUser() user: AuthenticatedUser,
    @Query('roomTypeId') roomTypeId: string,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.pricing.priceCalendar({
      propertyId: user.propertyId,
      roomTypeId,
      start: new Date(start),
      end: new Date(end),
    });
  }

  @Patch('room-types/:id/base-price')
  @Roles('ADMIN', 'MANAGER')
  async updateBasePrice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBasePriceSchema)) dto: UpdateBasePriceInput,
  ) {
    return this.pricing.updateBasePrice({
      propertyId: user.propertyId,
      userId: user.userId,
      roomTypeId: id,
      basePrice: dto.basePrice,
    });
  }

  @Post('periods')
  @Roles('ADMIN', 'MANAGER')
  async createPeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRatePeriodSchema)) dto: CreateRatePeriodInput,
  ) {
    return this.pricing.createPeriod({
      propertyId: user.propertyId,
      userId: user.userId,
      data: {
        name: dto.name,
        roomTypeId: dto.roomTypeId ?? null,
        startDate: dto.startDate,
        endDate: dto.endDate,
        adjustType: dto.adjustType,
        value: dto.value,
        priority: dto.priority,
      },
    });
  }

  @Patch('periods/:id')
  @Roles('ADMIN', 'MANAGER')
  async updatePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRatePeriodSchema)) dto: UpdateRatePeriodInput,
  ) {
    return this.pricing.updatePeriod({
      propertyId: user.propertyId,
      userId: user.userId,
      id,
      data: dto,
    });
  }

  @Delete('periods/:id')
  @Roles('ADMIN', 'MANAGER')
  async removePeriod(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.pricing.removePeriod({
      propertyId: user.propertyId,
      userId: user.userId,
      id,
    });
  }
}
