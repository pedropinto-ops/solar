import { Controller, Get } from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service.js';
import { Public } from '../../modules/auth/auth.guards.js';

@Controller('health')
@Public() // não exige JWT (Railway healthcheck)
@SkipThrottle() // health check não conta no rate limit
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
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

    return {
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor(process.uptime()),
      env: process.env.NODE_ENV || 'development',
    };
  }
}
