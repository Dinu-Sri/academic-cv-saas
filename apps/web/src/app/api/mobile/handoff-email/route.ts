import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";

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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "CVScholar <noreply@cvscholar.com>";

  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured. Please copy the laptop link instead." },
      { status: 503 }
    );
  }

  const name = session.user.name || "there";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [session.user.email],
        subject: "CVScholar · Finish your CV on a laptop",
        text: [
          `Hello ${name},`,
          "",
          "Your academic CV draft is ready to finish on a laptop.",
          "Open this link on a computer:",
          "",
          link,
          "",
          "— CVScholar"
        ].join("\n")
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[mobile/handoff-email]", response.status, text.slice(0, 300));
      return NextResponse.json(
        { error: "We could not send the email right now. Please copy the link instead." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[mobile/handoff-email]", error);
    return NextResponse.json(
      { error: "We could not send the email right now. Please copy the link instead." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, message: "We emailed your laptop link." });
}
