import crypto from "crypto";

/**
 * Hesap bağlantısı token'ları — üretim, saklama ve karşılaştırma.
 *
 * Token'lar veritabanında düz metin saklanıyordu: bir yedek sızıntısı ya da
 * fazla yetkili bir okuma, doğrudan hesap devralmaya çevrilebilecek canlı
 * bağlantılar veriyordu. Projenin daha yeni yazılmış parçası (katılım kodları)
 * bunu zaten doğru yapıyordu — `UnitJoinCode.codeHash`; bu modül aynı kuralı
 * şifre sıfırlama, e-posta doğrulama ve davet bağlantılarına da uyguluyor.
 *
 * Token 256 bit rastgele olduğu için tuz gerekmez: sözlük saldırısı anlamsız.
 */
export function createToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Bağlantıdan gelen token'ı saklanan özetle karşılaştırır. */
export function tokenMatches(token: unknown, storedHash: string | null | undefined): boolean {
  if (typeof token !== "string" || !token || !storedHash) return false;
  const given = Buffer.from(hashToken(token), "utf8");
  const want = Buffer.from(storedHash, "utf8");
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
}
