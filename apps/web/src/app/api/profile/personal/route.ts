import { NextResponse } from "next/server";
import { z } from "zod";
import {
  academicFieldKey,
  normalizeAcademicField,
  normalizeAcademicFieldGroup,
  normalizeCountryCode
} from "@/lib/academic-taxonomy";
import { retainCustomAcademicField } from "@/lib/academic-field-suggestions";
import { refreshCompleteness } from "@/lib/profile-editor";
import { prisma } from "@/lib/prisma";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

const personalSchema = z.object({
  displayName: z.string().trim().max(160),
  headline: z.string().trim().max(200),
  affiliation: z.string().trim().max(200),
  location: z.string().trim().max(160),
  countryCode: z.string().trim().max(2),
  academicFieldGroup: z.string().trim().max(80),
  academicField: z.string().trim().max(120),
  email: z.string().trim().max(320),
  websiteUrl: z.string().trim().max(2048),
  googleScholarUrl: z.string().trim().max(2048),
  orcidUrl: z.string().trim().max(2048),
  linkedinUrl: z.string().trim().max(2048),
  bio: z.string().trim().max(3000)
}).partial().strict();

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: true });

  if (!actor) {
    return NextResponse.json({ error: "Please login before saving your profile." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const parsed = personalSchema.safeParse(await request.json());
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: "No valid profile changes were provided." }, { status: 400 });
  }

  const data = parsed.data;
  const countryCode = normalizeCountryCode(data.countryCode ?? profile.countryCode);
  const academicFieldGroup = normalizeAcademicFieldGroup(data.academicFieldGroup ?? profile.academicFieldGroup);
  const academicField = normalizeAcademicField(
    data.academicField ?? (data.academicFieldGroup !== undefined ? "" : profile.academicField)
  );

  await prisma.academicProfile.update({
    where: { id: profile.id },
    data: {
      ...data,
      ...(data.countryCode !== undefined ? { countryCode } : {}),
      ...(data.academicFieldGroup !== undefined ? { academicFieldGroup } : {}),
      ...(data.academicField !== undefined ? { academicField } : {}),
      academicFieldKey: academicFieldKey(academicFieldGroup, academicField),
      version: { increment: 1 }
    }
  });

  await retainCustomAcademicField(profile.id, academicFieldGroup, academicField);

  const completeness = await refreshCompleteness(profile.id);

  return NextResponse.json({ ok: true, completeness });
}
