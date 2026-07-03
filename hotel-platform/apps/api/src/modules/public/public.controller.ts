import { Body, Controller, Get, Ip, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PropertyService } from '../property/property.service.js';
import { RoomService } from '../room/room.service.js';
import { PublicReservationService } from './public-reservation.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../auth/auth.guards.js';
import {
  availabilityQuerySchema,
  createPublicReservationSchema,
  type AvailabilityQuery,
  type CreatePublicReservationSchemaInput,
} from '@hotel/shared/schemas';

/**
 * Endpoints públicos (sem autenticação) — usados pela página de reserva
 * pública. Cobre o Fluxo 1 completo (documento critical-flows.md).
 */
@Controller('public')
@Public()
export class PublicController {
  constructor(
    private readonly propertyService: PropertyService,
    private readonly roomService: RoomService,
    private readonly publicReservation: PublicReservationService,
  ) {}

  @Get('property/:slug')
  async getPropertyBySlug(@Param('slug') slug: string) {
    const property = await this.propertyService.findBySlug(slug);
    return {
      id: property.id,
      name: property.name,
      logoUrl: property.logoUrl,
      primaryColor: property.primaryColor,
      checkInTime: property.checkInTime,
      checkOutTime: property.checkOutTime,
      cancellationPolicy: property.cancellationPolicy,
      addressCity: property.addressCity,
      addressState: property.addressState,
    };
  }

  @Get('property/:slug/availability')
  async availability(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(availabilityQuerySchema)) query: AvailabilityQuery,
  ) {
    const property = await this.propertyService.findBySlug(slug);
    const nights = Math.round(
      (query.checkOutDate.getTime() - query.checkInDate.getTime()) /
        (1000 * 60 * 60 * 24),
    );

    const roomTypes = await this.roomService.availability({
      propertyId: property.id,
      checkInDate: query.checkInDate,
      checkOutDate: query.checkOutDate,
      adults: query.adults,
      children: query.children,
    });

    return {
      nights,
      checkInDate: query.checkInDate.toISOString().split('T')[0],
      checkOutDate: query.checkOutDate.toISOString().split('T')[0],
      roomTypes,
    };
  }

  /**
   * POST /public/property/:slug/reservations
   * Cria reserva pública + Pix do sinal (Fluxo 1).
   *
   * Rate limit estrito: 5 tentativas / minuto por IP.
   * Endpoint mais sensível — abusado, gera reservas-pendentes em massa e
   * potencialmente cria Pix no Asaas (que tem custo). Limita agressivamente.
   */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('property/:slug/reservations')
  async createReservation(
    @Param('slug') slug: string,
    @Ip() ip: string,
    @Body(new ZodValidationPipe(createPublicReservationSchema))
    dto: CreatePublicReservationSchemaInput,
  ) {
    const property = await this.propertyService.findBySlug(slug);
    return this.publicReservation.createReservation({
      propertyId: property.id,
      propertySlug: slug,
      ip,
      data: dto,
    });
  }
}
