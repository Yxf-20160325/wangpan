import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { STORAGE_DIR, getShare, isDescendantOrSelf, readDb } from '@/lib/store';
import { serveFile } from '@/lib/serve';

export const dynamic = 'force-dynamic';

/**
 * 公共下载/预览接口（无需登录）。
 * - 文件分享：直接下载（或 ?inline=1 内联预览）
 * - 文件夹分享：?file=<子文件id> 指定要下载/预览的文件
 * 仅允许访问该分享范围内的文件，越权返回 403。
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const params = new URL(req.url).searchParams;
  const fileParam = params.get('file');
  const inline = params.get('inline') === '1';

  const db = await readDb();
  const share = getShare(db, id);
  if (!share) return NextResponse.json({ error: '分享链接已失效或不存在' }, { status: 404 });

  const root = db.nodes.find((n) => n.id === share.nodeId)!;

  let targetId = root.id;
  if (root.type === 'folder') {
    if (!fileParam) {
      return NextResponse.json({ error: '该分享为文件夹，请选择要下载的文件' }, { status: 400 });
    }
    targetId = fileParam;
  } else if (fileParam && fileParam !== root.id) {
    return NextResponse.json({ error: '无效的文件' }, { status: 400 });
  }

  // 校验目标文件确实属于该分享范围
  if (!isDescendantOrSelf(db, targetId, root.id)) {
    return NextResponse.json({ error: '文件不在该分享范围内' }, { status: 403 });
  }

  const node = db.nodes.find((n) => n.id === targetId);
  if (!node || node.type !== 'file' || !node.store) {
    return new NextResponse('文件不存在', { status: 404 });
  }

  return serveFile(
    req,
    path.join(STORAGE_DIR, node.store),
    node.mime,
    node.name,
    inline ? 'inline' : 'attachment',
  );
}
