import { NextResponse } from 'next/server';
import { clearLogs, getLogs } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET() {
  const logs = await getLogs();
  return NextResponse.json({ logs });
}

export async function DELETE() {
  await clearLogs();
  return NextResponse.json({ ok: true });
}
