import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard que valida JWT no header Authorization.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

/**
 * Roles decorator.
 * Uso: @Roles('ADMIN','MANAGER')
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException({
        errorCode: 'FORBIDDEN',
        title: 'Permissão insuficiente',
        detail: `Esta ação requer um dos perfis: ${required.join(', ')}`,
      });
    }
    return true;
  }
}

/**
 * Decorator para extrair user do request.
 * Uso: @CurrentUser() user: AuthenticatedUser
 */
export interface AuthenticatedUser {
  userId: string;
  name: string;
  email: string;
  role: string;
  propertyId: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return data ? request.user?.[data] : request.user;
  },
);
