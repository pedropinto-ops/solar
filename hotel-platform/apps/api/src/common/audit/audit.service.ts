import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '@prisma/client';

export interface AuditEntry {
  propertyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

/**
 * Registra mudanças importantes em audit_logs.
 *
 * Uso típico (dentro de um service):
 *   await this.audit.log({ propertyId, userId, action: 'reservation.created', ... });
 *
 * Em transação: passe o `tx` do prisma como segundo argumento.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    entry: AuditEntry,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        propertyId: entry.propertyId,
        userId: entry.userId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        changes: (entry.changes ?? null) as Prisma.InputJsonValue,
        metadata: (entry.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }
}
