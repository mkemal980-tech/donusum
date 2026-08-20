import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Security headers for all responses
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Log API requests in production for monitoring
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const logData = {
      method: request.method,
      path: request.nextUrl.pathname,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    };
    
    // Log to console (will be captured by production logging)
    if (process.env.NODE_ENV === 'production') {
      console.log('[API]', JSON.stringify(logData));
    }
  }

  return response;
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    // Match all paths except static files and images
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
