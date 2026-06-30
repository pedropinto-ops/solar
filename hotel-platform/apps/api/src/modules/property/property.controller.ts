import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PropertyService } from './property.service.js';
import { JwtAuthGuard, CurrentUser, AuthenticatedUser } from '../auth/auth.guards.js';

@Controller('properties')
@UseGuards(JwtAuthGuard)
export class PropertyController {
  constructor(private readonly propertyService: PropertyService) {}

  /**
   * Retorna a propriedade do usuário autenticado.
   * GET /api/v1/properties/me
   */
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.propertyService.findById(user.propertyId);
  }

  /**
   * Detalhe de uma propriedade pelo id (apenas a do próprio usuário no MVP).
   * Em multi-propriedade pra mesma rede, esta lógica vira mais complexa.
   * GET /api/v1/properties/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (id !== user.propertyId) {
      throw new Error('FORBIDDEN');
    }
    return this.propertyService.findById(id);
  }
}
