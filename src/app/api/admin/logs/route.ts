import { NextResponse } from 'next/server';
import { clearLogs, getLogs } from '@/lib/log';
import { requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePermission('logs:view');
  if (guard instanceof NextResponse) return guard;
  const logs = await getLogs();
  return NextResponse.json({ logs });
}

export async function DELETE() {
  const guard = await requirePermission('logs:clear');
  if (guard instanceof NextResponse) return guard;
  await clearLogs();
  return NextResponse.json({ ok: true });
}
