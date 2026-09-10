import { redirect } from 'next/navigation';
import { currentSession, currentUserRecord, effectivePermissions } from '@/lib/auth';
import { touchSession } from '@/lib/session-store';
import AdminPanel from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await currentSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/');
  const rec = await currentUserRecord();
  touchSession(session.id);

  const permissions = rec ? effectivePermissions(rec) : [];
  return <AdminPanel user={session.username} role="admin" permissions={permissions} />;
}
