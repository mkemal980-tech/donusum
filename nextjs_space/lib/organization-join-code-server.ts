import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  hashJoinCode,
  joinCodeUnavailableReason,
  normalizeJoinCode,
} from "@/lib/organization-join-code";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function resolveJoinCodeProfile(rawCode: unknown, db: DbClient = prisma) {
  const normalized = normalizeJoinCode(rawCode);
  if (!normalized) return { code: null, profile: null, error: "Katılım kodu gerekli." };

  const code = await db.unitJoinCode.findUnique({
    where: { codeHash: hashJoinCode(normalized) },
    select: {
      id: true,
      unitId: true,
      createdById: true,
      isActive: true,
      expiresAt: true,
      maxUses: true,
      useCount: true,
      survey: {
        select: { id: true, name: true, isActive: true, archivedAt: true },
      },
      unit: {
        select: {
          id: true,
          name: true,
          sectorId: true,
          subSectorId: true,
          sector: { select: { name: true } },
          subSector: { select: { name: true } },
        },
      },
    },
  });
  if (!code) return { code: null, profile: null, error: "Katılım kodu geçersiz." };

  const unavailableReason = joinCodeUnavailableReason(code);
  if (unavailableReason) return { code, profile: null, error: unavailableReason };

  /**
   * Sektör profili kuruluşun kendi alanından okunur.
   *
   * Önceden "birimdeki en eski aktif kullanıcı" üzerinden türetiliyordu: o
   * kişi başka sektörden bir danışmansa kodla katılan herkes yanlış sektöre
   * bağlanıyordu (bkz. migration 000014).
   */
  const profile = code.unit.sectorId
    ? {
        sectorId: code.unit.sectorId,
        subSectorId: code.unit.subSectorId,
        sector: code.unit.sector,
        subSector: code.unit.subSector,
      }
    : null;

  if (!profile) {
    return { code, profile: null, error: "Bu birimin sektör profili eksik. Birim yöneticinizle görüşün." };
  }

  return {
    code,
    profile,
    survey: code.survey?.isActive && !code.survey.archivedAt ? code.survey : null,
    error: null,
  };
}
