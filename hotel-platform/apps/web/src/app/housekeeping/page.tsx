'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button, KpiCard, EmptyState } from '@/components/ui/primitives';
import { StatusPill } from '@/components/ui/status-pill';
import {
  useCleaningTasks,
  useHousekeepingDashboard,
  useApproveCleaning,
  useRejectCleaning,
  type CleaningTask,
} from '@/lib/hooks';
import { ApiError } from '@/lib/api-client';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

type FilterTab = 'open' | 'pending' | 'inProgress' | 'awaitingInspection' | 'completed';

const TABS: Array<{ key: FilterTab; label: string; status: string }> = [
  { key: 'open', label: 'Abertas', status: 'PENDING,IN_PROGRESS,AWAITING_INSPECTION' },
  { key: 'pending', label: 'Pendentes', status: 'PENDING' },
  { key: 'inProgress', label: 'Em limpeza', status: 'IN_PROGRESS' },
  { key: 'awaitingInspection', label: 'Inspeção', status: 'AWAITING_INSPECTION' },
  { key: 'completed', label: 'Concluídas', status: 'COMPLETED' },
];

export default function HousekeepingPage() {
  const [tab, setTab] = useState<FilterTab>('open');
  const [error, setError] = useState<string | null>(null);
  const currentTab = TABS.find((t) => t.key === tab)!;

  const { data: dash } = useHousekeepingDashboard();
  const { data: tasks, isLoading } = useCleaningTasks({ status: currentTab.status });

  return (
    <AppShell>
      <PageHeader title="Housekeeping" subtitle="Painel da governanta" />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-6xl space-y-5">
        {/* KPIs */}
        {dash && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KpiCard label="Pendentes" value={dash.pending} />
            <KpiCard label="Em limpeza" value={dash.inProgress} />
            <KpiCard label="Inspeção" value={dash.awaitingInspection} />
            <KpiCard label="Concluídas hoje" value={dash.completedToday} highlight />
            <KpiCard
              label="Tempo médio"
              value={dash.avgDurationMinutes ? `${dash.avgDurationMinutes} min` : '—'}
              className="col-span-2 md:col-span-1"
            />
          </div>
        )}

        {/* Alerta: limpezas pendentes há mais de 24h (a governanta também
            recebe por e-mail). */}
        {dash && dash.overdue.count > 0 && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-600 text-xl leading-none mt-0.5" aria-hidden="true">
                ⚠️
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-amber-900">
                  {dash.overdue.count} limpeza{dash.overdue.count > 1 ? 's' : ''} pendente
                  {dash.overdue.count > 1 ? 's' : ''} há mais de 24h
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  {dash.overdue.rooms
                    .map((r) => `Quarto ${r.number} (${r.hours}h)`)
                    .join(' · ')}
                  {dash.overdue.count > dash.overdue.rooms.length ? ' · …' : ''}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Tabs — scroll horizontal em mobile */}
        <div className="border-b border-sand-200 -mx-5 md:mx-0 px-5 md:px-0">
          <nav className="flex gap-1 md:gap-6 overflow-x-auto hide-scroll">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'pb-2 px-1 md:px-0 text-sm font-medium border-b-2 transition-colors whitespace-nowrap min-h-touch-sm',
                  tab === t.key
                    ? 'border-teal-700 text-teal-700'
                    : 'border-transparent text-ink-500 hover:text-ink-950',
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Lista */}
        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : (tasks ?? []).length === 0 ? (
          <EmptyState
            icon="🧹"
            title="Nenhuma tarefa nesta categoria"
            description="As tarefas vão aparecer aqui conforme a operação evolui."
          />
        ) : (
          <div className="space-y-2">
            {(tasks ?? []).map((task) => (
              <TaskRow key={task.id} task={task} onError={setError} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function TaskRow({
  task,
  onError,
}: {
  task: CleaningTask;
  onError: (e: string | null) => void;
}) {
  const approve = useApproveCleaning();
  const reject = useRejectCleaning();

  async function run<T>(fn: () => Promise<T>) {
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro');
    }
  }

  return (
    <Card padding="default">
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="font-serif-display text-lg text-ink-950">
              Quarto {task.room.number}
              <span className="text-xs text-ink-500 font-sans ml-2">{task.room.roomType.name}</span>
            </div>
            <StatusPill status={task.status} />
            <span className="text-xs text-ink-300">{task.type}</span>
            {task.priority > 0 && (
              <span className="text-xs bg-red-50 text-red-700 px-2 py-0.5 rounded">⚡ {task.priority}</span>
            )}
          </div>

          <div className="mt-2 text-xs text-ink-500 flex gap-4 flex-wrap">
            <span>Criada {fmtDateTime(task.createdAt)}</span>
            {task.assignedTo && (
              <span>Feito por: <span className="text-ink-700">{task.assignedTo.name}</span></span>
            )}
            {task.durationMinutes != null && <span>Tempo: {task.durationMinutes} min</span>}
          </div>

          {task.issuesReported && (
            <div className="mt-2 bg-gold-50 border border-gold-100 rounded-lg p-2 text-xs text-gold-700 whitespace-pre-line">
              ⚠ {task.issuesReported}
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 shrink-0">
          {task.status === 'AWAITING_INSPECTION' && (
            <>
              <Button
                size="sm"
                className="bg-teal-500 hover:bg-teal-700"
                onClick={() => run(() => approve.mutateAsync(task.id))}
              >
                ✓ Aprovar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const reason = prompt('Motivo:');
                  if (reason) run(() => reject.mutateAsync({ taskId: task.id, reason }));
                }}
              >
                ✕ Refazer
              </Button>
            </>
          )}
        </div>
      </div>

    </Card>
  );
}
