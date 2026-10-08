import { type NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

// Next 16 calls this file the proxy (formerly middleware). It runs before every matched request.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    {
      // Everything except static files and images; link prefetches skip it too (the real navigation is checked).
      source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
