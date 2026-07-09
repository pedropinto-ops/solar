import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PropertyService } from '../property/property.service.js';
import { RoomService } from '../room/room.service.js';
import { RoomTypeService } from '../room/room-type.service.js';
import { PublicReservationService } from './public-reservation.service.js';
import { createPublicReservationSchema } from '@hotel/shared/schemas';

/**
 * "Cérebro" de reserva por IA (Fase 1 do WhatsApp).
 *
 * Um agente Claude conduz a conversa de reserva usando FERRAMENTAS que chamam
 * os serviços REAIS do sistema (disponibilidade e criação), então a IA nunca
 * inventa vaga/preço e a reserva passa pela mesma validação do fluxo web.
 *
 * DESLIGADO sem ANTHROPIC_API_KEY (igual Asaas/Resend). Transporte-agnóstico:
 * recebe o histórico e devolve a próxima resposta — o WhatsApp pluga depois.
 *
 * Estado da conversa em memória (single-instance MVP). Reinício perde as
 * conversas em andamento — aceitável nesta fase.
 */
// Modelo configurável via ASSISTANT_MODEL (Railway) — permite testar o Haiku
// (custo ~3x menor) e voltar pro Sonnet sem deploy. Default: Sonnet, ótimo em
// tool use por uma fração do custo do Opus.
const DEFAULT_MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_ITERATIONS = 8;
const CONTRACT_VERSION = 'assistente-ia-2026-07';
const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 min
const MAX_CONVERSATIONS = 500; // teto para não estourar memória (DoS)

interface StoredConversation {
  messages: Anthropic.MessageParam[];
  propertyId: string;
  propertySlug: string;
  roomTypeId: string;
  expiresAt: number;
}

export interface ChatResult {
  conversationId: string;
  reply: string;
  reservations?: Array<{ code: string }>;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly client: Anthropic | null;
  private readonly conversations = new Map<string, StoredConversation>();

