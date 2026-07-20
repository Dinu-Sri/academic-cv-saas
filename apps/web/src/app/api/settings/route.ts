import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettingsForUser, updateSettingsForUser } from "@/lib/settings/service";

const patchSchema = z.object({
  account: z
    .object({
      name: z.string().min(1).max(120).optional()
    })
    .optional(),
  privacy: z
    .object({
      marketingEmails: z.boolean().optional(),
      marketingSms: z.boolean().optional(),
      productUpdates: z.boolean().optional(),
      cookieConsent: z
        .object({
          functional: z.boolean().optional(),
          analytics: z.boolean().optional(),
          marketing: z.boolean().optional()
        })
        .optional(),
      acceptTerms: z.boolean().optional(),
      acceptPrivacy: z.boolean().optional()
    })
    .optional(),
  cvDefaults: z
    .object({
      pageSize: z.enum(["A4", "Letter", "Legal"]).optional(),
      marginTop: z.string().max(20).optional(),
      marginBottom: z.string().max(20).optional(),
      marginLeft: z.string().max(20).optional(),
      marginRight: z.string().max(20).optional(),
      fontFamily: z.enum(["serif", "sans"]).optional(),
      fontSize: z.enum(["10", "11", "12"]).optional(),
      lineSpacing: z.enum(["compact", "normal", "relaxed"]).optional(),
      showPageNumbers: z.boolean().optional(),
      showLastUpdated: z.boolean().optional(),
      dateFormat: z.enum(["F Y", "M Y", "m/Y", "Y"]).optional()
    })
    .optional(),
  appearance: z
    .object({
      density: z.enum(["comfortable", "compact"]).optional(),
      defaultNavCollapsed: z.boolean().optional()
    })
    .optional(),
  ai: z
    .object({
      agentMemoryEnabled: z.boolean().optional()
    })
    .optional()
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const payload = await getSettingsForUser(user);
  return NextResponse.json(payload);
}

export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }

  try {
    const body = patchSchema.parse(await request.json());
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const payload = await updateSettingsForUser(user, body);
    return NextResponse.json({ ok: true, ...payload });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }
    console.error("[settings]", error);
    return NextResponse.json({ error: "Could not save settings." }, { status: 500 });
  }
}
