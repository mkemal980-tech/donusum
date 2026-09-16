export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFileUrl } from "@/lib/s3";
import { withAuth } from "@/lib/api-utils";
import { getManagedUnitIds } from "@/lib/assessment";

export async function GET(request: NextRequest) {
  const auth = await withAuth(request, { requireUnitManager: true });
  if (!auth.success) return auth.response;

  try {
    /**
     * Kapsam açıkça çözülür; boş bırakılmaz.
     *
     * Burada eskiden `whereClause` yalnızca "rol UNIT_MANAGER **ve** birimi
     * var" koşulunda doldurulduğu için, birimi atanmamış bir birim yöneticisi
     * `where: {}` ile sistemdeki **bütün** kuruluşların belgelerini çalışan
     * imzalı indirme adresleriyle birlikte alıyordu. Bu durum olağandışı da
     * değildi: rolü verilip birimi sonra atanan ya da kısmi bir güncellemeyle
     * birimi düşen her kullanıcı oraya düşüyordu.
     *
     * Kapsam artık diğer ekranlarla aynı kaynaktan geliyor: yönetilen birimler
     * hiyerarşiyle birlikte (bkz. lib/assessment > getManagedUnitIds), ayrıca
     * kullanıcının kendi birimi. Yönetilen birim yoksa liste boştur.
     */
    const whereClause: { user?: { unitId: { in: string[] } } } = {};

    if (auth.user.role !== "ADMIN") {
      const managedUnitIds = new Set(await getManagedUnitIds(auth.userId));
      if (auth.user.unitId) managedUnitIds.add(auth.user.unitId);

      if (managedUnitIds.size === 0) {
        return NextResponse.json([]);
      }
      whereClause.user = { unitId: { in: [...managedUnitIds] } };
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
    // `cloudStoragePath` yanıtta dönmez: istemciye sızan nesne anahtarı,
    // yükleme tamamlama uç noktasında sahte yol üretmeyi kolaylaştırıyordu.
    const documentsWithUrls = await Promise.all(
      documents.map(async ({ cloudStoragePath, ...doc }) => {
        try {
          const downloadUrl = await getFileUrl(cloudStoragePath, doc.isPublic);
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
