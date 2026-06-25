import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Find any cookie matching the Supabase auth token naming convention: sb-[project-ref]-auth-token
  const cookies = request.cookies.getAll();
  const tokenCookie = cookies.find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'));
  
  const token = tokenCookie ? tokenCookie.value : null;
  const { pathname } = request.nextUrl;

  // Protect /dashboard and subroutes
  if (!token && pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Redirect authenticated users from login/root to dashboard
  if (token && (pathname === '/login' || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*', '/login'],
};
