import { NextRequest, NextResponse } from 'next/server';
import { currentUserRecord } from '@/lib/auth';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ user: null, role: null }, { status: 401 });

  const record = await currentUserRecord();
  return NextResponse.json({
    user: session.u,
    role: record?.role ?? 'user',
  });
}
