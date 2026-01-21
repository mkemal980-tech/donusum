import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

// Get all completion statuses for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const completions = await prisma.userRecommendationCompletion.findMany({
      where: { userId: user.id },
      include: {
        recommendation: {
          select: {
            id: true,
            title: true,
            points: true,
          }
        }
      }
    });

    return NextResponse.json(completions);
  } catch (error) {
    console.error('Error fetching completion statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch completion statuses' }, { status: 500 });
  }
}

// Create or update a completion status
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recommendationId, status, notes } = await request.json();

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const completion = await prisma.userRecommendationCompletion.upsert({
      where: {
        userId_recommendationId: {
          userId: user.id,
          recommendationId: recommendationId
        }
      },
      create: {
        userId: user.id,
        recommendationId: recommendationId,
        status: status || 'NOT_STARTED',
        notes: notes || null,
        completedAt: status === 'COMPLETED' ? new Date() : null
      },
      update: {
        status: status || 'NOT_STARTED',
        notes: notes !== undefined ? notes : undefined,
        completedAt: status === 'COMPLETED' ? new Date() : null
      },
      include: {
        recommendation: {
          select: {
            id: true,
            title: true,
            points: true
          }
        }
      }
    });

    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error updating completion status:', error);
    return NextResponse.json({ error: 'Failed to update completion status' }, { status: 500 });
  }
}

// Delete a completion status (reset to not started)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const recommendationId = searchParams.get('recommendationId');

    if (!recommendationId) {
      return NextResponse.json({ error: 'Recommendation ID is required' }, { status: 400 });
    }

    await prisma.userRecommendationCompletion.delete({
      where: {
        userId_recommendationId: {
          userId: user.id,
          recommendationId: recommendationId
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting completion status:', error);
    return NextResponse.json({ error: 'Failed to delete completion status' }, { status: 500 });
  }
}
