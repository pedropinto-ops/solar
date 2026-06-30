import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class PropertyService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });
    if (!property) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Propriedade não encontrada',
      });
    }
    return property;
  }

  async findBySlug(slug: string) {
    const property = await this.prisma.property.findUnique({
      where: { bookingSlug: slug },
    });
    if (!property || !property.active) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Propriedade não encontrada',
      });
    }
    return property;
  }
}
