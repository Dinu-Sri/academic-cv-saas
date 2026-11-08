import { NextResponse } from "next/server";
import { isPeerFeedbackSource, submitPeerFeedback } from "@/lib/feedback/service";
import { resolveRequestActor } from "@/lib/request-user";
import { parseImageFiles } from "@/lib/support/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please sign in to send feedback." }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const sourceRaw = String(formData.get("source") || "voluntary");
    if (!isPeerFeedbackSource(sourceRaw)) {
      return NextResponse.json({ error: "Unknown feedback source." }, { status: 400 });
    }
    const parsed = await parseImageFiles(formData);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const result = await submitPeerFeedback({
      user: actor.user,
      source: sourceRaw,
      message: String(formData.get("message") || ""),
      files: parsed.files
    });

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Could not send feedback.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
