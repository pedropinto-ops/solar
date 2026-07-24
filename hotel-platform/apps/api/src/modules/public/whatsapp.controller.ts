import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { WhatsappService } from './whatsapp.service.js';
import { Public } from '../auth/auth.guards.js';

/**
 * Webhook do WhatsApp (Meta Cloud API). Público, sem login.
 *
 * GET  /public/whatsapp/webhook  → handshake de verificação (a Meta chama ao
 *                                   configurar o webhook no painel dela).
 * POST /public/whatsapp/webhook  → recebe as mensagens dos hóspedes.
 *
 * ⚠️ ESBOÇO (Fase 2): pronto no código, mas só funciona depois de uma conta
 * WhatsApp Business API aprovada pela Meta + a chave da IA. Sem as variáveis
 * de ambiente, fica inerte.
 */
@Controller('public/whatsapp')
@Public()
export class WhatsappController {
  private readonly logger = new Logger(WhatsappController.name);

  constructor(private readonly whatsapp: WhatsappService) {}

  /**
   * Verificação do webhook. A Meta manda hub.mode / hub.verify_token /
   * hub.challenge (com ponto no nome — por isso lemos do objeto de query).
   * Devolvemos o challenge em TEXTO PURO se o token bater; senão, 403.
   */
  @Get('webhook')
  verify(@Query() query: Record<string, string>, @Res() res: Response): void {
    const challenge = this.whatsapp.verifyChallenge(
      query['hub.mode'],
      query['hub.verify_token'],
      query['hub.challenge'],
    );
    if (challenge !== null) {
      res.status(200).type('text/plain').send(challenge);
    } else {
      this.logger.warn('Verificação de webhook do WhatsApp recusada (token não bate).');
      res.status(403).send('forbidden');
    }
  }

  /**
   * DIAGNÓSTICO TEMPORÁRIO: dispara um envio de teste e devolve o status/corpo
   * exato da Graph API (para achar a causa do 400). Protegido pelo verify token.
   *   GET /public/whatsapp/_debug?t=<verify_token>&to=<numero>
   * REMOVER depois do teste.
   */
  @Get('_debug')
  async debug(@Query() query: Record<string, string>): Promise<Record<string, unknown>> {
    return this.whatsapp.debugSend(query['t'], query['to']);
  }

  /**
   * Recebe as mensagens. Confere a assinatura contra o corpo BRUTO, responde
   * 200 na hora (senão a Meta re-tenta) e processa em segundo plano.
   */
  @Throttle({ short: { ttl: 1_000, limit: 20 }, medium: { ttl: 60_000, limit: 300 } })
  @Post('webhook')
  receive(@Req() req: RawBodyRequest<Request>, @Res() res: Response): void {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    if (!this.whatsapp.verifySignature(req.rawBody, signature)) {
      this.logger.warn('Assinatura de webhook do WhatsApp inválida — descartado.');
      res.status(401).send('invalid signature');
      return;
    }

    // ACK imediato: a Meta espera 200 rápido, ou re-envia o evento.
    res.status(200).send('EVENT_RECEIVED');

    // Processa fora do caminho da resposta (a IA pode levar alguns segundos).
    void this.whatsapp
      .handleIncoming(req.body)
      .catch((err) => this.logger.error(`handleIncoming falhou: ${String(err)}`));
  }
}
