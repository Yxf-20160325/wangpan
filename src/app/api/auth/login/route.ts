import { NextRequest, NextResponse } from 'next/server';
import { getSettings, isBannedNow, verifyLogin } from '@/lib/auth';
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

  const settings = await getSettings();
  if (!settings.allowLogin) {
    appendLog({ action: 'login', target: username, detail: '登录功能已关闭', result: 'fail', user: username });
    return NextResponse.json({ error: '登录功能已暂时关闭，请联系管理员', code: 'LOGIN_DISABLED' }, { status: 403 });
  }

  if (isBannedNow(user)) {
    const until = user.banExpiresAt
      ? `，预计解封时间 ${new Date(user.banExpiresAt).toLocaleString('zh-CN')}`
      : '（永久封禁）';
    const reason = user.banReason || '未说明';
    appendLog({ action: 'login', target: username, detail: `账号被封禁：${reason}`, result: 'fail', user: username });
    return NextResponse.json(
      { error: `账号已被封禁${until}，原因：${reason}`, code: 'BANNED' },
      { status: 403 },
    );
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
