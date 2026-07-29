import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CV_TIME_MEASUREMENT_VERSION } from "@/lib/cv-time-to-value";

export const MIN_PUBLIC_CV_TIME_SAMPLE = 10;

export type PublicImpactStats = {
  academics: number;
  cvsGenerated: number;
  websitesPublished: number;
  publicationsSynced: number;
  aiImprovementsApplied: number;
  oldCvsImported: number;
  countriesRepresented: number;
  academicFieldsRepresented: number;
  medianFirstCvSeconds: number | null;
  medianSampleSize: number;
  generatedAt: string;
};

type ImpactRow = {
  academics: bigint;
  cvsGenerated: bigint;
  websitesPublished: bigint;
  publicationsSynced: bigint;
  aiImprovementsApplied: bigint;
  oldCvsImported: bigint;
  countriesRepresented: bigint;
  academicFieldsRepresented: bigint;
  medianFirstCvSeconds: number | null;
  medianSampleSize: bigint;
};

const emptyImpact = (): PublicImpactStats => ({
  academics: 0,
  cvsGenerated: 0,
  websitesPublished: 0,
  publicationsSynced: 0,
  aiImprovementsApplied: 0,
  oldCvsImported: 0,
  countriesRepresented: 0,
  academicFieldsRepresented: 0,
  medianFirstCvSeconds: null,
  medianSampleSize: 0,
  generatedAt: new Date().toISOString()
});

const loadPublicImpactStats = unstable_cache(
  async (): Promise<PublicImpactStats> => {
    try {
      const [row] = await prisma.$queryRaw<ImpactRow[]>`
        SELECT
          (SELECT COUNT(*) FROM "academic_profiles" p JOIN "user" u ON u."id" = p."ownerUserId" WHERE u."isGuest" = false) AS "academics",
          (SELECT COUNT(*) FROM "cv_documents" WHERE "pdfGeneratedAt" IS NOT NULL) AS "cvsGenerated",
          (SELECT COUNT(*) FROM "academic_websites" WHERE "status" = 'published' AND "publishedAt" IS NOT NULL AND "blockedAt" IS NULL AND "archivedAt" IS NULL) AS "websitesPublished",
          (SELECT COUNT(*) FROM "profile_section_entries" WHERE "sectionKey" = 'publications' AND "archivedAt" IS NULL AND "source" IN ('orcid', 'google_scholar')) AS "publicationsSynced",
          (SELECT COUNT(*) FROM "cv_agent_patch_logs" WHERE "status" = 'applied' AND "appliedAt" IS NOT NULL) AS "aiImprovementsApplied",
          (SELECT COUNT(*) FROM "cv_import_jobs" WHERE "status" = 'applied' AND "appliedAt" IS NOT NULL) AS "oldCvsImported",
          (SELECT COUNT(DISTINCT p."countryCode") FROM "academic_profiles" p JOIN "user" u ON u."id" = p."ownerUserId" WHERE u."isGuest" = false AND p."countryCode" <> '') AS "countriesRepresented",
          (SELECT COUNT(DISTINCT p."academicFieldKey") FROM "academic_profiles" p JOIN "user" u ON u."id" = p."ownerUserId" WHERE u."isGuest" = false AND p."academicFieldKey" <> '') AS "academicFieldsRepresented",
          (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY "activeSeconds") FROM "cv_time_to_first_cv" WHERE "completedAt" IS NOT NULL AND "activeSeconds" > 0 AND "measurementVersion" = ${CV_TIME_MEASUREMENT_VERSION}) AS "medianFirstCvSeconds",
          (SELECT COUNT(*) FROM "cv_time_to_first_cv" WHERE "completedAt" IS NOT NULL AND "activeSeconds" > 0 AND "measurementVersion" = ${CV_TIME_MEASUREMENT_VERSION}) AS "medianSampleSize"
      `;
      if (!row) return emptyImpact();

      const sampleSize = Number(row.medianSampleSize);
      return {
        academics: Number(row.academics),
        cvsGenerated: Number(row.cvsGenerated),
        websitesPublished: Number(row.websitesPublished),
        publicationsSynced: Number(row.publicationsSynced),
        aiImprovementsApplied: Number(row.aiImprovementsApplied),
        oldCvsImported: Number(row.oldCvsImported),
        countriesRepresented: Number(row.countriesRepresented),
        academicFieldsRepresented: Number(row.academicFieldsRepresented),
        medianFirstCvSeconds:
          sampleSize >= MIN_PUBLIC_CV_TIME_SAMPLE && row.medianFirstCvSeconds !== null
            ? Math.round(Number(row.medianFirstCvSeconds))
            : null,
        medianSampleSize: sampleSize,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.warn("Public impact metrics are temporarily unavailable", error);
      return emptyImpact();
    }
  },
  ["public-impact-v1"],
  { revalidate: 900, tags: ["public-impact"] }
);

export function getPublicImpactStats() {
  return loadPublicImpactStats();
}
