import { NextRequest, NextResponse } from 'next/server';
import {
  currentUser,
  currentUserRecord,
  getSettings,
  requirePermission,
  updateUser,
  verifyLogin,
} from '@/lib/auth';
import { appendLog } from '@/lib/log';
import { deleteNodes, readDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requirePermission('settings:view');
  if (guard instanceof NextResponse) return guard;
  const s = await getSettings();
  return NextResponse.json({ username: guard.rec.username, allowRegister: s.allowRegister, allowLogin: s.allowLogin });
}

export async function POST(req: NextRequest) {
  const rec = await currentUserRecord();
  if (!rec || rec.role !== 'admin') return NextResponse.json({ error: '需要管理员权限' }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    action?: 'account' | 'clear-data';
    currentPassword?: string;
    username?: string;
    password?: string;
  };
  const user = await currentUser();

  if (body.action === 'account') {
    // 仅用于「修改/校验自身密码」，任何管理员可用（清空数据前的身份校验也走这里）
    const ok = await verifyLogin(rec.username, body.currentPassword ?? '');
    if (!ok) {
      appendLog({ action: 'setting', target: '修改账号信息', detail: '当前密码验证失败', result: 'fail', user });
      return NextResponse.json({ error: '当前密码不正确' }, { status: 400 });
    }
    const updated = await updateUser(rec.id, {
      username: body.username,
      password: body.password || undefined,
    });
    appendLog({
      action: 'setting',
      target: '修改账号信息',
      detail: body.password ? '已更新账号与密码' : '已更新账号',
      user: updated.username,
    });
    return NextResponse.json({ ok: true, username: updated.username });
  }

  if (body.action === 'clear-data') {
    const guard = await requirePermission('settings:clear');
    if (guard instanceof NextResponse) return guard;
    const db = await readDb();
    const ids = db.nodes.map((n) => n.id);
    let removed = 0;
    if (ids.length) removed = await deleteNodes(ids);
    appendLog({ action: 'setting', target: '清空全部数据', detail: `移除 ${removed} 个节点`, user: guard.rec.username });
    return NextResponse.json({ ok: true, removed });
  }

  return NextResponse.json({ error: '未知操作' }, { status: 400 });
}
