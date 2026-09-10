import { NextRequest, NextResponse } from 'next/server';
import {
  AuthError,
  banUser,
  createUser,
  deleteUser,
  effectivePermissions,
  getSettings,
  listUsers,
  normalizeBan,
  requirePermission,
  setUserPermissions,
  unbanUser,
  updateSettings,
  updateUser,
  type AppSettings,
  type Role,
} from '@/lib/auth';
import { isPermissionKey, type PermissionKey } from '@/lib/permissions';
import { appendLog } from '@/lib/log';

export const dynamic = 'force-dynamic';

/** 操作 -> 所需权限点 */
const ACTION_PERM: Record<string, PermissionKey> = {
  create: 'users:create',
  update: 'users:edit',
  delete: 'users:delete',
  ban: 'users:ban',
  unban: 'users:ban',
  permissions: 'users:permissions',
  settings: 'settings:access',
};

function sanitizePerms(input: unknown): PermissionKey[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.filter(isPermissionKey);
}

export async function GET() {
  const guard = await requirePermission('users:view');
  if (guard instanceof NextResponse) return guard;
  const users = await listUsers();
  const settings = await getSettings();
  return NextResponse.json({
    users: users.map((u) => {
      const ban = normalizeBan(u);
      return {
        id: u.id,
        username: u.username,
        role: u.role,
        createdAt: u.createdAt,
        permissions: effectivePermissions(u),
        ...ban,
      };
    }),
    settings,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    id?: string;
    username?: string;
    password?: string;
    role?: Role;
    allowRegister?: boolean;
    allowLogin?: boolean;
    reason?: string;
    durationDays?: number;
    permissions?: unknown;
  };

  const perm = body.action ? ACTION_PERM[body.action] : undefined;
  if (!perm) return NextResponse.json({ error: '未知操作' }, { status: 400 });

  const guard = await requirePermission(perm);
  if (guard instanceof NextResponse) return guard;
  const admin = guard.rec;

  try {
    if (body.action === 'create') {
      const user = await createUser({
        username: body.username ?? '',
        password: body.password ?? '',
        role: body.role ?? 'user',
        permissions: sanitizePerms(body.permissions),
      });
      appendLog({
        action: 'setting',
        target: `新建账号：${user.username}`,
        detail: `由 ${admin.username} 创建，角色：${user.role === 'admin' ? '管理员' : '普通用户'}`,
        user: admin.username,
      });
      return NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, role: user.role, permissions: effectivePermissions(user) },
      });
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
      return NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, role: user.role, permissions: effectivePermissions(user) },
      });
    }

    if (body.action === 'permissions') {
      if (!body.id) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
      // 禁止管理员修改自己的权限，避免把自己锁死在管理入口之外
      if (body.id === admin.id) {
        return NextResponse.json({ error: '不能修改当前登录账号的权限' }, { status: 400 });
      }
      const perms = sanitizePerms(body.permissions) ?? [];
      const user = await setUserPermissions(body.id, perms);
      appendLog({
        action: 'setting',
        target: `设置权限：${user.username}`,
        detail: `由 ${admin.username} 调整为 ${perms.length} 项权限`,
        user: admin.username,
      });
      return NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, role: user.role, permissions: effectivePermissions(user) },
      });
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
      const patch: Partial<AppSettings> = {};
      if (body.allowRegister !== undefined) patch.allowRegister = body.allowRegister;
      if (body.allowLogin !== undefined) patch.allowLogin = body.allowLogin;
      const s = await updateSettings(patch);
      appendLog({
        action: 'setting',
        target: '访问设置',
        detail: `注册${s.allowRegister ? '开放' : '关闭'} · 登录${s.allowLogin ? '开放' : '关闭'}`,
        user: admin.username,
      });
      return NextResponse.json({ ok: true, settings: s });
    }

    if (body.action === 'ban') {
      if (!body.id) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
      if (body.id === admin.id) return NextResponse.json({ error: '不能封禁当前登录的账号' }, { status: 400 });
      const dur = Math.max(0, Math.floor(body.durationDays ?? 0));
      const user = await banUser(body.id, body.reason?.trim() || '', dur);
      appendLog({
        action: 'setting',
        target: `封禁账号：${user.username}`,
        detail: `${dur > 0 ? `${dur} 天` : '永久'} · ${body.reason?.trim() || '未说明原因'}`,
        user: admin.username,
      });
      const ban = normalizeBan(user);
      return NextResponse.json({
        ok: true,
        user: { id: user.id, username: user.username, role: user.role, permissions: effectivePermissions(user), ...ban },
      });
    }

    if (body.action === 'unban') {
      if (!body.id) return NextResponse.json({ error: '缺少用户 id' }, { status: 400 });
      const user = await unbanUser(body.id);
      appendLog({ action: 'setting', target: `解封账号：${user.username}`, detail: '', user: admin.username });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof AuthError ? e.message : '操作失败';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
