import { NextResponse } from "next/server";
import { z } from "zod";
import { resolveRequestActor } from "@/lib/request-user";
import { createTicket } from "@/lib/support/service";

export const runtime = "nodejs";

const bodySchema = z.object({
  message: z.string().trim().min(10).max(4000),
  path: z.string().trim().max(500).optional(),
  url: z.string().trim().max(1000).optional(),
  contactEmail: z.string().trim().max(200).optional()
});

/**
 * Public 404 / broken-link report → admin support inbox as a bug ticket.
 * Works for logged-in users and guests (guest actor is created when needed).
 */
export async function POST(request: Request) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Please describe what you expected (at least 10 characters)." },
      { status: 422 }
    );
  }

  const actor = await resolveRequestActor({ allowGuest: true, createGuest: true });
  if (!actor) {
    return NextResponse.json({ error: "Could not start a support report. Please try again." }, { status: 500 });
  }

  const path = (body.path || "/").slice(0, 500);
  const pageUrl = (body.url || "").slice(0, 1000);
  const contact = (body.contactEmail || "").trim();
  if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
    return NextResponse.json({ error: "Enter a valid contact email, or leave it blank." }, { status: 422 });
  }
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 300);

  const subject = `404 report: ${path}`.slice(0, 180);
  const message = [
    body.message.trim(),
    "",
    "—",
    `Path: ${path}`,
    pageUrl ? `URL: ${pageUrl}` : null,
    contact ? `Contact email: ${contact}` : null,
    userAgent ? `User-Agent: ${userAgent}` : null,
    `Reporter: ${actor.isGuest ? "guest" : "signed-in"} · ${actor.user.email || "no-email"}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const ticket = await createTicket({
      user: actor.user,
      type: "bug",
      subject,
      message,
      files: []
    });

    return NextResponse.json({
      ok: true,
      ticketNumber: ticket?.ticketNumber || null,
      ticketId: ticket?.id || null
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not send your report.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
