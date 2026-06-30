# 🚀 Guia de deploy — Pousada Vista Mar

> Este guia assume **zero experiência** com terminal, Git ou DevOps.
> Tudo é feito por interface gráfica (GitHub Desktop + dashboards web).

---

## 📋 Resumo do que será feito

```
┌─────────────────────────────────────────────────────────────┐
│  GitHub (código)                                            │
│         │                                                   │
│         ├──► Vercel (frontend Next.js)                      │
│         │       └─► https://seu-app.vercel.app              │
│         │                                                   │
│         └──► Railway (backend NestJS)                       │
│                 ├─► Postgres (Neon)                         │
│                 ├─► Redis (Upstash)                         │
│                 └─► Asaas (pagamentos)                      │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Pré-requisitos

| Item              | Onde criar                            | Tempo |
|-------------------|---------------------------------------|-------|
| GitHub Desktop    | https://desktop.github.com/           | 5min  |
| Conta GitHub      | https://github.com/signup             | 3min  |
| Conta Vercel      | https://vercel.com/signup             | 2min  |
| Conta Railway     | https://railway.app/                  | 2min  |
| Conta Neon        | https://neon.tech/                    | 3min  |
| Conta Upstash     | https://upstash.com/                  | 3min  |
| Conta Resend      | https://resend.com/                   | 3min  |
| Conta Asaas       | https://www.asaas.com/registrar       | 5min  |

**Dica**: use o mesmo email/senha para todas (com a senha forte). Ou — melhor — use um gerenciador de senhas tipo Bitwarden (grátis).

---

## 🪜 Passo a passo

### Etapa 1 — Postgres (Neon) — 5 min

1. Acesse https://console.neon.tech/
2. Clique em **"Create project"**
3. Nome: `hotel-platform-prod`
4. Região: **AWS US East 2 (Ohio)** — mais barato e rápido pra Asaas
5. Postgres version: **16**
6. Clique **"Create"**
7. Você verá uma tela com **"Connection string"**
8. Copie o valor (começa com `postgresql://...`)
9. **Cole esse valor em algum lugar seguro** (vai ser sua `DATABASE_URL`)

### Etapa 2 — Redis (Upstash) — 5 min

1. Acesse https://console.upstash.com/
2. Clique em **"Create database"**
3. Nome: `hotel-platform-prod`
4. Type: **Regional**
5. Region: **us-east-1**
6. Eviction: deixe ON
7. Clique **"Create"**
8. Na próxima tela, role até **"Connect to your database"**
9. Selecione a aba **"Node.js"**
10. Copie o valor que começa com `rediss://` (com 2 esses)
11. **Cole esse valor em algum lugar seguro** (vai ser sua `REDIS_URL`)

### Etapa 3 — Subir código pro GitHub — 10 min

1. Abra o **GitHub Desktop** (já instalado)
2. Faça login com sua conta GitHub
3. Menu: **File → Add local repository**
4. Procure a pasta onde você descompactou o `hotel-platform.zip`
5. Vai aparecer aviso "This directory does not appear to be a Git repository" → clique em **"create a repository"**
6. Preencha:
   - Name: `hotel-platform`
   - Description: `Sistema de gestão da Pousada Vista Mar`
   - Local path: (já preenchido)
   - Git ignore: **None** (já temos)
7. Clique **"Create repository"**
8. No topo da janela: **"Publish repository"** → marque **"Keep this code private"** → **"Publish"**

✅ Código no GitHub.

### Etapa 4 — Deploy do backend (Railway) — 30 min

1. Acesse https://railway.app/dashboard
2. Clique em **"New project"** → **"Deploy from GitHub repo"**
3. Autorize o Railway no GitHub → escolha `hotel-platform`
4. Railway começa o build automaticamente — **vai dar erro**, porque faltam env vars. Normal.
5. Clique no serviço criado → aba **"Variables"**
6. Cole TODAS as variáveis abaixo (clique em "RAW Editor" pra colar várias de uma vez):

```env
DATABASE_URL=<cole_aqui_a_connection_string_da_neon>
REDIS_URL=<cole_aqui_a_url_do_upstash>
JWT_SECRET=<gere_em_https://generate-secret.vercel.app/64>
JWT_EXPIRES_IN=7d
CORS_ORIGINS=https://pousadavistamar.vercel.app
ASAAS_API_KEY=<sandbox por enquanto, deixe vazio se ainda não criou Asaas>
ASAAS_API_URL=https://sandbox.asaas.com/api/v3
ASAAS_WEBHOOK_TOKEN=<gere_outra_string_aleatoria>
NODE_ENV=production
```

7. Aba **"Settings"** → **"Networking"** → **"Generate Domain"**
8. Anote o domínio gerado (algo como `hotel-platform-production-xxxx.up.railway.app`)
9. Volte na aba **"Deployments"** → clique nos 3 pontinhos do último deploy → **"Redeploy"**
10. Espere 2-5 min. Quando aparecer "Active" verde, clique no domínio:
    - Acesse `<seu-dominio>/health` no navegador
    - Deve retornar `{"status":"ok"}` ✅

### Etapa 5 — Deploy do frontend (Vercel) — 15 min

