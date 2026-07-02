'use client';

import { useMemo, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { PageHeader, FAB } from '@/components/ui/page-header';
import { Card, Button, KpiCard, EmptyState } from '@/components/ui/primitives';
import { Sheet } from '@/components/ui/sheet';
import {
  useStockProducts,
  useStockMovements,
  useCreateProduct,
  useUpdateProduct,
  useStockMove,
  type StockProduct,
} from '@/lib/hooks';
import { ApiError } from '@/lib/api-client';
import { fmtCurrency, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  SUPPLIES: 'Insumos',
  LINEN: 'Enxoval',
  MAINTENANCE: 'Manutenção',
  MINIBAR: 'Frigobar',
  RESTAURANT: 'Restaurante',
  BAR: 'Bar',
  ROOM_SERVICE: 'Room service',
  LAUNDRY: 'Lavanderia',
  SPA: 'Spa',
  EXTRA_SERVICE: 'Serviços',
  AMENITY: 'Amenities',
};

const MOVE_LABEL: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  LOSS: 'Perda',
  ADJUSTMENT: 'Contagem',
  TRANSFER_IN: 'Transf. recebida',
  TRANSFER_OUT: 'Transf. enviada',
};

export default function AlmoxarifadoPage() {
  const { data: products, isLoading } = useStockProducts();
  const { data: movements } = useStockMovements();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StockProduct | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const list = products ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lowCount = (products ?? []).filter((p) => p.low).length;
  const zeroCount = (products ?? []).filter((p) => p.quantity <= 0).length;

  return (
    <AppShell>
      <PageHeader title="Almoxarifado" subtitle="Controle de bens e insumos do hotel" />

      <div className="px-5 md:px-8 py-5 md:py-6 max-w-5xl space-y-5">
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label="Itens cadastrados" value={(products ?? []).length} />
          <KpiCard label="Abaixo do mínimo" value={lowCount} highlight={lowCount > 0} />
          <KpiCard label="Zerados" value={zeroCount} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="flex gap-2 items-center">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou código…"
            className="flex-1 rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
          />
          <Button className="hidden md:inline-flex" onClick={() => setCreating(true)}>
            + Novo item
          </Button>
        </div>

        {isLoading ? (
          <div className="text-ink-300 text-sm">Carregando…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="📦"
            title={search ? 'Nada encontrado' : 'Nenhum item cadastrado'}
            description={
              search
                ? 'Tente outro termo de busca.'
                : 'Cadastre os bens e insumos do hotel para começar o controle.'
            }
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p)}
                className="w-full text-left bg-cream rounded-xl border border-sand-200 p-4 hover:shadow-md transition-shadow flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-ink-950 truncate">{p.name}</div>
                  <div className="text-xs text-ink-500 mt-0.5">
                    {p.sku} · {CATEGORY_LABEL[p.category] ?? p.category}
                    {p.minLevel != null && ` · mín ${p.minLevel}`}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={cn(
                      'font-serif-display text-2xl nums leading-none',
                      p.quantity <= 0
                        ? 'text-red-600'
                        : p.low
                          ? 'text-gold-700'
                          : 'text-teal-900',
                    )}
                  >
                    {p.quantity}
                  </div>
                  <div className="text-[10px] text-ink-300 uppercase tracking-wide mt-0.5">
                    {p.unitMeasure}
                  </div>
                </div>
                {(p.low || p.quantity <= 0) && (
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-1 rounded-full shrink-0',
                      p.quantity <= 0
                        ? 'bg-red-50 text-red-700'
                        : 'bg-gold-50 text-gold-700',
                    )}
                  >
                    {p.quantity <= 0 ? 'ZERADO' : 'BAIXO'}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Últimas movimentações */}
        {(movements ?? []).length > 0 && (
          <Card padding="default">
            <div className="font-serif-display text-base text-ink-950 mb-3">
              Últimas movimentações
            </div>
            <div className="space-y-2">
              {(movements ?? []).slice(0, 12).map((m) => (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 w-20 text-center',
                      m.quantity >= 0
                        ? 'bg-teal-50 text-teal-900'
                        : 'bg-red-50 text-red-700',
                    )}
                  >
                    {MOVE_LABEL[m.type] ?? m.type}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-ink-700">
                    {m.product.name}
                    {m.reason && <span className="text-ink-300"> — {m.reason}</span>}
                  </span>
                  <span
                    className={cn(
                      'nums font-medium shrink-0',
                      m.quantity >= 0 ? 'text-teal-900' : 'text-red-700',
                    )}
                  >
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </span>
                  <span className="text-[11px] text-ink-300 shrink-0 hidden md:inline">
                    {fmtDateTime(m.createdAt)}
                    {m.userName && ` · ${m.userName}`}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <FAB
        label="Novo item"
        onClick={() => setCreating(true)}
        icon={
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        }
      />

      {selected && (
        <ProductSheet
          product={selected}
          onClose={() => setSelected(null)}
          onError={setError}
        />
      )}
      {creating && <CreateSheet onClose={() => setCreating(false)} onError={setError} />}
    </AppShell>
  );
}

// ------------------------------------------------------------
// Detalhe do item: movimentar estoque + editar mínimo
// ------------------------------------------------------------
function ProductSheet({
  product,
  onClose,
  onError,
}: {
  product: StockProduct;
  onClose: () => void;
  onError: (e: string | null) => void;
}) {
  const move = useStockMove();
  const update = useUpdateProduct();
  const [type, setType] = useState<'IN' | 'OUT' | 'LOSS' | 'ADJUSTMENT'>('IN');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [minLevel, setMinLevel] = useState(
    product.minLevel != null ? String(product.minLevel) : '',
  );

  async function submitMove() {
    onError(null);
    const quantity = Number(qty);
    if (Number.isNaN(quantity) || quantity < 0) return;
    try {
      await move.mutateAsync({
        productId: product.id,
        type,
        quantity,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao movimentar');
    }
  }

  async function saveMinLevel() {
    onError(null);
    try {
      await update.mutateAsync({
        productId: product.id,
        minLevel: minLevel.trim() === '' ? null : Number(minLevel),
      });
      onClose();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao salvar');
    }
  }

  const TYPES: Array<{ key: typeof type; label: string }> = [
    { key: 'IN', label: 'Entrada' },
    { key: 'OUT', label: 'Saída' },
    { key: 'LOSS', label: 'Perda' },
    { key: 'ADJUSTMENT', label: 'Contagem' },
  ];

  return (
    <Sheet open onClose={onClose} title={product.name}>
      <div className="space-y-4">
        <div className="bg-sand-50 rounded-lg p-3 text-sm flex justify-between items-center">
          <span className="text-ink-500">
            {product.sku} · {CATEGORY_LABEL[product.category] ?? product.category} ·{' '}
            {fmtCurrency(product.unitPrice)}
          </span>
          <span className="font-serif-display text-xl nums text-teal-900">
            {product.quantity} {product.unitMeasure}
          </span>
        </div>

        <div>
          <div className="text-xs text-ink-500 mb-1.5 font-medium">Movimentar</div>
          <div className="grid grid-cols-4 gap-1.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                onClick={() => setType(t.key)}
                className={cn(
                  'rounded-lg border text-xs font-medium min-h-touch-sm',
                  type === t.key
                    ? 'bg-teal-900 text-cream border-teal-900'
                    : 'bg-cream text-ink-700 border-sand-200',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <input
          type="number"
          min={0}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder={
            type === 'ADJUSTMENT'
              ? `Quantidade contada (atual: ${product.quantity})`
              : 'Quantidade'
          }
          className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional) — ex: compra, uso na governança…"
          className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
        />
        <Button
          fullWidth
          size="lg"
          onClick={submitMove}
          disabled={qty.trim() === '' || move.isPending}
        >
          Confirmar {TYPES.find((t) => t.key === type)?.label.toLowerCase()}
        </Button>

        <div className="pt-3 border-t border-sand-100 flex gap-2 items-center">
          <div className="flex-1">
            <div className="text-xs text-ink-500 mb-1">Estoque mínimo (alerta)</div>
            <input
              type="number"
              min={0}
              value={minLevel}
              onChange={(e) => setMinLevel(e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-sm bg-cream text-sm"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            className="self-end"
            onClick={saveMinLevel}
            disabled={update.isPending}
          >
            Salvar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

// ------------------------------------------------------------
// Cadastro de novo item
// ------------------------------------------------------------
function CreateSheet({
  onClose,
  onError,
}: {
  onClose: () => void;
  onError: (e: string | null) => void;
}) {
  const create = useCreateProduct();
  const [form, setForm] = useState({
    name: '',
    category: 'SUPPLIES',
    unitMeasure: 'UN',
    unitPrice: '0',
    unitCost: '',
    initialQuantity: '0',
    minLevel: '',
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit() {
    onError(null);
    try {
      await create.mutateAsync({
        name: form.name.trim(),
        category: form.category,
        unitMeasure: form.unitMeasure.trim() || 'UN',
        unitPrice: Number(form.unitPrice) || 0,
        unitCost: form.unitCost.trim() === '' ? undefined : Number(form.unitCost),
        initialQuantity: Number(form.initialQuantity) || 0,
        minLevel: form.minLevel.trim() === '' ? undefined : Number(form.minLevel),
      });
      onClose();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Erro ao cadastrar');
    }
  }

  return (
    <Sheet open onClose={onClose} title="Novo item do almoxarifado">
      <div className="space-y-3">
        <input
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Nome do item * — ex: Papel higiênico, Toalha de banho"
          className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
          autoFocus
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Categoria</span>
            <select
              value={form.category}
              onChange={(e) => set('category', e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-2 min-h-touch-md bg-cream text-sm"
            >
              {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Unidade</span>
            <select
              value={form.unitMeasure}
              onChange={(e) => set('unitMeasure', e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-2 min-h-touch-md bg-cream text-sm"
            >
              <option value="UN">Unidade</option>
              <option value="CX">Caixa</option>
              <option value="PCT">Pacote</option>
              <option value="KG">Quilo</option>
              <option value="L">Litro</option>
              <option value="PAR">Par</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Qtd. inicial</span>
            <input
              type="number"
              min={0}
              value={form.initialQuantity}
              onChange={(e) => set('initialQuantity', e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Estoque mínimo</span>
            <input
              type="number"
              min={0}
              value={form.minLevel}
              onChange={(e) => set('minLevel', e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Preço venda (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => set('unitPrice', e.target.value)}
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-ink-500 mb-1">Custo (R$)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.unitCost}
              onChange={(e) => set('unitCost', e.target.value)}
              placeholder="—"
              className="w-full rounded-lg border border-sand-200 px-3 min-h-touch-md bg-cream text-sm"
            />
          </label>
        </div>
        <Button
          fullWidth
          size="lg"
          onClick={submit}
          disabled={form.name.trim().length < 2 || create.isPending}
        >
          {create.isPending ? 'Cadastrando…' : 'Cadastrar item'}
        </Button>
      </div>
    </Sheet>
  );
}
