import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { CompanyService } from './company.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

const companyBase = {
  legalName: z.string().min(2).max(160),
  tradeName: z.string().max(160).optional(),
  cnpj: z.string().min(11).max(20),
  stateRegistration: z.string().max(40).optional(),
  email: z.string().email().max(160).optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  contactName: z.string().max(120).optional(),
  defaultRateOverride: z.coerce.number().positive().optional(),
  paymentTermDays: z.coerce.number().int().min(0).max(180).optional(),
  billingDay: z.coerce.number().int().min(1).max(28).optional(),
  creditLimit: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
};
const createCompanySchema = z.object(companyBase);
const updateCompanySchema = z.object({
  ...companyBase,
  legalName: companyBase.legalName.optional(),
  cnpj: companyBase.cnpj.optional(),
  active: z.boolean().optional(),
});
type CreateCompanyDto = z.infer<typeof createCompanySchema>;
type UpdateCompanyDto = z.infer<typeof updateCompanySchema>;

const createInvoiceSchema = z.object({
  companyId: z.string().cuid(),
  reservationIds: z.array(z.string().cuid()).min(1),
  discount: z.coerce.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});
type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;

const payInvoiceSchema = z.object({
  method: z.enum(['PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH', 'BANK_TRANSFER', 'OTHER']).optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
});
type PayInvoiceDto = z.infer<typeof payInvoiceSchema>;

@Controller()
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly service: CompanyService) {}

  // ------------------------- Empresas (convênios) -------------------------

  @Get('companies')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  list(@CurrentUser() user: AuthenticatedUser, @Query('onlyActive') onlyActive?: string) {
    return this.service.list(user.propertyId, onlyActive === 'true');
  }

  @Get('companies/:id')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION')
  getById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getById(user.propertyId, id);
  }

  @Get('companies/:id/open-reservations')
  @Roles('ADMIN', 'MANAGER')
  openReservations(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.openReservations(user.propertyId, id);
  }

  @Post('companies')
  @Roles('ADMIN', 'MANAGER')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCompanySchema)) dto: CreateCompanyDto,
  ) {
    return this.service.create({ propertyId: user.propertyId, userId: user.userId, data: dto });
  }

  @Patch('companies/:id')
  @Roles('ADMIN', 'MANAGER')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCompanySchema)) dto: UpdateCompanyDto,
  ) {
    return this.service.update({ propertyId: user.propertyId, userId: user.userId, id, data: dto });
  }

  @Delete('companies/:id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.remove({ propertyId: user.propertyId, userId: user.userId, id });
  }

  // ------------------------------- Faturas -------------------------------

  @Get('invoices')
  @Roles('ADMIN', 'MANAGER')
  listInvoices(@CurrentUser() user: AuthenticatedUser, @Query('companyId') companyId?: string) {
    return this.service.listInvoices(user.propertyId, companyId);
  }

  @Get('invoices/:id')
  @Roles('ADMIN', 'MANAGER')
  getInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getInvoice(user.propertyId, id);
  }

  @Post('invoices')
  @Roles('ADMIN', 'MANAGER')
  createInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createInvoiceSchema)) dto: CreateInvoiceDto,
  ) {
    return this.service.createInvoice({
      propertyId: user.propertyId, userId: user.userId,
      companyId: dto.companyId, reservationIds: dto.reservationIds, discount: dto.discount, notes: dto.notes,
    });
  }

  @Post('invoices/:id/pay')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(200)
  payInvoice(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(payInvoiceSchema)) dto: PayInvoiceDto,
  ) {
    return this.service.payInvoice({
      propertyId: user.propertyId, userId: user.userId, id,
      method: dto.method, paidAt: dto.paidAt, notes: dto.notes,
    });
  }

  @Post('invoices/:id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @HttpCode(200)
  cancelInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.cancelInvoice({ propertyId: user.propertyId, userId: user.userId, id });
  }
}
