# 🏨 Hotel Platform — Documento de Contexto Completo

> **Como usar este documento:** Cole o conteúdo inteiro deste arquivo em uma nova conversa com Claude (ou outro agente de IA) para continuar o desenvolvimento de onde parou. Ele contém o estado completo do sistema, decisões arquiteturais, pendências e roadmap.

---

## 📌 SOBRE O PROJETO

### Quem é o autor
**Pedro Pinto Cerqueira** — empreendedor baseado em Feira de Santana (BA), opera múltiplas empresas sob o grupo **GPC**. Está construindo este sistema para:
1. Usar em sua **própria pousada** (volume esperado: 15+ reservas/dia)
2. Eventualmente comercializar para outras pousadas pequenas/médias (15-50 quartos)

### Perfil de preferências
Pedro pediu explicitamente que Claude atue como **parceiro crítico de debate**, priorizando:
- Verdade sobre validação
- Apontar falhas lógicas e pressupostos
- Perguntas desafiadoras
- Linguagem simples (explicar termos técnicos quando usados)

### O que é o sistema
**Hotel Platform** — SaaS de gestão hoteleira (PMS) focado em pousadas brasileiras pequenas/médias. Substitui caderno/Excel por uma plataforma operacional completa.

**Diferencial vs concorrentes (HiTech, Stays, Hotsystem):**
- Mobile-first (camareira opera 100% pelo celular)
- Identidade visual diferenciada (boutique brasileiro: petróleo + dourado + areia)
- Adaptado ao contexto fiscal/regulatório BR (FNRH, LGPD, NFS-e, Simples Nacional)
- Multi-tenant nativo desde a fundação

---

## ✅ ESTADO ATUAL — O QUE FOI CONSTRUÍDO

### Sprints completos

#### Sprint 1 — Fundação ✅
- Monorepo Turborepo + pnpm workspaces
- Schema Prisma com 20 modelos
- Auth JWT (scrypt nativo do Node, sem deps externas)
- Multi-tenancy via `propertyId` em todas as tabelas
- Validação Zod compartilhada entre back/front (`@hotel/shared`)
- Endpoints read: properties, rooms, reservations, dashboard, public availability
- Frontend Next.js com login + dashboard
- Seed completo com pousada/usuários/quartos/reservas
- Docker Compose (Postgres 16 + Redis 7 + MailHog)
- Health check com ping DB

#### Sprint 2 — Operação de Recepção ✅
- POST /reservations + PATCH /reservations/:id/assign-room
- POST check-in (valida FNRH + payment)
- POST check-out (gera CleaningTask + FiscalDocument, marca quarto DIRTY)
- Cancel reservation
- Guest CRUD com soft-delete LGPD
- Geração automática de ChargeItems para diárias
- Sidebar layout, agenda visual grid, reservation detail com folio
- Room picker, room map, guest search, formulário 3-step nova reserva

#### Sprint 3 — Housekeeping ✅
- State machine completa: PENDING → IN_PROGRESS → AWAITING_INSPECTION → COMPLETED (com loop REJECTED)
- Endpoints: /assign, /start, /complete, /approve, /reject, /issue
- PATCH /rooms/:id/status
- Priority calculation + duration tracking
- Painel governanta + tela mobile-first /minha-limpeza para camareira
- Role-based menu filtering
- Login redireciona camareira direto para /minha-limpeza
- Seed inclui Lúcia Camareira + 2 sample tasks

#### Sprint 4 — Pagamentos + Fluxo Público ✅
- AsaasService completo (find/create customer, create payment, Pix QR, refund)
- PaymentService + WebhookController idempotente com token-auth
- POST /public/property/:slug/reservations (fluxo público completo)
- HoldExpirationService cron (libera reservas pendentes após 30min)
- applyPaymentToReservation (auto-confirma quando deposit atingido)
- ChargeModal frontend (Pix QR + copy/paste + cartão redirect)
- Página pública /reservar/{slug} (wizard 3 passos)
- UUID v4 client-side idempotency

#### Sprint 5 (Refactor Mobile-First) ✅
- Design system completo com paleta nova: ink, teal, gold, sand, cream
- Tipografia: Source Serif Pro (títulos) + Inter (corpo)
- Touch targets ≥ 44px em tudo
- Sidebar desktop ↔ bottom-nav mobile (responsivo)
- Tabelas viram cards em mobile
- Agenda timeline ↔ lista por dia (mobile)
- Modais viram bottom sheets
- FAB (floating action button) para mobile
- Componentes-primitivos: Card, KpiCard, StatusPill, Avatar, Sheet, PageHeader, FAB, Button, EmptyState

