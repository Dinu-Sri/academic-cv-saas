import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const personalSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  headline: z.string().trim().max(200),
  affiliation: z.string().trim().max(200),
  location: z.string().trim().max(160),
  email: z.email().or(z.literal("")),
  websiteUrl: z.url().or(z.literal("")),
  googleScholarUrl: z.url().or(z.literal("")),
  orcidUrl: z.url().or(z.literal("")),
  linkedinUrl: z.url().or(z.literal("")),
  bio: z.string().trim().max(3000)
});

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before saving your profile." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const data = personalSchema.parse(await request.json());

  await prisma.academicProfile.update({
    where: { id: profile.id },
    data
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}
