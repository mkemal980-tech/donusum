/**
 * API Security & Utility Functions
 * Production-ready helpers for authentication, rate limiting, validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth-options';
import { prisma } from './db';
import type { UserRole } from '@prisma/client';

// Rate limiting store (in-memory for single instance, use Redis for multi-instance)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Constants
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // requests per window
const RATE_LIMIT_MAX_ADMIN = 200; // higher limit for admin
const RATE_LIMIT_MAX_AUTH = 10; // lower limit for auth endpoints
const RATE_LIMIT_MAX_AI = 10; // LLM çağrıları pahalı — dar tutulur

export type RateLimitType = 'default' | 'admin' | 'auth' | 'upload' | 'ai';

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  unitId: string | null;
  sectorId: string | null;
  subSectorId: string | null;
  emailVerified: boolean;
  isActive: boolean;
};

/**
 * Rate Limiter
 */
export function checkRateLimit(
  identifier: string,
  type: RateLimitType = 'default'
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = `${type}:${identifier}`;
  const existing = rateLimitStore.get(key);
  
  // Get max requests based on type
  const maxRequests = {
    default: RATE_LIMIT_MAX_REQUESTS,
    admin: RATE_LIMIT_MAX_ADMIN,
    auth: RATE_LIMIT_MAX_AUTH,
    upload: 30,
    ai: RATE_LIMIT_MAX_AI
  }[type];

  // Clean old entries periodically (every 1000 checks)
  if (Math.random() < 0.001) {
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) rateLimitStore.delete(k);
    }
  }

  if (!existing || now > existing.resetTime) {
    // New window
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: maxRequests - 1, resetIn: RATE_LIMIT_WINDOW };
  }

  if (existing.count >= maxRequests) {
    return { 
      allowed: false, 
      remaining: 0, 
      resetIn: existing.resetTime - now 
    };
  }

  existing.count++;
  return { 
    allowed: true, 
    remaining: maxRequests - existing.count, 
    resetIn: existing.resetTime - now 
  };
}

/**
 * Dağıtık (cluster-safe) rate limit kontrolü.
 *
 * Upstash Redis REST yapılandırılmışsa (UPSTASH_REDIS_REST_URL + _TOKEN),
 * sabit-pencere sayacı Redis üzerinde tutulur — çok-instance dağıtımda tutarlı.
 * Yapılandırılmamışsa (yerel/tek-instance) mevcut in-memory sayaca düşer.
 *
 * Redis hatası durumunda güvenli tarafta kalır: isteği in-memory sayaç ile
 * değerlendirir (fail-open değil, yerel limit devrede).
 */