1. Acesse https://vercel.com/new
2. Importe o repo `hotel-platform`
3. Em **"Configure Project"**:
   - **Framework Preset**: Next.js
   - **Root Directory**: clique em "Edit" → selecione `apps/web`
4. Em **"Environment Variables"** adicione:
   - `NEXT_PUBLIC_API_URL` = `https://<seu-dominio-railway>.up.railway.app`
5. Clique em **"Deploy"** — espere 2-4 min
6. Quando aparecer "Congratulations" você terá uma URL tipo `https://hotel-platform.vercel.app`
7. **VOLTA** no Railway → variável `CORS_ORIGINS` → atualiza pra essa URL real → redeploy

### Etapa 6 — Configurar Asaas (pagamentos) — 30 min

1. Crie conta em https://sandbox.asaas.com (use o sandbox primeiro!)
2. Menu lateral → **"Integrações"** → **"API Sandbox"** → copie a API Key
3. Cole no Railway: variável `ASAAS_API_KEY`
4. **Webhook**: ainda no Asaas → **"Integrações"** → **"Notificações via webhook"** → **"Adicionar webhook"**
   - URL: `https://<seu-dominio-railway>/api/v1/webhooks/asaas`
   - Evento: deixe TODOS marcados
   - Token: o mesmo valor que você colocou em `ASAAS_WEBHOOK_TOKEN` no Railway
5. Salvar.

---

## 🧪 Teste final

1. Acesse `https://<seu-vercel>.vercel.app/login`
2. Login: `admin@pousadavistamar.com.br` / `admin123`
3. Crie uma reserva de teste
4. Vá em **"Cobrar"** → escolha Pix
5. O QR Code deve aparecer
6. Pague no app Asaas sandbox (eles dão simulação de pagamento)
7. Volte na reserva — status deve mudar pra "Pago" automaticamente

Se isso tudo funcionar = **sistema rodando no ar**.

---

## ❗ Quando algo der errado

| Sintoma                                          | Provável causa                                    |
|--------------------------------------------------|---------------------------------------------------|
| `/health` retorna erro                           | DATABASE_URL errada ou Neon não acordou ainda     |
| Frontend mostra "Failed to fetch"                | NEXT_PUBLIC_API_URL errada OU CORS_ORIGINS errado |
| Reserva não vira "Pago"                          | Webhook não chegou — checar logs do Railway       |
| QR Code não aparece                              | ASAAS_API_KEY errada                              |
| `Internal server error` ao logar                 | JWT_SECRET vazio ou faltando                      |
| Build do Railway falha                           | Veja logs — geralmente é env var faltando         |

---

## 💸 Custo mensal estimado

| Serviço   | Free tier        | Quando começa a cobrar     |
|-----------|------------------|----------------------------|
| Vercel    | 100 GB/mês       | ~10k visitas/mês — bem longe |
| Railway   | $5 trial         | Sempre. Conta ~R$ 30-60/mês |
| Neon      | 500 MB + 200h    | ~500 reservas               |
| Upstash   | 10k requests/dia | ~20 reservas/dia            |
| Resend    | 3k emails/mês    | Bem longe                   |
| **Total** |                  | **R$ 30-60/mês** nos primeiros meses |

---



---

## ⚠️ Pegadinhas conhecidas

### Erro: `ERR_PNPM_NO_LOCKFILE` no build do Railway
**Sintoma:** Build falha com `Cannot install with "frozen-lockfile" because pnpm-lock.yaml is absent`.

**Causa:** Railway exige o arquivo `pnpm-lock.yaml` para builds reproduzíveis.

**Solução:** O arquivo `pnpm-lock.yaml` JÁ está incluso no projeto. Se você criou o repositório a partir do zip e o arquivo não foi commitado por algum motivo, regenere localmente:

```bash
cd hotel-platform
pnpm install --lockfile-only
git add pnpm-lock.yaml
git commit -m "add: pnpm-lock.yaml"
git push
```

### Build no Railway está usando builder antigo
**Sintoma:** Railway ignora `nixpacks.toml`.

**Solução:** Garanta que `railway.json` define `"builder": "NIXPACKS"`. Se não funcionar, vá em Settings → Build → Builder → selecione "Nixpacks" explicitamente.

### CORS errors no frontend
**Sintoma:** Vercel mostra "Failed to fetch" em todas as chamadas API.

**Solução:** Verificar variável `CORS_ORIGINS` no Railway — deve incluir a URL do Vercel exatamente (sem `/` no final). Exemplo: `https://hotel-platform.vercel.app`.

### Webhook do Asaas não chega
**Sintoma:** Pagamento Pix é feito mas reserva não muda pra "Pago".

**Causas comuns:**
1. URL do webhook no painel Asaas está errada (deve ser `https://<seu-railway>/api/v1/webhooks/asaas`)
2. `ASAAS_WEBHOOK_TOKEN` no Railway diferente do configurado no painel Asaas
3. Backend retornando 500 para o webhook (verificar logs do Railway)


## 🆘 Quando voltar pro Claude pedir ajuda

Tire screenshot de:
- Tela de erro
- Aba de logs do Railway/Vercel (mostra a stack trace completa)
- Aba de Variables (esconda os secrets antes!!)

Cole no chat e descreva: "tava na etapa X, fiz Y, deu Z".
