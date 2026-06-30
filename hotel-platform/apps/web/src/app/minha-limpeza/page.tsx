'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button, EmptyState } from '@/components/ui/primitives';
import { StatusPill } from '@/components/ui/status-pill';
import { Sheet } from '@/components/ui/sheet';
import {
  useMyCleaningTasks,
  useStartCleaning,
  useCompleteCleaning,
  useReportCleaningIssue,
  type CleaningTask,
} from '@/lib/hooks';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function MyCleaningPage() {
  const { data: tasks, isLoading } = useMyCleaningTasks();
  const [error, setError] = useState<string | null>(null);

  const pending = (tasks ?? []).filter((t) => t.status === 'PENDING' || t.status === 'REJECTED');
  const inProgress = (tasks ?? []).filter((t) => t.status === 'IN_PROGRESS');
  const awaiting = (tasks ?? []).filter((t) => t.status === 'AWAITING_INSPECTION');

  return (
    <AppShell>
      <PageHeader
        title="Minha limpeza"
        subtitle={
          tasks
            ? `${tasks.length} tarefa${tasks.length !== 1 ? 's' : ''} atribuída${tasks.length !== 1 ? 's' : ''}`
            : undefined
        }
      />

      <div className="max-w-md md:max-w-2xl mx-auto px-5 py-5 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-ink-300 text-sm py-10 text-center">Carregando…</div>
        ) : (tasks ?? []).length === 0 ? (
          <EmptyState
            icon="🎉"
            title="Nenhuma tarefa pendente"
            description="Bom trabalho. Aproveite o descanso."
          />
        ) : (
          <>
            {inProgress.length > 0 && (
              <Section title="🧹 Em andamento" tasks={inProgress} onError={setError} />
            )}
            {pending.length > 0 && (
              <Section title="🔔 Pendentes" tasks={pending} onError={setError} />
            )}
            {awaiting.length > 0 && (
              <Section title="⏳ Aguardando inspeção" tasks={awaiting} onError={setError} />
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Section({
  title,
  tasks,
  onError,
}: {
  title: string;
  tasks: CleaningTask[];
  onError: (e: string | null) => void;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-ink-700 mb-2">{title}</h2>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onError={onError} />
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  task,
  onError,
}: {
  task: CleaningTask;
  onError: (e: string | null) => void;
}) {
  const startMutation = useStartCleaning();
  const completeMutation = useCompleteCleaning();
  const issueMutation = useReportCleaningIssue();
  const [showIssue, setShowIssue] = useState(false);
  const [issueText, setIssueText] = useState('');

  async function run<T>(fn: () => Promise<T>) {
    onError(null);
    try {
      await fn();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro');
    }
  }

  async function submitIssue() {
    if (!issueText.trim()) return;
    await run(() => issueMutation.mutateAsync({ taskId: task.id, description: issueText.trim() }));
    setIssueText('');
    setShowIssue(false);
  }

  const isUrgent = task.priority > 50;

  return (
    <>
      <Card padding="none" className={cn('border-l-4 overflow-hidden', isUrgent ? 'border-l-red-500' : 'border-l-teal-500')}>
        <div className="p-5">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="font-serif-display text-3xl text-ink-950 nums">
                {task.room.number}
              </div>
              <div className="text-xs text-ink-500 mt-0.5">{task.room.roomType.name}</div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusPill status={task.status} size="md" />
              <span className="text-xs text-ink-300">{task.type}</span>
            </div>
          </div>

          {isUrgent && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-800 mb-3">
              ⚡ <strong>URGENTE</strong> — próxima chegada em breve
            </div>
          )}

          {task.issuesReported && (
            <div className="bg-gold-50 border border-gold-100 rounded-lg p-2.5 text-xs text-gold-700 whitespace-pre-line mb-3">
              {task.issuesReported}
            </div>
          )}

          {task.notes && (
            <div className="bg-sand-50 rounded-lg p-2.5 text-xs text-ink-700 mb-3">
              <strong>Nota:</strong> {task.notes}
            </div>
          )}

          <div className="flex flex-col gap-2 mt-4">
            {(task.status === 'PENDING' || task.status === 'REJECTED') && (
              <Button
                fullWidth
                size="lg"
                onClick={() => run(() => startMutation.mutateAsync(task.id))}
              >
                ▶ Iniciar limpeza
              </Button>
            )}

            {task.status === 'IN_PROGRESS' && (
              <>
                <Button
                  fullWidth
                  size="lg"
                  className="bg-teal-500 hover:bg-teal-700"
                  onClick={() => run(() => completeMutation.mutateAsync(task.id))}
                >
                  ✓ Concluir limpeza
                </Button>
                <Button
                  fullWidth
                  size="md"
                  variant="secondary"
                  onClick={() => setShowIssue(true)}
                >
                  ⚠ Reportar problema
                </Button>
              </>
            )}

            {task.status === 'AWAITING_INSPECTION' && (
              <div className="bg-sand-50 rounded-lg p-3 text-xs text-ink-500 text-center">
                Aguardando inspeção da governanta…
              </div>
            )}
          </div>
        </div>
      </Card>

      <Sheet
        open={showIssue}
        onClose={() => {
          setShowIssue(false);
          setIssueText('');
        }}
        title="Reportar problema"
      >
        <div className="space-y-3">
          <textarea
            value={issueText}
            onChange={(e) => setIssueText(e.target.value)}
            placeholder="Descreva o problema (ex: chuveiro vazando, objeto esquecido...)"
            rows={4}
            className="w-full text-sm rounded-lg border border-sand-200 px-3 py-2 bg-cream"
            autoFocus
          />
          <Button
            fullWidth
            size="lg"
            variant="gold"
            onClick={submitIssue}
            disabled={!issueText.trim() || issueMutation.isPending}
          >
            Enviar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
