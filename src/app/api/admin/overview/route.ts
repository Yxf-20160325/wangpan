import { NextResponse } from 'next/server';
import { getPath, readDb, usedBytes, QUOTA_BYTES } from '@/lib/store';
import { getLogs } from '@/lib/log';
import { extOf } from '@/lib/format';
import { listUsers, requirePermission } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function pathOf(db: Awaited<ReturnType<typeof readDb>>, parentId: string | null): string {
  return getPath(db, parentId)
    .map((p) => p.name)
    .join(' / ');
}

export async function GET() {
  const guard = await requirePermission('overview:view');
  if (guard instanceof NextResponse) return guard;
  const db = await readDb();
  const files = db.nodes.filter((n) => n.type === 'file');
  const folders = db.nodes.filter((n) => n.type === 'folder');
  const totalSize = files.reduce((s, n) => s + n.size, 0);

  const largest = [...files]
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map((n) => ({ id: n.id, name: n.name, size: n.size, path: pathOf(db, n.parentId) }));

  const recent = [...files]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 6)
    .map((n) => ({ id: n.id, name: n.name, size: n.size, createdAt: n.createdAt, path: pathOf(db, n.parentId) }));

  const byExtMap = new Map<string, { count: number; size: number }>();
  for (const f of files) {
    const ext = extOf(f.name) || '无扩展名';
    const cur = byExtMap.get(ext) ?? { count: 0, size: 0 };
    cur.count += 1;
    cur.size += f.size;
    byExtMap.set(ext, cur);
  }
  const byExt = [...byExtMap.entries()]
    .map(([ext, v]) => ({ ext, count: v.count, size: v.size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);

  // 各账号空间使用
  const users = await listUsers();
  const byUser = users
    .map((u) => {
      const ownerNodes = db.nodes.filter((n) => n.owner === u.username);
      return {
        username: u.username,
        role: u.role,
        used: usedBytes(db, u.username),
        quota: QUOTA_BYTES,
        fileCount: ownerNodes.filter((n) => n.type === 'file').length,
        folderCount: ownerNodes.filter((n) => n.type === 'folder').length,
      };
    })
    .sort((a, b) => b.used - a.used);

  const logs = await getLogs();

  return NextResponse.json({
    fileCount: files.length,
    folderCount: folders.length,
    totalSize,
    logCount: logs.length,
    lastLogin: logs.find((l) => l.action === 'login' && l.result === 'ok')?.ts ?? null,
    largest,
    recent,
    byExt,
    byUser,
  });
}
