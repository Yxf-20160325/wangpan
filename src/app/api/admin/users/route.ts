import { NextRequest, NextResponse } from 'next/server';
import {
  AuthError,
  createUser,
  deleteUser,
  getSettings,
  listUsers,
  requireAdminRecord,
  updateSettings,
  updateUser,
  type Role,
} from '@/lib/auth';
import { appendLog } from '@/lib/log';

export const dynamic = 'force-dynamic';

async function guard() {
  const admin = await requireAdminRecord();
  if (!admin) return null;
  return admin;
}

export async function GET() {
  if (!(await guard())) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });
  const users = await listUsers();
  const settings = await getSettings();
  return NextResponse.json({
    users: users.map((u) => ({ id: u.id, username: u.username, role: u.role, createdAt: u.createdAt })),
    settings,
  });
}

export async function POST(req: NextRequest) {
  const admin = await guard();
  if (!admin) return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: 'create' | 'update' | 'delete' | 'settings';
    id?: string;
    username?: string;
    password?: string;
    role?: Role;
    allowRegister?: boolean;
  };

  try {
    if (body.action === 'create') {
      const user = await createUser({
        username: body.username ?? '',
        password: body.password ?? '',
        role: body.role ?? 'user',
      });
      appendLog({
        action: 'setting',
        target: `新建账号：${user.username}`,
        detail: `由 ${admin.username} 创建，角色：${user.role === 'admin' ? '管理员' : '普通用户'}`,
        user: admin.username,
      });
      return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
    }

    if (body.action === 'update') {
      if (!body.id) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
      const user = await updateUser(body.id, {
        username: body.username,
        password: body.password || undefined,
        role: body.role,
      });
      appendLog({
        action: 'setting',
        target: `修改账号：${user.username}`,
        detail: `由 ${admin.username} 修改${body.password ? '（含密码重置）' : ''}`,
        user: admin.username,
      });
      return NextResponse.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
    }

    if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
      if (body.id === admin.id) return NextResponse.json({ error: '不能删除当前登录的账号' }, { status: 400 });
      const users = await listUsers();
      const target = users.find((u) => u.id === body.id);
      await deleteUser(body.id);
      appendLog({
        action: 'setting',
        target: `删除账号：${target?.username ?? body.id}`,
        detail: `由 ${admin.username} 删除`,
        user: admin.username,
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'settings') {
      const s = await updateSettings({ allowRegister: body.allowRegister !== false });
      appendLog({
        action: 'setting',
        target: '注册开关',
        detail: s.allowRegister ? '已开放注册' : '已关闭注册',
        user: admin.username,
      });
      return NextResponse.json({ ok: true, settings: s });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