### Hot patches de produção aplicados
- ✅ Rate limit global (10 req/s, 100 req/min, 1000 req/h por IP)
- ✅ Rate limit estrito no público (5 reservas/min/IP)
- ✅ Webhooks isentos de rate limit (Asaas retenta agressivamente)
- ✅ Trust proxy no main.ts (essencial em Railway/Heroku)
- ✅ Compression middleware (reduz custo de banda)
- ✅ Health check ampliado (DB + Redis opcional)
- ✅ Helmet para security headers
- ✅ Script `deploy:start` que roda `prisma migrate deploy` automaticamente
- ✅ railway.json + nixpacks.toml + vercel.json configurados
- ✅ .env.production.example completo e documentado
- ✅ .gitignore reforçado
- ✅ DEPLOY.md com guia visual passo a passo

---

## 🛠️ STACK TÉCNICA

### Backend (`apps/api`)
- **NestJS 10** + TypeScript 5
- **Prisma 5** + PostgreSQL 16
- **Redis** (BullMQ para filas — hold expiration)
- **Zod** para validação (compartilhada via `@hotel/shared`)
- **JWT** com scrypt nativo (sem `bcrypt` externo)
- **Helmet + Compression** para segurança/performance
- **@nestjs/throttler** para rate limiting

### Frontend (`apps/web`)
- **Next.js 14** App Router
- **TailwindCSS** + design system customizado
- **TanStack Query** (cache + sync de servidor)
- **Lucide React** (ícones)

### Compartilhado (`packages/`)
- `@hotel/database` — Prisma schema + migrations + client singleton
- `@hotel/shared` — Schemas Zod + tipos + utils compartilhados

### Integrações externas
- **Asaas** — Pix + Cartão (sandbox: `sandbox.asaas.com`)
- **Focus NFe** — NFS-e (sandbox: `homologacao.focusnfe.com.br`)
- **Cloudflare R2** — Storage (fotos de cleaning issues, FNRH PDFs) — **ainda não configurado**
- **Resend** — E-mail transacional — **ainda não conectado**
- **Meta WhatsApp Cloud API** — Confirmações via WhatsApp — **ainda não implementado**

### Deploy stack alvo
- **Vercel** — Frontend
- **Railway** — Backend (Nixpacks builder)
- **Neon** — Postgres (free tier 500MB)
- **Upstash** — Redis (free tier 10k/dia) — opcional no MVP

---

## 🗂️ ESTRUTURA DE PASTAS

