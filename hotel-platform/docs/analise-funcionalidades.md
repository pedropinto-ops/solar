# Análise de funcionalidades — Solar Irará vs. mercado (PMS)

> Comparativo entre o portal do Solar Irará e o que sistemas de gestão hoteleira
> (PMS) de mercado oferecem — Brasil (Hospedin, HITS, Cloudbeds, Desbravador,
> RoomRaccoon) e internacionais (Cloudbeds, Mews, RoomMaster). Gerado em jul/2026.

## 1. Mapa de funcionalidades de um PMS completo

| Área | Funcionalidades típicas |
|------|--------------------------|
| **Reservas** | mapa/agenda, reserva direta, cadastro de hóspede, entradas/saídas, disponibilidade em tempo real, reservas de grupo/eventos, hold |
| **Motor de reservas (site)** | busca de disponibilidade, seleção, pagamento online, confirmação |
| **Channel Manager** | sincroniza tarifa e disponibilidade com Booking, Airbnb, Expedia (anti-overbooking automático) |
| **Gestão de tarifas (RMS)** | temporadas, planos tarifários, tarifa dinâmica/por ocupação, restrições (estadia mínima, CTA/CTD), calendário de tarifas |
| **Recepção / operação** | check-in/out, folio (conta do hóspede), lançamento de consumo, split de conta, status de quarto |
| **Governança** | tarefas de limpeza, checklist, inspeção, status de quarto |
| **Financeiro** | caixa do dia / fechamento de turno, contas a pagar/receber, formas de pagamento, night audit |
| **Fiscal** | NFS-e/NF-e automática, impostos (ISS/taxa de turismo) |
| **Faturamento B2B** | cliente corporativo, fatura mensal, condições de pagamento |
| **Comunicação** | e-mail e WhatsApp automáticos (confirmação, lembrete, pós-estadia), templates |
| **Experiência do hóspede** | check-in online, portal do hóspede, upsells/add-ons, avaliações/reputação |
| **POS** | ponto de venda de restaurante/bar/frigobar lançando no folio |
| **Estoque / almoxarifado** | produtos, movimentações, alertas de mínimo |
| **Relatórios / BI** | ocupação, RevPAR, ADR, ALOS, receita por período, previsão de demanda |
| **CRM / marketing** | perfil e histórico do hóspede, segmentação, fidelidade, campanhas |
| **Manutenção** | chamados/tickets de manutenção de quartos |
| **Infra / segurança** | multi-propriedade, controle de acesso, integração com fechaduras, auditoria |

## 2. O que o Solar JÁ tem

- ✅ Multi-tenant, autenticação (JWT), papéis de usuário
- ✅ Reservas: criação (recepção), atribuição de quarto, check-in, check-out, cancelamento, **folio (ChargeItem)**
- ✅ Motor de reservas no site (`/reservar`): disponibilidade + valor, cadastro, **aceite eletrônico de contrato**, cria **solicitação** (sem pagamento online ainda)
- ✅ Quartos (categoria única) + agenda/mapa
- ✅ Hóspedes: CRUD, LGPD (soft-delete), campos FNRH
- ✅ Governança: máquina de estados de limpeza, **checklist**, inspeção, status de quarto, sem atribuição (qualquer funcionário)
- ✅ Dashboard: ocupação, chegadas, saídas, in-house
- ✅ **Almoxarifado** (produtos, estoque, movimentações, alertas)
- ✅ Constraint anti-overbooking no banco
- ✅ Versionamento + pop-up de atualização
- ⚠️ Modelos prontos mas **sem uso/tela**: Company (B2B), Invoice (fatura), FiscalDocument (NFS-e), GuestDocument, Payment (Asaas codado mas desligado)

## 3. Lacunas (o que ainda NÃO existe)

