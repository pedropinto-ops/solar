import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AssistantService } from './assistant.service.js';

/**
 * Transporte WhatsApp (Fase 2) — pluga o "cérebro" (AssistantService) na
 * WhatsApp Cloud API oficial da Meta.
 *
 * Fluxo: a Meta chama nosso webhook quando chega uma mensagem → extraímos o
 * telefone + texto → passamos pro assistente (mesma lógica do chat do site) →
 * mandamos a resposta de volta pela Graph API.
 *
 * DESLIGADO sem as variáveis (igual assistente/Resend): sem WHATSAPP_PHONE_ID e
 * WHATSAPP_ACCESS_TOKEN, o serviço não envia nada. Nada quebra.
 *
 * ⚠️ ESBOÇO (Fase 2): ainda não testado ao vivo — depende de conta WhatsApp
 * Business API aprovada pela Meta (número dedicado + verificação) e da chave da
 * IA. O código está pronto pra ligar quando essas duas coisas existirem.
 */

// Estado da conversa e dedupe de mensagens ficam em MEMÓRIA (MVP single-instance,
// como o assistente). Reinício perde conversas em andamento — aceitável nesta
// fase. Evoluir para persistência (banco) antes de escalar.
const PROCESSED_TTL_MS = 10 * 60 * 1000; // janela de re-entrega da Meta
const MAX_PROCESSED = 2000;
const WHATSAPP_TEXT_LIMIT = 4000; // limite ~4096 do corpo de texto; folga de segurança

interface IncomingText {
  from: string; // telefone (wa_id), ex.: 5575981492537
  id: string; // wamid... — id único da mensagem (para dedupe)
  type: string;
  text?: { body?: string };
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly apiUrl: string;
  private readonly phoneId: string;
  private readonly accessToken: string;
  private readonly verifyToken: string;
  private readonly appSecret: string;
  private readonly propertySlug: string;
  /** ids de mensagens já processadas → id -> expiresAt (anti-reprocessamento). */
  private readonly processed = new Map<string, number>();

  constructor(
    private readonly config: ConfigService,
    private readonly assistant: AssistantService,
  ) {
    this.apiUrl = this.config
      .get<string>('WHATSAPP_API_URL', 'https://graph.facebook.com/v20.0')
      .replace(/\/$/, '');
    this.phoneId = this.config.get<string>('WHATSAPP_PHONE_ID', '');
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN', '');
    this.verifyToken = this.config.get<string>('WHATSAPP_VERIFY_TOKEN', '');
    this.appSecret = this.config.get<string>('WHATSAPP_APP_SECRET', '');
    // Qual propriedade este número atende (o Solar Irará é o único por ora).
    this.propertySlug = this.config.get<string>('WHATSAPP_PROPERTY_SLUG', 'solar-irara');

    if (this.enabled) {
      this.logger.log('Transporte WhatsApp ligado.');
      if (!this.appSecret) {
        this.logger.warn(
          '⚠️  WHATSAPP_APP_SECRET ausente — verificação de assinatura DESLIGADA. Configure em produção.',
        );
      }
    } else {
      this.logger.warn(
        '⚠️  WhatsApp desligado (faltam WHATSAPP_PHONE_ID / WHATSAPP_ACCESS_TOKEN).',
      );
    }
  }

  get enabled(): boolean {
    return Boolean(this.phoneId && this.accessToken);
  }

  /**
   * Handshake de verificação (GET). A Meta chama uma vez ao configurar o
   * webhook, mandando hub.mode/hub.verify_token/hub.challenge. Se o token bate,
   * devolvemos o challenge em TEXTO PURO. Retorna null se não bater.
   */
  verifyChallenge(mode?: string, token?: string, challenge?: string): string | null {
    if (mode === 'subscribe' && token && this.verifyToken && token === this.verifyToken) {
      return challenge ?? '';
    }
    return null;
  }

