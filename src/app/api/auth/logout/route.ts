import { NextRequest, NextResponse } from 'next/server';
import { currentSession } from '@/lib/auth';
import { appendLog } from '@/lib/log';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';
import { revokeSession } from '@/lib/session-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await currentSession();
  if (session) {
    await revokeSession(session.id);
    appendLog({ action: 'logout', target: session.username, detail: '退出登录', user: session.username });
  } else {
    const payload = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (payload) appendLog({ action: 'logout', target: payload.u, detail: '退出登录', user: payload.u });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