  constructor(
    private readonly config: ConfigService,
    private readonly propertyService: PropertyService,
    private readonly roomService: RoomService,
    private readonly roomTypeService: RoomTypeService,
    private readonly publicReservation: PublicReservationService,
  ) {
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY', '');
    this.model = this.config.get<string>('ASSISTANT_MODEL', DEFAULT_MODEL);
    this.client = this.apiKey ? new Anthropic({ apiKey: this.apiKey }) : null;
    if (this.client) {
      this.logger.log(`Assistente de IA ligado — modelo: ${this.model}`);
    }
    if (!this.client) {
      this.logger.warn(
        '⚠️  ANTHROPIC_API_KEY não configurado — assistente de IA desligado.',
      );
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async chat(params: {
    slug: string;
    conversationId?: string;
    message: string;
    ip?: string;
  }): Promise<ChatResult> {
    const client = this.client;
    if (!client) {
      return {
        conversationId: params.conversationId ?? this.newId(),
        reply:
          'O assistente por IA ainda não está disponível. Fale com a recepção pelo WhatsApp que ajudamos com sua reserva.',
      };
    }

    const convId = params.conversationId ?? this.newId();
    let conv = this.conversations.get(convId);

    if (!conv || conv.expiresAt < Date.now()) {
      const property = await this.propertyService.findBySlug(params.slug);
      const roomTypes = await this.roomTypeService.list(property.id);
      const roomType = roomTypes[0];
      if (!roomType) {
        return { conversationId: convId, reply: 'Hotel sem acomodações cadastradas.' };
      }
      this.enforceCapacity();
      conv = {
        messages: [],
        propertyId: property.id,
        propertySlug: params.slug,
        roomTypeId: roomType.id,
        expiresAt: Date.now() + CONVERSATION_TTL_MS,
      };
      this.conversations.set(convId, conv);
    }
    conv.expiresAt = Date.now() + CONVERSATION_TTL_MS;

    conv.messages.push({ role: 'user', content: params.message });

    const property = await this.propertyService.findBySlug(params.slug);
    const system = this.buildSystemPrompt(property);
    const createdCodes: string[] = [];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      // Prompt caching: o prefixo (ferramentas + system + histórico até o
      // marcador) é recobrado a 10% do preço de input nas chamadas seguintes.
      // O cache dura 5 min e renova a cada uso — cadência típica de chat.
      this.stripCacheControl(conv.messages);
      this.markCacheBreakpoint(conv.messages);

      const response = await client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: [
          { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
        ],
        tools: TOOLS,
        messages: conv.messages,
      });

      conv.messages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason !== 'tool_use') {
        const reply = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        this.enforceCapacity();
        return {
          conversationId: convId,
          reply: reply || 'Certo!',
          reservations: createdCodes.map((code) => ({ code })),
        };
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        const out = await this.runTool(block.name, block.input, conv, createdCodes, params.ip);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: out.content,
          ...(out.isError ? { is_error: true } : {}),
        });
      }
      conv.messages.push({ role: 'user', content: toolResults });
    }

    // Excedeu o limite de rodadas de ferramenta.
    this.enforceCapacity();
    return {
      conversationId: convId,
      reply:
        'Consegui adiantar bastante, mas preciso confirmar um detalhe com a recepção. Pode me mandar seu WhatsApp que finalizamos?',
    };
  }

  private async runTool(
    name: string,
    input: unknown,
    conv: StoredConversation,
    createdCodes: string[],
    ip?: string,
  ): Promise<{ content: string; isError?: boolean }> {
    try {
      if (name === 'check_availability') {
        const a = input as { checkInDate: string; checkOutDate: string; guests: number };
        const roomTypes = await this.roomService.availability({
          propertyId: conv.propertyId,
          checkInDate: this.toDate(a.checkInDate),
          checkOutDate: this.toDate(a.checkOutDate),
          guests: a.guests,
        });
        // Só o que a IA usa na conversa — fotos/amenities/descrição/ids são
        // ruído que ficaria no histórico sendo recobrado a cada mensagem.
        const disponibilidade = roomTypes.map((rt) => ({
          acomodacao: rt.name,
          diariaPorAdulto: rt.dailyRate,
          quartosLivres: rt.available,
          quartosQueOGrupoOcupa: rt.roomsNeeded,
          capacidadeMaxPorQuarto: rt.maxOccupancy,
          estimativaTotalTodosAdultos: rt.totalAmount,
          esgotado: rt.soldOut,
        }));
        return { content: JSON.stringify({ disponibilidade }) };
      }

      if (name === 'create_reservation') {
        const a = (input ?? {}) as any;
        // C1: valida o input da IA pelo MESMO schema Zod do fluxo web —
        // CPF com checksum, documentos distintos, aceite obrigatório, limites.
        // A IA (mesmo sob prompt injection) não contorna as regras de negócio.
        const parsed = createPublicReservationSchema.safeParse({
          roomTypeId: conv.roomTypeId,
          checkInDate: a?.checkInDate,
          checkOutDate: a?.checkOutDate,
          guest: {
            fullName: a?.guest?.fullName,
            documentType: a?.guest?.documentType,
            documentNumber: a?.guest?.documentNumber,
            email: a?.guest?.email,
            phone: a?.guest?.phone,
            consentMarketing: false,
          },
          companions: Array.isArray(a?.companions)
            ? a.companions.map((c: any) => ({
                fullName: c?.fullName,
                documentType: c?.documentType,
                documentNumber: c?.documentNumber,
                age: c?.age,
              }))
            : [],
          contractAccepted: a?.contractAccepted,
          contractVersion: CONTRACT_VERSION,
          idempotencyKey: this.newId(),
        });

        if (!parsed.success) {
          return {
            content: JSON.stringify({
              ok: false,
              errors: parsed.error.issues.map((iss) => ({
                campo: iss.path.join('.'),
                erro: iss.message,
              })),
            }),
            isError: true,
          };
        }

        const d = parsed.data;
        const result = await this.publicReservation.createReservation({
          propertyId: conv.propertyId,
          propertySlug: conv.propertySlug,
          ip,
          data: {
            roomTypeId: d.roomTypeId,
            checkInDate: d.checkInDate,
            checkOutDate: d.checkOutDate,
            guest: {
              fullName: d.guest.fullName,
              documentType: d.guest.documentType,
              documentNumber: d.guest.documentNumber,
              email: d.guest.email,
              phone: d.guest.phone,
              whatsapp: d.guest.whatsapp ?? null,
              birthDate: d.guest.birthDate ?? null,
              consentMarketing: d.guest.consentMarketing,
            },
            companions: d.companions.map((c) => ({
              fullName: c.fullName,
              documentType: c.documentType,
              documentNumber: c.documentNumber,
              age: c.age,
            })),
            guestNotes: d.guestNotes,
            contractAccepted: d.contractAccepted,
            contractVersion: CONTRACT_VERSION,
            idempotencyKey: d.idempotencyKey,
          },
        });
        const codes = result.reservations.map((r: { code: string }) => r.code);
        createdCodes.push(...codes);
        return {
          content: JSON.stringify({
            ok: true,
            codes,
            rooms: result.roomsQuantity,
            total: result.totalAmount,
          }),
        };
      }

      return { content: `Ferramenta desconhecida: ${name}`, isError: true };
    } catch (err: any) {
      // Erros de validação viram tool_result de erro para a IA se corrigir.
      const detail =
        err?.response?.title ||
        err?.title ||
        err?.message ||
        'Erro ao executar a ação.';
      this.logger.warn(`Ferramenta ${name} falhou: ${detail}`);
      return { content: JSON.stringify({ ok: false, error: String(detail) }), isError: true };
    }
  }

  private buildSystemPrompt(property: {
    name: string;
    addressCity?: string | null;
    addressState?: string | null;
  }): string {
    const local = [property.addressCity, property.addressState]
      .filter(Boolean)
      .join(' - ');
    return [
      `Você é o atendente virtual de reservas do ${property.name}${local ? `, em ${local}` : ''}.`,
      'Fale em português do Brasil, de forma cordial, objetiva e natural — como um recepcionista de pousada. Responda direto, sem expor seu raciocínio.',
      '',
      'SEU OBJETIVO: ajudar o hóspede a fazer uma solicitação de reserva.',
      '',
      'REGRAS DE PREÇO (diária POR PESSOA, por idade):',
      '- 0 a 8 anos: grátis.',
      '- 9 a 15 anos: R$50 por dia.',
      '- 16 anos ou mais: diária integral (o valor por adulto da acomodação).',
      'O titular da reserva é sempre tratado como adulto (diária integral).',
      '',
      'FLUXO:',
      '1. Descubra as DATAS (check-in e check-out) e QUANTAS pessoas no total.',
      '2. Use a ferramenta check_availability (datas no formato AAAA-MM-DD e o total de hóspedes) para ver vagas e valores REAIS. Nunca invente disponibilidade ou preço.',
      '3. Se houver vaga, informe quantos quartos o grupo ocupará e o valor estimado. Se um grupo passar da lotação do quarto, o sistema abre mais quartos automaticamente (o preço é por pessoa, não por quarto).',
      '4. Colete os dados do TITULAR: nome completo, CPF, e-mail e WhatsApp. E de CADA acompanhante: nome completo, CPF e IDADE. CPF é obrigatório para todos.',
      '5. Antes de criar a reserva, apresente um resumo (datas, pessoas, valor) e o CONTRATO em resumo: é uma SOLICITAÇÃO de reserva; a recepção confirma disponibilidade e combina o pagamento; políticas de cancelamento se aplicam. Pergunte claramente se o hóspede ACEITA os termos.',
      '6. Só depois de um "sim" explícito ao contrato, chame create_reservation com contractAccepted=true. Passe titular e acompanhantes.',
      '7. Ao criar, informe o(s) código(s) da solicitação e diga que a recepção entrará em contato para confirmar e combinar o pagamento.',
      '',
      'IMPORTANTE: não há pagamento online — é sempre uma solicitação. Não prometa que a reserva está garantida. Se faltar algum dado, peça de forma simples. Se uma ferramenta retornar erro, explique com gentileza e peça a correção.',
    ].join('\n');
  }

  /**
   * A API aceita no máx. 4 blocos com cache_control por request — remove os
   * marcadores da rodada anterior antes de marcar o novo fim do histórico.
   */
  private stripCacheControl(messages: Anthropic.MessageParam[]): void {
    for (const m of messages) {
      if (!Array.isArray(m.content)) continue;
      for (const b of m.content) {
        delete (b as { cache_control?: unknown }).cache_control;
      }
    }
  }

  /** Marca o último bloco do histórico como ponto de cache. */
  private markCacheBreakpoint(messages: Anthropic.MessageParam[]): void {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (typeof last.content === 'string') {
      last.content = [{ type: 'text', text: last.content }];
    }
    const blocks = last.content as Array<{ cache_control?: unknown }>;
    const block = blocks[blocks.length - 1];
    if (block) block.cache_control = { type: 'ephemeral' };
  }

  private toDate(ymd: string): Date {
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return (crypto as any).randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private enforceCapacity(): void {
    const now = Date.now();
    for (const [id, c] of this.conversations) {
      if (c.expiresAt < now) this.conversations.delete(id);
    }
    // Evita crescer sem limite (DoS de memória): remove as conversas mais
    // antigas (ordem de inserção do Map) até ficar sob o teto.
    while (this.conversations.size > MAX_CONVERSATIONS) {
      const oldest = this.conversations.keys().next().value;
      if (oldest === undefined) break;
      this.conversations.delete(oldest);
    }
  }
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description:
      'Consulta a disponibilidade e os valores REAIS de quartos para um período e um total de hóspedes. Use sempre antes de falar de vagas ou preços.',
    input_schema: {
      type: 'object',
      properties: {
        checkInDate: { type: 'string', description: 'Data de check-in no formato AAAA-MM-DD' },
        checkOutDate: { type: 'string', description: 'Data de check-out no formato AAAA-MM-DD' },
        guests: { type: 'integer', description: 'Número TOTAL de hóspedes (titular + acompanhantes)' },
      },
      required: ['checkInDate', 'checkOutDate', 'guests'],
    },
  },
  {
    name: 'create_reservation',
    description:
      'Cria a solicitação de reserva. Só chame após ter datas, todos os hóspedes (titular com contato + acompanhantes com idade) e o ACEITE explícito do contrato pelo hóspede.',
    input_schema: {
      type: 'object',
      properties: {
        checkInDate: { type: 'string', description: 'AAAA-MM-DD' },
        checkOutDate: { type: 'string', description: 'AAAA-MM-DD' },
        contractAccepted: {
          type: 'boolean',
          description: 'true somente se o hóspede aceitou explicitamente os termos do contrato',
        },
        guest: {
          type: 'object',
          description: 'Titular da reserva (tratado como adulto)',
          properties: {
            fullName: { type: 'string' },
            documentType: { type: 'string', enum: ['CPF', 'PASSPORT'] },
            documentNumber: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string', description: 'WhatsApp com DDD' },
          },
          required: ['fullName', 'documentType', 'documentNumber', 'email', 'phone'],
        },
        companions: {
          type: 'array',
          description: 'Demais hóspedes. Pode ser vazio.',
          items: {
            type: 'object',
            properties: {
              fullName: { type: 'string' },
              documentType: { type: 'string', enum: ['CPF', 'PASSPORT'] },
              documentNumber: { type: 'string' },
              age: { type: 'integer', description: 'Idade em anos' },
            },
            required: ['fullName', 'documentType', 'documentNumber', 'age'],
          },
        },
      },
      required: ['checkInDate', 'checkOutDate', 'contractAccepted', 'guest'],
    },
  },
];
