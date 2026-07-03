import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard, Public, CurrentUser, AuthenticatedUser } from './auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { loginSchema, type LoginInput } from '@hotel/shared/schemas';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
