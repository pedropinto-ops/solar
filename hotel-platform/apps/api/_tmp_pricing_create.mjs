// Autorizado pelo gestor ("lance datas com valores especiais e verifique").
// Cria regras de tarifa (RatePeriod) de TESTE em datas descartáveis de 2028,
// escopadas à categoria Standard. Nome com prefixo p/ limpeza garantida depois.
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/);
if (m) process.env.DATABASE_URL = m[1].trim();

const prisma = new PrismaClient();
const PREFIX = '__TESTE_PRICING__';
const D = (s) => new Date(s + 'T00:00:00.000Z');

// Descobre propertyId + a categoria Standard
const rt = await prisma.roomType.findFirst({
  where: { name: { contains: 'Standard' } },
  select: { id: true, propertyId: true, basePrice: true, name: true },
});
if (!rt) { console.error('RoomType Standard não encontrado'); process.exit(1); }
console.log(`Categoria: ${rt.name} | base/adulto ${rt.basePrice} | rt ${rt.id}`);

// Limpa qualquer resíduo de teste anterior antes de recriar (idempotente)
const del = await prisma.ratePeriod.deleteMany({ where: { name: { startsWith: PREFIX } } });
if (del.count) console.log(`(limpou ${del.count} regra(s) de teste anteriores)`);

const base = { propertyId: rt.propertyId, roomTypeId: rt.id, active: true };
const periods = [
  // ABSOLUTE 500 em 10-12/jun
  { ...base, name: `${PREFIX} ABS500`, startDate: D('2028-06-10'), endDate: D('2028-06-12'), adjustType: 'ABSOLUTE', value: 500, priority: 1 },
  // PERCENT +50% em 10-12/jul
  { ...base, name: `${PREFIX} PCT+50`, startDate: D('2028-07-10'), endDate: D('2028-07-12'), adjustType: 'PERCENT', value: 50, priority: 1 },
  // PERCENT -20% em 10-12/ago
  { ...base, name: `${PREFIX} PCT-20`, startDate: D('2028-08-10'), endDate: D('2028-08-12'), adjustType: 'PERCENT', value: -20, priority: 1 },
  // PRIORITY: sobreposição em 10-12/set — prio1=400 vs prio5=900 (deve vencer 900)
  { ...base, name: `${PREFIX} PRIO-baixa`, startDate: D('2028-09-10'), endDate: D('2028-09-12'), adjustType: 'ABSOLUTE', value: 400, priority: 1 },
  { ...base, name: `${PREFIX} PRIO-alta`, startDate: D('2028-09-10'), endDate: D('2028-09-12'), adjustType: 'ABSOLUTE', value: 900, priority: 5 },
  // MIXED: só a noite do meio (11/out) fica ABS 600; 10 e 12 ficam base 150
  { ...base, name: `${PREFIX} MIXED-meio`, startDate: D('2028-10-11'), endDate: D('2028-10-11'), adjustType: 'ABSOLUTE', value: 600, priority: 1 },
];

for (const p of periods) {
  const c = await prisma.ratePeriod.create({ data: p, select: { id: true, name: true } });
  console.log(`criada: ${c.name}`);
}
const total = await prisma.ratePeriod.count({ where: { name: { startsWith: PREFIX } } });
console.log(`TOTAL regras de teste ativas: ${total}`);
await prisma.$disconnect();
