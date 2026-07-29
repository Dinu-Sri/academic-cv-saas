import { prisma } from "@/lib/prisma";

export const JOURNEY_RANGES = ["realtime", "24h", "7d", "30d", "month", "custom"] as const;
export type JourneyRange = (typeof JOURNEY_RANGES)[number];

type EventRow = {
  sessionId: string;
  actorType: string;
  eventName: string;
  path: string;
  createdAt: Date;
};

type FunnelStep = {
  label: string;
  matches: (event: EventRow) => boolean;
};

const meaningfulActions = new Set([
  "profile_field_edited",
  "cv_compile_action",
  "cv_download_action",
  "cv_import_action",
  "ai_chat_action",
  "publication_action",
  "website_action",
  "website_username_check",
  "pricing_action"
]);

const funnels: { id: string; name: string; audience: "guest" | "registered" | "all"; steps: FunnelStep[] }[] = [
  {
    id: "guest-conversion",
    name: "Guest to registered",
    audience: "guest",
    steps: [
      { label: "Visited", matches: (event) => event.eventName === "page_view" },
      { label: "Opened a product", matches: (event) => event.eventName === "page_view" && /^\/(profile|publications|website|pricing|cv)/.test(event.path) },
      { label: "Tried a core task", matches: (event) => meaningfulActions.has(event.eventName) },
      { label: "Logged in", matches: (event) => event.eventName.startsWith("auth_") && event.actorType === "registered" },
      { label: "Continued after login", matches: (event) => event.actorType === "registered" && meaningfulActions.has(event.eventName) }
    ]
  },
  {
    id: "registered-activation",
    name: "Registered activation",
    audience: "registered",
    steps: [
      { label: "Active account", matches: (event) => event.actorType === "registered" && event.eventName === "page_view" },
      { label: "Edited CV", matches: (event) => event.eventName === "profile_field_edited" || event.eventName === "cv_import_action" },
      { label: "Used a core tool", matches: (event) => ["cv_compile_action", "publication_action", "ai_chat_action", "website_action"].includes(event.eventName) },
      { label: "Viewed pricing", matches: (event) => event.path.startsWith("/pricing") || event.eventName === "pricing_action" },
      { label: "Created an outcome", matches: (event) => ["cv_download_action", "website_publish_action"].includes(event.eventName) }
    ]
  },
  {
    id: "cv-creation",
    name: "CV creation",
    audience: "all",
    steps: [
      { label: "Opened editor", matches: (event) => event.eventName === "page_view" && event.path.startsWith("/profile") },
      { label: "Edited a field", matches: (event) => event.eventName === "profile_field_edited" },
      { label: "Used AI or import", matches: (event) => ["ai_chat_action", "cv_import_action"].includes(event.eventName) },
      { label: "Compiled", matches: (event) => event.eventName === "cv_compile_action" },
      { label: "Downloaded", matches: (event) => event.eventName === "cv_download_action" }
    ]
  },
  {
    id: "publications",
    name: "Publication workflow",
    audience: "all",
    steps: [
      { label: "Opened library", matches: (event) => event.eventName === "page_view" && event.path.startsWith("/publications") },
      { label: "Started add/import", matches: (event) => event.eventName === "publication_action" },
      { label: "Reviewed records", matches: (event) => event.eventName === "publication_review_action" },
      { label: "Compiled CV", matches: (event) => event.eventName === "cv_compile_action" },
      { label: "Downloaded CV", matches: (event) => event.eventName === "cv_download_action" }
    ]
  },
  {
    id: "website",
    name: "Academic website",
    audience: "all",
    steps: [
      { label: "Opened website", matches: (event) => event.eventName === "page_view" && event.path.startsWith("/website") },
      { label: "Checked username", matches: (event) => event.eventName === "website_username_check" },
      { label: "Edited site/profile", matches: (event) => ["website_action", "profile_field_edited"].includes(event.eventName) },
      { label: "Published", matches: (event) => event.eventName === "website_publish_action" },
      { label: "Returned", matches: (event) => event.eventName === "page_view" && event.path.startsWith("/website") }
    ]
  }
];

export function resolveJourneyWindow(range: JourneyRange, from?: string, to?: string) {
  const now = new Date();
  if (range === "custom") {
    const customFrom = from ? new Date(from) : new Date(now.getTime() - 7 * 86_400_000);
    const customTo = to ? new Date(to) : now;
    const start = Number.isNaN(customFrom.getTime()) ? new Date(now.getTime() - 7 * 86_400_000) : customFrom;
    const end = Number.isNaN(customTo.getTime()) ? now : customTo;
    const boundedStart = new Date(Math.max(start.getTime(), end.getTime() - 366 * 86_400_000));
    return { from: boundedStart, to: end };
  }
  if (range === "realtime") return { from: new Date(now.getTime() - 15 * 60_000), to: now };
  if (range === "24h") return { from: new Date(now.getTime() - 86_400_000), to: now };
  if (range === "7d") return { from: new Date(now.getTime() - 7 * 86_400_000), to: now };
  if (range === "30d") return { from: new Date(now.getTime() - 30 * 86_400_000), to: now };
  return { from: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), to: now };
}

