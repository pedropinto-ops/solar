'use client';

import { useState } from 'react';
import { AppShell, Icon } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, EmptyState } from '@/components/ui/primitives';
import { Tag } from '@/components/ui/status-pill';
import { Avatar } from '@/components/ui/avatar';
import { useGuests, type Guest } from '@/lib/hooks';

export default function GuestsPage() {
  const [q, setQ] = useState('');
  const { data: guests, isLoading } = useGuests(q);

  return (
    <AppShell>
      <PageHeader
        title="Hóspedes"
        subtitle={guests ? `${guests.length} cadastrado${guests.length !== 1 ? 's' : ''}` : undefined}
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-6xl space-y-5">
        {/* Busca */}
        <div className="relative">
          <Icon
            name="users"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300 pointer-events-none"
          />
          <input
            type="search"
            placeholder="Buscar por nome, CPF, e-mail ou telefone..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full pl-10 pr-4 rounded-lg bg-cream border border-sand-200 outline-none text-sm focus:border-teal-500 min-h-touch-md"
          />
        </div>

        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : !guests || guests.length === 0 ? (
          <EmptyState
            icon="👤"
            title={q ? 'Nenhum hóspede encontrado' : 'Sem hóspedes cadastrados'}
            description={q ? `Nenhum resultado para "${q}".` : 'Os hóspedes aparecerão aqui quando você criar reservas.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {guests.map((g) => <GuestCardMobile key={g.id} guest={g} />)}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden md:block rounded-xl overflow-hidden bg-cream border border-sand-200">
              <table className="w-full text-sm">
                <thead className="bg-sand-50">
                  <tr>
                    <Th>Nome</Th>
                    <Th>Documento</Th>
                    <Th>Contato</Th>
                    <Th>Tags</Th>
                    <Th>Empresa</Th>
                  </tr>
                </thead>
                <tbody>
                  {guests.map((g) => (
                    <tr key={g.id} className="border-t border-sand-100 hover:bg-sand-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={g.fullName} size="sm" />
                          <span className="font-medium text-ink-950">{g.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-ink-500">
                        {g.documentType} {g.documentNumber}
                      </td>
                      <td className="px-5 py-3 text-ink-500">
                        {g.email && <div className="text-xs">{g.email}</div>}
                        {g.phone && <div className="text-xs">{g.phone}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap gap-1">
                          {g.tags.map((t) => <Tag key={t}>{t}</Tag>)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-500">
                        {g.company?.tradeName ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function GuestCardMobile({ guest: g }: { guest: Guest }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Avatar name={g.fullName} size="md" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-ink-950 truncate">{g.fullName}</div>
          <div className="text-xs text-ink-500 mt-0.5 truncate">
            {g.documentType} {g.documentNumber}
          </div>
          {g.email && <div className="text-xs text-ink-500 mt-0.5 truncate">{g.email}</div>}
          {g.phone && <div className="text-xs text-ink-500 mt-0.5">{g.phone}</div>}
          {g.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {g.tags.map((t) => <Tag key={t}>{t}</Tag>)}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest text-ink-500">
      {children}
    </th>
  );
}
