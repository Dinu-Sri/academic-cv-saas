import { NextResponse } from "next/server";
import { z } from "zod";
import { submitWebsiteContact } from "@/lib/website/contact-service";
import { captureWebsiteException } from "@/lib/sentry";

const bodySchema = z.object({
  visitorName: z.string().min(2).max(120),
  visitorEmail: z.string().email().max(200),
  subject: z.string().max(200).optional(),
  message: z.string().min(10).max(4000),
  turnstileToken: z.string().optional()
});

type Params = { params: Promise<{ username: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const { username } = await params;
    const payload = bodySchema.parse(await request.json());
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;
    const result = await submitWebsiteContact({
      username,
      visitorName: payload.visitorName,
      visitorEmail: payload.visitorEmail,
      subject: payload.subject,
      message: payload.message,
      turnstileToken: payload.turnstileToken,
      ip,
      userAgent
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    await captureWebsiteException(error, { tags: { area: "contact_form" } });
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 400 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send message." }, { status });
  }
}
