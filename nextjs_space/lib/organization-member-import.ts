import * as XLSX from "xlsx";

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

export type MemberImportSector = {
  naicsCode: string | null;
  name: string;
  subSectors: { name: string }[];
};

export const MEMBER_IMPORT_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const MEMBER_IMPORT_EXAMPLE_EMAIL = "ayse.yilmaz@example.com";

const COLUMNS = [
  { key: "uye_kurulus", field: "memberName", required: true, description: "Üye kuruluşun tam adı", example: "Örnek Tersane" },
  { key: "ad", field: "firstName", required: true, description: "Davet edilecek kullanıcının adı", example: "Ayşe" },
  { key: "soyad", field: "lastName", required: false, description: "Davet edilecek kullanıcının soyadı", example: "Yılmaz" },
  { key: "e_posta", field: "email", required: true, description: "Sistemde daha önce kullanılmamış geçerli e-posta", example: MEMBER_IMPORT_EXAMPLE_EMAIL },
  { key: "sektor_kodu", field: "sectorCode", required: true, description: "Sektörün NACE üst kodu; köşeli parantez kullanmayın", example: "C" },
  { key: "alt_sektor_kodu", field: "subSectorCode", required: false, description: "Alt sektör kodu; köşeli parantez kullanmayın", example: "30.1" },
] as const;

type MemberField = (typeof COLUMNS)[number]["field"];

const HEADER_ALIASES: Record<string, MemberField> = {
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

function normalizeHeader(value: unknown) {
  return String(value ?? "")
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

function subSectorCode(name: string) {
  return name.match(/^\[([^\]]+)\]\s*/)?.[1]?.trim() ?? "";
}

function applyWidths(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  return sheet;
}

export function buildMemberImportWorkbook(sectors: MemberImportSector[] = []) {
  const workbook = XLSX.utils.book_new();
  const headers = COLUMNS.map((column) => column.key);
  const example = COLUMNS.map((column) => column.example);
  const dataSheet = applyWidths(
    XLSX.utils.aoa_to_sheet([headers, example]),
    [34, 18, 18, 34, 18, 22]
  );
  dataSheet["!autofilter"] = { ref: "A1:F2" };
  XLSX.utils.book_append_sheet(workbook, dataSheet, "Üye Aktarımı");

  const guideRows: Array<Array<string>> = [
    ["ÜYE AKTARIM ŞABLONU — DOLDURMA REHBERİ"],
    [],
    ["Önemli", "İlk sayfadaki örnek satırı silin veya gerçek bilgilerle tamamen değiştirin. Örnek e-posta aktarılmaz."],
    ["Dosya", "Yalnızca bu .xlsx dosyasını kullanın; sayfa adını ve sütun başlıklarını değiştirmeyin."],
    ["Satırlar", "Her satır bir kullanıcıdır. Aynı üye kuruluş adına sahip satırlar aynı kuruluş altında toplanır."],
    ["Sınır", "Tek yüklemede en fazla 500 kullanıcı aktarılır. E-posta adresleri dosya içinde ve sistemde benzersiz olmalıdır."],
    ["Kodlar", "Sektör ve alt sektör kodlarını aşağıdaki listeden, köşeli parantez olmadan yazın (ör. C ve 30.1)."],
    [],
    ["ALAN", "ZORUNLU", "AÇIKLAMA", "ÖRNEK"],
    ...COLUMNS.map((column) => [
      column.key,
      column.required ? "Evet" : "Hayır",
      column.description,
      column.example,
    ]),
    [],
    ["GEÇERLİ SEKTÖR VE ALT SEKTÖR KODLARI"],
    ["SEKTÖR KODU", "SEKTÖR", "ALT SEKTÖR KODU", "ALT SEKTÖR"],
  ];

  for (const sector of sectors) {
    const code = sector.naicsCode?.trim() ?? "";
    if (!code) continue;
    const codedChildren = sector.subSectors
      .map((child) => ({ name: child.name, code: subSectorCode(child.name) }))
      .filter((child) => child.code);
    if (codedChildren.length === 0) {
      guideRows.push([code, sector.name, "", ""]);
      continue;
    }
    for (const child of codedChildren) {
      guideRows.push([code, sector.name, child.code, child.name]);
    }
  }

  const guideSheet = applyWidths(
    XLSX.utils.aoa_to_sheet(guideRows),
    [24, 42, 28, 70]
  );
  XLSX.utils.book_append_sheet(workbook, guideSheet, "Doldurma Rehberi");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  }) as Buffer;
}

export function parseMemberImportExcel(file: Uint8Array): MemberImportResult {
  if (file.byteLength === 0) return { rows: [], errors: ["Excel dosyası boş."] };
  if (file.byteLength > MEMBER_IMPORT_MAX_FILE_BYTES) {
    return { rows: [], errors: ["Excel dosyası en fazla 2 MB olabilir."] };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(file, { type: "array" });
  } catch (error) {
    return {
      rows: [],
      errors: [`Excel okunamadı: ${error instanceof Error ? error.message : "geçersiz dosya"}`],
    };
  }

  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) return { rows: [], errors: ["Excel dosyasında aktarım sayfası bulunamadı."] };

  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: true,
  });
  const headerRow = rawRows[0] ?? [];
  const fields = headerRow.map((header) => HEADER_ALIASES[normalizeHeader(header)] ?? null);
  const missingHeaders = COLUMNS
    .filter((column) => !fields.includes(column.field))
    .map((column) => column.key);
  if (missingHeaders.length > 0) {
    return {
      rows: [],
      errors: [`Excel başlıkları eksik veya değiştirilmiş: ${missingHeaders.join(", ")}.`],
    };
  }

  const sourceRows = rawRows
    .slice(1)
    .map((values, index) => ({ values, rowNumber: index + 2 }))
    .filter(({ values }) => values.some((value) => clean(value, 1) !== ""));
  if (sourceRows.length > 500) {
    return { rows: [], errors: ["Tek yüklemede en fazla 500 kullanıcı eklenebilir."] };
  }

  const rows: MemberImportRow[] = [];
  const errors: string[] = [];
  const emails = new Set<string>();

  for (const source of sourceRows) {
    const record: Partial<Record<MemberField, unknown>> = {};
    fields.forEach((field, index) => {
      if (field) record[field] = source.values[index];
    });
    const row: MemberImportRow = {
      rowNumber: source.rowNumber,
      memberName: clean(record.memberName, 160),
      firstName: clean(record.firstName, 80),
      lastName: clean(record.lastName, 80),
      email: clean(record.email, 254).toLowerCase(),
      sectorCode: clean(record.sectorCode, 16).toUpperCase(),
      subSectorCode: clean(record.subSectorCode, 16).toUpperCase(),
    };

    if (!row.memberName) errors.push(`${row.rowNumber}. satır: Üye kuruluş adı gerekli.`);
    if (!row.firstName) errors.push(`${row.rowNumber}. satır: Ad gerekli.`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(`${row.rowNumber}. satır: Geçerli bir e-posta gerekli.`);
    }
    if (row.email === MEMBER_IMPORT_EXAMPLE_EMAIL) {
      errors.push(`${row.rowNumber}. satır: Örnek satırı silin veya gerçek bilgilerle değiştirin.`);
    }
    if (!row.sectorCode) errors.push(`${row.rowNumber}. satır: Sektör kodu gerekli.`);
    if (emails.has(row.email)) errors.push(`${row.rowNumber}. satır: E-posta Excel içinde tekrar ediyor.`);
    emails.add(row.email);
    rows.push(row);
  }

  return { rows, errors };
}
