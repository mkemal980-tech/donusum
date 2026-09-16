import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { assertStorageConfigured, createS3Client } from "./storage-config";

/**
 * Yükleme yolunun sunucu tarafından üretildiğini kanıtlayan mühür.
 *
 * `/api/upload/complete` `cloudStoragePath`'i istemciden olduğu gibi kabul
 * ediyordu ve sunucunun o yolu gerçekten üretip üretmediğini hiç
 * doğrulamıyordu. Başka bir kuruluşun nesne anahtarını gövdeye yazan bir
 * kullanıcı, kendi adına bir Document satırı açıp o nesne için imzalı indirme
 * adresi alabiliyor — ve DELETE ile kovadaki nesneyi silebiliyordu.
 *
 * Mühür, presigned URL ile birlikte üretilir ve `complete` çağrısında geri
 * istenir. Anahtar NEXTAUTH_SECRET'tan türetilir; ayrı bir sır gerekmez.
 */
function uploadSigningKey(): string {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign upload paths");
  return secret;
}

export function signUploadPath(cloudStoragePath: string): string {
  return crypto
    .createHmac("sha256", uploadSigningKey())
    .update(`upload:${cloudStoragePath}`)
    .digest("hex");
}

export function verifyUploadPath(cloudStoragePath: string, signature: unknown): boolean {
  if (typeof signature !== "string" || signature.length === 0) return false;
  let expected: string;
  try {
    expected = signUploadPath(cloudStoragePath);
  } catch {
    return false;
  }
  const given = Buffer.from(signature, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
}

export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<{ uploadUrl: string; cloudStoragePath: string; pathSignature: string }> {
  const s3Client = createS3Client();
  const { bucketName, folderPrefix } = assertStorageConfigured();
  const cloudStoragePath = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { uploadUrl, cloudStoragePath, pathSignature: signUploadPath(cloudStoragePath) };
}

export async function initiateMultipartUpload(
  fileName: string,
  isPublic: boolean = false
): Promise<{ uploadId: string; cloudStoragePath: string }> {
  const s3Client = createS3Client();
  const { bucketName, folderPrefix } = assertStorageConfigured();
  const cloudStoragePath = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  const command = new CreateMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ContentDisposition: isPublic ? "attachment" : undefined
  });

  const response = await s3Client.send(command);

  return { uploadId: response.UploadId ?? "", cloudStoragePath };
}

export async function getPresignedUrlForPart(
  cloudStoragePath: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const s3Client = createS3Client();
  const { bucketName } = assertStorageConfigured();
  const command = new UploadPartCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    UploadId: uploadId,
    PartNumber: partNumber
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function completeMultipartUpload(
  cloudStoragePath: string,
  uploadId: string,
  parts: { ETag: string; PartNumber: number }[]
): Promise<void> {
  const s3Client = createS3Client();
  const { bucketName } = assertStorageConfigured();
  const command = new CompleteMultipartUploadCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts }
  });

  await s3Client.send(command);
}

export async function getFileUrl(
  cloudStoragePath: string,
  isPublic: boolean = false
): Promise<string> {
  const s3Client = createS3Client();
  const { bucketName } = assertStorageConfigured();

  if (isPublic && process.env.S3_PUBLIC_BASE_URL) {
    return `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${cloudStoragePath}`;
  }

  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath,
    ResponseContentDisposition: "attachment"
  });

  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

export async function deleteFile(cloudStoragePath: string): Promise<void> {
  const s3Client = createS3Client();
  const { bucketName } = assertStorageConfigured();
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloudStoragePath
  });

  await s3Client.send(command);
}
