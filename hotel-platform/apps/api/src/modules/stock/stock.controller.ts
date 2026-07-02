import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { StockService } from './stock.service.js';
import {
  JwtAuthGuard,
  Roles,
  CurrentUser,
  AuthenticatedUser,
} from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  createProductSchema,
  updateProductSchema,
  stockMoveSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type StockMoveInput,
} from '@hotel/shared/schemas';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}

  /** Lista de bens/produtos com posição de estoque do almoxarifado. */
  @Get('products')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR')
  async listProducts(@CurrentUser() user: AuthenticatedUser) {
    return this.stock.listProducts(user.propertyId);
  }

  @Post('products')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async createProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProductSchema)) dto: CreateProductInput,
  ) {
    return this.stock.createProduct({
      propertyId: user.propertyId,
      userId: user.userId,
      data: dto,
    });
  }

  @Patch('products/:id')
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async updateProduct(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProductSchema)) dto: UpdateProductInput,
  ) {
    return this.stock.updateProduct({
      propertyId: user.propertyId,
      userId: user.userId,
      productId: id,
      data: dto,
    });
  }

  /** Entrada / saída / perda / ajuste de contagem. */
  @Post('movements')
  @HttpCode(200)
  @Roles('ADMIN', 'MANAGER', 'HOUSEKEEPING_SUPERVISOR')
  async move(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(stockMoveSchema)) dto: StockMoveInput,
  ) {
    return this.stock.move({
      propertyId: user.propertyId,
      userId: user.userId,
      data: dto,
    });
  }

  @Get('movements')
  @Roles('ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR')
  async movements(@CurrentUser() user: AuthenticatedUser) {
    return this.stock.listMovements(user.propertyId);
  }
}
