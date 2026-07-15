import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/); if (m) process.env.DATABASE_URL = m[1].trim();
const prisma = new PrismaClient();
try {
  await prisma.$transaction(async (tx) => {
    const pid = 'cmr0rgfi1000cn6zzlwhp60ho';
    const n = await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pid}, 0))`;
    console.log('$executeRaw OK (caminho real do serviço). retorno:', n);
  });
} catch(e){ console.error('$executeRaw FALHOU:', e.message); }
await prisma.$disconnect();
