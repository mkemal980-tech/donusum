import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with optimized connection settings
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// Cache the prisma instance globally to avoid creating multiple instances
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Helper function to execute queries with automatic retry on connection errors
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Before each attempt, try to reconnect if needed
      if (attempt > 1) {
        try {
          await prisma.$disconnect();
          await prisma.$connect();
        } catch {
          // Ignore reconnection errors, the operation itself will fail if connection is broken
        }
      }
      return await operation();
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = lastError?.message || '';
      const errorStr = String(error);
      
      // Check if it's a connection error that can be retried
      const isConnectionError = 
        errorMessage.includes('idle-session timeout') ||
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('connection was closed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('terminating connection') ||
        errorMessage.includes('Connection pool timeout') ||
        errorMessage.includes('prepared statement') ||
        errorMessage.includes('Cannot reach database') ||
        errorStr.includes('idle-session timeout') ||
        errorStr.includes('terminating connection') ||
        errorStr.includes('P1001') || // Can't reach database
        errorStr.includes('P1002') || // Timeout
        errorStr.includes('P1017');   // Server closed connection
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`[DB] Retry ${attempt}/${maxRetries} - reconnecting...`);
        // Wait before retry with exponential backoff (500ms, 1s, 1.5s)
        await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        continue;
      }
      
      throw error;
    }
  }
  
  throw lastError;
}

// Graceful shutdown handler
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}
