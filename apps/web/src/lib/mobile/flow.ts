"use client";

import { handleGuestLimitResponse } from "@/lib/guest-client";

/**
 * Ensure a Classic CV document exists, compile, and wait until PDF is ready (or fail).
 */
export async function runMobileCompileClassic(
  onStatus?: (message: string) => void
): Promise<{ documentId: string; jobId?: string }> {
  onStatus?.("Preparing document…");

  const docsRes = await fetch("/api/cv/documents", { credentials: "include" });
  if (await handleGuestLimitResponse(docsRes)) {
    throw new Error("Create a free account to continue.");
  }
  if (!docsRes.ok) {
    throw new Error("Could not load your CV workspace.");
  }
  const docsBody = (await docsRes.json()) as {
    documents?: Array<{ id: string }>;
  };
  let documentId = docsBody.documents?.[0]?.id;

  if (!documentId) {
    const createRes = await fetch("/api/cv/documents", {
      method: "POST",
      credentials: "include"
    });
    if (await handleGuestLimitResponse(createRes)) {
      throw new Error("Create a free account to continue.");
    }
    const createBody = (await createRes.json()) as {
      error?: string;
      document?: { id: string };
    };
    if (!createRes.ok || !createBody.document?.id) {
      throw new Error(createBody.error || "Could not create a CV document.");
    }
    documentId = createBody.document.id;
  }

  onStatus?.("Generating academic PDF…");
  const compileRes = await fetch("/api/cv/compile", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentId, templateKey: "classic" })
  });
  if (await handleGuestLimitResponse(compileRes)) {
    throw new Error("Create a free account to continue generating CVs.");
  }
  const compileBody = (await compileRes.json()) as {
    error?: string;
    jobId?: string;
    documentId?: string;
    pdfReady?: boolean;
  };
  if (!compileRes.ok) {
    throw new Error(compileBody.error || "Could not start PDF generation.");
  }

  const finalDocumentId = compileBody.documentId || documentId;

  if (compileBody.pdfReady) {
    return { documentId: finalDocumentId };
  }

  const jobId = compileBody.jobId;
  if (!jobId) {
    // Compile accepted without job (edge) — still send user to ready
    return { documentId: finalDocumentId };
  }

  for (let i = 0; i < 90; i += 1) {
    onStatus?.("Rendering your CV…");
    await sleep(1000);
    const jobRes = await fetch(`/api/cv/jobs/${jobId}`, { credentials: "include" });
    if (!jobRes.ok) continue;
    const jobBody = (await jobRes.json()) as {
      status?: string;
      pdfReady?: boolean;
      pdfError?: string;
      message?: string;
    };
    if (jobBody.pdfReady) {
      return { documentId: finalDocumentId, jobId };
    }
    if (jobBody.status === "failed") {
      throw new Error(jobBody.pdfError || jobBody.message || "PDF rendering failed.");
    }
  }

  // Draft is still useful even if PDF is slow — land on ready with document id
  return { documentId: finalDocumentId, jobId };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
