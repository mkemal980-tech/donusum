/**
 * Health Check API Endpoint
 * Used for monitoring and load balancer health checks
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; message?: string }> = {};
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // 1. Database connectivity check
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { 
      status: 'ok', 
      latency: Date.now() - dbStart 
    };
  } catch (error) {
    checks.database = { 
      status: 'error', 
      message: 'Database connection failed' 
    };
    overallStatus = 'unhealthy';
  }

  // 2. Memory usage check
  try {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);
    
    if (heapPercent > 90) {
      checks.memory = { status: 'error', message: `High memory usage: ${heapPercent}%` };
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
    } else {
      checks.memory = { status: 'ok', message: `${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%)` };
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
