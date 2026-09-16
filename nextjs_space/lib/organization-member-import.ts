import { parse } from "csv-parse/sync";

export type MemberImportRow = {
  rowNumber: number;
  memberName: string;
  firstName: string;
  lastName: string;
  email: string;
  sectorCode: string;
  subSectorCode: string;
};

export type MemberImportResult = {
  rows: MemberImportRow[];
  errors: string[];
};

const HEADER_ALIASES: Record<string, string> = {
  uyekurulus: "memberName",
  uyekurulusadi: "memberName",
  kurulus: "memberName",
  memberorganization: "memberName",
  membername: "memberName",
  ad: "firstName",
  firstname: "firstName",
  soyad: "lastName",
  lastname: "lastName",
  eposta: "email",
  email: "email",
  sektorkodu: "sectorCode",
  sectorcode: "sectorCode",
  altsektorkodu: "subSectorCode",
  subsectorcode: "subSectorCode",
};

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]/g, "");
}

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

export function parseMemberImportCsv(csvText: string): MemberImportResult {
  if (!csvText.trim()) return { rows: [], errors: ["CSV dosyası boş."] };
  if (Buffer.byteLength(csvText, "utf8") > 1024 * 1024) {
    return { rows: [], errors: ["CSV dosyası en fazla 1 MB olabilir."] };
  }

  let records: Array<Record<string, string>>;
  try {
    const headerLine = csvText.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0)
      ? ";"
      : ",";
    records = parse(csvText.replace(/^\uFEFF/, ""), {
      bom: true,
      delimiter,
      columns: (headers: string[]) =>
        headers.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? normalizeHeader(header)),
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    });
  } catch (error) {
    return {
      rows: [],
      errors: [`CSV okunamadı: ${error instanceof Error ? error.message : "geçersiz dosya"}`],
    };
  }

  if (records.length > 500) {
    return { rows: [], errors: ["Tek yüklemede en fazla 500 kullanıcı eklenebilir."] };
  }

  const rows: MemberImportRow[] = [];
  const errors: string[] = [];
  const emails = new Set<string>();

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    const row: MemberImportRow = {
      rowNumber,
      memberName: clean(record.memberName, 160),
      firstName: clean(record.firstName, 80),
      lastName: clean(record.lastName, 80),
      email: clean(record.email, 254).toLowerCase(),
      sectorCode: clean(record.sectorCode, 16).toUpperCase(),
      subSectorCode: clean(record.subSectorCode, 16).toUpperCase(),
    };

    if (!row.memberName) errors.push(`${rowNumber}. satır: Üye kuruluş adı gerekli.`);
    if (!row.firstName) errors.push(`${rowNumber}. satır: Ad gerekli.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(`${rowNumber}. satır: Geçerli bir e-posta gerekli.`);
    }
    if (!row.sectorCode) errors.push(`${rowNumber}. satır: Sektör kodu gerekli.`);
    if (emails.has(row.email)) errors.push(`${rowNumber}. satır: E-posta CSV içinde tekrar ediyor.`);
    emails.add(row.email);
    rows.push(row);
  }

  return { rows, errors };
}

export const MEMBER_IMPORT_TEMPLATE = [
  "uye_kurulus,ad,soyad,e_posta,sektor_kodu,alt_sektor_kodu",
  "Örnek Tersane,Ayşe,Yılmaz,ayse@example.com,C,30.1",
].join("\n");
