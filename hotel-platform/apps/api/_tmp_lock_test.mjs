import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
const env = readFileSync(new URL('./.env', import.meta.url), 'utf8');
const m = env.match(/DATABASE_URL\s*=\s*"?([^"\n]+)"?/); if (m) process.env.DATABASE_URL = m[1].trim();
const prisma = new PrismaClient();
try {
  const pid = 'cmr0rgfi1000cn6zzlwhp60ho';
  const r = await prisma.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pid}, 0)) AS locked`;
  console.log('LOCK SQL OK:', JSON.stringify(r, (k,v)=>typeof v==='bigint'?v.toString():v));
} catch(e){ console.error('LOCK SQL FALHOU:', e.message); }
await prisma.$disconnect();
