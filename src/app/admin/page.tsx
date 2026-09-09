import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/auth';
import { touchSession } from '@/lib/session-store';
import AdminPanel from '@/components/AdminPanel';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await currentSession();
  if (!session) redirect('/login');
  if (session.role !== 'admin') redirect('/');
  touchSession(session.id);

  return <AdminPanel user={session.username} />;
}
