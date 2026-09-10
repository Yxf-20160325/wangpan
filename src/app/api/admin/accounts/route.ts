import { NextResponse } from 'next/server';
import { currentSession, guardApi, listUsers } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 仅管理员可用：返回除自己外的全部账号名，供主页面“查看他人文件”使用
export async function GET() {
  const denied = await guardApi();
  if (denied) return denied;

  const session = await currentSession();
  if (!session) return NextResponse.json({ error: '未登录或会话已失效' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: '无权访问' }, { status: 403 });

  const users = await listUsers();
  const accounts = users.map((u) => u.username).filter((name) => name !== session.username);
  return NextResponse.json({ accounts });
}
