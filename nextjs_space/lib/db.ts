import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with retry logic for connection issues
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Helper function to execute queries with automatic retry on connection errors
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error as Error;
      const errorMessage = lastError?.message || '';
      
      // Check if it's a connection error that can be retried
      const isConnectionError = 
        errorMessage.includes('idle-session timeout') ||
        errorMessage.includes('Connection refused') ||
        errorMessage.includes('Connection terminated') ||
        errorMessage.includes('connection was closed') ||
        errorMessage.includes('ECONNRESET') ||
        errorMessage.includes('terminating connection');
      
      if (isConnectionError && attempt < maxRetries) {
        console.log(`[DB] Connection error, retrying (attempt ${attempt}/${maxRetries})...`);
        // Reconnect before retry
        try {
          await prisma.$disconnect();
        } catch {
          // Ignore disconnect errors
        }
        // Small delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
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
