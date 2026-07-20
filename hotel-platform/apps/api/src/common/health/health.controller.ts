import { Controller, Get } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../../modules/auth/auth.guards.js';

@Controller('health')
@Public() // não exige JWT (Railway healthcheck)
@SkipThrottle() // health check não conta no rate limit
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cache do resultado. Sem isto, cada GET /health (rota pública e sem
   * throttle) disparava um SELECT no Postgres e ABRIA UMA CONEXÃO NOVA no
   * Redis — ou seja, um atacante usava o health check como amplificador para
   * esgotar as conexões do banco. 10s é curto o bastante para o Railway.
   */
  private cached: { at: number; body: unknown } | null = null;
  private readonly CACHE_MS = 10_000;

  @Get()
  async check() {
    if (this.cached && Date.now() - this.cached.at < this.CACHE_MS) {
      return this.cached.body;
    }

    const checks: Record<string, string> = {};
    let allOk = true;

    // Postgres
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'down';
      allOk = false;
    }

    // Redis (opcional — só se REDIS_URL configurada)
    if (process.env.REDIS_URL) {
      try {
        const { default: Redis } = await import('ioredis');
        const redis = new Redis(process.env.REDIS_URL, {
          maxRetriesPerRequest: 1,
          connectTimeout: 1000,
          lazyConnect: true,
        });
        await redis.connect();
        await redis.ping();
        await redis.quit();
        checks.redis = 'ok';
      } catch {
        checks.redis = 'down';
        // não trava o app — Redis é usado pra filas/cache, não crítico ainda
      }
    }

    // Payload mínimo: `env`, `version` e `uptime` são reconhecimento gratuito
    // para um atacante (qual ambiente, qual versão para casar com CVE, há
    // quanto tempo subiu). O healthcheck só precisa do status.
    const body = {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    };
    this.cached = { at: Date.now(), body };
    return body;
  }
}
