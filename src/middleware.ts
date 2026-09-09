import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifyToken } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifyToken(req.cookies.get(SESSION_COOKIE)?.value);

  // 登录/注册页与认证接口始终放行
  const isPublic =
    pathname === '/login' || pathname === '/register' || pathname.startsWith('/api/auth/');

  // 公开分享页与分享查询/下载接口（仅 GET）无需登录
  const isSharePublic =
    pathname.startsWith('/share/') ||
    (req.method === 'GET' && /^\/api\/share\/[^/]+(\/download)?$/.test(pathname));

  if (session) {
    if (pathname === '/login') return NextResponse.redirect(new URL('/', req.url));
    return NextResponse.next();
  }

  if (isPublic || isSharePublic) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: '未登录或登录已过期', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  const url = new URL('/login', req.url);
  if (pathname !== '/') url.searchParams.set('from', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
