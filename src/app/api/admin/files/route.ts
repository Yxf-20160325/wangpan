import { NextRequest, NextResponse } from 'next/server';
import { deleteNodes, getPath, readDb } from '@/lib/store';
import { appendLog } from '@/lib/log';
import { currentUser } from '@/lib/auth';
import { extOf } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = await readDb();
  const items = db.nodes.map((n) => ({
    ...n,
    path: getPath(db, n.parentId)
      .map((p) => p.name)
      .join(' / '),
    ext: n.type === 'file' ? extOf(n.name) : '',
  }));
  // 去重后的账号列表，供前端按账号筛选
  const accounts = Array.from(new Set(db.nodes.map((n) => n.owner))).sort();
  return NextResponse.json({ items, accounts });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ error: '缺少 ids' }, { status: 400 });

  const db = await readDb();
  const names = ids.map((id) => db.nodes.find((n) => n.id === id)?.name).filter(Boolean) as string[];
  const removed = await deleteNodes(ids);

  appendLog({
    action: 'delete',
    target: names.join('、') || `${ids.length} 个项目`,
    detail: `管理面板删除，共移除 ${removed} 个节点`,
    user: await currentUser(),
  });

  return NextResponse.json({ removed });
}
