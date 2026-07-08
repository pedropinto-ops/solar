import { Body, Controller, Post } from '@nestjs/common';
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

  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @Post('chat')
  async chat(@Body(new ZodValidationPipe(chatSchema)) body: ChatInput) {
    return this.assistant.chat({
      slug: body.slug,
      conversationId: body.conversationId,
      message: body.message,
    });
  }
}
