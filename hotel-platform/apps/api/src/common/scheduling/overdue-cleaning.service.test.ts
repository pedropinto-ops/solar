import { describe, it, expect } from 'vitest';
import { OverdueCleaningService } from './overdue-cleaning.service.js';

const OLD = new Date('2026-07-14T00:00:00.000Z'); // bem no passado (>24h)

function makeFakes(opts: {
  tasks?: any[];
  supervisors?: any[];
  emailEnabled?: boolean;
  emailResult?: boolean;
}) {
  const sends: any[] = [];
  const updates: any[] = [];
  const tasks =
    opts.tasks ??
    [
      { id: 't1', propertyId: 'p1', type: 'CHECKOUT', createdAt: OLD, room: { number: '101' } },
      { id: 't2', propertyId: 'p1', type: 'DAILY', createdAt: OLD, room: { number: '102' } },
    ];
  const prisma: any = {
    cleaningTask: {
      findMany: async () => tasks,
      updateMany: async (args: any) => {
        updates.push(args.where.id.in);
        return { count: args.where.id.in.length };
      },
    },
    user: { findMany: async () => opts.supervisors ?? [{ email: 'governanta@hotel.com' }] },
    property: {
      findUnique: async () => ({ name: 'Solar Irará', primaryColor: '#9E4620' }),
    },
  };
  const email: any = {
    enabled: opts.emailEnabled ?? true,
    sendOverdueCleaningAlert: async (p: any) => {
      sends.push(p);
      return opts.emailResult ?? true;
    },
  };
  return { prisma, email, sends, updates };
}

describe('OverdueCleaningService — aviso de limpeza atrasada', () => {
  it('envia à governanta e marca as tarefas como notificadas', async () => {
    const { prisma, email, sends, updates } = makeFakes({});
    const svc = new OverdueCleaningService(prisma, email);
    await svc.checkOverdueCleanings();

    expect(sends).toHaveLength(1); // 1 governanta
    expect(sends[0].to).toBe('governanta@hotel.com');
    expect(sends[0].tasks).toHaveLength(2); // 2 quartos atrasados
    expect(sends[0].tasks[0].roomNumber).toBe('101');
    expect(updates).toEqual([['t1', 't2']]); // ambas marcadas
  });

  it('NÃO marca quando o e-mail falha (tenta de novo na próxima rodada)', async () => {
    const { prisma, email, updates } = makeFakes({ emailResult: false });
    const svc = new OverdueCleaningService(prisma, email);
    await svc.checkOverdueCleanings();
    expect(updates).toHaveLength(0); // nada marcado
  });

  it('com e-mail DESLIGADO, marca mesmo assim (painel cobre) e não tenta enviar', async () => {
    const { prisma, email, sends, updates } = makeFakes({ emailEnabled: false });
    const svc = new OverdueCleaningService(prisma, email);
    await svc.checkOverdueCleanings();
    expect(sends).toHaveLength(0);
    expect(updates).toEqual([['t1', 't2']]);
  });

  it('sem tarefas atrasadas, não faz nada', async () => {
    const { prisma, email, sends, updates } = makeFakes({ tasks: [] });
    const svc = new OverdueCleaningService(prisma, email);
    await svc.checkOverdueCleanings();
    expect(sends).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });
});
