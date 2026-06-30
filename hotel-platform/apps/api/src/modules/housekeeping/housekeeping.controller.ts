import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { HousekeepingService } from './housekeeping.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createCleaningTaskSchema,
  assignCleaningSchema,
  reportIssueSchema,
  rejectCleaningSchema,
  updateRoomStatusSchema,
  type CreateCleaningTaskInput,
} from '@hotel/shared/schemas';

@Controller('cleaning-tasks')
@UseGuards(JwtAuthGuard)
export class HousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  // ---- Leitura ----

  /**
   * GET /cleaning-tasks?status=PENDING,IN_PROGRESS&assignedTo=...
   * Para governanta — vê todas as tarefas com filtros.
   */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('assignedTo') assignedToId?: string,
    @Query('date') date?: string,
  ) {
    return this.housekeeping.listTasks({
      propertyId: user.propertyId,
      status: status ? status.split(',') : undefined,
      assignedToId,
      date: date ? new Date(date) : undefined,
    });
  }

  /**
   * GET /cleaning-tasks/my-tasks
   * Para camareira — tarefas atribuídas a ela.
   */
  @Get('my-tasks')
  async myTasks(@CurrentUser() user: AuthenticatedUser) {
    return this.housekeeping.listMyTasks(user.propertyId, user.userId);
  }

  /**
   * GET /cleaning-tasks/dashboard
   */
  @Get('dashboard')
  async dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.housekeeping.dashboard(user.propertyId);
  }

  @Get(':id')
  async getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.housekeeping.getById(user.propertyId, id);
  }

  // ---- Criação ----

  @Post()
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCleaningTaskSchema)) dto: CreateCleaningTaskInput,
  ) {
    return this.housekeeping.create({
      propertyId: user.propertyId,
      userId: user.userId,
      data: dto,
    });
  }

  // ---- Ações: Supervisor ----

  /**
   * PATCH /cleaning-tasks/:id/assign
   */
  @Patch(':id/assign')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(assignCleaningSchema)) dto: { userId: string },
  ) {
    return this.housekeeping.assign({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
      assignedToId: dto.userId,
    });
  }

  /**
   * POST /cleaning-tasks/:id/approve
   */
  @Post(':id/approve')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.housekeeping.approve({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
    });
  }

  /**
   * POST /cleaning-tasks/:id/reject
   */
  @Post(':id/reject')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(rejectCleaningSchema)) dto: { reason: string },
  ) {
    return this.housekeeping.reject({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
      reason: dto.reason,
    });
  }

  // ---- Ações: Camareira ----

  /**
   * POST /cleaning-tasks/:id/start
   */
  @Post(':id/start')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER')
  async start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.housekeeping.start({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
    });
  }

  /**
   * POST /cleaning-tasks/:id/complete
   */
  @Post(':id/complete')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER')
  async complete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.housekeeping.complete({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
    });
  }

  /**
   * POST /cleaning-tasks/:id/issue
   */
  @Post(':id/issue')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER')
  async reportIssue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(reportIssueSchema))
    dto: { description: string; photos?: string[] },
  ) {
    return this.housekeeping.reportIssue({
      propertyId: user.propertyId,
      userId: user.userId,
      taskId: id,
      description: dto.description,
      photos: dto.photos,
    });
  }
}