  /**
   * Confere o cabeçalho X-Hub-Signature-256 contra o corpo BRUTO usando o app
   * secret. Sem app secret configurado, pula a verificação (para testes) — mas
   * loga um aviso. Comparação em tempo constante.
   */
  verifySignature(rawBody: Buffer | undefined, signatureHeader?: string): boolean {
    if (!this.appSecret) return true; // não configurado → não bloqueia (dev/teste)
    if (!signatureHeader || !rawBody) return false;
    const expected =
      'sha256=' + createHmac('sha256', this.appSecret).update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  /**
   * Processa o payload do webhook (chamado em background pelo controller, que
   * já respondeu 200 pra Meta não re-tentar). Ignora status de entrega e tipos
   * não-texto; deduplica por id de mensagem.
   */
  async handleIncoming(payload: unknown): Promise<void> {
    if (!this.enabled) return;
    const messages = this.extractTextMessages(payload);
    for (const msg of messages) {
      if (this.alreadyProcessed(msg.id)) continue;
      this.markProcessed(msg.id);

      if (msg.type !== 'text' || !msg.text?.body) {
        await this.sendText(
          msg.from,
          'Por ora consigo ajudar só por mensagens de texto. Me conte as datas e quantas pessoas para sua reserva. 🙂',
        );
        continue;
      }

      try {
        const result = await this.assistant.chat({
          slug: this.propertySlug,
          // Chaveia a conversa pelo telefone → o mesmo número continua de onde parou.
          conversationId: `wa:${msg.from}`,
          message: msg.text.body,
        });
        await this.sendText(msg.from, result.reply);
      } catch (err) {
        this.logger.error(`Falha ao responder ${this.maskPhone(msg.from)}: ${String(err)}`);
        await this.sendText(
          msg.from,
          'Tive um probleminha aqui. Pode repetir, por favor? Se preferir, falo com a recepção.',
        );
      }
    }
  }

  /** Envia texto pela Graph API, quebrando mensagens longas. No-op se desligado. */
  private async sendText(to: string, body: string): Promise<void> {
    if (!this.enabled || !body) return;
    for (const chunk of this.splitMessage(body)) {
      try {
        const res = await fetch(`${this.apiUrl}/${this.phoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: chunk },
          }),
        });
        if (!res.ok) {
          // Não logamos o corpo (pode conter dados) — só status para diagnóstico.
          this.logger.warn(
            `Envio WhatsApp falhou (${res.status}) para ${this.maskPhone(to)}.`,
          );
        }
      } catch (err) {
        this.logger.warn(`Erro de rede ao enviar WhatsApp: ${String(err)}`);
      }
    }
  }

  private extractTextMessages(payload: unknown): IncomingText[] {
    const out: IncomingText[] = [];
    const p = payload as {
      entry?: Array<{ changes?: Array<{ value?: { messages?: IncomingText[] } }> }>;
    };
    if (!Array.isArray(p?.entry)) return out;
    for (const entry of p.entry) {
      if (!Array.isArray(entry?.changes)) continue;
      for (const change of entry.changes) {
        const msgs = change?.value?.messages;
        if (!Array.isArray(msgs)) continue; // ignora status de entrega e outros eventos
        for (const m of msgs) {
          if (m && typeof m.from === 'string' && typeof m.id === 'string') {
            out.push(m);
          }
        }
      }
    }
    return out;
  }

  private splitMessage(body: string): string[] {
    if (body.length <= WHATSAPP_TEXT_LIMIT) return [body];
    const chunks: string[] = [];
    let rest = body;
    while (rest.length > WHATSAPP_TEXT_LIMIT) {
      // Quebra preferencialmente numa troca de linha próxima do limite.
      let cut = rest.lastIndexOf('\n', WHATSAPP_TEXT_LIMIT);
      if (cut < WHATSAPP_TEXT_LIMIT * 0.5) cut = WHATSAPP_TEXT_LIMIT;
      chunks.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
    if (rest) chunks.push(rest);
    return chunks;
  }

  private alreadyProcessed(id: string): boolean {
    const exp = this.processed.get(id);
    return exp !== undefined && exp > Date.now();
  }

  private markProcessed(id: string): void {
    const now = Date.now();
    for (const [k, exp] of this.processed) {
      if (exp <= now) this.processed.delete(k);
    }
    while (this.processed.size >= MAX_PROCESSED) {
      const oldest = this.processed.keys().next().value;
      if (oldest === undefined) break;
      this.processed.delete(oldest);
    }
    this.processed.set(id, now + PROCESSED_TTL_MS);
  }

  /** Não logar telefone completo (LGPD). */
  private maskPhone(phone: string): string {
    if (phone.length <= 4) return '****';
    return `****${phone.slice(-4)}`;
  }
}
