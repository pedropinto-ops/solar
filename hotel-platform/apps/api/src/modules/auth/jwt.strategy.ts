import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from './auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      // Aceitar apenas HS256. Sem esta trava, a validação segue a lista padrão
      // da lib; fixar o algoritmo elimina de vez ataques de confusão de
      // algoritmo (ex.: token forjado com "alg": "none" ou assimétrico).
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.authService.validateUser(payload.sub, payload.tv);
    if (!user) throw new UnauthorizedException();
    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      propertyId: user.propertyId,
    };
  }
}
