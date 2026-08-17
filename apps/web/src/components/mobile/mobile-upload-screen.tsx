"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trackJourney } from "@/components/journey-tracker";
import { handleGuestLimitResponse } from "@/lib/guest-client";
import { runMobileCompileClassic } from "@/lib/mobile/flow";

type ImportJob = {
  id: string;
  status: string;
  message?: string;
};

export function MobileUploadScreen() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "importing" | "applying" | "compiling">("idle");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function pollImport(jobId: string): Promise<ImportJob> {
    for (let i = 0; i < 180; i += 1) {
      const response = await fetch(`/api/import/cv/${jobId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not check import status.");
      const result = (await response.json()) as { job: ImportJob };
      if (["ready", "applied", "failed"].includes(result.job.status)) {
        return result.job;
      }
      setStatusMessage(result.job.message || "Reading your CV…");
      await sleep(1200);
    }
    throw new Error("Import is taking longer than expected. Try again on Wi‑Fi.");
  }

  async function onSubmit() {
    if (!file) {
      setError("Choose your old CV PDF first.");
      return;
    }

    setError("");
    setPhase("uploading");
    setStatusMessage("Uploading…");
    trackJourney("mobile_upload_started");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const startRes = await fetch("/api/import/cv", {
        method: "POST",
        body: formData,
        credentials: "include"
      });
      if (await handleGuestLimitResponse(startRes)) return;
      const startBody = (await startRes.json()) as { error?: string; job?: ImportJob };
      if (!startRes.ok || !startBody.job) {
        throw new Error(startBody.error || "Could not start the import.");
      }

      setPhase("importing");
      setStatusMessage("Extracting academic details…");
      const job = await pollImport(startBody.job.id);
      if (job.status === "failed") {
        throw new Error(job.message || "We could not read that PDF. Try another file or start fresh.");
      }

      if (job.status === "ready") {
        setPhase("applying");
        setStatusMessage("Saving your draft…");
        const applyRes = await fetch(`/api/import/cv/${job.id}/apply`, {
          method: "POST",
          credentials: "include"
        });
        if (await handleGuestLimitResponse(applyRes)) return;
        const applyBody = (await applyRes.json()) as { error?: string };
        if (!applyRes.ok) {
          throw new Error(applyBody.error || "Could not apply imported data.");
        }
      }

      setPhase("compiling");
      setStatusMessage("Building your academic PDF…");
      const { documentId } = await runMobileCompileClassic((msg) => setStatusMessage(msg));
      trackJourney("mobile_upload_completed", { documentId });
      router.push(`/m/ready?documentId=${encodeURIComponent(documentId)}`);
    } catch (err) {
      setPhase("idle");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="mobile-flow-card-stack">
      <Link href="/m" className="mobile-flow-back">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="mobile-flow-hero">
        <h1>Upload your existing CV</h1>
        <p>PDF only. We prepare a polished academic version — refine everything on a laptop.</p>
      </div>

      {error ? <p className="mobile-flow-error">{error}</p> : null}

      <label className={`mobile-flow-dropzone ${file ? "has-file" : ""}`}>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(e) => {
            const next = e.target.files?.[0] || null;
            setFile(next);
            setError("");
          }}
        />
        <strong>{file ? file.name : "Tap to choose your CV"}</strong>
        <span>{file ? "Tap again to change file" : "PDF · up to import size limit"}</span>
      </label>

      <button
        type="button"
        className="mobile-flow-primary"
        disabled={busy || !file}
        onClick={() => void onSubmit()}
      >
        {busy ? <Loader2 className="spin-icon" size={18} /> : null}
        {busy ? statusMessage || "Preparing your CV…" : "Prepare my CV"}
      </button>
      <p className="mobile-flow-hint">This can take up to a minute while we build your CV.</p>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
