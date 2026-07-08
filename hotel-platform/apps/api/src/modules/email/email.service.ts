import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Envio de e-mails transacionais via Resend (https://resend.com).
 *
 * DESLIGADO por padrão: sem RESEND_API_KEY configurado, os métodos apenas
 * registram log e retornam — não quebram nada. Mesmo padrão do Asaas.
 *
 * REGRA DE OURO: nenhum método aqui pode lançar exceção para o chamador.
 * O envio é sempre "dispara e esquece" após a reserva já estar gravada, então
 * uma falha de e-mail NUNCA pode derrubar a criação da reserva.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey: string;
  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY', '');
    this.from = this.config.get<string>(
      'EMAIL_FROM',
      'Solar Irará Hotel <onboarding@resend.dev>',
    );
    if (!this.apiKey) {
      this.logger.warn(
        '⚠️  RESEND_API_KEY não configurado — e-mails NÃO serão enviados (apenas log).',
      );
    }
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * Envio bruto. Retorna true/false; nunca lança.
   */
  private async send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<boolean> {
    if (!this.enabled) {
      this.logger.log(`[e-mail desligado] Para: ${params.to} — ${params.subject}`);
      return false;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Falha ao enviar e-mail para ${params.to} (HTTP ${res.status}): ${body}`,
        );
        return false;
      }
      this.logger.log(`E-mail enviado para ${params.to} — ${params.subject}`);
      return true;
    } catch (err) {
      this.logger.error(
        `Erro ao enviar e-mail para ${params.to}: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * "Recebemos sua solicitação de reserva" — enviado ao hóspede logo após a
   * criação da reserva pública (que é uma SOLICITAÇÃO pendente, sem pagamento
   * online). Carrega os dados da reserva internamente; se algo faltar, apenas
   * loga e retorna.
   */
  async sendReservationReceived(reservationIds: string[]): Promise<void> {
    try {
      if (!reservationIds.length) return;

      const rs = await this.prisma.reservation.findMany({
        where: { id: { in: reservationIds } },
        orderBy: { code: 'asc' },
        select: {
          code: true,
          checkInDate: true,
          checkOutDate: true,
          nights: true,
          adults: true,
          children: true,
          totalAmount: true,
          primaryGuest: { select: { fullName: true, email: true } },
          roomType: { select: { name: true } },
          property: {
            select: {
              name: true,
              phone: true,
              email: true,
              addressCity: true,
              addressState: true,
              primaryColor: true,
            },
          },
        },
      });

      const first = rs[0];
      const to = first?.primaryGuest?.email;
      if (!first || !to) {
        this.logger.log(
          `Reservas [${reservationIds.join(', ')}] sem e-mail de hóspede — pulei o envio.`,
        );
        return;
      }

      const rooms = rs.length;
      const grandTotal = rs.reduce((s, r) => s + Number(r.totalAmount), 0);

      const html = reservationReceivedTemplate({
        guestName: first.primaryGuest?.fullName ?? 'hóspede',
        propertyName: first.property.name,
        propertyPhone: first.property.phone,
        propertyEmail: first.property.email,
        city: first.property.addressCity,
        state: first.property.addressState,
        color: first.property.primaryColor ?? '#9E4620',
        codes: rs.map((r) => r.code),
        rooms,
        checkIn: fmtDate(first.checkInDate),
        checkOut: fmtDate(first.checkOutDate),
        nights: first.nights,
        guests: first.adults + first.children,
        roomType: first.roomType.name,
        total: grandTotal,
      });

      const subject =
        rooms > 1
          ? `Recebemos sua solicitação de ${rooms} quartos — ${first.property.name}`
          : `Recebemos sua solicitação de reserva — ${first.property.name} (${first.code})`;

      await this.send({ to, subject, html });
    } catch (err) {
      // Blindagem final: qualquer erro aqui é engolido.
      this.logger.error(
        `sendReservationReceived falhou para [${reservationIds.join(', ')}]: ${(err as Error).message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(d: Date): string {
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function reservationReceivedTemplate(d: {
  guestName: string;
  propertyName: string;
  propertyPhone: string | null;
  propertyEmail: string | null;
  city: string | null;
  state: string | null;
  color: string;
  codes: string[];
  rooms: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  roomType: string;
  total: number;
}): string {
  const multi = d.rooms > 1;
  const contato = [
    d.propertyPhone ? `Telefone: ${d.propertyPhone}` : null,
    d.propertyEmail ? `E-mail: ${d.propertyEmail}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const local = [d.city, d.state].filter(Boolean).join(' - ');

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:6px 0;color:#6b7280;font-size:14px;">${label}</td>
      <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;">${value}</td>
    </tr>`;

  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ee;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fffdf8;border:1px solid #e7e1d5;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:${d.color};padding:24px 28px;">
          <div style="color:#fffdf8;font-size:20px;font-weight:700;letter-spacing:.3px;">${d.propertyName}</div>
          ${local ? `<div style="color:rgba(255,253,248,.8);font-size:13px;margin-top:2px;">${local}</div>` : ''}
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#111827;font-size:16px;">Olá, ${d.guestName}!</p>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.5;">
            Recebemos a sua <strong>solicitação de reserva${multi ? ` de ${d.rooms} quartos` : ''}</strong>.
            Veja abaixo os detalhes. Em breve nossa recepção entrará em contato para
            <strong>confirmar a disponibilidade e combinar o pagamento</strong>.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e7e1d5;border-bottom:1px solid #e7e1d5;margin-bottom:20px;">
            ${row(multi ? 'Códigos' : 'Código', d.codes.join(', '))}
            ${row('Acomodação', multi ? `${d.rooms} × ${d.roomType}` : d.roomType)}
            ${row('Check-in', d.checkIn)}
            ${row('Check-out', d.checkOut)}
            ${row('Noites', String(d.nights))}
            ${row(multi ? 'Hóspedes por quarto' : 'Hóspedes', String(d.guests))}
            ${row(multi ? `Total (${d.rooms} quartos)` : 'Total das diárias', fmtBRL(d.total))}
          </table>
          <p style="margin:0 0 4px;color:#6b7280;font-size:13px;line-height:1.5;">
            Esta mensagem confirma apenas o <strong>recebimento</strong> do pedido. A reserva só
            está garantida após a confirmação da recepção.
          </p>
          ${contato ? `<p style="margin:16px 0 0;color:#374151;font-size:13px;">Dúvidas? ${contato}</p>` : ''}
        </td></tr>
        <tr><td style="background:#faf8f2;padding:16px 28px;color:#9ca3af;font-size:12px;text-align:center;">
          ${d.propertyName}${local ? ` · ${local}` : ''}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
