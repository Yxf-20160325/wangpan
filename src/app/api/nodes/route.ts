import { NextRequest, NextResponse } from 'next/server';
import { createFolder, folderStats, getPath, readDb, sortNodes } from '@/lib/store';
import { currentSession, guardApi } from '@/lib/auth';
import { appendLog } from '@/lib/log';
import type { ApiListResult, FSNodeView, SortDir, SortKey } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SORT_KEYS: SortKey[] = ['name', 'size', 'updatedAt', 'type'];

export async function GET(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });
  // 普通用户只看自己的文件；管理员可见全部
  const isAdmin = session.role === 'admin';
  const scope = (nodes: typeof db.nodes) => (isAdmin ? nodes : nodes.filter((n) => n.owner === session.username));

  const { searchParams } = new URL(req.url);
  const parentId = searchParams.get('parentId') || null;
  const search = (searchParams.get('search') || '').trim();
  const sort = (SORT_KEYS.includes(searchParams.get('sort') as SortKey) ? searchParams.get('sort') : 'name') as SortKey;
  const dir: SortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc';
  const all = searchParams.get('all') === '1';

  const db = await readDb();
  const accessible = scope(db.nodes);

  let matched;
  if (search) {
    const kw = search.toLowerCase();
    matched = accessible.filter((n) => n.name.toLowerCase().includes(kw));
  } else if (all) {
    matched = [...accessible];
  } else {
    matched = accessible.filter((n) => n.parentId === parentId);
  }

  matched = sortNodes(matched, sort, dir);

  const nodes: FSNodeView[] = matched.map((n) => {
    if (n.type === 'folder') {
      const s = folderStats(db, n.id);
      return { ...n, itemCount: s.count, totalSize: s.size };
    }
    return { ...n };
  });

  const result: ApiListResult = {
    nodes,
    path: search ? [] : getPath(db, parentId),
    total: nodes.length,
  };

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; parentId?: string | null };
  const name = (body.name || '新建文件夹').trim();
  const parentId = body.parentId ?? null;

  const db = await readDb();
  if (parentId) {
    const parent = db.nodes.find((n) => n.id === parentId && n.type === 'folder');
    if (!parent) return NextResponse.json({ error: '目标文件夹不存在' }, { status: 404 });
  }

  const node = await createFolder(parentId, name, session.username);
  const parentName = parentId ? db.nodes.find((n) => n.id === parentId)?.name : '全部文件';
  appendLog({ action: 'create', target: node.name, detail: `位置：${parentName ?? '全部文件'}`, user: session.username });
  return NextResponse.json({ node });
}

export async function DELETE(req: NextRequest) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) return NextResponse.json({ error: '缺少 ids' }, { status: 400 });

  const { deleteNodes } = await import('@/lib/store');
  const db = await readDb();
  // 普通用户只能删除自己的节点
  const allowed =
    session.role === 'admin'
      ? ids
      : ids.filter((id) => {
          const n = db.nodes.find((x) => x.id === id);
          return n && n.owner === session.username;
        });
  const names = allowed.map((id) => db.nodes.find((n) => n.id === id)?.name).filter(Boolean) as string[];
  const removed = await deleteNodes(allowed);
  appendLog({
    action: 'delete',
    target: names.join('、') || `${allowed.length} 个项目`,
    detail: `共移除 ${removed} 个节点`,
    user: session.username,
  });
  return NextResponse.json({ removed });
}
