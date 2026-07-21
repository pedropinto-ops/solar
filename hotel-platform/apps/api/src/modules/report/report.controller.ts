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
 * Relatórios gerenciais — dados financeiros/operacionais sensíveis.
 * ADMIN e MANAGER (operação) + READONLY = perfil "Diretoria", que APENAS
 * consulta relatórios/indicadores e não pode alterar nada no sistema.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly report: ReportService) {}

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'READONLY')
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

  /** Previsão: ocupação e receita já confirmadas para os próximos dias. */
  @Get('forecast')
  @Roles('ADMIN', 'MANAGER', 'READONLY')
  async forecast(@CurrentUser() user: AuthenticatedUser) {
    return this.report.forecast({ propertyId: user.propertyId });
  }
}
