import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { EmailService } from '../../modules/email/email.service.js';

/**
 * Cron (setInterval) que avisa a GOVERNANTA quando uma limpeza fica pendente
 * há mais de 24h. Roda de hora em hora + uma vez ao iniciar.
 *
 * Canal duplo:
 *  - PAINEL (garantido): a tela de governança mostra as atrasadas via consulta
 *    ao vivo (status=PENDING + createdAt antigo), sem depender deste cron.
 *  - E-MAIL (best-effort): este cron envia um resumo à governanta e marca cada
 *    tarefa em `overdueNotifiedAt` para NÃO avisar a mesma repetidamente.
 *
 * Marca como notificada quando o e-mail é entregue OU quando não há como enviar
 * agora (e-mail desligado / sem destinatário) — nesses casos o painel já cobre.
 * Se houver destinatário e o envio falhar, não marca: tenta de novo na próxima
 * rodada. Mesmo padrão single-instance do HoldExpirationService.
 */
@Injectable()
export class OverdueCleaningService implements OnModuleInit {
  private readonly logger = new Logger(OverdueCleaningService.name);
  private interval: NodeJS.Timeout | null = null;
  private readonly INTERVAL_MS = 60 * 60 * 1000; // 1h
  private readonly OVERDUE_HOURS = 24;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return; // não roda em testes
    this.interval = setInterval(() => {
      this.checkOverdueCleanings().catch((err) =>
        this.logger.error(`Erro ao checar limpezas atrasadas: ${err.message}`),
      );
    }, this.INTERVAL_MS);
    // Primeira passada ~10s após subir.
    setTimeout(() => this.checkOverdueCleanings().catch(() => {}), 10_000);
    this.logger.log('⏰ Cron de limpeza atrasada iniciado (intervalo 1h, limiar 24h)');
  }

  async checkOverdueCleanings() {
    const now = Date.now();
    const cutoff = new Date(now - this.OVERDUE_HOURS * 60 * 60 * 1000);

    const tasks = await this.prisma.cleaningTask.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: cutoff },
        overdueNotifiedAt: null,
      },
      select: {
        id: true,
        propertyId: true,
        type: true,
        createdAt: true,
        room: { select: { number: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) return;

    // Agrupa por propriedade (o modelo é multi-propriedade).
    const byProperty = new Map<string, typeof tasks>();
    for (const t of tasks) {
      const arr = byProperty.get(t.propertyId);
      if (arr) arr.push(t);
      else byProperty.set(t.propertyId, [t]);
    }

    for (const [propertyId, propTasks] of byProperty) {
      const [supervisors, property] = await Promise.all([
        this.prisma.user.findMany({
          where: { propertyId, active: true, role: 'HOUSEKEEPING_SUPERVISOR' },
          select: { email: true },
        }),
        this.prisma.property.findUnique({
          where: { id: propertyId },
          select: { name: true, primaryColor: true },
        }),
      ]);
      const recipients = supervisors.map((s) => s.email).filter(Boolean) as string[];

      const emailTasks = propTasks.map((t) => ({
        roomNumber: t.room?.number ?? '—',
        hoursPending: Math.floor((now - t.createdAt.getTime()) / (60 * 60 * 1000)),
        type: t.type,
      }));

      let delivered = false;
      const canSend = this.email.enabled && recipients.length > 0;
      if (canSend) {
        for (const to of recipients) {
          const ok = await this.email.sendOverdueCleaningAlert({
            to,
            propertyName: property?.name ?? 'Hotel',
            color: property?.primaryColor ?? undefined,
            tasks: emailTasks,
          });
          delivered = delivered || ok;
        }
      }

      // Marca como notificada se entregou, ou se não há como enviar agora
      // (painel cobre). Se havia destinatário e falhou, deixa p/ tentar de novo.
      if (delivered || !canSend) {
        await this.prisma.cleaningTask.updateMany({
          where: { id: { in: propTasks.map((t) => t.id) } },
          data: { overdueNotifiedAt: new Date() },
        });
      }

      this.logger.log(
        `Limpezas atrasadas (${propTasks.length}) na propriedade ${propertyId} — ` +
          `governanta(s): ${recipients.length}, e-mail entregue: ${delivered}`,
      );
    }
  }
}
