'use client';

import { useRef } from 'react';
import { AppShell } from '@/components/app-shell';
import { useRoomBoard, type RoomBoard, type RoomBoardState } from '@/lib/hooks';
import { fmtDate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Room = RoomBoard['rooms'][number];

const STATE_LABEL: Record<RoomBoardState, string> = {
  OCCUPIED: 'Ocupado',
  DEPARTING: 'Sai hoje',
  ARRIVING: 'Chega hoje',
  FREE: 'Livre',
  CLEANING: 'Limpeza',
  BLOCKED: 'Bloqueado',
};

/** Cor do tile por estado. Ocupado é o mais destacado (foco do painel). */
const STATE_TILE: Record<RoomBoardState, string> = {
  OCCUPIED: 'bg-teal-900 text-cream border-teal-900',
  DEPARTING: 'bg-amber-500 text-ink-950 border-amber-500',
  ARRIVING: 'bg-sky-600 text-cream border-sky-600',
  FREE: 'bg-emerald-50 text-emerald-800 border-emerald-300',
  CLEANING: 'bg-amber-50 text-amber-800 border-amber-300',
  BLOCKED: 'bg-ink-100 text-ink-500 border-ink-200',
};

const STATE_DOT: Record<RoomBoardState, string> = {
  OCCUPIED: 'bg-teal-900',
  DEPARTING: 'bg-amber-500',
  ARRIVING: 'bg-sky-600',
  FREE: 'bg-emerald-500',
  CLEANING: 'bg-amber-400',
  BLOCKED: 'bg-ink-300',
};

export default function PainelPage() {
  const { data, isLoading, error, dataUpdatedAt } = useRoomBoard();
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  return (
    <AppShell>
      <div ref={containerRef} className="bg-sand-50 min-h-full">
        {/* Cabeçalho + resumo */}
        <div className="sticky top-0 z-10 bg-cream border-b border-sand-200 px-5 md:px-8 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-serif-display text-2xl text-ink-950">Painel de quartos</h1>
              <p className="text-xs text-ink-500">
                Atualização automática ·{' '}
                {dataUpdatedAt
                  ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '—'}
              </p>
            </div>
            <button
              onClick={toggleFullscreen}
              className="rounded-lg border border-sand-200 bg-cream px-3 py-2 text-sm text-ink-700 hover:border-teal-700"
            >
              ⛶ Tela cheia
            </button>
          </div>

          {data && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Stat label="Ocupados" value={data.summary.occupied} state="OCCUPIED" />
              <Stat label="Livres" value={data.summary.free} state="FREE" />
              <Stat label="Saídas hoje" value={data.summary.departingToday} state="DEPARTING" />
              <Stat label="Chegadas hoje" value={data.summary.arrivingToday} state="ARRIVING" />
              <Stat label="Limpeza" value={data.summary.cleaning} state="CLEANING" />
              <Stat label="Bloqueados" value={data.summary.blocked} state="BLOCKED" />
            </div>
          )}
        </div>

        <div className="px-5 md:px-8 py-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              Não foi possível carregar o painel.
            </div>
          )}
          {isLoading && <div className="text-sm text-ink-500">Carregando…</div>}

          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {data.rooms.map((room) => (
                <RoomTile key={room.id} room={room} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  label,
  value,
  state,
}: {
  label: string;
  value: number;
  state: RoomBoardState;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full bg-cream border border-sand-200 pl-2 pr-3 py-1">
      <span className={cn('w-2.5 h-2.5 rounded-full', STATE_DOT[state])} />
      <span className="text-lg font-semibold text-ink-950 tabular-nums">{value}</span>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}

function RoomTile({ room }: { room: Room }) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-3 min-h-[104px] flex flex-col justify-between',
        STATE_TILE[room.state],
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="leading-tight">
          <div className="text-2xl font-bold tabular-nums">{room.number}</div>
          {room.name && <div className="text-xs opacity-80 truncate">{room.name}</div>}
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-90 whitespace-nowrap">
          {STATE_LABEL[room.state]}
        </span>
      </div>

      <div className="text-xs mt-2 leading-snug">
        {room.occupant ? (
          <>
            <div className="font-medium truncate">{room.occupant.guestName}</div>
            <div className="opacity-80">
              {room.occupant.departingToday
                ? 'Saída hoje'
                : `Sai ${fmtDate(room.occupant.checkOutDate)}`}{' '}
              · {room.occupant.guests} pax
            </div>
          </>
        ) : room.arrivalGuest ? (
          <div className="opacity-90 truncate">Reserva: {room.arrivalGuest}</div>
        ) : (
          <div className="opacity-70">{room.roomType}</div>
        )}
      </div>
    </div>
  );
}
