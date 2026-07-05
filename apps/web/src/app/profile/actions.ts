"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { saveProfileForUser } from "@/lib/profile-save";

export async function saveAcademicProfile(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    throw new Error("Please login before saving your profile.");
  }

  await saveProfileForUser(session.user, formData);

  redirect("/profile?saved=1");
}
