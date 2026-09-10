import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUserRecord } from '@/lib/auth';
import { touchSession } from '@/lib/session-store';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';
import DiskApp from '@/components/DiskApp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  // 登录门禁与 middleware 保持一致：只看 token 是否有效（无状态）。
  // 若同时依赖有状态会话表（sessions.json），在重新部署后该表被重置、而旧 token 仍有效时，
  // 页面会判为「未登录」跳转 /login，middleware 却判为「已登录」把 /login 弹回 /，形成重定向死循环。
  const store = await cookies();
  const payload = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) redirect('/login');

  const rec = await currentUserRecord();
  if (!rec) redirect('/login');

  // 会话存储存在该会话时才刷新活跃时间；被踢/重置时静默跳过，不影响登录态判定
  touchSession(payload.sid);

  return <DiskApp user={rec.username} role={rec.role} avatar={rec.avatar ?? ''} />;
}
