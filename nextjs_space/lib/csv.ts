/**
 * CSV hücresi — Excel formül enjeksiyonuna kapalı.
 *
 * Tırnak, virgül ve satır sonu zaten kaçırılıyordu; ama `=`, `+`, `-` ve `@`
 * ile başlayan bir değeri Excel formül olarak çalıştırır. Üye kuruluş adları
 * Excel içe aktarımıyla geliyor — yani girdi kullanıcı denetiminde. Böyle bir
 * hücrenin başına tek tırnak konur; değer okunur kalır, formül çalışmaz.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}