```
hotel-platform/
├── apps/
│   ├── api/                          # Backend NestJS
│   │   ├── src/
│   │   │   ├── main.ts               # Bootstrap com helmet, CORS, compression
│   │   │   ├── app.module.ts         # Module root com throttler
│   │   │   ├── common/
│   │   │   │   ├── prisma/           # PrismaService
│   │   │   │   ├── audit/            # AuditLogService
│   │   │   │   ├── scheduling/       # SchedulingModule (cron)
│   │   │   │   ├── health/           # HealthController
│   │   │   │   ├── pipes/            # ZodValidationPipe
│   │   │   │   └── utils/
│   │   │   └── modules/
│   │   │       ├── auth/             # Login, JWT, roles
│   │   │       ├── property/         # Multi-tenant root
│   │   │       ├── room/             # Rooms + RoomTypes
│   │   │       ├── reservation/      # Reservations + folio + lifecycle
│   │   │       ├── guest/            # Guests CRUD + LGPD
│   │   │       ├── housekeeping/     # Cleaning state machine
│   │   │       ├── user/             # Staff
│   │   │       ├── payment/          # Asaas + Webhooks
│   │   │       └── public/           # Endpoints públicos (reserva direta)
│   │   └── package.json
│   └── web/                          # Frontend Next.js 14
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── login/page.tsx
│       │   │   ├── dashboard/page.tsx
│       │   │   ├── agenda/page.tsx
│       │   │   ├── reservas/[id]/page.tsx
│       │   │   ├── reservas/nova/page.tsx
│       │   │   ├── hospedes/page.tsx
│       │   │   ├── quartos/page.tsx
│       │   │   ├── housekeeping/page.tsx
│       │   │   ├── minha-limpeza/page.tsx
│       │   │   └── reservar/[slug]/page.tsx   # ⚠️ Não refatorada mobile-first
│       │   ├── components/
│       │   │   ├── app-shell.tsx     # Sidebar desktop + bottom-nav mobile
│       │   │   ├── charge-modal.tsx
│       │   │   └── ui/
│       │   │       ├── avatar.tsx
│       │   │       ├── status-pill.tsx
│       │   │       ├── primitives.tsx  # Card, Button, KpiCard, EmptyState
│       │   │       ├── sheet.tsx       # BottomSheet/Modal responsivo
│       │   │       └── page-header.tsx # PageHeader + FAB
│       │   └── lib/
│       │       ├── api-client.ts
│       │       ├── hooks.ts          # TanStack Query hooks
│       │       ├── format.ts
│       │       └── utils.ts
│       └── package.json
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/post-init.sql
│   │   └── src/client.ts
│   └── shared/
│       └── src/
│           ├── schemas/              # Zod schemas
│           ├── types/
│           └── utils/
├── docs/critical-flows.md            # 5 fluxos críticos documentados
├── docker-compose.yml
├── .env.example
├── .env.production.example           # Variáveis de produção documentadas
├── .gitignore
├── nixpacks.toml                     # Config Railway
├── railway.json                      # Config Railway (alternativa)
├── DEPLOY.md                         # Guia visual de deploy
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml                    # ⚠️ Gerado por Claude, recomendado regenerar localmente
└── turbo.json
```

---

## 🗄️ MODELO DE DADOS (Prisma)

### Modelos principais (20)
- `Property` — Tenant root (a pousada)
- `User` — Staff (ADMIN, MANAGER, RECEPTION, HOUSEKEEPING_SUPERVISOR, HOUSEKEEPER)
- `RoomType` — Categoria (Standard, Luxo, Suíte)
- `Room` — Quarto físico
- `Guest` — Hóspede com FNRH fields + LGPD soft delete
- `Reservation` — Com hold mechanism (30min), código `RES-YYYY-NNNNN` por property
- `ReservationGuest` — N:N reservation ↔ guest
- `Payment` — Asaas integration
- `CleaningTask` — Estado: PENDING / IN_PROGRESS / AWAITING_INSPECTION / COMPLETED / REJECTED
- `RoomStatusLog` — Audit do status do quarto
- `AuditLog` — Auditoria geral
- `Company` — B2B (cliente corporativo)
- `Invoice` — Fatura mensal corporativa
- `Product` — Itens de frigobar/restaurante (Sprint 5 pendente)
- `StockLocation` — Frigobar, despensa, etc
- `Stock` — Estoque por location
- `StockMovement` — Movimentações
- `ChargeItem` — Linha do folio
- `FiscalDocument` — NFS-e via Focus NFe
- `GuestDocument` — Anexos (FNRH PDF, RG/CPF foto)

### Decisões importantes
- **CUID IDs** (não UUID) — mais curtos, ordenáveis
- **Decimal para money** — nunca Float
- **@db.Date** para datas de calendário (sem time)
- **timestamptz** para instantes (com timezone)
- **Anti-overbooking** via PostgreSQL EXCLUDE constraint com daterange + btree_gist
- **Multi-tenancy** via `propertyId` em todas as tabelas — RLS planejado para v2

### Enums críticos
```typescript
// BillingMode
DEPOSIT_BALANCE      // B2C: sinal + saldo no check-in
POSTPAID_CORPORATE   // B2B: fatura mensal
FULL_PREPAID         // Pago antecipado integral
GUARANTEE_CARD       // Cartão como garantia, paga no check-out

// ReservationStatus
PENDING / CONFIRMED / CHECKED_IN / CHECKED_OUT / CANCELLED / NO_SHOW

// RoomStatus
AVAILABLE / OCCUPIED / DIRTY / CLEANING / INSPECTION / MAINTENANCE / BLOCKED / OUT_OF_ORDER

// CleaningTaskStatus
PENDING / IN_PROGRESS / AWAITING_INSPECTION / COMPLETED / REJECTED
```

---

## 🔑 CREDENCIAIS DE SEED

