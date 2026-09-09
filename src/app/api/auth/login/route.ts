import { NextRequest, NextResponse } from 'next/server';
import { verifyLogin } from '@/lib/auth';
import { appendLog } from '@/lib/log';
import { SESSION_COOKIE, SESSION_TTL_MS, createToken } from '@/lib/session';
import { createSession } from '@/lib/session-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
  }

  const user = await verifyLogin(username, password);
  if (!user) {
    appendLog({ action: 'login', target: username, detail: '账号或密码错误', result: 'fail', user: username });
    return NextResponse.json({ error: '账号或密码错误' }, { status: 401 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1';
  const ua = (req.headers.get('user-agent') || '未知设备').slice(0, 220);

  const session = await createSession({
    username: user.username,
    role: user.role,
    expAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    ip,
    ua,
  });
  const token = await createToken(user.username, session.id);

  appendLog({
    action: 'login',
    target: user.username,
    detail: `登录成功（${user.role === 'admin' ? '管理员' : '普通用户'}）· ${ip}`,
    user: user.username,
  });

  const res = NextResponse.json({ ok: true, user: user.username, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
