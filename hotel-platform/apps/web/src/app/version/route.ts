import { NextResponse } from 'next/server';
import { APP_VERSION } from '@/lib/version';

// Sempre reflete a versão do deploy que está servindo (sem cache).
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { version: APP_VERSION },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
