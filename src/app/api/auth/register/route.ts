import { NextRequest, NextResponse } from 'next/server';
import { AuthError, createUser, getSettings, listUsers } from '@/lib/auth';
import { appendLog } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string; confirm?: string };
  const username = (body.username || '').trim();
  const password = body.password || '';

  if (!username || !password) {
    return NextResponse.json({ error: '请输入账号和密码' }, { status: 400 });
  }
  if (body.confirm !== undefined && body.confirm !== password) {
    return NextResponse.json({ error: '两次输入的密码不一致' }, { status: 400 });
  }

  const settings = await getSettings();
  if (!settings.allowRegister) {
    return NextResponse.json({ error: '当前未开放注册，请联系管理员' }, { status: 403 });
  }

  try {
    // 系统里还没有任何账号时，第一个注册的账号直接成为管理员
    const existing = await listUsers();
    const role = existing.length === 0 ? 'admin' : 'user';

    const user = await createUser({ username, password, role });
    appendLog({
      action: 'setting',
      target: `注册账号：${user.username}`,
      detail: `角色：${role === 'admin' ? '管理员' : '普通用户'}`,
      user: user.username,
    });

    return NextResponse.json({ ok: true, user: user.username, role: user.role });
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : '注册失败';
    appendLog({ action: 'setting', target: `注册账号：${username}`, detail: msg, result: 'fail', user: username });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
