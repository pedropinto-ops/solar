# Fluxos Críticos — Hotel Platform MVP

Este documento especifica o comportamento end-to-end dos 5 fluxos mais críticos do sistema. Cada fluxo inclui: passo-a-passo, payloads de API, mudanças de estado no banco, edge cases e regras de negócio.

**Audiência:** backend, frontend, mobile, QA e produto.

**Como usar:** consulte o fluxo correspondente antes de implementar qualquer feature relacionada. Atualize aqui antes de mudar comportamento na produção.

---

## Índice

1. [Reserva via Link Público](#fluxo-1-reserva-via-link-público) — B2C, do clique ao confirmado
2. [Check-in](#fluxo-2-check-in) — do "vai chegar" ao "está dentro"
3. [Check-out com Fechamento de Conta](#fluxo-3-check-out-com-fechamento-de-conta) — fechamento + NFS-e
4. [Consumo de Frigobar](#fluxo-4-consumo-de-frigobar) — folio + estoque atômico
5. [Ciclo de Limpeza](#fluxo-5-ciclo-de-limpeza) — DIRTY → AVAILABLE

---

## Convenções

- **Estados** em `MAIÚSCULA_SNAKE` referem-se a enums do schema.
- **Endpoints** usam prefixo `/api/v1`.
- **Eventos** são publicados em fila Redis/BullMQ para processamento assíncrono.
- **Idempotência**: toda operação crítica aceita `Idempotency-Key` no header.
- **Erros** seguem padrão Problem Details (RFC 7807).

---

# FLUXO 1: Reserva via Link Público

## Contexto
Hóspede acessa `seuhotel.com/reservar/{slug}`, escolhe datas, seleciona categoria, paga via Pix e recebe voucher.

## Atores
- **Hóspede** (anônimo) — sem login
- **Sistema** (backend + Asaas + WhatsApp + e-mail)

## Diagrama de Sequência

```
Hóspede        Frontend Público     API Backend      Banco          Asaas       WhatsApp
   │                  │                  │              │              │             │
   │─ acessa URL ────▶│                  │              │              │             │
   │                  │── GET /public/   │              │              │             │
   │                  │   property/{slug}│              │              │             │
   │                  │─────────────────▶│              │              │             │
   │                  │                  │── busca ────▶│              │             │
   │                  │                  │◀── dados ────│              │             │
   │                  │◀─ property info ─│              │              │             │
   │                  │                  │              │              │             │
   │─ escolhe datas ─▶│                  │              │              │             │
   │                  │── GET availability(dates) ─────▶│              │             │
   │                  │                  │── query ────▶│              │             │
   │                  │                  │◀─ disponiv. ─│              │             │
   │                  │◀── tipos/preços ─│              │              │             │
   │                  │                  │              │              │             │
   │─ preenche dados─▶│                  │              │              │             │
   │   e clica pagar  │                  │              │              │             │
   │                  │── POST /public/  │              │              │             │
   │                  │   reservations   │              │              │             │
   │                  │─────────────────▶│              │              │             │
   │                  │                  │── BEGIN TX ─▶│              │             │
   │                  │                  │              │              │             │
   │                  │                  │ verifica disponibilidade   │             │
   │                  │                  │ cria/recupera Guest        │             │
   │                  │                  │ cria Reservation PENDING   │             │
   │                  │                  │ holdExpiresAt = +30min     │             │
   │                  │                  │              │              │             │
   │                  │                  │── COMMIT ───▶│              │             │
   │                  │                  │              │              │             │
   │                  │                  │── POST /payments(PIX) ────▶│             │
   │                  │                  │◀── QR Code + copia-cola ───│             │
   │                  │                  │              │              │             │
   │                  │                  │ salva Payment (PENDING)    │             │
   │                  │                  │              │              │             │
   │                  │◀─ {qr, copy} ────│              │              │             │
   │◀─ tela QR Code ──│                  │              │              │             │
   │                  │                  │── envia mensagem ──────────────────────▶│
   │                  │                  │              │              │             │
   │─ paga via Pix ───────────────────────────────────────────────────▶│             │
   │                  │                  │              │              │             │
   │                  │                  │◀── webhook payment.received ─│             │
   │                  │                  │ valida HMAC                 │             │
   │                  │                  │ Payment → PAID              │             │
   │                  │                  │ Reservation → CONFIRMED     │             │
   │                  │                  │ holdExpiresAt = null        │             │
   │                  │                  │ gera ChargeItems das diárias│             │
   │                  │                  │── envia voucher ────────────────────────▶│
   │                  │                  │              │              │             │
   │◀─ voucher WhatsApp ─────────────────────────────────────────────────────────────│
```

## Passo a Passo

### Passo 1.1: Carregar página pública

`GET /api/v1/public/property/{slug}`

**Response 200:**
```json
{
  "id": "clxk2m3n40000abc",
  "name": "Pousada Vista Mar",
  "logoUrl": "https://r2.../logo.png",
  "primaryColor": "#0066CC",
  "checkInTime": "14:00",
  "checkOutTime": "12:00",
  "cancellationPolicy": {
    "freeUntilDays": 7,
    "partialUntilDays": 3,
    "partialPercent": 50
  }
}
```

**Cache:** 5 minutos no CDN (Vercel Edge). Mudança de identidade visual demora a propagar — aceitável.

### Passo 1.2: Buscar disponibilidade

`GET /api/v1/public/property/{slug}/availability?checkIn=2026-06-15&checkOut=2026-06-18&adults=2&children=0`

**Validações:**
- `checkIn` ≥ hoje (não permite reservar no passado)
- `checkOut` > `checkIn`
- `(checkOut - checkIn)` ≤ 30 dias (proteção contra abuso)
- `adults + children` ≥ 1 e ≤ 10

**Response 200:**
```json
{
  "nights": 3,
  "roomTypes": [
    {
      "id": "clxk2t1...",
      "name": "Standard Casal",
      "description": "Quarto confortável com cama de casal",
      "photos": ["https://r2.../std-1.jpg", "..."],
      "amenities": ["wifi", "ar", "tv"],
      "maxOccupancy": 2,
      "available": 3,
      "dailyRate": 280.00,
      "totalAmount": 840.00
    },
    {
      "id": "clxk2t2...",
      "name": "Luxo Vista Mar",
      "available": 0,
      "soldOut": true
    }
  ]
}
```

**Query SQL (essência):**
```sql
SELECT rt.*, COUNT(r.id) AS available_rooms
FROM room_types rt
JOIN rooms r ON r.room_type_id = rt.id AND r.active = true
WHERE rt.property_id = $1 AND rt.active = true
  AND r.status NOT IN ('MAINTENANCE','OUT_OF_ORDER','BLOCKED')
  AND NOT EXISTS (
    SELECT 1 FROM reservations res
    WHERE res.room_id = r.id
      AND res.status IN ('CONFIRMED','CHECKED_IN','PENDING')
      AND res.check_in_date < $3   -- checkOut
      AND res.check_out_date > $2  -- checkIn
      AND (res.status != 'PENDING' OR res.hold_expires_at > NOW())
  )
GROUP BY rt.id;
```

Reparar no filtro de PENDING: só conta como ocupando se o hold ainda não expirou. Holds expirados serão limpos por cron, mas a query já ignora.

### Passo 1.3: Criar reserva (a parte crítica)

`POST /api/v1/public/reservations`

**Headers:**
```
Content-Type: application/json
Idempotency-Key: <uuid v4>     ← gerado no frontend, evita duplicação se clicar 2x
```

**Body:**
```json
{
  "propertyId": "clxk2m3n40000abc",
  "roomTypeId": "clxk2t1...",
  "checkInDate": "2026-06-15",
  "checkOutDate": "2026-06-18",
  "adults": 2,
  "children": 0,
  "guest": {
    "fullName": "Maria Silva",
    "documentType": "CPF",
    "documentNumber": "12345678900",
    "email": "maria@example.com",
    "phone": "+5571999998888",
    "whatsapp": "+5571999998888",
    "birthDate": "1985-04-20",
    "consentMarketing": true
  },
  "paymentMethod": "PIX",
  "guestNotes": "Chego por volta das 21h"
}
```

**Lógica do backend (em transação):**

```typescript
async createPublicReservation(input: CreatePublicReservationDto) {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Verifica idempotência
    const existing = await tx.idempotencyKey.findUnique({
      where: { key: input.idempotencyKey }
    });
    if (existing) return existing.response;

    // 2. Re-valida disponibilidade DENTRO da transação (race condition)
    const available = await this.checkAvailability(tx, input);
    if (!available) {
      throw new ConflictException('Quarto não está mais disponível');
    }

    // 3. Cria ou recupera Guest (busca por CPF)
    let guest = await tx.guest.findFirst({
      where: {
        propertyId: input.propertyId,
        documentNumber: input.guest.documentNumber,
        deletedAt: null
      }
    });
    if (!guest) {
      guest = await tx.guest.create({ data: { ...input.guest, propertyId } });
    } else {
      // Atualiza dados de contato (podem ter mudado)
      guest = await tx.guest.update({
        where: { id: guest.id },
        data: {
          email: input.guest.email,
          phone: input.guest.phone,
          whatsapp: input.guest.whatsapp
        }
      });
    }

    // 4. Calcula valor
    const nights = differenceInDays(input.checkOutDate, input.checkInDate);
    const roomType = await tx.roomType.findUnique({ where: { id: input.roomTypeId } });
    const dailyRate = roomType.basePrice;
    const totalAmount = dailyRate.mul(nights);

    // 5. Gera código de reserva
    const code = await generateReservationCode(tx, input.propertyId); // "RES-2026-00123"

    // 6. Cria Reservation com hold de 30min
    const reservation = await tx.reservation.create({
      data: {
        propertyId: input.propertyId,
        code,
        primaryGuestId: guest.id,
        roomTypeId: input.roomTypeId,
        // roomId: null  ← alocação posterior
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nights,
        adults: input.adults,
        children: input.children,
        totalAmount,
        dailyRate,
        billingMode: 'DEPOSIT_BALANCE',
        depositPercent: 30,
        source: 'DIRECT',
        status: 'PENDING',
        holdExpiresAt: addMinutes(new Date(), 30),
        guests: {
          create: { guestId: guest.id, isPrimary: true }
        }
      }
    });

    // 7. Calcula valor do sinal (30%)
    const depositAmount = totalAmount.mul(0.3);

    // 8. Cria Payment PENDING e chama Asaas
    const asaasPayment = await this.asaas.createPayment({
      billingType: 'PIX',
      value: depositAmount.toNumber(),
      dueDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      description: `Sinal reserva ${code}`,
      externalReference: reservation.id,
      customer: {
        name: guest.fullName,
        cpfCnpj: guest.documentNumber,
        email: guest.email
      }
    });

    const payment = await tx.payment.create({
      data: {
        propertyId: input.propertyId,
        reservationId: reservation.id,
        amount: depositAmount,
        method: 'PIX',
        status: 'PENDING',
        gatewayProvider: 'asaas',
        gatewayId: asaasPayment.id,
        pixQrCode: asaasPayment.pix.encodedImage,
        pixCopyPaste: asaasPayment.pix.payload,
        pixExpiresAt: addMinutes(new Date(), 30)
      }
    });

    // 9. Salva idempotency key
    await tx.idempotencyKey.create({
      data: {
        key: input.idempotencyKey,
        response: { reservationId: reservation.id, paymentId: payment.id }
      }
    });

    // 10. Dispara eventos assíncronos (fora da TX, na fila)
    await this.events.publish('reservation.created', {
      reservationId: reservation.id,
      paymentId: payment.id
    });

    return { reservation, payment };
  });
}
```

**Response 201:**
```json
{
  "reservation": {
    "id": "clxk5...",
    "code": "RES-2026-00123",
    "status": "PENDING",
    "holdExpiresAt": "2026-05-28T15:30:00Z",
    "totalAmount": 840.00,
    "depositAmount": 252.00
  },
  "payment": {
    "id": "clxk6...",
    "method": "PIX",
    "amount": 252.00,
    "pixQrCode": "data:image/png;base64,iVBOR...",
    "pixCopyPaste": "00020126580014BR.GOV.BCB.PIX...",
    "pixExpiresAt": "2026-05-28T15:30:00Z"
  }
}
```

### Passo 1.4: Webhook de pagamento

`POST /api/v1/webhooks/asaas` *(endpoint público, mas validado por HMAC)*

**Headers:**
```
asaas-access-token: <token configurado no Asaas>
```

**Body (exemplo `PAYMENT_RECEIVED`):**
```json
{
  "event": "PAYMENT_RECEIVED",
  "payment": {
    "id": "pay_8723764234",
    "status": "RECEIVED",
    "value": 252.00,
    "externalReference": "clxk5..."
  }
}
```

**Lógica:**

```typescript
async handleAsaasWebhook(headers, body) {
  // 1. Valida token (defesa contra spoofing)
  if (headers['asaas-access-token'] !== process.env.ASAAS_WEBHOOK_TOKEN) {
    throw new UnauthorizedException();
  }

  // 2. Idempotência: webhook pode chegar 2x
  const eventId = `${body.event}_${body.payment.id}`;
  const processed = await this.cache.get(`webhook:${eventId}`);
  if (processed) return { ok: true, alreadyProcessed: true };

  // 3. Localiza Payment pelo gatewayId
  const payment = await this.prisma.payment.findFirst({
    where: { gatewayId: body.payment.id }
  });
  if (!payment) {
    // Não é nosso, ignora
    return { ok: true, ignored: true };
  }

  // 4. Processa conforme evento
  switch (body.event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
      await this.confirmPayment(payment.id);
      break;
    case 'PAYMENT_REFUNDED':
      await this.refundPayment(payment.id, body.payment.value);
      break;
    case 'PAYMENT_OVERDUE':
      // Pix venceu — depende do contexto
      break;
  }

  // 5. Marca como processado (TTL 7 dias)
  await this.cache.set(`webhook:${eventId}`, '1', 7 * 24 * 3600);

  return { ok: true };
}

async confirmPayment(paymentId: string) {
  await this.prisma.$transaction(async (tx) => {
    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: { status: 'PAID', paidAt: new Date() }
    });

    const reservation = await tx.reservation.findUnique({
      where: { id: payment.reservationId },
      include: { payments: { where: { status: 'PAID' } } }
    });

    // Soma todos os pagamentos confirmados
    const paidAmount = reservation.payments.reduce(
      (sum, p) => sum.add(p.amount), new Decimal(0)
    );

    // Atualiza paidAmount
    const updateData: any = { paidAmount };

    // Se atingiu o sinal mínimo (depositPercent), CONFIRMA
    const requiredDeposit = reservation.totalAmount.mul(reservation.depositPercent).div(100);
    if (paidAmount.gte(requiredDeposit) && reservation.status === 'PENDING') {
      updateData.status = 'CONFIRMED';
      updateData.confirmedAt = new Date();
      updateData.holdExpiresAt = null;
    }

    await tx.reservation.update({
      where: { id: reservation.id },
      data: updateData
    });

    // Gera ChargeItems das diárias (snapshot do valor)
    if (updateData.status === 'CONFIRMED') {
      await this.generateRoomNightCharges(tx, reservation);
    }
  });

  // Eventos assíncronos
  await this.events.publish('payment.confirmed', { paymentId });
  await this.events.publish('reservation.confirmed', { reservationId: payment.reservationId });
}
```

### Passo 1.5: Envio de voucher (assíncrono)

Job listening em `reservation.confirmed`:

1. Renderiza template de voucher (HTML/PDF) com QR Code da reserva
2. Envia por e-mail (Resend)
3. Envia por WhatsApp (Meta Cloud API, template aprovado)

Falha em envio **não reverte** a confirmação da reserva. Reserva confirmada é confirmada, comunicação é "best effort" (com retry).

## Edge Cases

| Caso | Tratamento |
|---|---|
| Hóspede clica "pagar" 2x rapidamente | `Idempotency-Key` retorna a mesma reserva, não cria duplicada |
| Hóspede tem CPF inválido | Validação de checksum no frontend e backend, rejeita antes de criar |
| Quarto fica indisponível entre busca e criação | Transação re-valida; retorna 409 Conflict com `error_code: ROOM_NO_LONGER_AVAILABLE` |
| Asaas indisponível | Tenta 3x com exponential backoff (1s, 4s, 16s); se falhar, retorna 503 e reserva fica `PENDING` sem payment para ser tentada manualmente |
| Webhook chega 2x | Idempotência via `webhook:{event}_{paymentId}` no Redis |
| Hold expira durante pagamento | Cron a cada 1 min: `UPDATE reservations SET status='CANCELLED', cancellationReason='HOLD_EXPIRED' WHERE status='PENDING' AND holdExpiresAt < NOW() AND NOT EXISTS (SELECT 1 FROM payments WHERE reservationId=... AND status='PAID')` |
| Hóspede paga DEPOIS de expirado | Webhook chega; sistema detecta que reserva está CANCELLED e Payment status `EXPIRED`; cria caso no painel admin para estorno manual ou recriação |
| Valor pago ≠ valor cobrado | Aceita; marca como `PARTIALLY_PAID`; recepção resolve no check-in |
| Dois Pix do mesmo CPF para a mesma reserva (duplo pagamento) | Sistema aceita; ambos viram PAID; recepção vê excedente no folio; pode estornar via Asaas |
| CPF já existe na propriedade com dados diferentes | Atualiza email/phone (são dinâmicos); preserva nome (mudança de nome exige confirmação manual) |

## Regras de Negócio Documentadas

1. **Hold de 30 minutos**: tempo entre criar reserva PENDING e o Pix expirar. Se hóspede pagar em 31min, paga mas reserva pode ter sido cancelada. Trade-off: 30min é gentil sem permitir hold abusivo.
2. **Sinal de 30%**: pagamento mínimo para confirmar. Configurável por propriedade.
3. **Apenas 1 quarto por reserva no MVP**: grupo (várias reservas vinculadas) fica para v2.
4. **Não aloca quarto físico no momento da reserva**: alocação é decisão da recepção no check-in (otimização de ocupação).
5. **Acompanhantes não são pedidos no link público**: só o titular. Recepção completa no check-in (FNRH).

---

# FLUXO 2: Check-in

## Contexto
Hóspede com reserva `CONFIRMED` chega ao hotel. Recepção verifica documentos, completa cadastro de acompanhantes, aloca quarto físico, cobra saldo (se houver), atualiza estado do quarto para ocupado.

## Atores
- **Hóspede** (presencial)
- **Recepcionista** (autenticado, role RECEPTION ou MANAGER)

## Pré-condições

- Reserva existe e tem status `CONFIRMED`
- Data atual ≥ `checkInDate` (ou recepção autoriza early check-in com justificativa)
- Quarto físico está em status `AVAILABLE` (ou exceção autorizada)

## Diagrama

```
Recepcionista       Frontend Web         API              Banco
   │                    │                  │                 │
   │── busca reserva ──▶│                  │                 │
   │   (nome/CPF/code)  │                  │                 │
   │                    │── GET /reservations?q=... ────────▶│
   │                    │◀── lista ─────────────────────────│
   │                    │                  │                 │
   │── abre reserva ───▶│                  │                 │
   │                    │── GET /reservations/{id} ─────────▶│
   │                    │◀── detalhes ──────────────────────│
   │                    │                  │                 │
   │── atualiza dados  ▶│                  │                 │
   │   do titular       │── PATCH /guests/{id} ─────────────▶│
   │                    │                  │                 │
   │── adiciona acomp. ▶│                  │                 │
   │                    │── POST /reservations/{id}/guests ─▶│
   │                    │                  │                 │
   │── escolhe quarto ─▶│                  │                 │
   │                    │── GET /rooms/available?type=... ──▶│
   │                    │◀── lista ─────────────────────────│
   │                    │                  │                 │
   │── confirma quarto ▶│                  │                 │
   │                    │── PATCH /reservations/{id}/assign-room ▶│
   │                    │                  │                 │
   │── faz check-in ───▶│                  │                 │
   │                    │── POST /reservations/{id}/check-in ▶│
   │                    │                  │── BEGIN TX ────▶│
   │                    │                  │ valida quarto AVAILABLE
   │                    │                  │ valida pagamento (depósito ok)
   │                    │                  │ Reservation → CHECKED_IN
   │                    │                  │ checkedInAt = now()
   │                    │                  │ Room → OCCUPIED
   │                    │                  │ Gera FNRH (background)
   │                    │                  │── COMMIT ──────▶│
   │                    │◀─ ok + voucher ─│                 │
   │◀─ "boas-vindas" ──│                  │                 │
```

## Endpoints

### 2.1 Buscar reserva
`GET /api/v1/reservations?q={termo}&status=CONFIRMED&date=today`

- `q`: busca em nome do hóspede, CPF, código de reserva
- `date=today`: chegadas do dia
- `status=CONFIRMED`: filtro

### 2.2 Atualizar dados do titular
`PATCH /api/v1/guests/{guestId}`

Recepção completa campos faltantes (endereço, profissão, dados de viagem para FNRH).

**Body parcial:**
```json
{
  "occupation": "Engenheira",
  "addressCity": "São Paulo",
  "addressState": "SP",
  "addressZip": "01234567",
  "travelOrigin": "São Paulo",
  "travelDestination": "Porto Seguro",
  "travelPurpose": "LEISURE",
  "transportMeans": "PLANE"
}
```

### 2.3 Adicionar acompanhante

`POST /api/v1/reservations/{id}/guests`

**Body:**
```json
{
  "guest": {
    "fullName": "Pedro Silva",
    "documentType": "CPF",
    "documentNumber": "98765432100",
    "birthDate": "2015-08-12",
    "nationality": "BR"
  },
  "isPrimary": false
}
```

Sistema busca CPF na base; se existe, vincula. Se não, cria. Valida que `adults + children <= roomType.maxOccupancy`.

### 2.4 Listar quartos disponíveis (alocação)

`GET /api/v1/rooms/available?roomTypeId={id}&checkIn=2026-06-15&checkOut=2026-06-18`

Retorna quartos `AVAILABLE` da categoria pedida, que não tenham conflito de reserva no período.

### 2.5 Atribuir quarto à reserva

`PATCH /api/v1/reservations/{id}/assign-room`

**Body:**
```json
{ "roomId": "clxk7..." }
```

**Validações:**
- Quarto pertence à propriedade
- Quarto pertence ao `roomTypeId` da reserva (ou recepcionista autoriza upgrade)
- Quarto não tem outras reservas no período (exclusion constraint do Postgres protege)

### 2.6 Executar check-in

`POST /api/v1/reservations/{id}/check-in`

**Body (opcional):**
```json
{
  "earlyCheckIn": false,
  "notes": "Pediu cama extra",
  "additionalCharges": []
}
```

**Lógica:**

```typescript
async checkIn(reservationId: string, userId: string, dto: CheckInDto) {
  return await this.prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true, payments: true, guests: { include: { guest: true } } }
    });

    // Validações
    if (reservation.status !== 'CONFIRMED') {
      throw new BadRequestException(`Reserva em status ${reservation.status}, não pode fazer check-in`);
    }
    if (!reservation.roomId) {
      throw new BadRequestException('Atribua um quarto antes do check-in');
    }
    if (reservation.room.status !== 'AVAILABLE') {
      throw new ConflictException(`Quarto ${reservation.room.number} está ${reservation.room.status}`);
    }

    // Verifica se hoje é a data ou se foi autorizado early check-in
    const today = startOfDay(new Date());
    const checkInDay = startOfDay(reservation.checkInDate);
    if (today < checkInDay && !dto.earlyCheckIn) {
      throw new BadRequestException('Use earlyCheckIn=true para check-in antecipado');
    }

    // Valida que todos os hóspedes têm FNRH minimamente preenchida
    for (const rg of reservation.guests) {
      const g = rg.guest;
      const missing = [];
      if (!g.fullName) missing.push('fullName');
      if (!g.documentNumber) missing.push('documentNumber');
      if (!g.addressCity) missing.push('addressCity'); // exigido FNRH
      if (missing.length) {
        throw new BadRequestException(
          `Hóspede ${g.fullName || '(sem nome)'} com campos faltantes: ${missing.join(', ')}`
        );
      }
    }

    // Validação financeira: depósito tem que estar pago
    const totalPaid = reservation.payments
      .filter(p => p.status === 'PAID')
      .reduce((s, p) => s.add(p.amount), new Decimal(0));
    const minRequired = reservation.totalAmount.mul(reservation.depositPercent).div(100);

    if (totalPaid.lt(minRequired) && reservation.billingMode !== 'POSTPAID_CORPORATE') {
      throw new BadRequestException(
        `Pagamento insuficiente: pago R$ ${totalPaid}, mínimo R$ ${minRequired}`
      );
    }

    // Mutações
    await tx.reservation.update({
      where: { id: reservationId },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date()
      }
    });

    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: 'OCCUPIED' }
    });

    await tx.roomStatusLog.create({
      data: {
        roomId: reservation.roomId,
        previousStatus: 'AVAILABLE',
        newStatus: 'OCCUPIED',
        reason: `Check-in: ${reservation.code}`,
        changedById: userId
      }
    });

    await tx.auditLog.create({
      data: {
        propertyId: reservation.propertyId,
        userId,
        action: 'reservation.checked_in',
        entityType: 'Reservation',
        entityId: reservationId
      }
    });
  });

  // Eventos assíncronos
  await this.events.publish('reservation.checked_in', { reservationId });
  // → gera FNRH PDF, salva no Storage
  // → opcionalmente envia para SisHospedagem (Ministério Turismo)
  // → envia "boas-vindas" via WhatsApp com info do hotel
}
```

**Response 200:**
```json
{
  "reservation": { /* atualizada */ },
  "room": { "number": "201", "status": "OCCUPIED" },
  "fnrhUrl": "https://r2.../fnrh/{reservationId}.pdf"
}
```

## Edge Cases

| Caso | Tratamento |
|---|---|
| Hóspede chega 4h antes (early check-in) | Recepção marca `earlyCheckIn: true`; sistema permite; pode cobrar taxa |
| Quarto está `DIRTY` (limpeza atrasada) | Bloqueia check-in; recepção pode usar "force check-in" se MANAGER, mas log audita |
| Hóspede chegou mas falta documento | Permite check-in com flag `pendingDocument`; bloqueia check-out até regularizar |
| Faltam dados FNRH | Bloqueia (resposta clara mostrando campos faltantes); FNRH é exigência legal |
| Hóspede pediu upgrade na hora | Recepção atribui quarto de categoria superior; sistema registra `originalRoomTypeId` em internalNotes; ajusta `dailyRate` e regera ChargeItems |
| Hóspede vai dividir o quarto com um amigo que chega depois | Cadastra titular agora, acompanhante via app/recepção depois (`POST /reservations/{id}/guests`) |
| Reserva é POSTPAID_CORPORATE | Pula validação financeira (vai faturar no fim do mês) |

## Decisões Importantes

1. **Bloqueio "duro" em campos faltantes da FNRH** — Embratur fiscaliza, hotel multado paga caro. Melhor obrigar agora do que esquecer.
2. **Mudança de quarto após check-in** — endpoint separado `POST /reservations/{id}/transfer-room`, gera split de estadia (dorme no 201 no dia X, no 305 no dia Y).
3. **FNRH gerada em PDF, não como tela** — vira documento arquivável. Cliente recebe cópia se quiser.

---

# FLUXO 3: Check-out com Fechamento de Conta

## Contexto
Hóspede está saindo. Recepção fecha conta (diárias + consumos), cobra saldo restante, emite NFS-e (B2C) ou registra para fatura mensal (B2B), libera quarto.

## Atores
- **Hóspede** (presencial)
- **Recepcionista** (autenticado)
- **Sistema** (Asaas, Focus NFe, WhatsApp)

## Diagrama

```
Recepcionista     API              Banco        Asaas        Focus NFe     WhatsApp
   │                │                 │            │              │             │
   │── abre reserva │                 │            │              │             │
   │   in-house     │── GET /reservations/{id}/folio ▶│           │             │
   │                │ soma ChargeItems            │              │             │
   │                │ soma Payments               │              │             │
   │                │◀ calcula saldo  │            │              │             │
   │◀─ folio ──────│                 │            │              │             │
   │                │                 │            │              │             │
   │── adiciona     │                 │            │              │             │
   │   consumo final│── POST /reservations/{id}/charge ▶│        │              │
   │ (ex: late ckt) │                 │            │              │             │
   │                │                 │            │              │             │
   │── cobra saldo ▶│── POST /reservations/{id}/charge-balance ▶│              │
   │   (cartão)     │── cria Payment via Asaas ──▶│              │             │
   │                │◀── link/QR ────────────────│              │             │
   │◀─ link cartão ─│                 │            │              │             │
   │                │                 │            │              │             │
   │── confirma     │  Payment → PAID            │              │             │
   │   recebimento  │ (Asaas webhook ou manual)  │              │             │
   │                │                 │            │              │             │
   │── faz check-out▶│── POST /reservations/{id}/check-out ▶│   │              │
   │                │── BEGIN TX ────▶│            │              │             │
   │                │ valida saldo zerado         │              │             │
   │                │ Reservation → CHECKED_OUT   │              │             │
   │                │ checkedOutAt = now()        │              │             │
   │                │ Room → DIRTY                │              │             │
   │                │ Cria CleaningTask           │              │             │
   │                │ Cria FiscalDocument PENDING │              │             │
   │                │── COMMIT ──────▶│            │              │             │
   │                │                 │            │              │             │
   │                │── enfileira emit_nfse ─────────────────────▶│             │
   │                │                                          processa        │
   │                │◀── status: ISSUED + xml/pdf ─────────────────│            │
   │                │                                            │              │
   │                │── envia NFS-e + agradecimento ──────────────────────────▶│
   │◀ "tudo certo" ─│                 │            │              │             │
```

## Endpoints

### 3.1 Visualizar folio (conta do hóspede)

`GET /api/v1/reservations/{id}/folio`

**Response 200:**
```json
{
  "reservationCode": "RES-2026-00123",
  "guestName": "Maria Silva",
  "checkInDate": "2026-06-15",
  "checkOutDate": "2026-06-18",
  "charges": [
    { "id": "ci_1", "date": "2026-06-15", "type": "ROOM_NIGHT", "description": "Diária 15/06 - Standard Casal", "amount": 280.00 },
    { "id": "ci_2", "date": "2026-06-15", "type": "CONSUMPTION", "description": "Coca-Cola 350ml x2", "amount": 14.00 },
    { "id": "ci_3", "date": "2026-06-16", "type": "ROOM_NIGHT", "description": "Diária 16/06 - Standard Casal", "amount": 280.00 },
    { "id": "ci_4", "date": "2026-06-17", "type": "ROOM_NIGHT", "description": "Diária 17/06 - Standard Casal", "amount": 280.00 },
    { "id": "ci_5", "date": "2026-06-17", "type": "CONSUMPTION", "description": "Restaurante - jantar", "amount": 85.00 }
  ],
  "payments": [
    { "id": "p_1", "date": "2026-05-28", "method": "PIX", "amount": 252.00, "status": "PAID" }
  ],
  "totalCharges": 939.00,
  "totalPaid": 252.00,
  "balanceDue": 687.00
}
```

### 3.2 Adicionar lançamento manual

`POST /api/v1/reservations/{id}/charges`

**Body:**
```json
{
  "type": "FEE",
  "description": "Late check-out",
  "quantity": 1,
  "unitPrice": 50.00
}
```

Cria `ChargeItem` na reserva. Pode ser produto do catálogo (`productId`) ou item avulso.

### 3.3 Cobrar saldo

`POST /api/v1/reservations/{id}/charge-balance`

**Body:**
```json
{
  "method": "CREDIT_CARD",
  "amount": 687.00,
  "installments": 1
}
```

Cria Payment no Asaas, retorna link/QR para hóspede pagar.

### 3.4 Confirmar pagamento manual (dinheiro)

`POST /api/v1/payments/{paymentId}/confirm`

Para pagamentos em dinheiro/PIX manual onde não há webhook. Marca Payment como `PAID` e registra `userId` no audit.

### 3.5 Executar check-out

`POST /api/v1/reservations/{id}/check-out`

**Body:**
```json
{
  "skipNFSe": false,
  "sendNFSeBy": "WHATSAPP",
  "earlyCheckout": false
}
```

**Lógica:**

```typescript
async checkOut(reservationId: string, userId: string, dto: CheckOutDto) {
  return await this.prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId },
      include: {
        room: true,
        payments: true,
        chargeItems: { where: { voidedAt: null } },
        company: true,
        primaryGuest: true
      }
    });

    // Validações
    if (reservation.status !== 'CHECKED_IN') {
      throw new BadRequestException(`Status ${reservation.status} não permite check-out`);
    }

    // Calcula saldo
    const totalCharges = reservation.chargeItems.reduce(
      (s, c) => s.add(c.totalAmount), new Decimal(0)
    );
    const totalPaid = reservation.payments
      .filter(p => p.status === 'PAID')
      .reduce((s, p) => s.add(p.amount), new Decimal(0));
    const balance = totalCharges.sub(totalPaid);

    // Saldo deve estar zerado, EXCETO se for corporativo (fatura mensal)
    if (reservation.billingMode === 'DEPOSIT_BALANCE') {
      if (balance.gt(new Decimal('0.01'))) {
        throw new BadRequestException(
          `Saldo a pagar: R$ ${balance}. Cobre antes do check-out.`
        );
      }
      if (balance.lt(new Decimal('-0.01'))) {
        // Hóspede pagou mais do que deve — precisa de estorno
        throw new BadRequestException(
          `Há saldo a devolver: R$ ${balance.abs()}. Faça o estorno antes.`
        );
      }
    }

    // Mutações
    await tx.reservation.update({
      where: { id: reservationId },
      data: { status: 'CHECKED_OUT', checkedOutAt: new Date() }
    });

    await tx.room.update({
      where: { id: reservation.roomId },
      data: { status: 'DIRTY' }
    });

    await tx.roomStatusLog.create({
      data: {
        roomId: reservation.roomId,
        previousStatus: 'OCCUPIED',
        newStatus: 'DIRTY',
        reason: `Check-out: ${reservation.code}`,
        changedById: userId
      }
    });

    // Cria tarefa de limpeza automaticamente
    await tx.cleaningTask.create({
      data: {
        propertyId: reservation.propertyId,
        roomId: reservation.roomId,
        type: 'CHECKOUT',
        status: 'PENDING',
        priority: await this.calculateCleaningPriority(tx, reservation.roomId)
      }
    });

    // NFS-e: cria pendente, processamento async
    if (!dto.skipNFSe && reservation.billingMode === 'DEPOSIT_BALANCE') {
      await tx.fiscalDocument.create({
        data: {
          propertyId: reservation.propertyId,
          type: 'NFSE',
          status: 'PENDING',
          reservationId: reservation.id,
          serviceAmount: totalCharges,
          netAmount: totalCharges,
          taxpayerName: reservation.primaryGuest.fullName,
          taxpayerDocument: reservation.primaryGuest.documentNumber,
          taxpayerEmail: reservation.primaryGuest.email,
          issRate: reservation.property.fiscalIssRate || new Decimal(0)
        }
      });
    }

    // Se POSTPAID_CORPORATE: associa a Invoice do mês corrente
    if (reservation.billingMode === 'POSTPAID_CORPORATE') {
      const invoice = await this.getOrCreateCurrentInvoice(tx, reservation.companyId, reservation.propertyId);
      await tx.reservation.update({
        where: { id: reservationId },
        data: { invoiceId: invoice.id }
      });
    }
  });

  // Eventos assíncronos
  await this.events.publish('reservation.checked_out', { reservationId });
  // Listeners:
  //   - emit_nfse_job (chama Focus NFe)
  //   - send_thank_you_message
  //   - mark_cleaning_priority
}
```

### 3.6 Job de emissão NFS-e

Listener de `reservation.checked_out`:

```typescript
async emitNFSe(reservationId: string) {
  const fd = await this.prisma.fiscalDocument.findFirst({
    where: { reservationId, status: 'PENDING' }
  });
  if (!fd) return;

  await this.prisma.fiscalDocument.update({
    where: { id: fd.id },
    data: { status: 'PROCESSING', lastAttemptAt: new Date(), attemptCount: { increment: 1 } }
  });

  try {
    const response = await this.focusNFe.createNFSe({
      cnpj_emitente: property.cnpj,
      data_emissao: new Date().toISOString(),
      // ... payload conforme prefeitura
      valor_servicos: fd.serviceAmount.toNumber(),
      iss_retido: false,
      aliquota: fd.issRate.toNumber(),
      tomador: {
        cpf: fd.taxpayerDocument,
        razao_social: fd.taxpayerName,
        email: fd.taxpayerEmail
      },
      // ... etc
    });

    if (response.status === 'autorizado') {
      await this.prisma.fiscalDocument.update({
        where: { id: fd.id },
        data: {
          status: 'ISSUED',
          number: response.numero,
          verificationCode: response.codigo_verificacao,
          xmlUrl: response.url_xml,
          pdfUrl: response.url_pdf,
          issuedAt: new Date()
        }
      });

      await this.events.publish('nfse.issued', { fiscalDocumentId: fd.id });
    } else if (response.status === 'erro_autorizacao') {
      await this.prisma.fiscalDocument.update({
        where: { id: fd.id },
        data: { status: 'REJECTED', errorMessage: response.mensagem }
      });
      await this.alertAdmin(`NFS-e rejeitada para ${reservationId}: ${response.mensagem}`);
    } else {
      // Em processamento, agenda retry
      await this.queue.add('emit_nfse', { reservationId }, { delay: 60_000 });
    }
  } catch (err) {
    await this.prisma.fiscalDocument.update({
      where: { id: fd.id },
      data: { status: 'ERROR', errorMessage: err.message }
    });

    if (fd.attemptCount < 5) {
      // Retry exponencial
      const delay = Math.pow(2, fd.attemptCount) * 60_000;
      await this.queue.add('emit_nfse', { reservationId }, { delay });
    } else {
      await this.alertAdmin(`NFS-e falhou 5x para ${reservationId}`);
    }
  }
}
```

## Edge Cases

| Caso | Tratamento |
|---|---|
| Hóspede sai antes do previsto (early checkout) | `earlyCheckout: true`; sistema reduz diárias (depende da política — alguns hotéis não reembolsam) |
| Hóspede esquece de pagar e some | Reserva fica `CHECKED_IN` indefinidamente; manager faz "force checkout" com `unpaidBalance` registrado; gera ChargeItem REFUND negativo; abre caso de cobrança |
| Saldo a devolver (hóspede pagou demais) | Bloqueia checkout até estorno; recepção faz `POST /payments/{id}/refund` |
| NFS-e falha 5 vezes | Status ERROR; admin recebe alerta; pode reemitir manualmente após corrigir dados |
| NFS-e emitida com erro de dados → cancelar | `POST /fiscal-documents/{id}/cancel` cria nova com dados corretos (NFS-e emitida não se "edita") |
| Hóspede pede a NFS-e meses depois | Endpoint `GET /reservations/{id}/fiscal-documents` retorna URL do PDF/XML |
| Estorno após NFS-e emitida | Cancela NFS-e antiga, emite nota de estorno (futuro: NFS-e de cancelamento parcial) |
| Pagamento em cartão de crédito ainda não compensou | Sistema aguarda webhook PAID; pode liberar checkout com flag MANAGER_OVERRIDE (risco assumido) |
| Hóspede corporativo (POSTPAID) | Pula validação de saldo; associa reserva à Invoice do mês; NFS-e única no fechamento da fatura, não por reserva |

---

# FLUXO 4: Consumo de Frigobar

## Contexto
Hóspede consumiu produtos do frigobar. Recepção/governança lança consumo, que vira simultaneamente lançamento na conta E baixa de estoque.

## Atores
- **Recepcionista** (ou camareira via app)
- **Hóspede** (passivo, apenas vê no checkout)

## Pré-condições

- Reserva está `CHECKED_IN`
- Quarto tem `StockLocation` do tipo `MINIBAR_ROOM` vinculada
- Produtos estão cadastrados e ativos

## Diagrama

```
Recepcionista       API                       Banco
     │                │                          │
     │── busca quarto │── GET /rooms/201/minibar ▶│
     │                │ retorna produtos no frigobar com saldo
     │◀── catálogo ──│                          │
     │                │                          │
     │── lança consumo▶│                          │
     │ (2 colas + 1 chocolate)
     │                │── POST /reservations/{id}/charges/batch ▶│
     │                │── BEGIN TX ──────────────▶│
     │                │  Para cada item:         │
     │                │   1. Valida estoque ≥ qty │
     │                │   2. Cria ChargeItem      │
     │                │   3. Cria StockMovement (OUT)
     │                │   4. Atualiza Stock.qty   │
     │                │  Se algum falha: rollback total
     │                │── COMMIT ─────────────────▶│
     │                │                          │
     │                │── evento stock.low ──── (se saldo < minLevel)
     │                │                          │
     │◀── ok + folio atualizado ─                 │
```

## Endpoints

### 4.1 Consultar minibar do quarto

`GET /api/v1/rooms/{id}/minibar`

**Response 200:**
```json
{
  "stockLocationId": "loc_201",
  "items": [
    {
      "productId": "p_coca",
      "name": "Coca-Cola 350ml",
      "unitPrice": 7.00,
      "currentStock": 4,
      "minLevel": 2,
      "maxLevel": 6
    },
    {
      "productId": "p_agua",
      "name": "Água Mineral 500ml",
      "unitPrice": 4.00,
      "currentStock": 6,
      "minLevel": 2,
      "maxLevel": 6
    }
  ]
}
```

### 4.2 Lançar consumo (batch)

`POST /api/v1/reservations/{id}/charges/batch`

**Headers:**
```
Idempotency-Key: <uuid>
```

**Body:**
```json
{
  "stockLocationId": "loc_201",
  "items": [
    { "productId": "p_coca", "quantity": 2 },
    { "productId": "p_choc", "quantity": 1 }
  ],
  "notes": "Consumo do dia 17/06"
}
```

**Lógica:**

```typescript
async batchCharge(reservationId: string, userId: string, dto: BatchChargeDto) {
  return await this.prisma.$transaction(async (tx) => {
    const reservation = await tx.reservation.findUnique({
      where: { id: reservationId }
    });
    if (reservation.status !== 'CHECKED_IN') {
      throw new BadRequestException('Reserva deve estar CHECKED_IN para lançar consumo');
    }

    const chargesCreated = [];

    for (const item of dto.items) {
      // 1. Busca produto e estoque
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product || !product.active) {
        throw new BadRequestException(`Produto ${item.productId} inválido`);
      }

      const stock = await tx.stock.findUnique({
        where: { productId_locationId: { productId: item.productId, locationId: dto.stockLocationId } }
      });

      if (!stock || stock.quantity.lt(item.quantity)) {
        throw new ConflictException(
          `Estoque insuficiente de ${product.name}: tem ${stock?.quantity || 0}, pediu ${item.quantity}`
        );
      }

      // 2. Cria ChargeItem
      const totalAmount = product.unitPrice.mul(item.quantity);
      const chargeItem = await tx.chargeItem.create({
        data: {
          propertyId: reservation.propertyId,
          reservationId,
          type: 'CONSUMPTION',
          productId: product.id,
          description: `${product.name} x${item.quantity}`,
          quantity: item.quantity,
          unitPrice: product.unitPrice,
          totalAmount,
          registeredById: userId
        }
      });

      // 3. Cria StockMovement (saída)
      await tx.stockMovement.create({
        data: {
          productId: product.id,
          locationId: dto.stockLocationId,
          type: 'OUT',
          quantity: new Decimal(-item.quantity),  // negativo
          reason: `Consumo - Reserva ${reservation.code}`,
          chargeItemId: chargeItem.id,
          userId
        }
      });

      // 4. Atualiza saldo do estoque (cache)
      await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: item.quantity } }
      });

      chargesCreated.push(chargeItem);
    }

    return chargesCreated;
  });

  // Após commit: verifica alertas de estoque baixo
  await this.events.publish('charges.created', { reservationId, items: dto.items });
}
```

### 4.3 Estornar consumo (engano)

`POST /api/v1/charges/{chargeItemId}/void`

**Body:**
```json
{ "reason": "Hóspede contestou - não consumiu" }
```

Marca `ChargeItem.voidedAt`, cria `StockMovement` reverso (devolve ao estoque). Auditoria preservada.

## Edge Cases

| Caso | Tratamento |
|---|---|
| Camareira repõe frigobar | Endpoint separado `POST /stock-locations/{id}/restock`; cria StockMovement IN; útil pra contagem |
| Estoque do sistema diverge do físico (camareira contou) | Endpoint `POST /stock-locations/{id}/adjust`; cria StockMovement ADJUSTMENT; precisa role HOUSEKEEPING_SUPERVISOR |
| Hóspede consumiu mas saldo já estava 0 (erro de cadastro) | Bloqueia lançamento; obriga ajuste de estoque antes (rastreabilidade) |
| Produto descontinuado | Marca `active: false`; sistema permite estornar movimentos antigos, mas bloqueia novos lançamentos |
| Múltiplas pessoas lançando consumo simultaneamente | Lock otimista na atualização do Stock; um falha com 409, retenta |
| Saldo abaixo de `minLevel` | Após commit, publica `stock.low`; listener envia alerta à governanta |
| Cancelamento de consumo após checkout | Permitido até NFS-e ser emitida; depois, requer nota de cancelamento (futuro) |

---

# FLUXO 5: Ciclo de Limpeza

## Contexto
Quarto fica `DIRTY` após check-out. Governanta atribui camareira, camareira limpa pelo app, governanta inspeciona, quarto volta a `AVAILABLE`.

## Atores
- **Sistema** (cria tarefa automaticamente no check-out)
- **Governanta** (atribui, inspeciona)
- **Camareira** (executa)

## Diagrama

```
Sistema   Governanta      Camareira        API           Banco
   │            │              │             │              │
   │── checkout │              │             │              │
   │   cria CleaningTask PENDING            │              │
   │            │              │             │              │
   │            │── abre fila ▶│             │              │
   │            │── GET /cleaning-tasks?status=PENDING ────▶│
   │            │◀── lista priorizada ─────────────────────│
   │            │              │             │              │
   │            │── atribui ──▶│             │              │
   │            │── PATCH /cleaning-tasks/{id}/assign ─────▶│
   │            │              │             │              │
   │            │              │── push noti ◀── job
   │            │              │ "Q201 atribuído"
   │            │              │             │              │
   │            │              │── abre app ▶│              │
   │            │              │── GET /my-cleaning-tasks ▶│
   │            │              │◀── lista ──────────────────│
   │            │              │             │              │
   │            │              │── chega no Q201
   │            │              │── toca "Iniciar"
   │            │              │── POST /cleaning-tasks/{id}/start ▶│
   │            │              │  status → IN_PROGRESS
   │            │              │  startedAt = now()
   │            │              │  Room → CLEANING
   │            │              │             │              │
   │            │              │ (limpa)     │              │
   │            │              │             │              │
   │            │              │── encontra problema
   │            │              │── POST /cleaning-tasks/{id}/issue ▶│
   │            │              │  com foto                  │
   │            │              │             │              │
   │            │              │── termina   │              │
   │            │              │── POST /cleaning-tasks/{id}/complete ▶│
   │            │              │  status → AWAITING_INSPECTION
   │            │              │  finishedAt + durationMinutes
   │            │              │             │              │
   │            │── push noti  ◀── "Q201 pronto para inspeção"
   │            │── inspeciona presencial
   │            │── aprova    ▶│             │              │
   │            │── POST /cleaning-tasks/{id}/approve ─────▶│
   │            │  status → COMPLETED                       │
   │            │  Room → AVAILABLE                         │
   │            │              │             │              │
   │            │ ou rejeita  ▶│             │              │
   │            │── POST /cleaning-tasks/{id}/reject ──────▶│
   │            │  com motivo  │             │              │
   │            │  status → IN_PROGRESS (volta pra camareira)
```

## Endpoints

### 5.1 Listar tarefas (governanta)

`GET /api/v1/cleaning-tasks?status=PENDING,IN_PROGRESS,AWAITING_INSPECTION&date=today`

**Response 200:**
```json
{
  "tasks": [
    {
      "id": "ct_1",
      "roomNumber": "201",
      "roomTypeName": "Standard Casal",
      "type": "CHECKOUT",
      "status": "PENDING",
      "priority": 120,
      "assignedTo": null,
      "createdAt": "2026-06-18T11:30:00Z",
      "nextArrival": "2026-06-18T14:00:00Z",
      "isVip": false
    }
  ]
}
```

Ordenação: por `priority` desc, depois `createdAt` asc.

### 5.2 Atribuir camareira

`PATCH /api/v1/cleaning-tasks/{id}/assign`

**Body:**
```json
{ "userId": "u_maria" }
```

Valida: `User.role === 'HOUSEKEEPER'`. Dispara push para o app da camareira.

### 5.3 Camareira: minhas tarefas (mobile)

`GET /api/v1/my-cleaning-tasks`

Filtra por `assignedToId = currentUser.id` e status não-final.

### 5.4 Camareira: iniciar tarefa

`POST /api/v1/cleaning-tasks/{id}/start`

```typescript
async startCleaning(taskId: string, userId: string) {
  return await this.prisma.$transaction(async (tx) => {
    const task = await tx.cleaningTask.findUnique({ where: { id: taskId } });

    if (task.assignedToId !== userId) {
      throw new ForbiddenException('Tarefa não está atribuída a você');
    }
    if (task.status !== 'PENDING') {
      throw new BadRequestException(`Status atual ${task.status} não permite iniciar`);
    }

    await tx.cleaningTask.update({
      where: { id: taskId },
      data: { status: 'IN_PROGRESS', startedAt: new Date() }
    });

    await tx.room.update({
      where: { id: task.roomId },
      data: { status: 'CLEANING' }
    });
  });
}
```

### 5.5 Camareira: reportar problema

`POST /api/v1/cleaning-tasks/{id}/issue`

**Body (multipart):**
- `description`: texto
- `photos[]`: arquivos (upload pro R2)

Adiciona texto em `issuesReported` (acumula). Salva fotos. Não muda status — limpeza continua.

### 5.6 Camareira: concluir

`POST /api/v1/cleaning-tasks/{id}/complete`

```typescript
await tx.cleaningTask.update({
  where: { id: taskId },
  data: {
    status: 'AWAITING_INSPECTION',
    finishedAt: new Date(),
    durationMinutes: differenceInMinutes(new Date(), task.startedAt)
  }
});
// Room continua em CLEANING — só vai para AVAILABLE após inspeção
```

### 5.7 Governanta: aprovar

`POST /api/v1/cleaning-tasks/{id}/approve`

```typescript
await tx.cleaningTask.update({
  where: { id: taskId },
  data: { status: 'COMPLETED', inspectedAt: new Date(), inspectedById: userId }
});
await tx.room.update({
  where: { id: task.roomId },
  data: { status: 'AVAILABLE' }
});
```

### 5.8 Governanta: rejeitar

`POST /api/v1/cleaning-tasks/{id}/reject`

**Body:**
```json
{ "reason": "Banheiro com manchas no espelho" }
```

Status volta a `IN_PROGRESS`. Camareira recebe notificação. Não cria nova tarefa (mesma, retomada).

## Cálculo de Prioridade

```typescript
async calculateCleaningPriority(tx, roomId: string): Promise<number> {
  let priority = 0;

  // Próxima reserva chegando neste quarto
  const nextReservation = await tx.reservation.findFirst({
    where: {
      roomId,
      status: { in: ['CONFIRMED'] },
      checkInDate: { gte: new Date() }
    },
    orderBy: { checkInDate: 'asc' }
  });

  if (nextReservation) {
    const hoursUntilArrival = differenceInHours(nextReservation.checkInDate, new Date());

    if (hoursUntilArrival < 6) priority += 100;       // chega em <6h
    else if (hoursUntilArrival < 24) priority += 50;  // chega hoje
    else if (hoursUntilArrival < 48) priority += 20;  // chega amanhã

    if (nextReservation.primaryGuest?.tags?.includes('VIP')) priority += 30;
  }

  // Quanto tempo a tarefa está aguardando
  const ageMinutes = differenceInMinutes(new Date(), task.createdAt);
  priority += Math.floor(ageMinutes / 60) * 10;

  return priority;
}
```

Re-calculado por cron a cada 30 minutos (priority muda com o passar do tempo).

## Edge Cases

| Caso | Tratamento |
|---|---|
| Camareira esquece de "concluir" | Tarefa fica `IN_PROGRESS` indefinidamente; alerta após 90min |
| Camareira sai de turno | Governanta reatribui: `PATCH /assign` com novo userId |
| Próximo hóspede chega antes da limpeza terminar | Sistema avisa recepção; recepção pode autorizar check-in em quarto reserva (raro) ou oferecer espera |
| Quarto reprovado 3+ vezes | Sistema alerta supervisor; pode ser problema de treinamento da camareira |
| Camareira reporta problema crítico (cano vazando) | App cria `MaintenanceRequest`; Room → `MAINTENANCE`; bloqueia próximas reservas até resolver |
| Wifi caiu (camareira sem rede) | App funciona offline com fila de sincronização (WatermelonDB); sincroniza ao reconectar |
| Inspeção é dispensada (hotel pequeno) | Configuração da propriedade `skipInspection: true` faz status pular direto para COMPLETED ao concluir |

---

# Apêndice A — Padrões Transversais

## Idempotency-Key

Todo endpoint que cria recurso aceita header `Idempotency-Key`. Implementação:

```typescript
@Injectable()
class IdempotencyService {
  async execute<T>(key: string, scope: string, fn: () => Promise<T>): Promise<T> {
    const cacheKey = `idem:${scope}:${key}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = await fn();
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', 86400);
    return result;
  }
}
```

## Autorização (RBAC)

Decorator `@Roles()` em cada endpoint:

```typescript
@Post(':id/check-in')
@Roles('RECEPTION', 'MANAGER', 'ADMIN')
async checkIn(...) { ... }
```

Validado por guard global. `READONLY` nunca passa em endpoints `POST/PATCH/DELETE`.

## Audit Log

Middleware Prisma intercepta mutations em models críticos e grava em `audit_logs`:

```typescript
prisma.$use(async (params, next) => {
  const result = await next(params);
  if (AUDITED_MODELS.includes(params.model) && WRITE_ACTIONS.includes(params.action)) {
    await prisma.auditLog.create({
      data: {
        propertyId: extractPropertyId(params),
        userId: getCurrentUserId(),
        action: `${params.model}.${params.action}`,
        entityType: params.model,
        entityId: result.id,
        changes: diff(params.args.data, result),
        metadata: { ip: getRequestIp(), userAgent: getUserAgent() }
      }
    });
  }
  return result;
});
```

## Tratamento de Erros

Padrão Problem Details (RFC 7807):

```json
{
  "type": "https://api.hotel.com/errors/room-not-available",
  "title": "Quarto não disponível",
  "status": 409,
  "detail": "Quarto 201 está em status DIRTY",
  "instance": "/api/v1/reservations/clxk5/check-in",
  "errorCode": "ROOM_NOT_AVAILABLE",
  "context": {
    "roomNumber": "201",
    "currentStatus": "DIRTY"
  }
}
```

Frontend trata por `errorCode`, não pela mensagem (i18n-friendly).

## Eventos publicados

| Evento | Quando | Listeners típicos |
|---|---|---|
| `reservation.created` | POST público criada | Envia QR Pix; agenda hold-expire-check |
| `reservation.confirmed` | Sinal pago | Envia voucher; gera ChargeItems |
| `reservation.checked_in` | Check-in feito | Gera FNRH; envia welcome |
| `reservation.checked_out` | Check-out | Emite NFS-e; envia thank-you |
| `payment.confirmed` | Webhook PAID | Atualiza Reservation.paidAmount |
| `payment.refunded` | Webhook REFUNDED | Ajusta paidAmount; alerta admin |
| `charges.created` | Consumo lançado | Verifica estoque baixo |
| `stock.low` | Estoque < minLevel | Notifica governanta |
| `cleaning.completed` | Inspeção aprovada | (futuro) Notifica recepção pra realocação |
| `nfse.issued` | Focus retorna ok | Envia PDF ao hóspede |
| `nfse.failed` | Focus rejeita | Alerta admin |
| `invoice.closed` | Cron mensal | Emite NFS-e da fatura; envia boleto |

## Locks e Concorrência

- **Reserva criando para o mesmo quarto**: protegido pela exclusion constraint do Postgres
- **Consumo simultâneo do mesmo produto**: optimistic locking via campo `updatedAt`; em conflito, retentar
- **Webhook do Asaas duplicado**: idempotência por `gatewayId` + `event`
- **Cron jobs**: usar `pg_advisory_lock` para garantir execução única em ambiente multi-instância

---

# Apêndice B — O que NÃO está nestes fluxos (deixado para v2)

- Reserva de grupo (múltiplos quartos vinculados)
- Tarifas dinâmicas (sazonalidade, mínimo de noites)
- Channel Manager (Booking, Airbnb, Expedia)
- Pacotes (estadia + café + passeio)
- Programas de fidelidade
- Self check-in via celular do hóspede
- Chave digital (mobile key)
- Reconhecimento facial
- Domótica integrada (luzes, ar)
- Multi-idioma na página pública
- Faturamento parcelado de Invoice corporativa
- Cancelamento e re-emissão de NFS-e via interface
- Conciliação bancária automática

Cada um destes requer um documento próprio quando entrar no escopo.
