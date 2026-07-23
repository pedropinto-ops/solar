// PRIMEIRO import: inicializa o Sentry antes de qualquer outra coisa carregar.
import './instrument.js';
import { setDefaultResultOrder } from 'node:dns';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module.js';
import { SentryExceptionFilter } from './common/sentry/sentry-exception.filter.js';

// Containers sem saída IPv6 (ex.: Railway): priorizar IPv4 em resoluções DNS
// evita ENETUNREACH em chamadas HTTPS de saída (ex.: API do Resend) quando o
// host resolve para IPv6. Não afeta o Prisma/Neon, que usa resolvedor próprio.
setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Em produção não emitir verbose/debug: esses níveis despejam payloads e
    // internos nos logs, criando um repositório paralelo de dados pessoais.
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'verbose', 'debug'],
    // Guarda o corpo BRUTO da requisição (req.rawBody). Necessário para
    // verificar a assinatura HMAC do webhook do WhatsApp (Meta) — o corpo
    // reserializado não bate. Não altera o parsing normal das outras rotas.
    rawBody: true,
  });

  // Necessário em PaaS (Railway, Heroku) pra obter IP real através do load balancer
  app.set('trust proxy', 1);

  // Segurança
  app.use(helmet());

  // Teto explícito de payload. Antes dependíamos do default implícito do
  // Express (~100kb); fixar em 64kb deixa o limite intencional e corta
  // tentativas de exaustão de memória por corpo gigante/JSON profundo.
  app.useBodyParser('json', { limit: '64kb' });
  app.useBodyParser('urlencoded', { limit: '64kb', extended: true });

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
  // Excluir /health E /health/live do prefixo: sem o segundo, o liveness cairia
  // em /api/v1/health/live e o healthcheck do Railway (configurado p/ /health/live)
  // não o acharia.
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/health/live', '/'],
  });

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Filtro global que captura erros inesperados no Sentry (mantendo a resposta
  // HTTP padrão do Nest). Sem SENTRY_DSN, o capture é no-op.
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new SentryExceptionFilter(httpAdapterHost.httpAdapter));

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
