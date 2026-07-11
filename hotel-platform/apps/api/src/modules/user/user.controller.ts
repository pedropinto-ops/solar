import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * GET /users?role=HOUSEKEEPER
   * Lista usuários da propriedade. Restrito à gestão (dados da equipe).
   */
  @Get()
  @Roles('ADMIN', 'MANAGER')
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('role') role?: string,
  ) {
    return this.userService.listStaff({
      propertyId: user.propertyId,
      role,
    });
  }
}
