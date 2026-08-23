import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isPlatformAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { isEmailSendingConfigured, resolveEmailProvider, sendTransactionalEmail } from "@/lib/email";
import {
  TRANSACTIONAL_EMAIL_KINDS,
  TRANSACTIONAL_EMAIL_LABELS,
  buildTestEmail,
  type TransactionalEmailKind
} from "@/lib/email/templates/catalog";

const bodySchema = z.object({
  to: z.string().trim().email().max(320),
  kind: z
    .string()
    .refine(
      (value): value is TransactionalEmailKind =>
        (TRANSACTIONAL_EMAIL_KINDS as readonly string[]).includes(value),
      { message: "Unknown email kind" }
    ),
  /** When true, return HTML only — do not send. */
  previewOnly: z.boolean().optional().default(false)
});

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  if (!isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  return NextResponse.json({
    configured: isEmailSendingConfigured(),
    provider: resolveEmailProvider(),
    kinds: TRANSACTIONAL_EMAIL_KINDS.map((kind) => ({
      kind,
      label: TRANSACTIONAL_EMAIL_LABELS[kind]
    }))
  });
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Please login first." }, { status: 401 });
  }
  if (!isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  try {
    const body = bodySchema.parse(await request.json());
    const built = buildTestEmail(body.kind, body.to);

    if (body.previewOnly) {
      return NextResponse.json({
        ok: true,
        preview: true,
        kind: body.kind,
        label: TRANSACTIONAL_EMAIL_LABELS[body.kind],
        subject: built.subject,
        html: built.html,
        text: built.text
      });
    }

    if (!isEmailSendingConfigured()) {
      return NextResponse.json(
        { error: "Email provider is not configured (set BREVO_API_KEY or RESEND_API_KEY)." },
        { status: 503 }
      );
    }

    const result = await sendTransactionalEmail({
      to: body.to,
      subject: `[TEST] ${built.subject}`,
      text: built.text,
      html: built.html,
      tags: [...built.tags, "admin_test"]
    });

    if (!result.sent) {
      return NextResponse.json(
        { error: `Send failed (${result.reason}). Check provider logs / API key.` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      kind: body.kind,
      label: TRANSACTIONAL_EMAIL_LABELS[body.kind],
      to: body.to,
      provider: result.provider,
      messageId: result.messageId,
      subject: `[TEST] ${built.subject}`
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email or template kind." }, { status: 400 });
    }
    console.error("[admin/emails/test]", error);
    return NextResponse.json({ error: "Could not send test email." }, { status: 500 });
  }
}