```
Property slug: pousada-vista-mar

admin@pousadavistamar.com.br        / admin123      (ADMIN)
recepcao@pousadavistamar.com.br     / recepcao123   (RECEPTION)
governanta@pousadavistamar.com.br   / governanta123 (HOUSEKEEPING_SUPERVISOR)
maria.camareira@pousadavistamar.com.br / maria123   (HOUSEKEEPER)
lucia.camareira@pousadavistamar.com.br / lucia123   (HOUSEKEEPER)
```

---

## ⚠️ PENDÊNCIAS CRÍTICAS

### 🔴 Sprint 5 — Consumos + Estoque (NÃO IMPLEMENTADO)
**Por que é crítico**: em pousada com restaurante/frigobar, lançar consumo na conta do hóspede é operação **diária e múltipla**. Sem isso, recepção lança manualmente em Excel paralelo = dado perdido.

**Escopo:**
- POST /reservations/:id/charges/batch (lançar múltiplos consumos)
- GET /rooms/:id/minibar
- Stock movements (entrada/saída/ajuste)
- Stock alerts (mínimo configurável)
- Modal de consumo na tela de detalhe da reserva
- Tela de estoque com KPIs e alertas
- Integração com folio existente (ChargeItem já existe no schema)

### 🔴 Sprint 6 — Fiscal + Comunicações (NÃO IMPLEMENTADO)
**Por que é crítico em volume 15+/dia:**
- Sem NFS-e automática = emitir 15 notas/dia manualmente no Focus NFe = inviável
- Sem WhatsApp/email automático = recepção gasta 2h30/dia em confirmações manuais

**Escopo:**
- Focus NFe integration (auto NFS-e no check-out)
- Monthly corporate invoice cron (B2B)
- Resend setup (e-mails transacionais)
- Meta WhatsApp Cloud API (confirmações, lembretes)
- Templates de email/whatsapp
- Tela de logs de comunicação

### 🟠 Deploy ainda não concluído
- Tentativa em Vercel + Railway + Neon parou no build do Railway (falta lockfile)
- `pnpm-lock.yaml` foi gerado e está no zip — ao subir em novo repo, build deve funcionar
- Variáveis de ambiente já documentadas em `.env.production.example`
- Guia visual em `DEPLOY.md`

### 🟠 Dívidas técnicas de segurança/produção

#### Race condition no código de reserva
**Problema:** `reservationCode` é gerado por contagem (`COUNT() + 1` formatado como `RES-YYYY-NNNNN`). Duas reservas simultâneas podem gerar o mesmo código. Hoje confiamos na unique constraint para falhar uma — mas sem retry.

**Fix sugerido:** sequence Postgres dedicada por property + retry com backoff.

#### JWT em localStorage
**Problema:** vulnerável a XSS. Com dados de CPF de hóspedes = problema de LGPD.

**Fix sugerido:** httpOnly cookie + CSRF token + SameSite=strict.

#### Webhook race condition
**Problema:** pagamento Asaas pode chegar antes do `Reservation.PENDING` ser commitada na transação. Hoje confiamos em retry do Asaas para reprocessar.

**Fix sugerido:** trabalhar com `payment_intent` na criação da reserva e amarrar webhook via `externalReference` aguardando transação ficar disponível (com timeout).

#### Idempotency cache em memória
**Problema:** se backend escalar para múltiplas instâncias, idempotência falha entre elas.

**Fix sugerido:** mover para Redis (SETNX com TTL).

#### Sem testes automatizados
**Problema:** qualquer alteração futura pode quebrar produção sem aviso.

**Fix sugerido:** começar por testes E2E dos fluxos críticos (check-in, check-out, webhook), depois unit tests do business core.

#### Sem rate limiting nos endpoints autenticados
**Status:** rate limit global aplicado (10/s, 100/min, 1000/h), mas endpoints autenticados podem precisar de limites por user (não só por IP) em produção.

#### Sem monitoring/observability
**Problema:** quando der pau em produção, vai ser cego.

**Fix sugerido:** Sentry (free tier) + structured logging com pino + dashboard básico no Railway.

#### Página pública /reservar/[slug] não foi refatorada mobile-first
Era pendência da Sprint 5 de design. Funciona mas não tem o tratamento responsivo do resto.

#### Cloudflare R2 não configurado
Schema aceita URLs de fotos para cleaning issues e FNRH, mas o upload não foi implementado.

