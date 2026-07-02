/**
 * Seed de desenvolvimento — Hotel Platform
 *
 * Cria:
 *  - 1 Property (Pousada Vista Mar)
 *  - 4 Users (admin, recepção, governanta, camareira)
 *  - 3 RoomTypes + 12 Rooms
 *  - 1 Company (cliente corporativo)
 *  - 5 Guests
 *  - 8 Products (frigobar + restaurante)
 *  - 12 StockLocations (1 frigobar por quarto + depósito)
 *  - Estoque inicial
 *  - 3 Reservas de exemplo (uma em cada status)
 *
 * Rodar: pnpm db:seed
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function dec(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

async function main() {
  console.log('🌱 Iniciando seed...\n');

  // ----------------------------------------------------------
  // PROPERTY
  // ----------------------------------------------------------
  console.log('📍 Criando propriedade...');
  const property = await prisma.property.upsert({
    where: { bookingSlug: 'solar-irara' },
    update: {},
    create: {
      name: 'Solar Irará Hotel',
      legalName: 'Solar Irará Hotelaria LTDA',
      cnpj: '12345678000190',
      cadastur: '12.345678.10-0',
      addressStreet: 'Rua Principal',
      addressNumber: '100',
      addressNeighborhood: 'Centro',
      addressCity: 'Irará',
      addressState: 'BA',
      addressZip: '44600000',
      phone: '+5575999990000',
      email: 'contato@solarirara.com.br',
      website: 'https://solar.gpcbahia.com.br',
      timezone: 'America/Bahia',
      bookingSlug: 'solar-irara',
      primaryColor: '#B85C2E',
      checkInTime: '14:00',
      checkOutTime: '12:00',
      fiscalEnabled: false, // ativar quando Focus NFe estiver configurado
      paymentPolicies: {
        defaultMode: 'DEPOSIT_BALANCE',
        depositPercent: 30,
        holdMinutes: 30,
      },
      cancellationPolicy: {
        freeUntilDays: 7,
        partialUntilDays: 3,
        partialPercent: 50,
      },
    },
  });
  console.log(`   ✅ ${property.name} (id: ${property.id})\n`);

  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------
  console.log('👥 Criando usuários...');
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@pousadavistamar.com.br' },
      update: {},
      create: {
        propertyId: property.id,
        email: 'admin@pousadavistamar.com.br',
        passwordHash: hashPassword('admin123'),
        name: 'Carlos Admin',
        role: 'ADMIN',
      },
    }),
    prisma.user.upsert({
      where: { email: 'recepcao@pousadavistamar.com.br' },
      update: {},
      create: {
        propertyId: property.id,
        email: 'recepcao@pousadavistamar.com.br',
        passwordHash: hashPassword('recepcao123'),
        name: 'Ana Recepção',
        role: 'RECEPTION',
      },
    }),
    prisma.user.upsert({
      where: { email: 'governanta@pousadavistamar.com.br' },
      update: {},
      create: {
        propertyId: property.id,
        email: 'governanta@pousadavistamar.com.br',
        passwordHash: hashPassword('governanta123'),
        name: 'Joana Governanta',
        role: 'HOUSEKEEPING_SUPERVISOR',
      },
    }),
    prisma.user.upsert({
      where: { email: 'maria.camareira@pousadavistamar.com.br' },
      update: {},
      create: {
        propertyId: property.id,
        email: 'maria.camareira@pousadavistamar.com.br',
        passwordHash: hashPassword('maria123'),
        name: 'Maria Camareira',
        role: 'HOUSEKEEPER',
      },
    }),
    prisma.user.upsert({
      where: { email: 'lucia.camareira@pousadavistamar.com.br' },
      update: {},
      create: {
        propertyId: property.id,
        email: 'lucia.camareira@pousadavistamar.com.br',
        passwordHash: hashPassword('lucia123'),
        name: 'Lúcia Camareira',
        role: 'HOUSEKEEPER',
      },
    }),
  ]);
  users.forEach((u) => console.log(`   ✅ ${u.name} (${u.role})`));
  console.log();

  // ----------------------------------------------------------
  // ROOM TYPES
  // ----------------------------------------------------------
  console.log('🛏️  Criando categorias de quarto...');
  // Categoria única — todos os quartos do Solar Irará são do mesmo tipo.
  const stdType = await prisma.roomType.create({
    data: {
      propertyId: property.id,
      name: 'Quarto Standard',
      description: 'Quarto confortável com ar-condicionado, TV e frigobar.',
      basePrice: dec(280),
      maxOccupancy: 2,
      maxAdults: 2,
      maxChildren: 1,
      bedConfig: '1 cama de casal',
      sizeSqm: 22,
      amenities: ['wifi', 'ar', 'tv', 'frigobar'],
    },
  });
  console.log(`   ✅ ${stdType.name} (R$ ${stdType.basePrice})\n`);

  // ----------------------------------------------------------
  // ROOMS
  // ----------------------------------------------------------
  console.log('🚪 Criando quartos...');
  const rooms: Array<{ id: string; number: string }> = [];

  // Quartos reais do Solar Irará Hotel (17)
  const realRooms: Array<{ number: string; name: string; floor: number; typeId: string }> = [
    { number: '001', name: 'Massaranduba', floor: 0, typeId: stdType.id },
    { number: '002', name: 'Mangabeira', floor: 0, typeId: stdType.id },
    { number: '101', name: 'Candeal', floor: 1, typeId: stdType.id },
    { number: '102', name: 'Murici', floor: 1, typeId: stdType.id },
    { number: '103', name: 'Coqueiro', floor: 1, typeId: stdType.id },
    { number: '104', name: 'Caroba', floor: 1, typeId: stdType.id },
    { number: '105', name: 'Caboronga', floor: 1, typeId: stdType.id },
    { number: '106', name: 'Santo Antônio', floor: 1, typeId: stdType.id },
    { number: '107', name: 'Largo', floor: 1, typeId: stdType.id },
    { number: '108', name: 'Juazeiro', floor: 1, typeId: stdType.id },
    { number: '109', name: 'Sucupira', floor: 1, typeId: stdType.id },
    { number: '110', name: 'Várzea', floor: 1, typeId: stdType.id },
    { number: '111', name: 'Bento Simões', floor: 1, typeId: stdType.id },
    { number: '112', name: 'Sobradinho', floor: 1, typeId: stdType.id },
    { number: '113', name: 'Brotas', floor: 1, typeId: stdType.id },
    { number: '114', name: 'Jardin', floor: 1, typeId: stdType.id },
    { number: '115', name: 'Baixinha', floor: 1, typeId: stdType.id },
  ];
  for (const r of realRooms) {
    const room = await prisma.room.create({
      data: {
        propertyId: property.id,
        roomTypeId: r.typeId,
        number: r.number,
        name: r.name,
        floor: r.floor,
        status: 'AVAILABLE',
      },
    });
    rooms.push({ id: room.id, number: room.number });
  }
  console.log(`   ✅ ${rooms.length} quartos criados\n`);

  // ----------------------------------------------------------
  // COMPANY (cliente corporativo)
  // ----------------------------------------------------------
  console.log('🏢 Criando empresa corporativa...');
  const company = await prisma.company.create({
    data: {
      propertyId: property.id,
      legalName: 'ACME Tecnologia LTDA',
      tradeName: 'ACME Tech',
      cnpj: '11222333000144',
      email: 'financeiro@acmetech.com.br',
      phone: '+5511999990000',
      contactName: 'João Silva',
      addressStreet: 'Av. Paulista',
      addressNumber: '1000',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZip: '01310100',
      defaultRateOverride: dec(380), // tarifa negociada
      paymentTermDays: 30,
      billingDay: 25,
      creditLimit: dec(50000),
    },
  });
  console.log(`   ✅ ${company.tradeName}\n`);

  // ----------------------------------------------------------
  // GUESTS
  // ----------------------------------------------------------
  console.log('👤 Criando hóspedes...');
  const guests = await Promise.all([
    prisma.guest.create({
      data: {
        propertyId: property.id,
        fullName: 'Maria Silva Santos',
        documentType: 'CPF',
        documentNumber: '12345678901',
        birthDate: new Date('1985-04-20'),
        gender: 'FEMALE',
        nationality: 'BR',
        occupation: 'Engenheira',
        email: 'maria.silva@example.com',
        phone: '+5511987654321',
        whatsapp: '+5511987654321',
        addressStreet: 'Rua das Flores',
        addressNumber: '100',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZip: '01310100',
        travelOrigin: 'São Paulo',
        travelDestination: 'São Paulo',
        travelPurpose: 'LEISURE',
        transportMeans: 'PLANE',
        consentMarketing: true,
        consentDataAt: new Date(),
      },
    }),
    prisma.guest.create({
      data: {
        propertyId: property.id,
        fullName: 'Pedro Costa Lima',
        documentType: 'CPF',
        documentNumber: '23456789012',
        birthDate: new Date('1990-11-08'),
        gender: 'MALE',
        nationality: 'BR',
        occupation: 'Médico',
        email: 'pedro.costa@example.com',
        phone: '+5571999998877',
        whatsapp: '+5571999998877',
        addressCity: 'Salvador',
        addressState: 'BA',
        travelOrigin: 'Salvador',
        travelDestination: 'Salvador',
        travelPurpose: 'LEISURE',
        consentMarketing: false,
      },
    }),
    prisma.guest.create({
      data: {
        propertyId: property.id,
        fullName: 'Ana Beatriz Ferreira',
        documentType: 'CPF',
        documentNumber: '34567890123',
        birthDate: new Date('1995-07-15'),
        gender: 'FEMALE',
        nationality: 'BR',
        occupation: 'Designer',
        email: 'ana.ferreira@acmetech.com.br',
        phone: '+5511966665555',
        whatsapp: '+5511966665555',
        companyId: company.id, // hóspede corporativa
        addressCity: 'São Paulo',
        addressState: 'SP',
        travelOrigin: 'São Paulo',
        travelDestination: 'São Paulo',
        travelPurpose: 'BUSINESS',
        transportMeans: 'PLANE',
        tags: ['Corporativo', 'Recorrente'],
      },
    }),
    prisma.guest.create({
      data: {
        propertyId: property.id,
        fullName: 'John Smith',
        documentType: 'PASSPORT',
        documentNumber: 'US123456789',
        birthDate: new Date('1978-02-14'),
        gender: 'MALE',
        nationality: 'US',
        occupation: 'Tourist',
        email: 'john.smith@example.com',
        phone: '+14155551234',
        addressCity: 'New York',
        addressState: 'NY',
        addressCountry: 'US',
        travelOrigin: 'New York',
        travelDestination: 'Rio de Janeiro',
        travelPurpose: 'LEISURE',
        transportMeans: 'PLANE',
        tags: ['VIP', 'Estrangeiro'],
      },
    }),
    prisma.guest.create({
      data: {
        propertyId: property.id,
        fullName: 'Roberto Almeida',
        documentType: 'CPF',
        documentNumber: '45678901234',
        birthDate: new Date('1972-09-30'),
        gender: 'MALE',
        nationality: 'BR',
        occupation: 'Empresário',
        email: 'roberto@example.com',
        phone: '+5521988887777',
        addressCity: 'Rio de Janeiro',
        addressState: 'RJ',
        travelPurpose: 'LEISURE',
        tags: ['VIP'],
      },
    }),
  ]);
  guests.forEach((g) => console.log(`   ✅ ${g.fullName}`));
  console.log();

  // ----------------------------------------------------------
  // PRODUCTS (frigobar + restaurante)
  // ----------------------------------------------------------
  console.log('🥤 Criando produtos...');
  const products = await Promise.all([
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'COCA350',
        name: 'Coca-Cola 350ml',
        category: 'MINIBAR',
        unitPrice: dec(7),
        unitCost: dec(2.5),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'AGUA500',
        name: 'Água Mineral 500ml',
        category: 'MINIBAR',
        unitPrice: dec(4),
        unitCost: dec(1),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'CERV350',
        name: 'Cerveja 350ml',
        category: 'MINIBAR',
        unitPrice: dec(10),
        unitCost: dec(3.5),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'CHOC100',
        name: 'Chocolate 100g',
        category: 'MINIBAR',
        unitPrice: dec(12),
        unitCost: dec(4),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'JANTAR',
        name: 'Jantar Executivo',
        category: 'RESTAURANT',
        unitPrice: dec(85),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'CAFE',
        name: 'Café da Manhã Avulso',
        category: 'RESTAURANT',
        unitPrice: dec(45),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'TRANSFER',
        name: 'Transfer Aeroporto',
        category: 'EXTRA_SERVICE',
        unitPrice: dec(120),
        unitMeasure: 'UN',
      },
    }),
    prisma.product.create({
      data: {
        propertyId: property.id,
        sku: 'LATECKO',
        name: 'Late Check-out',
        category: 'EXTRA_SERVICE',
        unitPrice: dec(50),
        unitMeasure: 'UN',
      },
    }),
  ]);
  console.log(`   ✅ ${products.length} produtos criados\n`);

  // ----------------------------------------------------------
  // STOCK LOCATIONS + STOCK INICIAL
  // ----------------------------------------------------------
  console.log('📦 Configurando estoque inicial...');

  // Depósito central
  const warehouse = await prisma.stockLocation.create({
    data: {
      propertyId: property.id,
      name: 'Depósito Central',
      type: 'WAREHOUSE',
    },
  });

  // 1 frigobar por quarto
  const minibarProducts = products.filter((p) => p.category === 'MINIBAR');
  for (const room of rooms) {
    const minibar = await prisma.stockLocation.create({
      data: {
        propertyId: property.id,
        name: `Frigobar Q${room.number}`,
        type: 'MINIBAR_ROOM',
        roomId: room.id,
      },
    });

    // Estoque inicial: 4 unidades de cada produto no frigobar
    for (const product of minibarProducts) {
      await prisma.stock.create({
        data: {
          productId: product.id,
          locationId: minibar.id,
          quantity: dec(4),
          minLevel: dec(2),
          maxLevel: dec(6),
        },
      });
    }
  }

  // Estoque no depósito (todas as categorias)
  for (const product of products) {
    if (product.category === 'MINIBAR' || product.category === 'RESTAURANT') {
      await prisma.stock.create({
        data: {
          productId: product.id,
          locationId: warehouse.id,
          quantity: dec(100),
          minLevel: dec(20),
        },
      });
    }
  }
  console.log(`   ✅ Depósito + ${rooms.length} frigobares configurados\n`);

  // ----------------------------------------------------------
  // RESERVAS DE EXEMPLO
  // ----------------------------------------------------------
  console.log('📅 Criando reservas de exemplo...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const tenDaysOut = new Date(today);
  tenDaysOut.setDate(tenDaysOut.getDate() + 10);
  const inHouseStart = new Date(today);
  inHouseStart.setDate(inHouseStart.getDate() - 2);
  const inHouseEnd = new Date(today);
  inHouseEnd.setDate(inHouseEnd.getDate() + 1);

  // 1. Reserva CONFIRMED (chega na próxima semana) — Pedro
  const reservation1 = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      code: 'RES-2026-00001',
      primaryGuestId: guests[1]!.id, // Pedro
      roomTypeId: stdType.id,
      checkInDate: nextWeek,
      checkOutDate: tenDaysOut,
      nights: 3,
      adults: 2,
      children: 0,
      totalAmount: dec(840),
      dailyRate: dec(280),
      paidAmount: dec(252), // 30% pago
      billingMode: 'DEPOSIT_BALANCE',
      depositPercent: 30,
      source: 'DIRECT',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      guests: {
        create: { guestId: guests[1]!.id, isPrimary: true },
      },
    },
  });

  // 2. Reserva CHECKED_IN (hóspede in-house) — Maria no Standard 101
  const room101 = rooms.find((r) => r.number === '101')!;
  const reservation2 = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      code: 'RES-2026-00002',
      primaryGuestId: guests[0]!.id, // Maria
      roomTypeId: stdType.id,
      roomId: room101.id,
      checkInDate: inHouseStart,
      checkOutDate: inHouseEnd,
      nights: 3,
      adults: 1,
      children: 0,
      totalAmount: dec(840),
      dailyRate: dec(280),
      paidAmount: dec(840), // pago integral
      billingMode: 'DEPOSIT_BALANCE',
      depositPercent: 30,
      source: 'DIRECT',
      status: 'CHECKED_IN',
      confirmedAt: inHouseStart,
      checkedInAt: inHouseStart,
      guests: {
        create: { guestId: guests[0]!.id, isPrimary: true },
      },
    },
  });
  // Marca quarto como ocupado
  await prisma.room.update({
    where: { id: room101.id },
    data: { status: 'OCCUPIED' },
  });

  // 3. Reserva POSTPAID_CORPORATE (corporativo) — Ana
  const reservation3 = await prisma.reservation.create({
    data: {
      propertyId: property.id,
      code: 'RES-2026-00003',
      primaryGuestId: guests[2]!.id, // Ana (corporativa)
      companyId: company.id,
      roomTypeId: stdType.id,
      checkInDate: tomorrow,
      checkOutDate: nextWeek,
      nights: 6,
      adults: 1,
      children: 0,
      totalAmount: dec(2280), // 380 * 6 (tarifa negociada)
      dailyRate: dec(380),
      paidAmount: dec(0), // pós-pago
      billingMode: 'POSTPAID_CORPORATE',
      source: 'PHONE',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
      corporatePO: 'PO-2026-456',
      guests: {
        create: { guestId: guests[2]!.id, isPrimary: true },
      },
    },
  });

  console.log(`   ✅ ${reservation1.code} CONFIRMED (Pedro - Luxo)`);
  console.log(`   ✅ ${reservation2.code} CHECKED_IN (Maria - 101)`);
  console.log(`   ✅ ${reservation3.code} CONFIRMED corp (Ana - ACME)\n`);

  // ----------------------------------------------------------
  // TAREFAS DE LIMPEZA DE EXEMPLO
  // ----------------------------------------------------------
  console.log('🧹 Criando tarefas de limpeza de exemplo...');

  const room102 = rooms.find((r) => r.number === '102')!;
  const room201 = rooms.find((r) => r.number === '111')!;

  // Quarto 102: DIRTY, pendente, atribuído à Maria
  await prisma.room.update({
    where: { id: room102.id },
    data: { status: 'DIRTY' },
  });
  await prisma.cleaningTask.create({
    data: {
      propertyId: property.id,
      roomId: room102.id,
      type: 'CHECKOUT',
      status: 'PENDING',
      priority: 50,
      assignedToId: users[3]!.id, // Maria
      notes: 'Hóspede saiu de manhã. Atenção aos lençóis (relataram derramamento).',
    },
  });

  // Quarto 201: em limpeza, atribuído à Lúcia
  await prisma.room.update({
    where: { id: room201.id },
    data: { status: 'CLEANING' },
  });
  await prisma.cleaningTask.create({
    data: {
      propertyId: property.id,
      roomId: room201.id,
      type: 'CHECKOUT',
      status: 'IN_PROGRESS',
      priority: 80,
      assignedToId: users[4]!.id, // Lúcia
      startedAt: new Date(Date.now() - 15 * 60 * 1000), // iniciada há 15 min
    },
  });

  console.log(`   ✅ 2 tarefas criadas (1 pendente, 1 em andamento)\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Seed concluído!\n');
  console.log('🔐 Credenciais de teste:');
  console.log('   admin@pousadavistamar.com.br / admin123');
  console.log('   recepcao@pousadavistamar.com.br / recepcao123');
  console.log('   governanta@pousadavistamar.com.br / governanta123');
  console.log('   maria.camareira@pousadavistamar.com.br / maria123');
  console.log('   lucia.camareira@pousadavistamar.com.br / lucia123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
