import { NextResponse } from "next/server";
import { z } from "zod";
import { subscribeGuestToMarketing } from "@/lib/email/subscribe";

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  source: z.string().trim().max(80).optional().default("homepage_popup"),
  company: z.string().max(200).optional().default("")
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";

    const result = await subscribeGuestToMarketing({
      email: body.email,
      source: body.source,
      company: body.company,
      ip
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      message: "Thanks — you are on the list. You can unsubscribe anytime."
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    console.error("[marketing/subscribe]", error);
    return NextResponse.json({ error: "Could not subscribe right now." }, { status: 500 });
  }
}
