export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");
    const unitId = searchParams.get("unitId");

    const whereClause: any = {};
    
    if (userId) {
      whereClause.userId = userId;
    }
    
    if (unitId) {
      whereClause.user = {
        unitId: unitId
      };
    }

    const documents = await prisma.document.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            unit: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        response: {
          select: {
            id: true,
            question: {
              select: {
                id: true,
                text: true,
                subLevel: {
                  select: {
                    name: true,
                    subCategory: {
                      select: {
                        name: true,
                        category: {
                          select: { name: true }
                        }
                      }
                    }
                  }
                },
                subCategory: {
                  select: {
                    name: true,
                    category: {
                      select: { name: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Generate signed URLs for each document
    const documentsWithUrls = await Promise.all(
      documents.map(async (doc) => {
        try {
          const downloadUrl = await getFileUrl(doc.cloudStoragePath, doc.isPublic);
          return { ...doc, downloadUrl };
        } catch {
          return { ...doc, downloadUrl: null };
        }
      })
    );

    return NextResponse.json(documentsWithUrls);
  } catch (error) {
    console.error("Error fetching documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
