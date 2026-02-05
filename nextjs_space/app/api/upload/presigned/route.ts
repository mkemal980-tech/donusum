export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { generatePresignedUploadUrl } from "@/lib/s3";
import { checkRateLimit, getClientIP, validators } from "@/lib/api-utils";

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

const MAX_FILE_SIZE_MB = 25; // Maximum 25MB

export async function POST(request: NextRequest) {
  // Rate limiting for uploads
  const ip = getClientIP(request);
  const rateLimit = checkRateLimit(ip, 'upload');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Çok fazla yükleme denemesi. Lütfen bekleyin." },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rateLimit.resetIn / 1000)) } }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const { uploadUrl, cloudStoragePath } = await generatePresignedUploadUrl(
      sanitizedFileName,
      contentType,
      isPublic ?? true
    );

    return NextResponse.json({ uploadUrl, cloudStoragePath });
  } catch (error) {
    console.error("Error generating presigned URL:", error);
    return NextResponse.json(
      { error: "Yükleme URL'si oluşturulamadı" },
      { status: 500 }
    );
  }
}