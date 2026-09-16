import crypto from "crypto";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type JoinCodeState = {
  isActive: boolean;
  expiresAt: Date | null;
  maxUses: number | null;
  useCount: number;
};

export function normalizeJoinCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 32);
}

export function hashJoinCode(value: unknown) {
  return crypto.createHash("sha256").update(normalizeJoinCode(value)).digest("hex");
}

function randomSegment(length: number) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function generateJoinCode() {
  return `BRM-${randomSegment(4)}-${randomSegment(4)}`;
}

export function joinCodePreview(value: unknown) {
  const normalized = normalizeJoinCode(value);
  return `BRM-••••-${normalized.slice(-4)}`;
}

export function joinCodeUnavailableReason(code: JoinCodeState, now = new Date()) {
  if (!code.isActive) return "Bu katılım kodu iptal edilmiş.";
  if (code.expiresAt && code.expiresAt.getTime() <= now.getTime()) {
    return "Bu katılım kodunun süresi dolmuş.";
  }
  if (code.maxUses !== null && code.useCount >= code.maxUses) {
    return "Bu katılım kodunun kullanım sınırı dolmuş.";
  }
  return null;
}
