"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, LifeBuoy, Loader2, Send, X } from "lucide-react";

const ACADEMIC_LINES = [
  "This page has left the literature review and is currently under peer review elsewhere.",
  "Citation not found. The reference list stops before this entry.",
  "Hypothesis rejected: the URL you sought does not exist in this dataset.",
  "404: the seminar room is empty, the slides are missing, and coffee has gone cold.",
  "This result failed to replicate. We checked thrice; the page remains unobserved.",
  "Abstract available. Full text: nowhere to be found.",
  "Your request scored well on curiosity, poorly on existence.",
  "The archive has no record of this folio. Try the index — or report the gap."
] as const;

type Props = {
  /** Optional path hint when rendered outside Next not-found (defaults to browser path). */
  pathHint?: string;
};

export function NotFoundExperience({ pathHint }: Props) {
  const [line, setLine] = useState<string>(ACADEMIC_LINES[0]);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    const path = pathHint || (typeof window !== "undefined" ? window.location.pathname : "/");
    const index = Math.abs(hashString(path)) % ACADEMIC_LINES.length;
    queueMicrotask(() => {
      setLine(ACADEMIC_LINES[index] || ACADEMIC_LINES[0]);
    });
  }, [pathHint]);
  const [message, setMessage] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submitReport() {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const path =
        pathHint ||
        (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
      const url = typeof window !== "undefined" ? window.location.href : "";
      const response = await fetch("/api/public/report-issue", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          path,
          url,
          contactEmail: contactEmail.trim() || undefined
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        ticketNumber?: string | null;
      };
      if (!response.ok) throw new Error(payload.error || "Could not send your report.");
      setSuccess(
        payload.ticketNumber
          ? `Report sent. Reference ${payload.ticketNumber}. Our team will review it.`
          : "Report sent. Our team will review it."
      );
      setMessage("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send your report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="not-found-screen">
      <div className="not-found-card">
        <Link href="/" className="not-found-brand" aria-label="CVScholar home">
          <Image src="/cvscholar-logo.svg" alt="" width={48} height={48} priority />
          <span>
            <strong>CVScholar</strong>
            <small>Academic CVs &amp; websites</small>
          </span>
        </Link>

        <p className="not-found-code" aria-hidden="true">
          404
        </p>
        <h1>This page is not in the corpus</h1>
        <p className="not-found-line">{line}</p>
        <p className="not-found-sub muted-text">
          The link may be outdated, mistyped, or never published. You can return home or tell us what you expected to
          find.
        </p>

        <div className="not-found-actions">
          <Link href="/" className="primary-action">
            <Home size={16} />
            Back to home
          </Link>
          <button className="secondary-action" type="button" onClick={() => setReportOpen(true)}>
            <LifeBuoy size={16} />
            Report issue
          </button>
        </div>
      </div>

      {reportOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setReportOpen(false)}>
          <section
            className="not-found-report-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="not-found-report-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              disabled={busy}
              onClick={() => setReportOpen(false)}
            >
              <X size={18} />
            </button>
            <h2 id="not-found-report-title">Report a missing page</h2>
            <p className="muted-text">
              Send a short note to the CVScholar support team. Include what you were looking for so we can fix broken
              links or clarify the path.
            </p>
            <label className="website-field">
              <span>What did you expect here?</span>
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={5}
                placeholder="e.g. I followed a link from my email to open my CV share page…"
                disabled={busy}
              />
            </label>
            <label className="website-field">
              <span>Contact email (optional)</span>
              <input
                type="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="you@university.edu"
                disabled={busy}
                autoComplete="email"
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            {success ? <p className="form-success">{success}</p> : null}
            <div className="not-found-report-actions">
              <button className="secondary-action compact-action" type="button" disabled={busy} onClick={() => setReportOpen(false)}>
                Cancel
              </button>
              <button
                className="primary-action compact-action"
                type="button"
                disabled={busy || message.trim().length < 10}
                onClick={() => void submitReport()}
              >
                {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                {busy ? "Sending…" : "Send to support"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
