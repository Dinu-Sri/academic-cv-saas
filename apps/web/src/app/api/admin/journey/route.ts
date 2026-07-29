import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/admin";
import { getJourneyAnalytics, JOURNEY_RANGES } from "@/lib/journey";

const querySchema = z.object({
  range: z.enum(JOURNEY_RANGES).default("7d"),
  from: z.string().optional(),
  to: z.string().optional()
});

export async function GET(request: Request) {
  const admin = await requirePlatformAdmin();
  if (admin.response) return admin.response;
  const url = new URL(request.url);
  const query = querySchema.parse({
    range: url.searchParams.get("range") || undefined,
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined
  });
  return NextResponse.json(await getJourneyAnalytics(query.range, query.from, query.to));
}
