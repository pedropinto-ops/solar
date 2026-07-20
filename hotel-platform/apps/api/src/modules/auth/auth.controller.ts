import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, Public, CurrentUser, AuthenticatedUser } from './auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { loginSchema, type LoginInput } from '@hotel/shared/schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Limite ESPECÍFICO de login. Sem isto valia só o teto global (100/min,
   * 1000/h por IP) — o suficiente para varredura de senhas por força bruta.
   * Aqui cai para 50/h por IP, sem atrapalhar a equipe (ninguém entra 10x/min).
   */
  @Throttle({
    short: { ttl: 1_000, limit: 2 },
    medium: { ttl: 60_000, limit: 10 },
    long: { ttl: 3_600_000, limit: 50 },
  })
  @Post('login')
  @Public()
  @HttpCode(200)
  async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginInput) {
    return this.auth.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}
