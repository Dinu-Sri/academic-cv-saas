import { NextResponse } from "next/server";
import { z } from "zod";
import {
  academicFieldKey,
  normalizeAcademicField,
  normalizeAcademicFieldGroup,
  normalizeCountryCode
} from "@/lib/academic-taxonomy";
import { refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const personalSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  headline: z.string().trim().max(200),
  affiliation: z.string().trim().max(200),
  location: z.string().trim().max(160),
  countryCode: z.string().trim().max(2),
  academicFieldGroup: z.string().trim().max(80),
  academicField: z.string().trim().max(120),
  email: z.email().or(z.literal("")),
  websiteUrl: z.url().or(z.literal("")),
  googleScholarUrl: z.url().or(z.literal("")),
  orcidUrl: z.url().or(z.literal("")),
  linkedinUrl: z.url().or(z.literal("")),
  bio: z.string().trim().max(3000)
});

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before saving your profile." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const data = personalSchema.parse(await request.json());
  const countryCode = normalizeCountryCode(data.countryCode);
  const academicFieldGroup = normalizeAcademicFieldGroup(data.academicFieldGroup);
  const academicField = academicFieldGroup ? normalizeAcademicField(data.academicField) : "";

  await prisma.academicProfile.update({
    where: { id: profile.id },
    data: {
      ...data,
      countryCode,
      academicFieldGroup,
      academicField,
      academicFieldKey: academicFieldKey(academicFieldGroup, academicField),
      version: { increment: 1 }
    }
  });

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}
