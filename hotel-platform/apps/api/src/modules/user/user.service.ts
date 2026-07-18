import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../../common/audit/audit.service.js';
import { AuthService } from '../auth/auth.service.js';

/**
 * Quem pode gerenciar quem (anti-escalonamento de privilégio):
 *  - ADMIN gerencia qualquer cargo.
 *  - MANAGER gerencia recepção, governanta, camareira e readonly —
 *    NÃO mexe em ADMIN nem em outro MANAGER.
 */
function canManageRole(actorRole: string, targetRole: string): boolean {
  if (actorRole === 'ADMIN') return true;
  if (actorRole === 'MANAGER') {
    return !['ADMIN', 'MANAGER'].includes(targetRole);
  }
  return false;
}

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Seletor simples (ex.: escolher camareira). Só ativos, campos mínimos. */
  async listStaff(params: { propertyId: string; role?: string }) {
    return this.prisma.user.findMany({
      where: {
        propertyId: params.propertyId,
        active: true,
        ...(params.role ? { role: params.role as any } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  /** Lista de gestão: ativos E inativos, com mais contexto. */
  async listForManagement(propertyId: string) {
    return this.prisma.user.findMany({
      where: { propertyId },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async create(params: {
    propertyId: string;
    actor: { userId: string; role: string };
    data: {
      username: string;
      email?: string;
      password: string;
      name: string;
      phone?: string;
      role: string;
    };
  }) {
    const { propertyId, actor, data } = params;

    if (!canManageRole(actor.role, data.role)) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        title: 'Você não pode criar um usuário com esse cargo.',
      });
    }

    const username = data.username.trim();
    const email = data.email?.trim() || null;

    const dupUser = await this.prisma.user.findUnique({ where: { username } });
    if (dupUser) {
      throw new ConflictException({
        errorCode: 'USERNAME_IN_USE',
        title: 'Já existe um usuário com esse nome de login.',
      });
    }
    if (email) {
      const dupEmail = await this.prisma.user.findUnique({ where: { email } });
      if (dupEmail) {
        throw new ConflictException({
          errorCode: 'EMAIL_IN_USE',
          title: 'Já existe um usuário com esse e-mail.',
        });
      }
    }

    const user = await this.prisma.user.create({
      data: {
        propertyId,
        username,
        email,
        passwordHash: AuthService.hashPassword(data.password),
        name: data.name,
        phone: data.phone ?? null,
        role: data.role as any,
        active: true,
      },
      select: { id: true, name: true, username: true, email: true, role: true, active: true },
    });

    await this.audit.log({
      propertyId,
      userId: actor.userId,
      action: 'user.created',
      entityType: 'User',
      entityId: user.id,
      changes: { username: user.username, role: user.role },
    });

    return user;
  }

  async update(params: {
    propertyId: string;
    actor: { userId: string; role: string };
    userId: string;
    data: {
      username?: string;
      email?: string;
      name?: string;
      phone?: string;
      role?: string;
      active?: boolean;
    };
  }) {
    const { propertyId, actor, userId, data } = params;

    const target = await this.prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!target) {
      throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Usuário não encontrado.' });
    }

    // Unicidade de username / e-mail (se mudaram)
    const username = data.username != null ? data.username.trim() : undefined;
    const email = data.email !== undefined ? data.email.trim() || null : undefined;
    if (username && username !== target.username) {
      const dup = await this.prisma.user.findFirst({ where: { username, id: { not: userId } } });
      if (dup) {
        throw new ConflictException({
          errorCode: 'USERNAME_IN_USE',
          title: 'Já existe um usuário com esse nome de login.',
        });
      }
    }
    if (email && email !== target.email) {
      const dup = await this.prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (dup) {
        throw new ConflictException({
          errorCode: 'EMAIL_IN_USE',
          title: 'Já existe um usuário com esse e-mail.',
        });
      }
    }

    // Precisa poder gerenciar o cargo ATUAL do alvo…
    if (!canManageRole(actor.role, target.role)) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        title: 'Você não pode editar este usuário.',
      });
    }
    // …e, se muda o cargo, também o NOVO cargo (evita promover a ADMIN sendo MANAGER).
    if (data.role && !canManageRole(actor.role, data.role)) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        title: 'Você não pode atribuir esse cargo.',
      });
    }

    // Não pode rebaixar nem desativar a si mesmo (evita se trancar pra fora).
    if (userId === actor.userId) {
      if (data.active === false) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Você não pode desativar o próprio usuário.',
        });
      }
      if (data.role && data.role !== target.role) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_ERROR',
          title: 'Você não pode alterar o próprio cargo.',
        });
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(username !== undefined ? { username } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.role !== undefined ? { role: data.role as any } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
      select: { id: true, name: true, username: true, email: true, role: true, active: true },
    });

    await this.audit.log({
      propertyId,
      userId: actor.userId,
      action: 'user.updated',
      entityType: 'User',
      entityId: userId,
      changes: data,
    });

    return updated;
  }

  async resetPassword(params: {
    propertyId: string;
    actor: { userId: string; role: string };
    userId: string;
    password: string;
  }) {
    const { propertyId, actor, userId, password } = params;

    const target = await this.prisma.user.findFirst({ where: { id: userId, propertyId } });
    if (!target) {
      throw new NotFoundException({ errorCode: 'NOT_FOUND', title: 'Usuário não encontrado.' });
    }
    if (!canManageRole(actor.role, target.role)) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        title: 'Você não pode redefinir a senha deste usuário.',
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: AuthService.hashPassword(password) },
    });

    await this.audit.log({
      propertyId,
      userId: actor.userId,
      action: 'user.password_reset',
      entityType: 'User',
      entityId: userId,
      changes: { by: actor.userId },
    });

    return { ok: true };
  }
}
