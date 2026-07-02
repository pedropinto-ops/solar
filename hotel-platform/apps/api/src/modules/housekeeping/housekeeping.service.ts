import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import type { Prisma } from '@prisma/client';

@Injectable()
export class HousekeepingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ===========================================================
  //  LEITURA
  // ===========================================================

  /**
   * Fila de tarefas para a governanta.
   * Ordenada por prioridade calculada decrescente.
   */
  async listTasks(params: {
    propertyId: string;
    status?: string[];
    assignedToId?: string;
    date?: Date;
  }) {
    const { propertyId, status, assignedToId, date } = params;

    const where: Prisma.CleaningTaskWhereInput = { propertyId };

    if (status && status.length > 0) {
      where.status = { in: status as any };
    } else {
      // Default: tarefas abertas
      where.status = { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION'] };
    }

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (date) {
      const start = new Date(date);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);
      where.createdAt = { gte: start, lt: end };
    }

    return this.prisma.cleaningTask.findMany({
      where,
      include: {
        room: { include: { roomType: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
        inspectedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Tarefas de limpeza abertas da pousada (sem atribuição — qualquer
   * funcionário pode limpar qualquer quarto). userId mantido por
   * compatibilidade de assinatura.
   */
  async listMyTasks(propertyId: string, _userId: string) {
    return this.prisma.cleaningTask.findMany({
      where: {
        propertyId,
        status: { in: ['PENDING', 'IN_PROGRESS', 'AWAITING_INSPECTION', 'REJECTED'] },
      },
      include: {
        room: { include: { roomType: { select: { name: true } } } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getById(propertyId: string, id: string) {
    const task = await this.prisma.cleaningTask.findFirst({
      where: { id, propertyId },
      include: {
        room: { include: { roomType: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        inspectedBy: { select: { id: true, name: true } },
      },
    });
    if (!task) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Tarefa não encontrada',
      });
    }
    return task;
  }

  /**
   * Estatísticas para o dashboard da governanta.
   */
  async dashboard(propertyId: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const [pending, inProgress, awaitingInspection, completedToday] = await Promise.all([
      this.prisma.cleaningTask.count({
        where: { propertyId, status: 'PENDING' },
      }),
      this.prisma.cleaningTask.count({
        where: { propertyId, status: 'IN_PROGRESS' },
      }),
      this.prisma.cleaningTask.count({
        where: { propertyId, status: 'AWAITING_INSPECTION' },
      }),
      this.prisma.cleaningTask.count({
        where: {
          propertyId,
          status: 'COMPLETED',
          inspectedAt: { gte: today, lt: tomorrow },
        },
      }),
    ]);

    // Tempo médio de limpeza (últimas 30 tarefas completadas)
    const recent = await this.prisma.cleaningTask.findMany({
      where: {
        propertyId,
        status: 'COMPLETED',
        durationMinutes: { not: null },
      },
      orderBy: { inspectedAt: 'desc' },
      take: 30,
      select: { durationMinutes: true },
    });

    const avgDuration =
      recent.length > 0
        ? Math.round(
            recent.reduce((s, t) => s + (t.durationMinutes ?? 0), 0) / recent.length,
          )
        : null;

    return {
      pending,
      inProgress,
      awaitingInspection,
      completedToday,
      avgDurationMinutes: avgDuration,
    };
  }

  // ===========================================================
  //  CRIAÇÃO MANUAL
  // ===========================================================

  async create(params: {
    propertyId: string;
    userId: string;
    data: {
      roomId: string;
      type: string;
      priority?: number;
      assignedToId?: string;
      scheduledFor?: Date;
      notes?: string;
    };
  }) {
    const { propertyId, userId, data } = params;

    const room = await this.prisma.room.findFirst({
      where: { id: data.roomId, propertyId },
    });
    if (!room) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Quarto não encontrado',
      });
    }

    let priority = data.priority;
    if (priority === undefined) {
      priority = await this.calculatePriority(this.prisma, data.roomId);
    }

    const task = await this.prisma.cleaningTask.create({
      data: {
        propertyId,
        roomId: data.roomId,
        type: data.type as any,
        status: 'PENDING',
        priority,
        assignedToId: data.assignedToId,
        scheduledFor: data.scheduledFor,
        notes: data.notes,
      },
      include: {
        room: true,
        assignedTo: { select: { id: true, name: true } },
      },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'cleaning.created',
      entityType: 'CleaningTask',
      entityId: task.id,
      changes: { roomId: data.roomId, type: data.type, priority },
    });

    return task;
  }

  // ===========================================================
  //  ATRIBUIÇÃO
  // ===========================================================

  async assign(params: {
    propertyId: string;
    userId: string;
    taskId: string;
    assignedToId: string;
  }) {
    const { propertyId, userId, taskId, assignedToId } = params;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId },
      });
      if (!task) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Tarefa não encontrada',
        });
      }

      if (task.status === 'COMPLETED') {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Tarefa concluída não pode ser reatribuída',
        });
      }

      // Valida que assignee é HOUSEKEEPER
      const assignee = await tx.user.findFirst({
        where: { id: assignedToId, propertyId, active: true },
      });
      if (!assignee) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Usuário não encontrado',
        });
      }
      if (!['HOUSEKEEPER', 'HOUSEKEEPING_SUPERVISOR'].includes(assignee.role)) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Usuário não tem perfil de camareira',
        });
      }

      const previousAssigneeId = task.assignedToId;

      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: { assignedToId },
        include: {
          assignedTo: { select: { id: true, name: true } },
          room: true,
        },
      });

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'cleaning.assigned',
          entityType: 'CleaningTask',
          entityId: taskId,
          changes: { previousAssigneeId, newAssigneeId: assignedToId },
        },
        tx,
      );

      return updated;
    });
  }

  // ===========================================================
  //  CAMAREIRA: INICIAR / CONCLUIR
  // ===========================================================

  async start(params: { propertyId: string; userId: string; taskId: string }) {
    const { propertyId, userId, taskId } = params;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId },
        include: { room: true },
      });
      if (!task) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Tarefa não encontrada',
        });
      }

      // Sem atribuição: qualquer funcionário pode iniciar qualquer tarefa.
      // Quem inicia fica registrado como responsável (via assignedToId abaixo).
      if (task.status === 'IN_PROGRESS') {
        return task; // idempotente
      }

      if (!['PENDING', 'REJECTED'].includes(task.status)) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Tarefa em status ${task.status} não pode ser iniciada`,
        });
      }

      const now = new Date();
      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: task.startedAt ?? now, // preserva startedAt original se já existir
          assignedToId: task.assignedToId ?? userId, // auto-atribui se ninguém
        },
      });

      if (task.room && task.room.status !== 'CLEANING') {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: 'CLEANING' },
        });
        await tx.roomStatusLog.create({
          data: {
            roomId: task.roomId,
            previousStatus: task.room.status,
            newStatus: 'CLEANING',
            reason: `Limpeza iniciada (task ${taskId})`,
            changedById: userId,
          },
        });
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'cleaning.started',
          entityType: 'CleaningTask',
          entityId: taskId,
        },
        tx,
      );

      return updated;
    });
  }

  async complete(params: {
    propertyId: string;
    userId: string;
    taskId: string;
    checklist?: unknown;
  }) {
    const { propertyId, userId, taskId, checklist } = params;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId },
        include: { room: true, property: { select: { paymentPolicies: true } } },
      });
      if (!task) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Tarefa não encontrada',
        });
      }

      if (task.status !== 'IN_PROGRESS') {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Tarefa em status ${task.status} não pode ser concluída`,
        });
      }

      const now = new Date();
      const startedAt = task.startedAt ?? now;
      const durationMinutes = Math.max(
        1,
        Math.round((now.getTime() - startedAt.getTime()) / 60000),
      );

      // Configuração da propriedade: inspeção pode ser pulada
      const skipInspection = false; // futuramente vem de Property.paymentPolicies.skipInspection

      const newStatus = skipInspection ? 'COMPLETED' : 'AWAITING_INSPECTION';

      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: {
          status: newStatus,
          finishedAt: now,
          durationMinutes,
          ...(checklist !== undefined
            ? { checklist: checklist as Prisma.InputJsonValue }
            : {}),
          ...(skipInspection
            ? { inspectedAt: now, inspectedById: userId }
            : {}),
        },
      });

      // Se pula inspeção, libera quarto direto
      if (skipInspection && task.roomId) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: 'AVAILABLE' },
        });
        await tx.roomStatusLog.create({
          data: {
            roomId: task.roomId,
            previousStatus: 'CLEANING',
            newStatus: 'AVAILABLE',
            reason: `Limpeza concluída sem inspeção (task ${taskId})`,
            changedById: userId,
          },
        });
      }

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'cleaning.completed',
          entityType: 'CleaningTask',
          entityId: taskId,
          changes: { durationMinutes, skipInspection },
        },
        tx,
      );

      return updated;
    });
  }

  // ===========================================================
  //  SUPERVISOR: APROVAR / REJEITAR
  // ===========================================================

  async approve(params: { propertyId: string; userId: string; taskId: string }) {
    const { propertyId, userId, taskId } = params;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId },
      });
      if (!task) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Tarefa não encontrada',
        });
      }

      if (task.status !== 'AWAITING_INSPECTION') {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Tarefa em status ${task.status} não pode ser aprovada`,
        });
      }

      const now = new Date();
      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: {
          status: 'COMPLETED',
          inspectedAt: now,
          inspectedById: userId,
        },
      });

      // Libera quarto para venda
      await tx.room.update({
        where: { id: task.roomId },
        data: { status: 'AVAILABLE' },
      });
      await tx.roomStatusLog.create({
        data: {
          roomId: task.roomId,
          previousStatus: 'CLEANING',
          newStatus: 'AVAILABLE',
          reason: `Limpeza aprovada (task ${taskId})`,
          changedById: userId,
        },
      });

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'cleaning.approved',
          entityType: 'CleaningTask',
          entityId: taskId,
        },
        tx,
      );

      return updated;
    });
  }

  async reject(params: {
    propertyId: string;
    userId: string;
    taskId: string;
    reason: string;
  }) {
    const { propertyId, userId, taskId, reason } = params;

    return this.prisma.$transaction(async (tx) => {
      const task = await tx.cleaningTask.findFirst({
        where: { id: taskId, propertyId },
      });
      if (!task) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Tarefa não encontrada',
        });
      }

      if (task.status !== 'AWAITING_INSPECTION') {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Tarefa em status ${task.status} não pode ser rejeitada`,
        });
      }

      // Volta pra IN_PROGRESS pra camareira refazer
      const updated = await tx.cleaningTask.update({
        where: { id: taskId },
        data: {
          status: 'REJECTED',
          issuesReported: task.issuesReported
            ? `${task.issuesReported}\n[Inspeção rejeitada]: ${reason}`
            : `[Inspeção rejeitada]: ${reason}`,
        },
      });

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'cleaning.rejected',
          entityType: 'CleaningTask',
          entityId: taskId,
          changes: { reason },
        },
        tx,
      );

      return updated;
    });
  }

  // ===========================================================
  //  REPORTAR PROBLEMA (durante a limpeza)
  // ===========================================================

  async reportIssue(params: {
    propertyId: string;
    userId: string;
    taskId: string;
    description: string;
    photos?: string[];
  }) {
    const { propertyId, userId, taskId, description, photos = [] } = params;

    const task = await this.prisma.cleaningTask.findFirst({
      where: { id: taskId, propertyId },
    });
    if (!task) {
      throw new NotFoundException({
        errorCode: 'NOT_FOUND',
        title: 'Tarefa não encontrada',
      });
    }

    const timestamp = new Date().toISOString();
    const newEntry = `[${timestamp}] ${description}`;
    const updated = await this.prisma.cleaningTask.update({
      where: { id: taskId },
      data: {
        issuesReported: task.issuesReported
          ? `${task.issuesReported}\n${newEntry}`
          : newEntry,
        photos: { push: photos },
      },
    });

    await this.audit.log({
      propertyId,
      userId,
      action: 'cleaning.issue_reported',
      entityType: 'CleaningTask',
      entityId: taskId,
      changes: { description, photoCount: photos.length },
    });

    return updated;
  }

  // ===========================================================
  //  ROOM STATUS — mudanças manuais (manutenção / bloqueio)
  // ===========================================================

  async updateRoomStatus(params: {
    propertyId: string;
    userId: string;
    roomId: string;
    status: string;
    reason: string;
  }) {
    const { propertyId, userId, roomId, status, reason } = params;

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.room.findFirst({
        where: { id: roomId, propertyId },
      });
      if (!room) {
        throw new NotFoundException({
          errorCode: 'NOT_FOUND',
          title: 'Quarto não encontrado',
        });
      }

      // Bloqueia transições que confundem a operação:
      //  - Não dá pra marcar OCCUPIED via este endpoint (check-in faz isso)
      //  - Não dá pra marcar CLEANING ou INSPECTION via este endpoint (housekeeping)
      const allowedManual = ['AVAILABLE', 'DIRTY', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER'];
      if (!allowedManual.includes(status)) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: `Status ${status} não pode ser definido manualmente`,
        });
      }

      // Não permite tirar OCCUPIED se há hóspede in-house
      if (room.status === 'OCCUPIED') {
        const inHouse = await tx.reservation.findFirst({
          where: { roomId, status: 'CHECKED_IN' },
        });
        if (inHouse) {
          throw new BadRequestException({
            errorCode: 'CONFLICT',
            title: `Quarto está com hóspede in-house (reserva ${inHouse.code})`,
          });
        }
      }

      const previousStatus = room.status;

      const updated = await tx.room.update({
        where: { id: roomId },
        data: { status: status as any },
      });

      await tx.roomStatusLog.create({
        data: {
          roomId,
          previousStatus: previousStatus as any,
          newStatus: status as any,
          reason,
          changedById: userId,
        },
      });

      await this.audit.log(
        {
          propertyId,
          userId,
          action: 'room.status_changed',
          entityType: 'Room',
          entityId: roomId,
          changes: { previousStatus, newStatus: status, reason },
        },
        tx,
      );

      return updated;
    });
  }

  // ===========================================================
  //  UTILS
  // ===========================================================

  /**
   * Cálculo de prioridade baseado em proximidade da próxima reserva.
   */
  async calculatePriority(
    client: PrismaService | Prisma.TransactionClient,
    roomId: string,
  ): Promise<number> {
    let priority = 0;

    const nextReservation = await client.reservation.findFirst({
      where: {
        roomId,
        status: 'CONFIRMED',
        checkInDate: { gte: new Date() },
      },
      orderBy: { checkInDate: 'asc' },
      include: { primaryGuest: { select: { tags: true } } },
    });

    if (nextReservation) {
      const hoursUntil =
        (nextReservation.checkInDate.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 6) priority += 100;
      else if (hoursUntil < 24) priority += 50;
      else if (hoursUntil < 48) priority += 20;

      if (nextReservation.primaryGuest?.tags.includes('VIP')) priority += 30;
    }

    return priority;
  }
}
