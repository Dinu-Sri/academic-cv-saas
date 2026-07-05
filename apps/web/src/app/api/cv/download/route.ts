import { readFile } from "node:fs/promises";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Please login before downloading your CV." }, { status: 401 });
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const document = await prisma.cvDocument.findFirst({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" }
  });

  if (!document?.pdfPath) {
    return NextResponse.json({ error: "Generate your CV before downloading." }, { status: 404 });
  }

  try {
    const bytes = await readFile(document.pdfPath);
    return new Response(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.pdfFilename || "academic-cv.pdf"}"`,
        "Cache-Control": "private, no-store"
      }
    });
  } catch {
    return NextResponse.json({ error: "Generated PDF file could not be found. Please generate it again." }, { status: 404 });
  }
}