export async function checkRateLimitDistributed(
  identifier: string,
  type: RateLimitType = 'default'
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    // Redis yok: yerel in-memory sayaç
    return checkRateLimit(identifier, type);
  }

  const maxRequests = {
    default: RATE_LIMIT_MAX_REQUESTS,
    admin: RATE_LIMIT_MAX_ADMIN,
    auth: RATE_LIMIT_MAX_AUTH,
    upload: 30,
    ai: RATE_LIMIT_MAX_AI,
  }[type];

  const windowSeconds = RATE_LIMIT_WINDOW / 1000;
  const bucket = Math.floor(Date.now() / RATE_LIMIT_WINDOW);
  const key = `rl:${type}:${identifier}:${bucket}`;

  try {
    // Tek round-trip'te INCR + EXPIRE (pipeline)
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, String(windowSeconds)],
      ]),
      // Prod'da sayaç güncel olmalı, cache yok
      cache: 'no-store',
    });

    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`);
    const data = (await res.json()) as Array<{ result: number }>;
    const count = data?.[0]?.result ?? 1;
    const remaining = Math.max(0, maxRequests - count);
    const resetIn = (windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds)) * 1000;

    return { allowed: count <= maxRequests, remaining, resetIn };
  } catch (error) {
    logError('checkRateLimitDistributed', error, { type });
    // Redis erişilemiyorsa yerel sayaca düş
    return checkRateLimit(identifier, type);
  }
}

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Authentication wrapper with admin check
 */
export async function withAuth(
  request: NextRequest,
  options: {
    requireAdmin?: boolean;
    requireUnitManager?: boolean;
    rateLimit?: RateLimitType;
  } = {}
): Promise<{ success: true; userId: string; user: AuthenticatedUser } | { success: false; response: NextResponse }> {
  const { requireAdmin = false, requireUnitManager = false, rateLimit = 'default' } = options;
  
  // Rate limit check (dağıtık; Redis yoksa in-memory'ye düşer)
  const ip = getClientIP(request);
  const rateLimitResult = await checkRateLimitDistributed(ip, rateLimit);
  
  if (!rateLimitResult.allowed) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Çok fazla istek. Lütfen biraz bekleyin.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimitResult.resetIn / 1000)),
            'X-RateLimit-Remaining': '0'
          }
        }
      )
    };
  }

  // Session check
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Oturum açmanız gerekiyor.' },
        { status: 401 }
      )
    };
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      unitId: true,
      sectorId: true,
      subSectorId: true,
      emailVerified: true,
      isActive: true
    }
  });

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Kullanıcı bulunamadı.' },
        { status: 404 }
      )
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Hesabınız devre dışı bırakılmış.' },
        { status: 403 }
      )
    };
  }

  // Admin check
  if (requireAdmin && user.role !== 'ADMIN') {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok.' },
        { status: 403 }
      )
    };
  }

  if (requireUnitManager && user.role !== 'ADMIN' && user.role !== 'UNIT_MANAGER') {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'Bu işlem için yetkiniz yok.' },
        { status: 403 }
      )
    };
  }

  return { success: true, userId: user.id, user };
}

/**
 * Input Validation Helpers
 */
export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  password: (password: string): { valid: boolean; message?: string } => {
    if (!password || password.length < 8) {
      return { valid: false, message: 'Şifre en az 8 karakter olmalıdır.' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Şifre en az bir büyük harf içermelidir.' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Şifre en az bir rakam içermelidir.' };
    }
    return { valid: true };
  },
  
  sanitizeString: (str: string, maxLength: number = 1000): string => {
    if (!str) return '';
    return str.trim().slice(0, maxLength);
  },
  
  isValidId: (id: string): boolean => {
    // CUID format check
    return /^c[a-z0-9]{24,}$/.test(id);
  },

  fileSize: (size: number, maxMB: number = 10): boolean => {
    return size <= maxMB * 1024 * 1024;
  },

  fileType: (contentType: string, allowedTypes: string[]): boolean => {
    return allowedTypes.some(type => 
      type.endsWith('/*') 
        ? contentType.startsWith(type.replace('/*', '/')) 
        : contentType === type
    );
  }
};

/**
 * Safe JSON parse
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string
): NextResponse {
  return NextResponse.json(
    { error: message, code },
    { status }
  );
}

/**
 * Success response helper
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Kullanıcının bir ankete erişimi var mı?
 *
 * Erişim atamayla verilir; anket ya da atama pasifse, süresi dolmuşsa erişim
 * kapanır. Yönetici her ankete erişir. Erişim varsa null, yoksa doğrudan
 * dönülecek hata yanıtı verir.
 */
export async function validateSurveyAccess(
  userId: string,
  role: string,
  surveyId: string
): Promise<NextResponse | null> {
  if (role === 'ADMIN') return null;

  const assignment = await prisma.userSurveyAssignment.findUnique({
    where: { userId_surveyId: { userId, surveyId } },
    include: { survey: { select: { isActive: true } } }
  });

  if (!assignment || !assignment.isActive || !assignment.survey.isActive) {
    return NextResponse.json(
      { error: 'Bu ankete erişim yetkiniz yok.' },
      { status: 403 }
    );
  }

  if (assignment.hasDeadline && assignment.deadline && assignment.deadline < new Date()) {
    return NextResponse.json(
      { error: 'Bu anketin süresi dolmuş.' },
      { status: 403 }
    );
  }

  return null;
}

/**
 * Logging helper (sanitizes sensitive data)
 */
export function logError(context: string, error: unknown, additionalInfo?: Record<string, any>) {
  const safeInfo = additionalInfo ? { ...additionalInfo } : {};
  
  // Remove sensitive fields
  delete safeInfo.password;
  delete safeInfo.token;
  delete safeInfo.secret;
  
  console.error(`[${context}]`, {
    message: error instanceof Error ? error.message : 'Unknown error',
    timestamp: new Date().toISOString(),
    ...safeInfo
  });
}
