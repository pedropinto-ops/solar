import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserService } from './user.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
} from '@hotel/shared/schemas';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users?role=HOUSEKEEPER — seletor simples (só ativos).
   * GET /users?scope=all — lista de gestão (ativos e inativos).
   * Restrito à gestão (dados da equipe).
   */
  @Get()
  @Roles('ADMIN', 'MANAGER')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: string,
    @Query('scope') scope?: string,
  ) {
    if (scope === 'all') {
      return this.userService.listForManagement(user.propertyId);
    }
    return this.userService.listStaff({ propertyId: user.propertyId, role });
  }

  /** POST /users — cria funcionário com senha provisória (gestor define). */
  @Post()
  @Roles('ADMIN', 'MANAGER')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createUserSchema)) dto: CreateUserInput,
  ) {
    return this.userService.create({
      propertyId: user.propertyId,
      actor: { userId: user.userId, role: user.role },
      data: dto,
    });
  }

  /** PATCH /users/:id — edita nome, telefone, cargo, ativa/desativa. */
  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) dto: UpdateUserInput,
  ) {
    return this.userService.update({
      propertyId: user.propertyId,
      actor: { userId: user.userId, role: user.role },
      userId: id,
      data: dto,
    });
  }

  /** PATCH /users/:id/password — redefine senha provisória. */
  @Patch(':id/password')
  @Roles('ADMIN', 'MANAGER')
  async resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordInput,
  ) {
    return this.userService.resetPassword({
      propertyId: user.propertyId,
      actor: { userId: user.userId, role: user.role },
      userId: id,
      password: dto.password,
    });
  }
}
