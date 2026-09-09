import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { currentSession } from '@/lib/auth';
import { STORAGE_DIR, readDb } from '@/lib/store';
import { serveFile } from '@/lib/serve';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const download = new URL(req.url).searchParams.get('d') === '1';

  const session = await currentSession();
  if (!session) return new NextResponse('未登录或会话已失效', { status: 401 });

  const db = await readDb();
  const node = db.nodes.find((n) => n.id === id && n.type === 'file');
  if (!node || !node.store) return new NextResponse('文件不存在', { status: 404 });
  // 只能访问自己名下的文件；管理员可访问全部
  if (session.role !== 'admin' && node.owner !== session.username) {
    return new NextResponse('无权访问该文件', { status: 403 });
  }

  return serveFile(req, path.join(STORAGE_DIR, node.store), node.mime, node.name, download ? 'attachment' : 'inline');
}