---

## 🎨 DESIGN SYSTEM

### Paleta
```typescript
ink:  { 950: '#0F1F26', 700: '#3A4A52', 500: '#6B7A82', 300: '#B5BFC4', 100: '#E5E9EB' }
teal: { 900: '#0E3940', 700: '#1A5560', 500: '#2A7785', 100: '#C4DBE0', 50: '#E8F0F2' }  // primária
gold: { 700: '#9D7A3C', 500: '#C49B5C', 100: '#F5EBD8', 50: '#FBF6EC' }  // acento
sand: { 200: '#E6DECF', 100: '#F2EDE4', 50: '#FAF7F2' }  // neutros
cream: '#FFFEFB'
```

### Tipografia
- **Source Serif Pro** — títulos (`font-serif-display`)
- **Inter** — corpo (`font-sans`)
- Sempre `font-variant-numeric: tabular-nums` em números

### Touch targets (acessibilidade)
- `min-h-touch-sm` = 44px
- `min-h-touch-md` = 48px

### Padrões mobile-first
- Sidebar desktop ↔ bottom-nav mobile (via `md:` prefix)
- Tabelas viram cards em mobile
- Modais viram bottom sheets em mobile (componente `Sheet` com `variant="auto"`)
- FAB (floating action button) para ação primária mobile
- Agenda timeline desktop ↔ lista por dia mobile

---

## 🚀 COMO RODAR LOCALMENTE

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
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- MailHog: http://localhost:8025
- Prisma Studio: `cd packages/database && npx prisma studio`

---

## ☁️ COMO DEPLOYAR

Ver `DEPLOY.md` completo. Resumo:

1. **Postgres** — Neon (free tier)
2. **Redis** — Upstash (free tier, opcional)
3. **Backend** — Railway (Nixpacks builder)
4. **Frontend** — Vercel (root directory: `apps/web`)
5. **Pagamentos** — Asaas Sandbox primeiro

Variáveis de ambiente documentadas em `.env.production.example`.

⚠️ **Pegadinha conhecida**: Railway exige `pnpm-lock.yaml`. Está incluso no projeto. Se quiser regenerar localmente: `pnpm install --lockfile-only`.

---

## 🛣️ ROADMAP SUGERIDO

### Curto prazo (próximas 2-4 semanas)
1. **Finalizar deploy MVP** (Vercel + Railway + Neon) — 1h
2. **Sprint 5: Consumos + Estoque** — 1 semana
3. **Sprint 6: Fiscal + Comunicações** — 1 semana
4. **Testar com 1-2 reservas reais por dia** — 1 semana

### Médio prazo (1-3 meses)
5. **Resolver dívidas técnicas críticas** (JWT cookie, idempotency Redis, race condition reservation code)
6. **Implementar Sentry + logs estruturados**
7. **Suite de testes E2E** (Playwright + Jest)
8. **Channel manager básico** (Booking.com Connect API)
9. **Tela de relatórios financeiros** (RevPAR, ADR, ocupação, recebimentos)
10. **Caixa do dia / Fechamento de turno**

### Longo prazo (3-12 meses)
11. **Multi-property real** (ADMIN gerenciando várias pousadas)
12. **RLS no Postgres** (segurança extra de multi-tenancy)
13. **Tarifação dinâmica** (por dia da semana, temporada, ocupação)
14. **Channel manager full** (Booking + Airbnb + Expedia)
15. **Mobile app nativo** (camareira, recepção) usando React Native ou PWA upgrade
16. **Integração com pricing tools** (price intelligence)
17. **Cliente recorrente / programa de fidelidade**
18. **App do hóspede** (check-in online, pedidos de room service)

---

## 🧠 DECISÕES ARQUITETURAIS IMPORTANTES

### Por que monorepo Turborepo?
Reuso de schemas Zod entre back e front. Type-safety end-to-end (cliente sabe o formato exato que back retorna). Build paralelizado.

### Por que NestJS no back?
Maturidade enterprise (DI, modules, pipes, guards). Decorator-based = declarativo. Comunidade BR forte. Performance suficiente para o caso.

### Por que Next.js App Router?
Server Components reduzem JS no cliente. Streaming nativo. Edge-ready. App Router é o futuro do Next.

### Por que pnpm?
Eficiência de disco (hard links). Strict (não pega deps fantasma). Workspaces nativos.

