import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface AvailabilityParams {
  propertyId: string;
  checkInDate: Date;
  checkOutDate: Date;
  guests: number;
}

/**
 * Aloca quartos para um grupo com base na capacidade REAL de cada quarto livre.
 * Estratégia: o MENOR quarto único que caiba o grupo (pra não gastar um quarto
 * grande com um casal); se nenhum quarto único couber, combina os maiores
 * primeiro. Retorna a lista de capacidades usadas (nessa ordem), ou null se o
 * grupo não couber nos quartos disponíveis.
 */
export function allocateByCapacity(
  freeCaps: number[],
  guests: number,
): number[] | null {
  if (guests <= 0 || freeCaps.length === 0) return null;
  const asc = [...freeCaps].sort((a, b) => a - b);
  for (const c of asc) {
    if (c >= guests) return [c]; // menor quarto único que cabe
  }
  const desc = [...freeCaps].sort((a, b) => b - a);
  const used: number[] = [];
  let remaining = guests;
  for (const c of desc) {
    used.push(c);
    remaining -= c;
    if (remaining <= 0) return used;
  }
  return null; // capacidade total insuficiente
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
    const { propertyId, checkInDate, checkOutDate, guests } = params;
    const nights = Math.round(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Todas as categorias ativas — NÃO filtra por lotação, porque um grupo
    // maior que a lotação é atendido abrindo mais de um quarto.
    const roomTypes = await this.prisma.roomType.findMany({
      where: {
        propertyId,
        active: true,
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

    // Para cada tipo, apura os quartos LIVRES no período (com sua capacidade).
    const result = await Promise.all(
      roomTypes.map(async (rt) => {
        const roomIds = rt.rooms.map((r) => r.id);
        if (roomIds.length === 0) {
          return { roomType: rt, freeCaps: [] as number[] };
        }

        // Quartos do tipo que TÊM conflito no período
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
        // Capacidade REAL de cada quarto livre.
        const freeCaps = rt.rooms
          .filter((r) => !conflictingIds.has(r.id))
          .map((r) => r.maxOccupancy);

        return { roomType: rt, freeCaps };
      }),
    );

    return result.map(({ roomType, freeCaps }) => {
      // Aloca por capacidade real: quantos quartos o grupo precisa de fato.
      const alloc = allocateByCapacity(freeCaps, guests);
      const maxCap = freeCaps.length ? Math.max(...freeCaps) : 0;
      return {
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        photos: roomType.photos,
        amenities: roomType.amenities,
        // Maior quarto livre (referência de "cabe até X por quarto").
        maxOccupancy: maxCap,
        bedConfig: roomType.bedConfig,
        sizeSqm: roomType.sizeSqm,
        dailyRate: roomType.basePrice.toNumber(),
        // Estimativa MÁXIMA (todos adultos) — preço é por pessoa/idade, então
        // o total final é calculado depois com as idades. Quartos não somam.
        totalAmount: roomType.basePrice.toNumber() * nights * guests,
        available: freeCaps.length,
        // Nº de quartos que o grupo vai ocupar (0 se não couber).
        roomsNeeded: alloc ? alloc.length : 0,
        guests,
        // "Esgotado" = não dá pra acomodar o grupo com os quartos livres.
        soldOut: alloc === null,
      };
    });
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

  /**
   * Painel de recepção — situação de TODOS os quartos num relance.
   *
   * Ocupação é derivada da reserva CHECKED_IN (fonte confiável), não só do
   * campo Room.status — evita divergência se o status ficar defasado. O
   * status do quarto ainda define os estados de governança (limpeza etc.).
   */
  async board(propertyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [rooms, inHouse, arrivals] = await Promise.all([
      this.prisma.room.findMany({
        where: { propertyId, active: true },
        include: { roomType: { select: { name: true } } },
        orderBy: [{ floor: 'asc' }, { number: 'asc' }],
      }),
      this.prisma.reservation.findMany({
        where: { propertyId, status: 'CHECKED_IN', roomId: { not: null } },
        select: {
          roomId: true,
          checkOutDate: true,
          adults: true,
          children: true,
          primaryGuest: { select: { fullName: true } },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          propertyId,
          status: 'CONFIRMED',
          roomId: { not: null },
          checkInDate: { gte: today, lt: tomorrow },
        },
        select: {
          roomId: true,
          primaryGuest: { select: { fullName: true } },
        },
      }),
    ]);

    const inHouseByRoom = new Map(inHouse.map((r) => [r.roomId, r]));
    const arrivalByRoom = new Map(arrivals.map((r) => [r.roomId, r]));
    const todayIdx = Math.floor(today.getTime() / 86_400_000);

    const items = rooms.map((room) => {
      const occ = inHouseByRoom.get(room.id);
      const arr = arrivalByRoom.get(room.id);

      let state:
        | 'OCCUPIED'
        | 'DEPARTING'
        | 'ARRIVING'
        | 'FREE'
        | 'CLEANING'
        | 'BLOCKED';
      let occupant: {
        guestName: string;
        checkOutDate: string;
        guests: number;
        departingToday: boolean;
      } | null = null;

      if (occ) {
        const departing =
          Math.floor(occ.checkOutDate.getTime() / 86_400_000) <= todayIdx;
        state = departing ? 'DEPARTING' : 'OCCUPIED';
        occupant = {
          guestName: occ.primaryGuest?.fullName ?? 'Hóspede',
          checkOutDate: occ.checkOutDate.toISOString().slice(0, 10),
          guests: occ.adults + occ.children,
          departingToday: departing,
        };
      } else if (['DIRTY', 'CLEANING', 'INSPECTION'].includes(room.status)) {
        state = 'CLEANING';
      } else if (
        ['MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'].includes(room.status)
      ) {
        state = 'BLOCKED';
      } else if (arr) {
        state = 'ARRIVING';
      } else {
        state = 'FREE';
      }

      return {
        id: room.id,
        number: room.number,
        name: room.name,
        floor: room.floor,
        roomType: room.roomType.name,
        status: room.status,
        state,
        occupant,
        arrivalGuest:
          state === 'ARRIVING' ? arr?.primaryGuest?.fullName ?? 'Reserva' : null,
      };
    });

    const summary = {
      total: items.length,
      occupied: items.filter(
        (i) => i.state === 'OCCUPIED' || i.state === 'DEPARTING',
      ).length,
      departingToday: items.filter((i) => i.state === 'DEPARTING').length,
      arrivingToday: items.filter((i) => i.state === 'ARRIVING').length,
      free: items.filter((i) => i.state === 'FREE').length,
      cleaning: items.filter((i) => i.state === 'CLEANING').length,
      blocked: items.filter((i) => i.state === 'BLOCKED').length,
    };

    return { summary, rooms: items };
  }
}
