import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { saveProfileForUser } from "@/lib/profile-save";

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before saving your profile." }, { status: 401 });
  }

  try {
    const result = await saveProfileForUser(session.user, await request.formData());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Please check the highlighted profile details." }, { status: 422 });
    }

    throw error;
  }
}
