'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button, EmptyState } from '@/components/ui/primitives';
import { Tag } from '@/components/ui/status-pill';
import { Sheet } from '@/components/ui/sheet';
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  useUsersManagement,
  useCreateUser,
  useUpdateUser,
  useResetPassword,
  type ManagedUser,
} from '@/lib/hooks';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  MANAGER: 'Gerência',
  RECEPTION: 'Recepção',
  HOUSEKEEPING_SUPERVISOR: 'Governanta',
  HOUSEKEEPER: 'Camareira',
  READONLY: 'Somente leitura',
};

const ALL_ROLES = ['ADMIN', 'MANAGER', 'RECEPTION', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER'];

/** Cargos que o usuário logado pode atribuir (anti-escalonamento). */
function assignableRoles(actorRole: string | undefined): string[] {
  if (actorRole === 'ADMIN') return ALL_ROLES;
  if (actorRole === 'MANAGER')
    return ['RECEPTION', 'HOUSEKEEPING_SUPERVISOR', 'HOUSEKEEPER'];
  return [];
}

export default function UsuariosPage() {
  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: () =>
      apiFetch<{ user: { userId: string; role: string; email: string | null; username: string | null } }>(
        '/auth/me',
      ),
  });
  const actorRole = me?.user.role;
  const { data: users, isLoading } = useUsersManagement();

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);

  return (
    <AppShell>
      <PageHeader
        title="Usuários"
        subtitle={users ? `${users.length} no total` : undefined}
        actions={
          assignableRoles(actorRole).length > 0 ? (
            <Button onClick={() => setCreating(true)}>Novo funcionário</Button>
          ) : undefined
        }
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-5">
        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : !users || users.length === 0 ? (
          <EmptyState icon="👥" title="Sem usuários" description="Cadastre o primeiro funcionário." />
        ) : (
          <>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {users.map((u) => (
                <UserCardMobile key={u.id} user={u} onEdit={() => setEditing(u)} />
              ))}
            </div>
            {/* Desktop */}
            <div className="hidden md:block rounded-xl overflow-hidden bg-cream border border-sand-200">
              <table className="w-full text-sm">
                <thead className="bg-sand-50">
                  <tr>
                    <Th>Nome</Th>
                    <Th>Login</Th>
                    <Th>Cargo</Th>
                    <Th>Situação</Th>
                    <Th>Último acesso</Th>
                    <Th> </Th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-sand-100 hover:bg-sand-50">
                      <td className="px-5 py-3 font-medium text-ink-950">{u.name}</td>
                      <td className="px-5 py-3 text-xs">
                        <div className="text-ink-950">{u.username ?? '—'}</div>
                        {u.email && <div className="text-ink-400">{u.email}</div>}
                      </td>
                      <td className="px-5 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                      <td className="px-5 py-3">
                        {u.active ? <Tag>Ativo</Tag> : <span className="text-xs text-ink-300">Inativo</span>}
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-500">{fmtDate(u.lastLoginAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(u)}>
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {creating && (
        <CreateUserSheet actorRole={actorRole} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <EditUserSheet
          user={editing}
          actorRole={actorRole}
          currentUserId={me?.user.userId}
          onClose={() => setEditing(null)}
        />
      )}
    </AppShell>
  );
}

function CreateUserSheet({
  actorRole,
  onClose,
}: {
  actorRole: string | undefined;
  onClose: () => void;
}) {
  const create = useCreateUser();
  const roles = assignableRoles(actorRole);
  const [form, setForm] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    role: roles[0] ?? 'RECEPTION',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({
        name: form.name,
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone || undefined,
        role: form.role,
        password: form.password,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar usuário');
    }
  }

  return (
    <Sheet open onClose={onClose} title="Novo funcionário" maxWidth="md">
      <div className="space-y-3">
        {error && <ErrorBox msg={error} />}
        <Field label="Nome completo">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Usuário (login)">
          <input
            className={inputCls}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="ex.: joana.recepcao"
            autoCapitalize="none"
          />
          <p className="text-xs text-ink-500 mt-1">Com o que a pessoa vai entrar no sistema (letras, números, ponto, hífen ou _).</p>
        </Field>
        <Field label="E-mail (opcional)">
          <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone (opcional)">
          <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Cargo">
          <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            {roles.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </Field>
        <Field label="Senha provisória (mín. 8 caracteres)">
          <input className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <p className="text-xs text-ink-500 mt-1">Passe esta senha ao funcionário. Ele pode usá-la para entrar.</p>
        </Field>
        <div className="flex gap-2 pt-2">
          <Button fullWidth onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'Criando…' : 'Criar'}
          </Button>
          <Button fullWidth variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </Sheet>
  );
}

