import { NextRequest, NextResponse } from 'next/server';
import { moveNodes, readDb } from '@/lib/store';
import { currentSession, guardApi } from '@/lib/auth';
import { appendLog } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ids?: string[]; targetId?: string | null };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  const targetId = body.targetId ?? null;
  if (!ids.length) return NextResponse.json({ error: '缺少 ids' }, { status: 400 });

  const db = await readDb();
  if (targetId) {
    const target = db.nodes.find((n) => n.id === targetId && n.type === 'folder');
    if (!target) return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 });
  }

  // 普通用户只能移动自己名下的节点，且目标文件夹也必须是自己的
  const isAdmin = session.role === 'admin';
  const allowed = isAdmin
    ? ids
    : ids.filter((i) => {
        const n = db.nodes.find((x) => x.id === i);
        return n && n.owner === session.username;
      });
  if (!isAdmin && targetId) {
    const target = db.nodes.find((n) => n.id === targetId);
    if (!target || target.owner !== session.username) {
      return NextResponse.json({ error: '无权移动到该文件夹' }, { status: 403 });
    }
  }

  const names = allowed.map((i) => db.nodes.find((n) => n.id === i)?.name).filter(Boolean) as string[];
  const targetName = targetId ? db.nodes.find((n) => n.id === targetId)?.name : '全部文件';
  const moved = await moveNodes(allowed, targetId);
  appendLog({
    action: 'move',
    target: names.join('、') || `${allowed.length} 个项目`,
    detail: `移动到：${targetName ?? '全部文件'}`,
    user: session.username,
  });
  return NextResponse.json({ moved });
}
