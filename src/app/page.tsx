import { redirect } from 'next/navigation';
import { currentSession, currentUserRecord } from '@/lib/auth';
import { touchSession } from '@/lib/session-store';
import DiskApp from '@/components/DiskApp';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await currentSession();
  if (!session) redirect('/login');
  touchSession(session.id);

  const rec = await currentUserRecord();

  return <DiskApp user={session.username} role={session.role} avatar={rec?.avatar ?? ''} />;
}
