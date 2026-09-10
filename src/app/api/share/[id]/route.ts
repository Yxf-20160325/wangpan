import { NextRequest, NextResponse } from 'next/server';
import { currentSession, currentUserRecord, guardApi, hasPerm } from '@/lib/auth';
import { collectSubtree, getPath, getShare, readDb, revokeShare } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await readDb();
  const share = getShare(db, id);
  if (!share) return NextResponse.json({ error: '分享链接已失效或不存在' }, { status: 404 });

  const node = db.nodes.find((n) => n.id === share.nodeId)!;
  const base = {
    id: share.id,
    nodeId: node.id,
    name: node.name,
    type: node.type,
    size: node.size,
    mime: node.mime,
    owner: share.owner,
    createdAt: node.createdAt,
    expireAt: share.expireAt,
  };

  if (node.type === 'folder') {
    const subtree = collectSubtree(db, node.id);
    const files = subtree.filter((n) => n.type === 'file');
    const children = files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      mime: f.mime,
      // 相对分享根目录的路径（去掉分享文件夹本身这一层）
      path: getPath(db, f.parentId)
        .slice(1)
        .map((p) => p.name)
        .join(' / '),
    }));
    return NextResponse.json({ ...base, childCount: children.length, children });
  }

  return NextResponse.json({ ...base, childCount: 1, children: [] });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  const { id } = await ctx.params;

  const db = await readDb();
  const share = db.shares.find((s) => s.id === id);
  if (!share) return NextResponse.json({ error: '分享不存在' }, { status: 404 });

  const isOwner = share.owner === session?.username;
  if (!isOwner) {
    // 仅管理员可撤销他人分享，且需持有 shares:revoke 权限
    if (session?.role !== 'admin') return NextResponse.json({ error: '无权撤销该分享' }, { status: 403 });
    const rec = await currentUserRecord();
    if (!rec || !hasPerm(rec, 'shares:revoke')) {
      return NextResponse.json({ error: '无权限撤销分享链接', code: 'FORBIDDEN' }, { status: 403 });
    }
  }

  const removed = await revokeShare(id, isOwner ? session?.username : undefined);
  return NextResponse.json({ removed });
}
