import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Cron simples (setInterval) que expira holds de reservas públicas.
 *
 * Quando alguém clica "reservar" na página pública, criamos uma Reservation
 * PENDING com `holdExpiresAt = now + 30min` e geramos Pix. Se o usuário
 * fechar a aba sem pagar, esta tarefa cancela a reserva — liberando o quarto.
 *
 * Para MVP single-instance, `setInterval` basta. Em produção multi-instância,
 * usar BullMQ com lock distribuído para evitar duplicação.
 */
@Injectable()
export class HoldExpirationService implements OnModuleInit {
  private readonly logger = new Logger(HoldExpirationService.name);
  private interval: NodeJS.Timeout | null = null;
  // 10 min (era 1 min). Holds públicos duram 48h — não há pressa. Rodar de
  // hora em hora manteria o Neon sempre aceso; a cada 10 min ele consegue
  // suspender nos intervalos sem uso, poupando a cota de computação.
  // Ajustável por HOLD_SWEEP_MINUTES sem deploy.
  private readonly INTERVAL_MS =
    Number(process.env.HOLD_SWEEP_MINUTES ?? 10) * 60_000;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return; // não roda em testes
    this.interval = setInterval(() => {
      this.cleanExpiredHolds().catch((err) =>
        this.logger.error(`Erro ao expirar holds: ${err.message}`),
      );
    }, this.INTERVAL_MS);
    // Roda uma vez ao iniciar
    setTimeout(() => this.cleanExpiredHolds().catch(() => {}), 5000);
    this.logger.log(`⏰ Hold expiration cron iniciado (intervalo ${this.INTERVAL_MS}ms)`);
  }

  async cleanExpiredHolds() {
    const now = new Date();

    const expired = await this.prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        holdExpiresAt: { lt: now },
        // Não cancela se já recebeu algum pagamento (caso de borda raro)
        paidAmount: { lte: 0 },
      },
      select: { id: true, code: true, propertyId: true },
    });

    if (expired.length === 0) return;

    this.logger.log(`Cancelando ${expired.length} reserva(s) com hold expirado`);

    for (const r of expired) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.reservation.update({
            where: { id: r.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: now,
              cancellationReason: 'HOLD_EXPIRED',
            },
          });
          await tx.auditLog.create({
            data: {
              propertyId: r.propertyId,
              action: 'reservation.hold_expired',
              entityType: 'Reservation',
              entityId: r.id,
            },
          });
        });
        this.logger.log(`  Hold expirado cancelado: ${r.code}`);
      } catch (err: any) {
        this.logger.error(`Falha ao cancelar ${r.code}: ${err.message}`);
      }
    }
  }
}
