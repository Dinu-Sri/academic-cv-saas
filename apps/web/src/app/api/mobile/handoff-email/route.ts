import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isEmailSendingConfigured, sendTransactionalEmail } from "@/lib/email";

const bodySchema = z.object({
  continuePath: z.string().trim().max(200).optional()
});

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.BETTER_AUTH_URL ||
    "https://cvscholar.com"
  ).replace(/\/$/, "");
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Sign in so we can email your laptop link." },
      { status: 401 }
    );
  }

  let continuePath = "/profile?from=mobile";
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (parsed.success && parsed.data.continuePath?.startsWith("/")) {
      continuePath = parsed.data.continuePath.slice(0, 200);
    }
  } catch {
    // optional body
  }

  const link = `${appBaseUrl()}${continuePath.startsWith("/") ? continuePath : `/${continuePath}`}`;

  if (!isEmailSendingConfigured()) {
    return NextResponse.json(
      { error: "Email is not configured. Please copy the laptop link instead." },
      { status: 503 }
    );
  }

  const name = session.user.name || "there";
  const { buildMobileHandoffEmail } = await import("@/lib/email/templates/catalog");
  const built = buildMobileHandoffEmail({ name, link });
  const result = await sendTransactionalEmail({
    to: session.user.email,
    subject: built.subject,
    text: built.text,
    html: built.html,
    tags: built.tags
  });

  if (!result.sent) {
    console.error("[mobile/handoff-email]", result.reason);
    return NextResponse.json(
      { error: "We could not send the email right now. Please copy the link instead." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "We emailed your laptop link." });
}
