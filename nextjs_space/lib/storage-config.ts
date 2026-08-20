import { S3Client } from "@aws-sdk/client-s3";

export interface StorageConfig {
  bucketName: string;
  folderPrefix: string;
}

function normalizeFolderPrefix(prefix: string): string {
  if (!prefix) return "";
  return prefix.endsWith("/") ? prefix : `${prefix}/`;
}

export function getStorageConfig(): StorageConfig {
  return {
    bucketName: process.env.S3_BUCKET ?? "",
    folderPrefix: normalizeFolderPrefix(process.env.S3_FOLDER_PREFIX ?? "")
  };
}

export function assertStorageConfigured(): StorageConfig {
  const config = getStorageConfig();
  const required = [
    ["S3_BUCKET", config.bucketName],
    ["S3_ENDPOINT", process.env.S3_ENDPOINT],
    ["S3_ACCESS_KEY_ID", process.env.S3_ACCESS_KEY_ID],
    ["S3_SECRET_ACCESS_KEY", process.env.S3_SECRET_ACCESS_KEY]
  ];

  const missing = required
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Storage is not configured. Missing: ${missing.join(", ")}`);
  }

  return config;
}

export function createS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "auto",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? ""
    }
  });
}
