export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { generatePresignedUploadUrl } from "@/lib/s3";
import { validators, withAuth } from "@/lib/api-utils";

// Allowed file types for upload
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv'
];

const MAX_FILE_SIZE_MB = 10; // Maximum 10MB

export async function POST(request: NextRequest) {
  // Hız sınırı ve kimlik tek kapıda; devre dışı bırakılan hesap artık
  // eski oturumuyla yükleme adresi alamıyor.
  const auth = await withAuth(request, { rateLimit: 'upload' });
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { fileName, contentType, isPublic, fileSize } = body ?? {};

    if (!fileName || !contentType) {
      return NextResponse.json(
        { error: "Dosya adı ve içerik tipi gerekli" },
        { status: 400 }
      );
    }

    // File type validation
    if (!validators.fileType(contentType, ALLOWED_FILE_TYPES)) {
      return NextResponse.json(
        { error: "Desteklenmeyen dosya türü. İzin verilen: PDF, Word, Excel, resim dosyaları." },
        { status: 400 }
      );
    }

    // File size validation (if provided)
    if (fileSize && !validators.fileSize(fileSize, MAX_FILE_SIZE_MB)) {
      return NextResponse.json(
        { error: `Dosya boyutu ${MAX_FILE_SIZE_MB}MB'dan büyük olamaz.` },
        { status: 400 }
      );
    }

    // Sanitize filename (remove special characters)
    const sanitizedFileName = fileName
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 255);

    /**
     * Kanıt dosyaları varsayılan olarak özeldir.
     *
     * `isPublic ?? true` kurumsal kanıt belgelerini (fatura, izin, denetim
     * raporu) herkese açık ön ekle yüklüyordu. Açık olması isteniyorsa
     * çağıran taraf bunu açıkça söylemeli.
     */
    const { uploadUrl, cloudStoragePath, pathSignature } = await generatePresignedUploadUrl(
      sanitizedFileName,
      contentType,
      isPublic === true
    );

    return NextResponse.json({ uploadUrl, cloudStoragePath, pathSignature });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Yükleme URL'si oluşturulamadı" },
      { status: 500 }
    );
  }
}
