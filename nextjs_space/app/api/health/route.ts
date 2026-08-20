/**
 * Health Check API Endpoint
 * Used for monitoring and load balancer health checks
 * Logs results to database for admin monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, withRetry } from '@/lib/db';
import { withAuth } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; message?: string }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  let errorMessage: string | null = null;

  // 1. Database connectivity check
  let dbLatency: number | null = null;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    checks.database = { 
      status: 'ok', 
      latency: dbLatency 
    };
  } catch (error) {
    checks.database = { 
      status: 'error', 
      message: 'Database connection failed' 
    };
    errorMessage = 'Database connection failed';
    overallStatus = 'unhealthy';
  }

  // 2. Memory usage check
  let memoryUsage: number | null = null;
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    memoryUsage = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    const memoryThreshold = Number(process.env.HEALTH_MEMORY_THRESHOLD ?? 98);

    if (memoryUsage > memoryThreshold) {
      checks.memory = {
        status: 'error',
        message: `High memory usage: ${memoryUsage}% (threshold: ${memoryThreshold}%)`
      };
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
      errorMessage = errorMessage || `High memory: ${memoryUsage}%`;
    } else {
      checks.memory = { status: 'ok', message: `${heapUsedMB}MB / ${heapTotalMB}MB (${memoryUsage}%)` };
    }
  } catch (error) {
    checks.memory = { status: 'error', message: 'Memory check failed' };
  }

  // 3. Response time check
  const totalLatency = Date.now() - startTime;
  checks.responseTime = { 
    status: totalLatency < 1000 ? 'ok' : 'error', 
    latency: totalLatency 
  };

  // Log to database (non-blocking, don't fail health check if logging fails)
  const searchParams = request.nextUrl.searchParams;
  const shouldLog = searchParams.get('log') !== 'false';
  
  if (shouldLog && overallStatus !== 'unhealthy') {
    try {
      await prisma.healthLog.create({
        data: {
          status: overallStatus,
          dbLatency,
          memoryUsage,
          responseTime: totalLatency,
          errorMessage
        }
      });
      
      // Clean up old logs (keep last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await prisma.healthLog.deleteMany({
        where: { checkedAt: { lt: sevenDaysAgo } }
      });
    } catch (logError) {
      // Don't fail health check due to logging issues
      console.error('Health log write failed:', logError);
    }
  }

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks,
    version: process.env.npm_package_version || '1.0.0'
  };

  // Return appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
                     overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: statusCode });
}

// Get health history for admin dashboard
export async function POST(request: NextRequest) {
  const auth = await withAuth(request, { requireAdmin: true, rateLimit: 'admin' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { hours = 24 } = body;
    
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const logs = await prisma.healthLog.findMany({
      where: { checkedAt: { gte: since } },
      orderBy: { checkedAt: 'desc' },
      take: 500
    });
    
    // Calculate stats
    const stats = {
      total: logs.length,
      healthy: logs.filter(l => l.status === 'healthy').length,
      degraded: logs.filter(l => l.status === 'degraded').length,
      unhealthy: logs.filter(l => l.status === 'unhealthy').length,
      avgDbLatency: logs.length ? Math.round(logs.reduce((sum, l) => sum + (l.dbLatency || 0), 0) / logs.length) : 0,
      avgMemory: logs.length ? Math.round(logs.reduce((sum, l) => sum + (l.memoryUsage || 0), 0) / logs.length) : 0,
      avgResponseTime: logs.length ? Math.round(logs.reduce((sum, l) => sum + (l.responseTime || 0), 0) / logs.length) : 0
    };
    
    return NextResponse.json({ logs, stats });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch health logs' }, { status: 500 });
  }
}
