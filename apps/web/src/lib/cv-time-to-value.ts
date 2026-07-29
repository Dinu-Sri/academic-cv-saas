import type { PrismaClient } from "../generated/prisma/client";

export const CV_TIME_MEASUREMENT_VERSION = "active-v1";
export const CV_TIME_MEASUREMENT_STARTED_ON = "2026-07-29";
const MAX_HEARTBEAT_SECONDS = 45;

export async function recordCvActiveTime(
  db: PrismaClient,
  workspaceId: string,
  profileId: string,
  startedBy = "editor_activity",
  now = new Date()
) {
  const existing = await db.cvTimeToFirstCv.findUnique({ where: { profileId } });
  if (!existing) {
    try {
      return await db.cvTimeToFirstCv.create({
        data: {
          workspaceId,
          profileId,
          startedAt: now,
          lastHeartbeatAt: now,
          startedBy,
          measurementVersion: CV_TIME_MEASUREMENT_VERSION
        }
      });
    } catch {
      return db.cvTimeToFirstCv.findUnique({ where: { profileId } });
    }
  }
  if (existing.completedAt) return existing;

  const deltaSeconds = cappedActiveDelta(existing.lastHeartbeatAt, now);
  await db.cvTimeToFirstCv.updateMany({
    where: { profileId, completedAt: null },
    data: {
      activeSeconds: { increment: deltaSeconds },
      lastHeartbeatAt: now
    }
  });
  return db.cvTimeToFirstCv.findUnique({ where: { profileId } });
}

export async function completeCvTimeToFirstCv(
  db: PrismaClient,
  input: { workspaceId: string; profileId: string; documentId: string; renderJobId: string },
  now = new Date()
) {
  const [profile, activeEntryCount] = await Promise.all([
    db.academicProfile.findUnique({
      where: { id: input.profileId },
      select: {
        displayName: true,
        headline: true,
        affiliation: true,
        bio: true,
        completeness: true
      }
    }),
    db.profileSectionEntry.count({ where: { profileId: input.profileId, archivedAt: null } })
  ]);
  if (!profile || !qualifiesAsFinishedCv(profile, activeEntryCount)) return { completed: false as const };

  const journey =
    (await db.cvTimeToFirstCv.findUnique({ where: { profileId: input.profileId } })) ??
    (await db.cvTimeToFirstCv.create({
      data: {
        workspaceId: input.workspaceId,
        profileId: input.profileId,
        startedAt: new Date(now.getTime() - 1000),
        lastHeartbeatAt: now,
        activeSeconds: 1,
        startedBy: "render_fallback",
        measurementVersion: CV_TIME_MEASUREMENT_VERSION
      }
    }));
  if (journey.completedAt) return { completed: false as const };

  const tailSeconds = cappedActiveDelta(journey.lastHeartbeatAt, now);
  const activeSeconds = Math.max(1, journey.activeSeconds + tailSeconds);
  const elapsedSeconds = Math.max(1, Math.floor((now.getTime() - journey.startedAt.getTime()) / 1000));
  const result = await db.cvTimeToFirstCv.updateMany({
    where: { profileId: input.profileId, completedAt: null },
    data: {
      activeSeconds,
      completedAt: now,
      elapsedSeconds,
      documentId: input.documentId,
      renderJobId: input.renderJobId,
      qualifyingCompleteness: profile.completeness,
      lastHeartbeatAt: now
    }
  });
  return { completed: result.count === 1, activeSeconds, elapsedSeconds } as const;
}

export function cappedActiveDelta(lastHeartbeatAt: Date, now: Date) {
  return Math.min(
    MAX_HEARTBEAT_SECONDS,
    Math.max(0, Math.floor((now.getTime() - lastHeartbeatAt.getTime()) / 1000))
  );
}

export function qualifiesAsFinishedCv(
  profile: { displayName: string; headline: string; affiliation: string; bio: string },
  activeEntryCount: number
) {
  const name = profile.displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const placeholderNames = new Set(["", "dr john doe", "john doe", "guest academic"]);
  const hasAcademicDepth = Boolean(
    profile.headline.trim() || profile.affiliation.trim() || profile.bio.trim() || activeEntryCount > 0
  );
  return !placeholderNames.has(name) && hasAcademicDepth;
}
