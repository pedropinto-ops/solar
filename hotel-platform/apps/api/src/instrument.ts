import * as Sentry from '@sentry/node';

/**
 * Inicialização do Sentry (rastreamento de erros em produção).
 *
 * Importado como PRIMEIRA linha do main.ts para instrumentar antes de tudo.
 *
 * DESLIGADO sem SENTRY_DSN (mesmo padrão da chave da Anthropic/Resend): sem a
 * variável, `Sentry.init` nem é chamado e o SDK fica inerte — zero efeito em
 * dev ou enquanto você não cria o projeto no sentry.io.
 *
 * LGPD: sendDefaultPii=false — o Sentry NÃO recebe corpo de requisição,
 * cabeçalhos nem IP, para nenhum dado de hóspede (CPF/e-mail) vazar para um
 * serviço externo junto com o stack de erro.
 */
const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    // Só erros por enquanto — sem tracing de performance (que gera volume e
    // custo). Pode ligar depois com SENTRY_TRACES_SAMPLE_RATE.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false,
  });
}
