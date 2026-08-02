import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordWebsiteShareEvent } from "@/lib/website/analytics";

const bodySchema = z.object({
  eventName: z.string().trim().min(1).max(40),
  path: z.string().trim().max(200).optional()
});

/**
 * Public beacon for scholar-site share actions.
 * Resolves website from host (subdomain / custom domain) — no visitor identity stored.
 */
export async function POST(request: Request) {
  try {
    const json = bodySchema.parse(await request.json());
    const headerStore = await headers();
    const username = headerStore.get("x-cvscholar-site-username")?.toLowerCase() || "";
    if (!username) {
      return NextResponse.json({ ok: true, recorded: false });
    }

    const website = await prisma.academicWebsite.findFirst({
      where: {
        username,
        status: "published",
        archivedAt: null,
        blockedAt: null
      },
      select: { id: true }
    });
    if (!website) {
      return NextResponse.json({ ok: true, recorded: false });
    }

    await recordWebsiteShareEvent(website.id, json.eventName);
    return NextResponse.json({ ok: true, recorded: true });
  } catch {
    return NextResponse.json({ ok: true, recorded: false });
  }
}