- ❌ **Pagamento online ativo** (Asaas codado, mas desligado/não testado)
- ❌ **Lançamento de consumo** (frigobar/restaurante) na conta — sem tela
- ❌ **Caixa do dia / fechamento de turno**
- ❌ **Comunicação automática** (WhatsApp/e-mail)
- ❌ **Relatórios gerenciais** (RevPAR, ADR, ocupação por período, receita)
- ❌ **NFS-e automática** (Focus NFe — só stub)
- ❌ **Channel Manager** (Booking/Airbnb) — maior fonte de reservas de pousada no BR
- ❌ **Gestão de tarifas** (temporada, tarifa dinâmica, restrições, calendário)
- ❌ **Check-in online / portal do hóspede**
- ❌ **Faturamento corporativo (B2B)**
- ❌ **Manutenção** (chamados)
- ❌ **Contas a pagar / despesas**
- ❌ **CRM / fidelidade / marketing**, avaliações/reputação
- ❌ **POS** dedicado (restaurante/bar)
- ❌ **Upload de fotos** (R2 não configurado — fotos de limpeza, docs FNRH)
- ⚠️ Dívidas técnicas: sem testes automatizados, JWT em localStorage, sem monitoramento (Sentry)

## 4. Lista priorizada — o que acrescentar no Solar

Priorizado para **pousada 15–50 quartos, dono na operação, foco em vender diárias**.

### 🟢 P0 — Ganhos rápidos (muito valor, quase prontos)
1. **Ativar pagamento online (Asaas)** — Pix/sinal na reserva pública. Já codado; falta configurar conta + testar. Converte "solicitação" em reserva paga.
2. **Lançar consumo no folio** — frigobar/restaurante/serviços na conta do hóspede. `ChargeItem` já existe; falta a tela. Integra com o checklist e o almoxarifado.
3. **Caixa do dia / fechamento** — resumo financeiro diário por forma de pagamento. Essencial pro dono.

### 🟡 P1 — Alto retorno para pousada BR
4. **Confirmações automáticas (WhatsApp + e-mail)** — reserva confirmada, lembrete de check-in, pós-estadia. Economiza horas/dia da recepção. (Resend + Meta WhatsApp)
5. **Relatórios gerenciais** — ocupação, RevPAR, ADR, receita por período. Base já existe no dashboard.
6. **Channel Manager básico (Booking.com)** — a maior fonte de reservas de pousada no Brasil. ⚠️ risco de overbooking + integração complexa; avaliar integração real vs. atualização manual.
7. **NFS-e automática no check-out** (Focus NFe) — obrigação fiscal; inviável manual em volume.

### 🟠 P2 — Conforme o hotel cresce
8. **Gestão de tarifas** — temporadas, tarifa por dia/ocupação, estadia mínima, calendário de tarifas.
9. **Check-in online / portal do hóspede** — FNRH antecipado, menos fila.
10. **Faturamento corporativo (B2B)** — Company/Invoice já no schema.
11. **Manutenção** — chamados de manutenção de quartos.
12. **Contas a pagar / despesas** — fluxo de caixa completo.

### 🔵 P3 — Depois / diferenciais
13. CRM / fidelidade / segmentação / campanhas
14. Reputação / avaliações
15. POS dedicado (restaurante/bar)
16. Upsells / add-ons (late checkout, transfer, passeios)
17. Multi-propriedade, BI avançado, fechaduras eletrônicas

### 🔧 Transversal (fazer em paralelo)
- Testes automatizados dos fluxos críticos (check-in/out, reserva pública)
- Monitoramento (Sentry) + logs estruturados
- Upload de fotos (Cloudflare R2) — habilita fotos de limpeza e docs do hóspede
- JWT em cookie httpOnly (segurança/LGPD)

## Fontes
- Cloudbeds — PMS: https://www.cloudbeds.com/property-management-system/
- Hospedin: https://hospedin.com/
- HQBeds — o que é PMS: https://www.hqbeds.com.br/blog/sistema-pms-hotel
- RoomMaster — hotel PMS features 2026: https://www.roommaster.com/blog/what-is-hotel-pms-system
- AltexSoft — PMS products and features: https://www.altexsoft.com/blog/hotel-property-management-systems-products-and-features/
- HotelTechReport — revenue management systems: https://hoteltechreport.com/revenue-management/revenue-management-systems
