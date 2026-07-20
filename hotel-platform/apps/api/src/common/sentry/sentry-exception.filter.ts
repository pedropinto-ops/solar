import { Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Filtro global que reporta ao Sentry apenas o que é REALMENTE erro.
 *
 * Estende o BaseExceptionFilter do Nest, então o comportamento de resposta
 * HTTP fica idêntico ao padrão (status, corpo) — só acrescenta a captura.
 *
 * Não reporta 4xx (validação, 401, 404, conflito): são fluxo normal e
 * poluiriam o painel. Só sobe o inesperado — 5xx e exceções não-HTTP (ex.:
 * falha de banco, bug de runtime), que é o que você quer descobrir na hora.
 */
@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  override catch(exception: unknown, host: ArgumentsHost): void {
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : 500;
    if (!isHttp || status >= 500) {
      Sentry.captureException(exception);
    }
    super.catch(exception, host);
  }
}
