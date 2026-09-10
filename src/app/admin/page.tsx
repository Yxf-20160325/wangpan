import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { currentUserRecord, effectivePermissions } from '@/lib/auth';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';
import AdminPanel from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  // 登录门禁与 middleware 保持一致：只看 token 是否有效（无状态），避免判据不一致导致的重定向死循环
  const store = await cookies();
  const payload = await verifyToken(store.get(SESSION_COOKIE)?.value);
  if (!payload) redirect('/login');

  const rec = await currentUserRecord();
  if (!rec) redirect('/login');
  if (rec.role !== 'admin') redirect('/');

  const permissions = effectivePermissions(rec);
  return <AdminPanel user={rec.username} role="admin" permissions={permissions} />;
}
