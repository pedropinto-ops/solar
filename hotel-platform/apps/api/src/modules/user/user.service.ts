import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async listStaff(params: { propertyId: string; role?: string }) {
    return this.prisma.user.findMany({
      where: {
        propertyId: params.propertyId,
        active: true,
        ...(params.role ? { role: params.role as any } : {}),
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });
  }
}
