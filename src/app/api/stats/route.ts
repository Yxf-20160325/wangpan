import { NextResponse } from 'next/server';
import { readDb, usedBytes, QUOTA_BYTES } from '@/lib/store';
import { currentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const db = await readDb();
  // 统计当前登录账号名下的文件与文件夹
  const mine = db.nodes.filter((n) => n.owner === session.username);
  const files = mine.filter((n) => n.type === 'file');
  const folders = mine.filter((n) => n.type === 'folder');
  const used = usedBytes(db, session.username);
  const remaining = Math.max(0, QUOTA_BYTES - used);
  return NextResponse.json({
    fileCount: files.length,
    folderCount: folders.length,
    totalSize: used,
    used,
    quota: QUOTA_BYTES,
    remaining,
  });
}
