import { NextRequest, NextResponse } from 'next/server';
import { readDb, renameNode } from '@/lib/store';
import { currentSession, guardApi } from '@/lib/auth';
import { appendLog } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = (body.name || '').trim();
  if (!name) return NextResponse.json({ error: '名称不能为空' }, { status: 400 });

  const db = await readDb();
  const target = db.nodes.find((n) => n.id === id);
  if (!target) return NextResponse.json({ error: '节点不存在' }, { status: 404 });
  if (session.role !== 'admin' && target.owner !== session.username) {
    return NextResponse.json({ error: '无权操作该文件' }, { status: 403 });
  }

  const oldName = target.name;
  const node = await renameNode(id, name);
  appendLog({ action: 'rename', target: `${oldName} → ${name}`, user: session.username });
  return NextResponse.json({ node });
}
