import { NextResponse, type NextRequest } from 'next/server';
const PUBLIC = ['/login', '/join', '/apply'];
export function middleware(req: NextRequest) {
  const p = req.nextUrl.pathname;
  if (PUBLIC.some((x) => p.startsWith(x))) return NextResponse.next();
  if (!req.cookies.get('kerem_session')) {
    const u = req.nextUrl.clone(); u.pathname = '/login'; u.search = p !== '/' ? `?mode=signin&next=${encodeURIComponent(p)}` : '';
    return NextResponse.redirect(u);
  }
  return NextResponse.next();
}
export const config = { matcher: ['/((?!api|_next|icons|sw.js|offline.html|manifest.webmanifest|favicon.ico|.*\\.(?:png|svg|jpg|ico|webmanifest|js)$).*)'] };
