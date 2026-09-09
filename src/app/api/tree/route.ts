import { NextResponse } from 'next/server';
import { readDb } from '@/lib/store';
import { currentSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** 返回当前账号可见的文件夹，供「移动到」选择器使用；管理员可见全部 */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });

  const db = await readDb();
  const visible = session.role === 'admin' ? db.nodes : db.nodes.filter((n) => n.owner === session.username);
  const folders = visible
    .filter((n) => n.type === 'folder')
    .map((n) => ({ id: n.id, name: n.name, parentId: n.parentId }))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
  return NextResponse.json({ folders });
}
