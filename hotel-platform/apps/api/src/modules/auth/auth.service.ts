import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { LoginInput } from '@hotel/shared/schemas';

export interface JwtPayload {
  sub: string; // userId
  email: string | null;
  username: string | null;
  role: string;
  propertyId: string;
  /**
   * Versão da sessão no momento da emissão. Comparada com a do banco a cada
   * requisição — se não bater, o token foi revogado (troca de senha) e o
   * acesso cai na hora. Tokens antigos, emitidos antes desta mudança, não
   * têm o campo: tratamos como versão 0 para não deslogar todo mundo agora.
   */
  tv?: number;
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

  /**
   * Hash descartável usado só para gastar o mesmo tempo de CPU quando o
   * usuário não existe — impede enumeração de contas por diferença de tempo.
   */
  private static readonly DUMMY_HASH = AuthService.hashPassword(
    randomBytes(32).toString('hex'),
  );

  static verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const candidate = scryptSync(password, salt, 64);
    const original = Buffer.from(hash, 'hex');
    if (candidate.length !== original.length) return false;
    return timingSafeEqual(candidate, original);
  }

  async login(dto: LoginInput) {
    // Aceita nome de usuário OU e-mail no campo "login".
    const login = dto.login.trim();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: login }, { email: login }] },
    });

    // Executa scrypt SEMPRE — inclusive quando o usuário não existe ou está
    // inativo — para que os dois caminhos levem o mesmo tempo. Antes, a saída
    // antecipada tornava "login inexistente" mensuravelmente mais rápida que
    // "senha errada", permitindo descobrir quais usuários existem.
    const passwordOk = AuthService.verifyPassword(
      dto.password,
      user?.active ? user.passwordHash : AuthService.DUMMY_HASH,
    );

    if (!user || !user.active || !passwordOk) {
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
      username: user.username,
      role: user.role,
      propertyId: user.propertyId,
      tv: user.tokenVersion,
    };

    // 24h (era 7d): reduz drasticamente a janela de uso de um token roubado.
    // Ajustável por JWT_EXPIRES_IN sem deploy.
    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN', '24h');
    const token = await this.jwt.signAsync(payload, { expiresIn });

    return {
      token,
      expiresAt: this.calculateExpiresAt(expiresIn),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        propertyId: user.propertyId,
      },
    };
  }

  async validateUser(userId: string, tokenVersion?: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.active) return null;

    // Coração da revogação: o token só vale se a versão que ele carrega ainda
    // for a versão atual do usuário. Trocar a senha incrementa a do banco e
    // todas as sessões anteriores morrem imediatamente.
    if ((tokenVersion ?? 0) !== user.tokenVersion) return null;

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
