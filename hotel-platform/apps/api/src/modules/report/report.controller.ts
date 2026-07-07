import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportService } from './report.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { reportQuerySchema, type ReportQuery } from '@hotel/shared/schemas';

/**
 * Relatórios gerenciais — dados financeiros/operacionais sensíveis,
 * restritos a ADMIN e MANAGER.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get('summary')
  @Roles('ADMIN', 'MANAGER')
  async summary(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(reportQuerySchema)) query: ReportQuery,
  ) {
    return this.report.summary({
      propertyId: user.propertyId,
      start: query.start,
      end: query.end,
    });
  }
}
