import { NextRequest, NextResponse } from 'next/server';
import { currentSession, requirePermission } from '@/lib/auth';
import { appendLog } from '@/lib/log';
import { listSessions, revokeAllExcept, revokeSessions, touchSession } from '@/lib/session-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePermission('sessions:view');
  if (guard instanceof NextResponse) return guard;

  const session = await currentSession();
  if (session) touchSession(session.id);
  const currentId = session?.id ?? null;

  const sessions = await listSessions();
  return NextResponse.json({
    currentId,
    sessions: sessions.map((s) => ({
      id: s.id,
      username: s.username,
      role: s.role,
      ip: s.ip,
      ua: s.ua,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      expAt: s.expAt,
      current: s.id === currentId,
    })),
  });
}

export async function DELETE(req: NextRequest) {
  const guard = await requirePermission('sessions:kick');
  if (guard instanceof NextResponse) return guard;

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string') : [];
  if (!ids.length) return NextResponse.json({ error: '缺少会话 id' }, { status: 400 });

  const removed = await revokeSessions(ids);
  appendLog({
    action: 'setting',
    target: '踢出登录会话',
    detail: `由 ${guard.rec.username} 踢出 ${removed} 个会话`,
    user: guard.rec.username,
  });
  return NextResponse.json({ removed });
}

export async function POST(req: NextRequest) {
  const guard = await requirePermission('sessions:kick');
  if (guard instanceof NextResponse) return guard;

  const body = (await req.json().catch(() => ({}))) as { action?: 'revoke-others' };
  if (body.action !== 'revoke-others') return NextResponse.json({ error: '未知操作' }, { status: 400 });

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效', code: 'UNAUTHORIZED' }, { status: 401 });

  const removed = await revokeAllExcept(session.id);
  appendLog({
    action: 'setting',
    target: '踢出其他会话',
    detail: `由 ${guard.rec.username} 踢出 ${removed} 个会话`,
    user: guard.rec.username,
  });
  return NextResponse.json({ removed });
}