function EditUserSheet({
  user,
  actorRole,
  currentUserId,
  onClose,
}: {
  user: ManagedUser;
  actorRole: string | undefined;
  currentUserId: string | undefined;
  onClose: () => void;
}) {
  const update = useUpdateUser();
  const reset = useResetPassword();
  const roles = assignableRoles(actorRole);
  const isSelf = currentUserId === user.id;
  const [form, setForm] = useState({
    name: user.name,
    username: user.username ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
    role: user.role,
    active: user.active,
  });
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save() {
    setError(null); setOk(null);
    try {
      await update.mutateAsync({
        id: user.id,
        name: form.name,
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone,
        role: form.role,
        active: form.active,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    }
  }

  async function doReset() {
    setError(null); setOk(null);
    try {
      await reset.mutateAsync({ id: user.id, password: newPassword });
      setNewPassword('');
      setOk('Senha redefinida. Passe a nova senha ao funcionário.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao redefinir senha');
    }
  }

  // Só oferece cargos que o ator pode atribuir; mantém o atual se fora da lista.
  const roleOptions = roles.includes(user.role) ? roles : [user.role, ...roles];

  return (
    <Sheet open onClose={onClose} title={`Editar — ${user.name}`} maxWidth="md">
      <div className="space-y-3">
        {error && <ErrorBox msg={error} />}
        {ok && <div className="bg-teal-50 border border-teal-200 text-teal-900 text-sm rounded-lg p-3">{ok}</div>}
        <Field label="Nome completo">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Usuário (login)">
          <input
            className={inputCls}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            autoCapitalize="none"
          />
        </Field>
        <Field label="E-mail (opcional)">
          <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="Telefone">
          <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Cargo">
          <select
            className={inputCls}
            value={form.role}
            disabled={isSelf}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roleOptions.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
          {isSelf && <p className="text-xs text-ink-500 mt-1">Você não pode alterar o próprio cargo.</p>}
        </Field>
        <Field label="Situação">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              disabled={isSelf}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            {form.active ? 'Ativo (pode entrar)' : 'Inativo (acesso bloqueado)'}
          </label>
          {isSelf && <p className="text-xs text-ink-500 mt-1">Você não pode desativar o próprio usuário.</p>}
        </Field>

        <div className="flex gap-2 pt-1">
          <Button fullWidth onClick={save} disabled={update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
          <Button fullWidth variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>

        <div className="pt-3 mt-2 border-t border-sand-100">
          <div className="text-xs font-medium uppercase tracking-widest text-ink-500 mb-2">Redefinir senha</div>
          <div className="flex gap-2">
            <input
              className={inputCls}
              placeholder="Nova senha provisória (mín. 8)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button variant="secondary" onClick={doReset} disabled={reset.isPending || newPassword.length < 8}>
              {reset.isPending ? '…' : 'Aplicar'}
            </Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

const inputCls =
  'w-full rounded-lg border border-sand-200 px-3 py-2 outline-none focus:border-teal-500 bg-cream text-sm';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-500 mb-1.5 font-medium">{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{msg}</div>;
}

function UserCardMobile({ user: u, onEdit }: { user: ManagedUser; onEdit: () => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-sm text-ink-950 truncate">{u.name}</div>
          <div className="text-xs text-ink-500 truncate">{u.username ?? u.email ?? '—'}</div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</span>
            {u.active ? <Tag>Ativo</Tag> : <span className="text-xs text-ink-300">Inativo</span>}
          </div>
        </div>
        <Button size="sm" variant="ghost" onClick={onEdit}>Editar</Button>
      </div>
    </Card>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return 'nunca';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-widest text-ink-500">
      {children}
    </th>
  );
}
