import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class RoomTypeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(propertyId: string) {
    return this.prisma.roomType.findMany({
      where: { propertyId, active: true },
      orderBy: { basePrice: 'asc' },
    });
  }
}
