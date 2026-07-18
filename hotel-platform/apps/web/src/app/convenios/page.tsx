'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { Card, Button, EmptyState } from '@/components/ui/primitives';
import { Tag } from '@/components/ui/status-pill';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api-client';
import { fmtDate } from '@/lib/format';
import {
  useCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useCompanyOpenReservations,
  useInvoices,
  useCreateInvoice,
  usePayInvoice,
  useCancelInvoice,
  type Company,
  type Invoice,
} from '@/lib/hooks';

const money = (v: string | number | null | undefined) =>
  (Number(v ?? 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  OPEN: { label: 'Em aberto', cls: 'bg-sand-100 text-ink-700' },
  CLOSED: { label: 'A pagar', cls: 'bg-amber-100 text-amber-800' },
  PAID: { label: 'Paga', cls: 'bg-teal-100 text-teal-800' },
  OVERDUE: { label: 'Vencida', cls: 'bg-red-100 text-red-700' },
  CANCELLED: { label: 'Cancelada', cls: 'bg-sand-100 text-ink-400' },
};

export default function ConveniosPage() {
  const { data: companies, isLoading } = useCompanies();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [invoicingFor, setInvoicingFor] = useState<Company | null>(null);

  return (
    <AppShell>
      <PageHeader
        title="Convênios"
        subtitle={companies ? `${companies.length} empresa(s)` : undefined}
        actions={<Button onClick={() => setCreating(true)}>Novo convênio</Button>}
      />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-8">
        {/* ---------- Empresas ---------- */}
        <section className="space-y-3">
          {isLoading ? (
            <div className="text-ink-300 text-sm">Carregando…</div>
          ) : !companies || companies.length === 0 ? (
            <EmptyState icon="🏢" title="Sem convênios" description="Cadastre a primeira empresa conveniada (ex.: Sicoob)." />
          ) : (
            <div className="space-y-2">
              {companies.map((c) => (
                <Card key={c.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ink-950">{c.tradeName || c.legalName}</span>
                        {!c.active && <span className="text-xs text-ink-300">inativo</span>}
                      </div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        CNPJ {fmtCnpj(c.cnpj)}
                        {c.defaultRateOverride ? ` · tarifa R$ ${Number(c.defaultRateOverride)}/diária` : ''}
                        {` · prazo ${c.paymentTermDays} dias`}
                      </div>
                      <div className="mt-1.5">
                        {c.openReservations && c.openReservations > 0 ? (
                          <Tag>{c.openReservations} reserva(s) em aberto · {money(c.openAmount)}</Tag>
                        ) : (
                          <span className="text-xs text-ink-400">nada a faturar</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {c.openReservations && c.openReservations > 0 ? (
                        <Button size="sm" onClick={() => setInvoicingFor(c)}>Gerar fatura</Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Editar</Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ---------- Faturas ---------- */}
        <InvoicesSection />
      </div>

      {creating && <CompanySheet onClose={() => setCreating(false)} />}
      {editing && <CompanySheet company={editing} onClose={() => setEditing(null)} />}
      {invoicingFor && <InvoiceSheet company={invoicingFor} onClose={() => setInvoicingFor(null)} />}
    </AppShell>
  );
}

// ============================ Cadastro de empresa ============================

function CompanySheet({ company, onClose }: { company?: Company; onClose: () => void }) {
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const del = useDeleteCompany();
  const editing = !!company;
  const [form, setForm] = useState({
    legalName: company?.legalName ?? '',
    tradeName: company?.tradeName ?? '',
    cnpj: company?.cnpj ?? '',
    email: company?.email ?? '',
    phone: company?.phone ?? '',
    contactName: company?.contactName ?? '',
    defaultRateOverride: company?.defaultRateOverride ?? '',
    paymentTermDays: String(company?.paymentTermDays ?? 30),
    billingDay: company?.billingDay != null ? String(company.billingDay) : '',
    active: company?.active ?? true,
    notes: company?.notes ?? '',
  });
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const payload: Record<string, unknown> = {
      legalName: form.legalName,
      tradeName: form.tradeName || undefined,
      cnpj: form.cnpj,
      email: form.email || undefined,
      phone: form.phone || undefined,
      contactName: form.contactName || undefined,
      defaultRateOverride: form.defaultRateOverride ? Number(form.defaultRateOverride) : undefined,
      paymentTermDays: form.paymentTermDays ? Number(form.paymentTermDays) : undefined,
      billingDay: form.billingDay ? Number(form.billingDay) : undefined,
      notes: form.notes || undefined,
    };
    try {
      if (editing) {
        await update.mutateAsync({ id: company!.id, ...payload, active: form.active });
      } else {
        await create.mutateAsync(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao salvar convênio');
    }
  }

  async function deactivate() {
    setError(null);
    try {
      await del.mutateAsync(company!.id);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao desativar');
    }
  }

  const pending = create.isPending || update.isPending;

  return (
    <Sheet open onClose={onClose} title={editing ? `Editar — ${company!.tradeName || company!.legalName}` : 'Novo convênio'} maxWidth="md">
      <div className="space-y-3">
        {error && <ErrorBox msg={error} />}
        <Field label="Razão social">
          <input className={inputCls} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </Field>
        <Field label="Nome fantasia (opcional)">
          <input className={inputCls} value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
        </Field>
        <Field label="CNPJ">
          <input className={inputCls} value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tarifa negociada / diária (R$)">
            <input className={inputCls} inputMode="decimal" value={form.defaultRateOverride} onChange={(e) => setForm({ ...form, defaultRateOverride: e.target.value })} placeholder="ex.: 125" />
          </Field>
          <Field label="Prazo de pagamento (dias)">
            <input className={inputCls} inputMode="numeric" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="E-mail (financeiro)">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Field label="Pessoa de contato (opcional)">
          <input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
        </Field>
        <Field label="Observações (opcional)">
          <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </Field>
        {editing && (
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Convênio ativo
          </label>
        )}
        <div className="flex gap-2 pt-2">
          <Button fullWidth onClick={submit} disabled={pending}>
            {pending ? 'Salvando…' : editing ? 'Salvar' : 'Criar convênio'}
          </Button>
          <Button fullWidth variant="secondary" onClick={onClose}>Cancelar</Button>
        </div>
        {editing && company!.active && (
          <button className="text-xs text-red-600 hover:underline pt-1" onClick={deactivate} disabled={del.isPending}>
            Desativar convênio
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ============================ Geração de fatura ============================

function InvoiceSheet({ company, onClose }: { company: Company; onClose: () => void }) {
  const { data: reservations, isLoading } = useCompanyOpenReservations(company.id);
  const create = useCreateInvoice();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [discount, setDiscount] = useState('');
  const [error, setError] = useState<string | null>(null);

  // pré-seleciona todas as reservas quando carregam (uma vez)
  useEffect(() => {
    if (reservations && !initialized) {
      setSelected(new Set(reservations.map((r) => r.id)));
      setInitialized(true);
    }
  }, [reservations, initialized]);

  const chosen = (reservations ?? []).filter((r) => selected.has(r.id));
  const subtotal = chosen.reduce((s, r) => s + Number(r.totalAmount), 0);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit() {
    setError(null);
    try {
      await create.mutateAsync({
        companyId: company.id,
        reservationIds: [...selected],
        discount: Number(discount) || 0,
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao gerar fatura');
    }
  }

  return (
    <Sheet open onClose={onClose} title={`Gerar fatura — ${company.tradeName || company.legalName}`} maxWidth="lg">
      <div className="space-y-3">
        {error && <ErrorBox msg={error} />}
        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando reservas…</div>
        ) : !reservations || reservations.length === 0 ? (
          <EmptyState icon="✅" title="Nada a faturar" description="Este convênio não tem reservas em aberto." />
        ) : (
          <>
            <p className="text-xs text-ink-500">Selecione as reservas que entram nesta fatura:</p>
            <div className="rounded-xl border border-sand-200 divide-y divide-sand-100">
              {reservations.map((r) => (
                <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-sand-50">
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-ink-950">{r.primaryGuest?.fullName ?? '—'} <span className="text-ink-400 text-xs">{r.code}</span></div>
                    <div className="text-xs text-ink-500">
                      Q{r.room?.number ?? '—'} · {fmtDate(r.checkInDate)} → {fmtDate(r.checkOutDate)} · {r.nights} noite(s)
                    </div>
                  </div>
                  <div className="text-sm font-medium text-ink-950">{money(r.totalAmount)}</div>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <Field label="Desconto (R$, opcional)">
                <input className={inputCls} inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </Field>
              <div className="text-right">
                <div className="text-xs text-ink-500">Total da fatura</div>
                <div className="text-2xl font-bold text-ink-950">{money(total)}</div>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button fullWidth onClick={submit} disabled={create.isPending || selected.size === 0}>
                {create.isPending ? 'Gerando…' : `Gerar fatura (${selected.size})`}
              </Button>
              <Button fullWidth variant="secondary" onClick={onClose}>Cancelar</Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}

// ============================ Lista de faturas ============================

function InvoicesSection() {
  const { data: invoices, isLoading } = useInvoices();
  const pay = usePayInvoice();
  const cancel = useCancelInvoice();
  const [busy, setBusy] = useState<string | null>(null);

  async function doPay(inv: Invoice) {
    if (!confirm(`Registrar o pagamento da fatura ${inv.number} (${money(inv.totalAmount)})?`)) return;
    setBusy(inv.id);
    try { await pay.mutateAsync({ id: inv.id }); } finally { setBusy(null); }
  }
  async function doCancel(inv: Invoice) {
    if (!confirm(`Cancelar a fatura ${inv.number}? As reservas voltam a ficar em aberto.`)) return;
    setBusy(inv.id);
    try { await cancel.mutateAsync(inv.id); } finally { setBusy(null); }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-ink-700">Faturas</h2>
      {isLoading ? (
        <div className="text-ink-300 text-sm">Carregando…</div>
      ) : !invoices || invoices.length === 0 ? (
        <p className="text-sm text-ink-400">Nenhuma fatura gerada ainda.</p>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const st = INVOICE_STATUS[inv.status] ?? { label: inv.status, cls: 'bg-sand-100 text-ink-700' };
            return (
              <Card key={inv.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-950">{inv.number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="text-xs text-ink-500 mt-0.5">
                      {inv.company?.tradeName || inv.company?.legalName} · {inv._count?.reservations ?? 0} reserva(s)
                      {inv.dueDate ? ` · vence ${fmtDate(inv.dueDate)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-lg font-bold text-ink-950">{money(inv.totalAmount)}</div>
                    </div>
                    {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => doPay(inv)} disabled={busy === inv.id}>Registrar pagamento</Button>
                        <Button size="sm" variant="ghost" onClick={() => doCancel(inv)} disabled={busy === inv.id}>Cancelar</Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ============================ helpers ============================

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

function fmtCnpj(cnpj: string): string {
  const d = (cnpj || '').replace(/\D/g, '');
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
