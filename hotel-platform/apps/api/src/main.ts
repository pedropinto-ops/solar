import { setDefaultResultOrder } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';

// Containers sem saída IPv6 (ex.: Railway): priorizar IPv4 em resoluções DNS
// evita ENETUNREACH em chamadas HTTPS de saída (ex.: API do Resend) quando o
// host resolve para IPv6. Não afeta o Prisma/Neon, que usa resolvedor próprio.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'verbose', 'debug'],
  });

  // Necessário em PaaS (Railway, Heroku) pra obter IP real através do load balancer
  app.set('trust proxy', 1);

  // Segurança
  app.use(helmet());

  // Compressão (reduz custos de banda no Railway)
  app.use(compression());

  // CORS — exige variável de ambiente em produção
  const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Prefixo de API
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/'],
  });

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || process.env.API_PORT || '3001', 10);
  const host = process.env.API_HOST || '0.0.0.0';

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`🏨 Hotel Platform API rodando em http://${host}:${port}`);
  logger.log(`📖 Health check: http://${host}:${port}/health`);
  logger.log(`🌐 CORS origins: ${corsOrigins.join(', ')}`);
}

bootstrap().catch((err) => {
  console.error('❌ Falha ao iniciar a API:', err);
  process.exit(1);
});
