# 🏨 Hotel Platform

> Sistema de gestão hoteleira (PMS) mobile-first focado em pousadas brasileiras pequenas/médias.

## 📚 Documentos importantes

| Arquivo | Para que serve |
|---|---|
| **[CONTEXTO-SISTEMA.md](./CONTEXTO-SISTEMA.md)** | 📌 **Comece por aqui** — overview completo, pendências, decisões, roadmap |
| [DEPLOY.md](./DEPLOY.md) | Guia passo a passo de deploy (Vercel + Railway + Neon) |
| [docs/critical-flows.md](./docs/critical-flows.md) | Fluxos críticos do sistema documentados |
| [.env.production.example](./.env.production.example) | Variáveis de ambiente de produção |

## 🚀 Quick start (local)

### Pré-requisitos
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker Desktop

### Setup

```bash
# 1. Subir Postgres + Redis + MailHog
docker compose up -d

# 2. Instalar dependências
pnpm install

# 3. Rodar migrations + seed
cd packages/database
npx prisma migrate dev
npx prisma db seed
cd ../..

# 4. Rodar tudo
pnpm dev
```

### Acessar
- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **MailHog** (visualizador de emails): http://localhost:8025

## 🔑 Credenciais de seed

| Login | Senha | Papel |
|---|---|---|
| admin@pousadavistamar.com.br | admin123 | ADMIN |
| recepcao@pousadavistamar.com.br | recepcao123 | RECEPTION |
| governanta@pousadavistamar.com.br | governanta123 | HOUSEKEEPING_SUPERVISOR |
| maria.camareira@pousadavistamar.com.br | maria123 | HOUSEKEEPER |
| lucia.camareira@pousadavistamar.com.br | lucia123 | HOUSEKEEPER |

## 🛠️ Stack

- **Backend**: NestJS 10 + TypeScript + Prisma 5 + PostgreSQL 16 + Redis
- **Frontend**: Next.js 14 (App Router) + TailwindCSS + TanStack Query
- **Compartilhado**: Zod schemas
- **Monorepo**: Turborepo + pnpm workspaces
- **Pagamentos**: Asaas (Pix + Cartão)
- **Fiscal**: Focus NFe (NFS-e) — não conectado ainda
- **Storage**: Cloudflare R2 — não conectado ainda

## 📁 Estrutura

```
hotel-platform/
├── apps/
│   ├── api/          # Backend NestJS
│   └── web/          # Frontend Next.js
├── packages/
│   ├── database/     # Prisma + migrations
│   └── shared/       # Zod schemas + types
├── docs/             # Documentação técnica
└── docker-compose.yml
```

## ✅ Estado das sprints

- ✅ Sprint 1 — Fundação (auth, schema, multi-tenant)
- ✅ Sprint 2 — Operação de recepção (reservas, check-in/out)
- ✅ Sprint 3 — Housekeeping (state machine completa)
- ✅ Sprint 4 — Pagamentos + Fluxo público (Asaas, webhook)
- ✅ Sprint 5 — Mobile-first refactor (design system completo)
- 🔴 **Sprint 5b — Consumos + Estoque** (não implementado)
- 🔴 **Sprint 6 — Fiscal + Comunicações** (não implementado)

Detalhes em [CONTEXTO-SISTEMA.md](./CONTEXTO-SISTEMA.md).

## ⚠️ Dívidas técnicas críticas

Em ordem de prioridade:
1. **JWT em localStorage** → mover para httpOnly cookie (LGPD)
2. **Race condition no reservationCode** → usar sequence Postgres
3. **Idempotency cache in-memory** → mover para Redis
4. **Sem testes** → começar pelos fluxos críticos (E2E)
5. **Sem monitoring** → adicionar Sentry + structured logging

Lista completa em [CONTEXTO-SISTEMA.md](./CONTEXTO-SISTEMA.md).

## 🎨 Design system

Identidade boutique brasileiro:
- **Petróleo** (`teal-900` #0E3940) — primária
- **Dourado quente** (`gold-500` #C49B5C) — acento
- **Areia** (`sand-*`) — neutros warm
- **Source Serif Pro** — títulos
- **Inter** — corpo
- **Touch targets** ≥ 44px (acessibilidade)

## 📦 Comandos úteis

```bash
# Database
cd packages/database
npx prisma studio              # GUI do banco
npx prisma migrate dev         # Nova migration
npx prisma db seed             # Resetar com seed

# Geral
pnpm dev                       # Roda back + front em modo dev
pnpm build                     # Build de produção
pnpm lint                      # Lint em tudo

# API
cd apps/api
pnpm start:dev                 # Só backend
pnpm test                      # Testes (vazio por enquanto)

# Web
cd apps/web
pnpm dev                       # Só frontend
```

## 📝 Licença

Privado. Não distribuir.
