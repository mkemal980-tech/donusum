import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET - Tüm anketleri getir
export async function GET() {
  try {
    const surveys = await prisma.survey.findMany({
      orderBy: { order: 'asc' },
      include: {
        categories: {
          orderBy: { order: 'asc' },
          include: {
            _count: {
              select: { subCategories: true }
            }
          }
        },
        _count: {
          select: { categories: true }
        }
      }
    });
    return NextResponse.json(surveys);
  } catch (error) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: 'Failed to fetch surveys' }, { status: 500 });
  }
}

// POST - Yeni anket oluştur
export async function POST(request: Request) {
  try {
    const { name, description, isActive, order } = await request.json();
    
    const survey = await prisma.survey.create({
      data: {
        name,
        description,
        isActive: isActive ?? true,
        order: order || 0
      }
    });
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error creating survey:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}

// PUT - Anket güncelle
export async function PUT(request: Request) {
  try {
    const { id, name, description, isActive, order } = await request.json();
    
    const survey = await prisma.survey.update({
      where: { id },
      data: {
        name,
        description,
        isActive,
        order
      }
    });
    
    return NextResponse.json(survey);
  } catch (error) {
    console.error('Error updating survey:', error);
    return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
  }
}

// DELETE - Anket sil
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Survey ID required' }, { status: 400 });
    }
    
    await prisma.survey.delete({
      where: { id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
