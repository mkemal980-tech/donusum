export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    const userRole = (session.user as any)?.role;

    // Get current user with their unit
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { unitId: true, role: true }
    });

    // Only allow UNIT_MANAGER or ADMIN
    if (userRole !== "UNIT_MANAGER" && userRole !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Unit managers can only see documents from their unit
    const whereClause: any = {};
    if (userRole === "UNIT_MANAGER" && currentUser?.unitId) {
      whereClause.user = {
        unitId: currentUser.unitId
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
                category: {
                  select: { name: true }
                },
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
