import { Body, Controller, Ip, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { AssistantService } from './assistant.service.js';
import { Public } from '../auth/auth.guards.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';

const chatSchema = z.object({
  slug: z.string().min(1).max(100),
  conversationId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});
type ChatInput = z.infer<typeof chatSchema>;

/**
 * Assistente de reserva por IA (Fase 1). Público, sem login. Rate-limit
 * agressivo — cada chamada consome tokens de IA (custo).
 */
@Controller('public/assistant')
@Public()
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  // Override dos throttlers NOMEADOS (short/medium existem na config global).
  // O IA gasta tokens Opus por mensagem — limite apertado por IP contra abuso
  // de custo: no máx. 2/s e 8/min por IP.
  @Throttle({ short: { ttl: 1_000, limit: 2 }, medium: { ttl: 60_000, limit: 8 } })
  @Post('chat')
  async chat(
    @Body(new ZodValidationPipe(chatSchema)) body: ChatInput,
    @Ip() ip: string,
  ) {
    return this.assistant.chat({
      slug: body.slug,
      conversationId: body.conversationId,
      message: body.message,
      ip,
    });
  }
}
