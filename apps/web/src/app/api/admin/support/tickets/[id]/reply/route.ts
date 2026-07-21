import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { parseImageFiles, replyToTicketAsAdmin } from "@/lib/support/service";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const adminUser = await prisma.user.findUnique({ where: { id: gate.session.user.id } });
  if (!adminUser) {
    return NextResponse.json({ error: "Admin user not found." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const message = String(formData.get("message") || "");
    const status = String(formData.get("status") || "") || undefined;
    const parsed = await parseImageFiles(formData);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const ticket = await replyToTicketAsAdmin({
      ticketId: id,
      admin: adminUser,
      message,
      files: parsed.files,
      status
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not send reply.";
    const statusCode = msg === "Ticket not found." ? 404 : 400;
    return NextResponse.json({ error: msg }, { status: statusCode });
  }
}
