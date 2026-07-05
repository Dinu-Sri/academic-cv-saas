"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function saveAcademicProfile(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    throw new Error("Please login before saving your profile.");
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);

  await prisma.academicProfile.update({
    where: { id: profile.id },
    data: {
      displayName: String(formData.get("displayName") ?? "").trim(),
      headline: String(formData.get("headline") ?? "").trim(),
      affiliation: String(formData.get("affiliation") ?? "").trim(),
      location: String(formData.get("location") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      websiteUrl: String(formData.get("websiteUrl") ?? "").trim(),
      googleScholarUrl: String(formData.get("googleScholarUrl") ?? "").trim(),
      orcidUrl: String(formData.get("orcidUrl") ?? "").trim(),
      linkedinUrl: String(formData.get("linkedinUrl") ?? "").trim(),
      bio: String(formData.get("bio") ?? "").trim(),
      researchSummary: String(formData.get("researchSummary") ?? "").trim()
    }
  });

  redirect("/profile?saved=1");
}