### Por que Asaas (não Stripe/Mercado Pago)?
Foco em PME brasileira. Pix nativo. Webhook simples. Boleto/cartão/Pix unificados. Taxa razoável (1,99% Pix instantâneo, 4,99% cartão à vista).

### Por que mobile web (não app nativo)?
Camareira não baixa app. PWA + design mobile-first cobre 95% dos casos. Manutenção 1x para web + mobile.

### Por que não usar Supabase/Firebase?
Schema complexo (20 tabelas com constraints fortes). Triggers Postgres customizadas. Multi-tenancy específica. Vendor lock-in alto.

### Por que Prisma (não TypeORM/Sequelize)?
Type-safety completa. Migrations declarativas. Performance OK. DX (developer experience) superior.

---

## ⚠️ CRÍTICA HONESTA AO QUE FOI CONSTRUÍDO

Sendo brutalmente franco com o estado atual:

### O que ficou bom
- Schema do banco bem pensado (constraints, índices, relações)
- Separação clara back/front via tipos compartilhados
- State machine de housekeeping completa
- Fluxo de Pix bem desenhado (idempotência, holds, webhook)
- Design system coeso e diferenciado
- Documentação de fluxos críticos

### O que ficou apenas suficiente
- Testes: zero. Confiamos na linguagem (TS) e revisão manual.
- Observability: log nativo + healthcheck. Sem APM.
- Performance: não foi medida. Pode ter N+1 queries escondidas.

### O que ficou incompleto/preocupante
- **Sprints 5 e 6 não foram feitos.** Em volume 15+ reservas/dia, isso é dor real.
- **Asaas nunca foi testado de verdade contra sandbox.** Código segue docs, mas integrações têm pegadinhas que só aparecem no real.
- **JWT em localStorage** = risco de LGPD com dados de hóspedes.
- **Sem channel manager** = se publicar no Booking.com, overbooking é certo.

### O que eu (Claude) faria diferente se começasse de novo
- Geraria o `pnpm-lock.yaml` desde o Sprint 1 (não no final, depois de quebrar deploy)
- Testaria Asaas sandbox no Sprint 4 com webhook real via ngrok
- Implementaria Sentry/logs estruturados ainda no Sprint 1
- Faria 1 teste E2E por sprint (não acumular dívida)
- Documentaria o "Sprint 0: deployable from day 1" como meta — sempre deployar mesmo que vazio
- Não criaria mockups visuais paralelos — aplicaria direto no código real desde o primeiro dia

---

## 📋 ARQUIVOS PRINCIPAIS PARA RETOMAR

Ao subir o projeto em nova conversa, prioridade de leitura para entender:

1. `README.md` — Overview geral
2. `docs/critical-flows.md` — Como cada fluxo funciona
3. `packages/database/prisma/schema.prisma` — Modelo de dados completo
4. `apps/api/src/app.module.ts` — Estrutura do backend
5. `apps/web/src/app/layout.tsx` + `app-shell.tsx` — Estrutura do frontend
6. `DEPLOY.md` — Como deployar
7. `.env.production.example` — Variáveis necessárias

---

## 🎯 PRIMEIRA MENSAGEM SUGERIDA PARA NOVA CONVERSA

> Estou retomando o desenvolvimento de um sistema de gestão hoteleira (PMS) construído em NestJS + Next.js + Prisma + Postgres. Leia o documento `CONTEXTO-SISTEMA.md` que vou anexar (ou cole o conteúdo) para entender o estado atual completo.
> 
> Meu próximo passo é [escolha um]:
> - (a) Finalizar deploy em Vercel + Railway + Neon
> - (b) Implementar Sprint 5 (Consumos + Estoque)
> - (c) Implementar Sprint 6 (Fiscal + Comunicações)
> - (d) Resolver dívidas técnicas críticas (race conditions, JWT cookie, idempotency Redis)
> - (e) Outro: [descreva]
> 
> Atue como **parceiro crítico de debate**: aponte falhas no meu raciocínio, ofereça contrapontos, priorize a verdade sobre validação, use linguagem simples.

---

**Documento gerado em:** Junho/2026
**Versão do projeto:** Pós-Sprint 5 (Mobile-first refactor) + Hot patches de produção
**Próxima ação sugerida:** Subir em novo repositório limpo e completar deploy.