export async function getJourneyAnalytics(range: JourneyRange, from?: string, to?: string) {
  const window = resolveJourneyWindow(range, from, to);
  const events = await prisma.journeyEvent.findMany({
    where: { createdAt: { gte: window.from, lte: window.to } },
    orderBy: { createdAt: "asc" },
    take: 100_000,
    select: { sessionId: true, actorType: true, eventName: true, path: true, createdAt: true }
  });
  const bySession = new Map<string, EventRow[]>();
  for (const event of events) {
    const rows = bySession.get(event.sessionId) ?? [];
    rows.push(event);
    bySession.set(event.sessionId, rows);
  }

  const sessions = [...bySession.entries()].map(([id, rows]) => ({ id, rows, firstType: rows[0]?.actorType ?? "guest" }));
  const guestVisitors = sessions.filter((session) => session.firstType === "guest").length;
  const registeredVisitors = sessions.filter((session) => session.rows.some((event) => event.actorType === "registered")).length;
  const convertedVisitors = sessions.filter(
    (session) => session.firstType === "guest" && session.rows.some((event) => event.actorType === "registered")
  ).length;

  return {
    generatedAt: new Date().toISOString(),
    range: { key: range, from: window.from.toISOString(), to: window.to.toISOString() },
    summary: {
      visitors: sessions.length,
      guestVisitors,
      registeredVisitors,
      convertedVisitors,
      conversionRate: guestVisitors ? Math.round((convertedVisitors / guestVisitors) * 1000) / 10 : 0,
      events: events.length
    },
    timeline: buildTimeline(events, window.from, window.to),
    pages: aggregateBars(events.filter((event) => event.eventName === "page_view"), (event) => event.path || "/").slice(0, 12),
    actions: aggregateBars(events.filter((event) => event.eventName !== "page_view"), (event) => event.eventName).slice(0, 14),
    funnels: funnels.map((funnel) => buildFunnel(funnel, sessions))
  };
}

function buildFunnel(
  funnel: (typeof funnels)[number],
  sessions: { id: string; rows: EventRow[]; firstType: string }[]
) {
  const cohort = sessions.filter((session) =>
    funnel.audience === "all"
      ? true
      : funnel.audience === "guest"
        ? session.firstType === "guest"
        : session.firstType === "registered"
  );
  const counts = funnel.steps.map((_, stepIndex) =>
    cohort.filter((session) => completesStepsInOrder(session.rows, funnel.steps.slice(0, stepIndex + 1))).length
  );
  return {
    id: funnel.id,
    name: funnel.name,
    audience: funnel.audience,
    steps: funnel.steps.map((step, index) => ({
      label: step.label,
      count: counts[index],
      rate: counts[0] ? Math.round((counts[index] / counts[0]) * 1000) / 10 : 0,
      dropOff: index === 0 ? 0 : Math.max(0, counts[index - 1] - counts[index])
    }))
  };
}

function completesStepsInOrder(events: EventRow[], steps: FunnelStep[]) {
  let cursor = 0;
  for (const step of steps) {
    const found = events.findIndex((event, index) => index >= cursor && step.matches(event));
    if (found < 0) return false;
    cursor = found + 1;
  }
  return true;
}

function aggregateBars(events: EventRow[], labelFor: (event: EventRow) => string) {
  const groups = new Map<string, { label: string; guest: Set<string>; registered: Set<string>; events: number }>();
  for (const event of events) {
    const label = labelFor(event).slice(0, 120);
    const group = groups.get(label) ?? { label, guest: new Set(), registered: new Set(), events: 0 };
    group[event.actorType === "registered" ? "registered" : "guest"].add(event.sessionId);
    group.events += 1;
    groups.set(label, group);
  }
  return [...groups.values()]
    .map((group) => ({
      label: group.label,
      guest: group.guest.size,
      registered: group.registered.size,
      visitors: new Set([...group.guest, ...group.registered]).size,
      events: group.events
    }))
    .sort((a, b) => b.visitors - a.visitors || b.events - a.events);
}

function buildTimeline(events: EventRow[], from: Date, to: Date) {
  const duration = Math.max(1, to.getTime() - from.getTime());
  const buckets = duration <= 86_400_000 ? 12 : Math.min(30, Math.max(7, Math.ceil(duration / 86_400_000)));
  const bucketSize = duration / buckets;
  const result = Array.from({ length: buckets }, (_, index) => ({
    label: formatBucket(new Date(from.getTime() + index * bucketSize), duration),
    guest: 0,
    registered: 0
  }));
  for (const event of events) {
    const index = Math.min(buckets - 1, Math.max(0, Math.floor((event.createdAt.getTime() - from.getTime()) / bucketSize)));
    result[index][event.actorType === "registered" ? "registered" : "guest"] += 1;
  }
  return result;
}

function formatBucket(date: Date, duration: number) {
  return duration <= 86_400_000
    ? date.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" })
    : date.toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
}
