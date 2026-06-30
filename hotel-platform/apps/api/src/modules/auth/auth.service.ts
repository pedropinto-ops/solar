import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { LoginInput } from '@hotel/shared/schemas';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  propertyId: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Compatível com o seed que usa scrypt.
   * Formato: "{salt}:{hash}"
   */
  static hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  static verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const original = Buffer.from(hash, 'hex');
    if (candidate.length !== original.length) return false;
    return timingSafeEqual(candidate, original);
  }

  async login(dto: LoginInput) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.active) {
      throw new UnauthorizedException({
        errorCode: 'INVALID_CREDENTIALS',
        title: 'Credenciais inválidas',
      });
    }

    if (!AuthService.verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException({
        errorCode: 'INVALID_CREDENTIALS',
        title: 'Credenciais inválidas',
      });
    }

    // Atualiza lastLoginAt (não-bloqueante)
    this.prisma.user
      .update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch((e) => this.logger.warn(`Falha ao atualizar lastLoginAt: ${e.message}`));

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      propertyId: user.propertyId,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '7d');
    const token = await this.jwt.signAsync(payload, { expiresIn });

    return {
      token,
      expiresAt: this.calculateExpiresAt(expiresIn),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        propertyId: user.propertyId,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.active) return null;
    return user;
  }

  private calculateExpiresAt(expiresIn: string): string {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const value = parseInt(match[1]!, 10);
    const unit = match[2]!;
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 3600 * 1000,
      d: 24 * 3600 * 1000,
    };
    return new Date(Date.now() + value * multipliers[unit]!).toISOString();
  }
}
