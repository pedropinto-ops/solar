import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface AvailabilityParams {
  propertyId: string;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
}

@Injectable()
export class RoomService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista todos os quartos da propriedade (com tipo).
   */
  async listAll(propertyId: string) {
    return this.prisma.room.findMany({
      where: { propertyId, active: true },
      include: { roomType: true },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });
  }

  /**
   * Calcula disponibilidade por categoria.
   *
   * Algoritmo:
   *   1. Para cada RoomType ativo da propriedade
   *   2. Conta quantos Room daquele tipo NÃO têm reserva conflitante no período
   *
   * Conflito = reserva CONFIRMED/CHECKED_IN/PENDING (hold ainda válido)
   * cujas datas se sobrepõem ao período solicitado.
   */
  async availability(params: AvailabilityParams) {
    const { propertyId, checkInDate, checkOutDate, adults, children } = params;
    const totalGuests = adults + children;
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Tipos de quarto que comportam a quantidade de pessoas
    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        propertyId,
        active: true,
        maxOccupancy: { gte: totalGuests },
      },
      include: {
        rooms: {
          where: {
            active: true,
            status: {
              notIn: ['MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'],
            },
          },
        },
      },
    });

    // Para cada tipo, conta quartos livres no período
    const result = await Promise.all(
      roomTypes.map(async (rt) => {
        const roomIds = rt.rooms.map((r) => r.id);
        if (roomIds.length === 0) {
          return { roomType: rt, available: 0 };
        }

        // Conta quartos do tipo que TÊM conflito no período
        const conflictingRoomIds = await this.prisma.reservation.findMany({
          where: {
            propertyId,
            roomId: { in: roomIds },
            checkInDate: { lt: checkOutDate },
            checkOutDate: { gt: checkInDate },
            OR: [
              { status: { in: ['CONFIRMED', 'CHECKED_IN'] } },
              {
                status: 'PENDING',
                holdExpiresAt: { gt: new Date() },
              },
            ],
          },
          select: { roomId: true },
          distinct: ['roomId'],
        });

        const conflictingIds = new Set(
          conflictingRoomIds.map((r) => r.roomId).filter((id): id is string => !!id),
        );
        const available = roomIds.filter((id) => !conflictingIds.has(id)).length;

        return { roomType: rt, available };
      }),
    );

    return result.map(({ roomType, available }) => ({
      id: roomType.id,
      name: roomType.name,
      description: roomType.description,
      photos: roomType.photos,
      amenities: roomType.amenities,
      maxOccupancy: roomType.maxOccupancy,
      bedConfig: roomType.bedConfig,
      sizeSqm: roomType.sizeSqm,
      dailyRate: roomType.basePrice.toNumber(),
      totalAmount: roomType.basePrice.toNumber() * nights,
      available,
      soldOut: available === 0,
    }));
  }

  /**
   * Lista quartos disponíveis de uma categoria específica.
   * Usado pela recepção na hora de alocar quarto físico.
   */
  async listAvailable(params: {
    propertyId: string;
    roomTypeId: string;
    checkInDate: Date;
    checkOutDate: Date;
  }) {
    const { propertyId, roomTypeId, checkInDate, checkOutDate } = params;

    const rooms = await this.prisma.room.findMany({
      where: {
        propertyId,
        roomTypeId,
        active: true,
        status: { notIn: ['MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'] },
        reservations: {
          none: {
            checkInDate: { lt: checkOutDate },
            checkOutDate: { gt: checkInDate },
            status: { in: ['CONFIRMED', 'CHECKED_IN'] },
          },
        },
      },
      orderBy: [{ floor: 'asc' }, { number: 'asc' }],
    });

    return rooms;
  }
}
