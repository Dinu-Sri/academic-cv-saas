"use client";

import type { FormEvent, ReactNode } from "react";
import { createContext, useContext, useRef, useState } from "react";
import { ImagePlus, Loader2, Paperclip, X } from "lucide-react";

type DownloadResult = { ok: true; message: "" } | { ok: false; message: string };

type PeerFeedbackContextValue = {
  openVoluntary: () => void;
  downloadCvPdf: (url: string) => Promise<DownloadResult>;
};

const PeerFeedbackContext = createContext<PeerFeedbackContextValue | null>(null);

export function usePeerFeedback() {
  return useContext(PeerFeedbackContext);
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "";
}

async function savePdfResponse(response: Response) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "academic-cv.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function requestPdf(url: string): Promise<
  | { ok: true }
  | { ok: false; feedbackRequired: true }
  | { ok: false; feedbackRequired: false; message: string }
> {
  const response = await fetch(url, { credentials: "include" });
  if (response.ok) {
    await savePdfResponse(response);
    return { ok: true };
  }

  let code = "";
  let message = "Could not download the generated PDF.";
  try {
    const body = (await response.json()) as { code?: string; error?: string };
    code = body.code || "";
    if (body.error) message = body.error;
  } catch {
    /* keep the fallback message */
  }

  if (response.status === 403 && code === "PDF_FEEDBACK_REQUIRED") {
    return { ok: false, feedbackRequired: true };
  }
  if (response.status === 401) {
    return { ok: false, feedbackRequired: false, message: "Please login again before downloading the PDF." };
  }
  return { ok: false, feedbackRequired: false, message };
}

export function PeerFeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"download" | "voluntary">("voluntary");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState(false);
  const pendingUrl = useRef("");
  const pendingResolve = useRef<((result: DownloadResult) => void) | null>(null);

  function finishPending(result: DownloadResult) {
    pendingResolve.current?.(result);
    pendingResolve.current = null;
    pendingUrl.current = "";
  }

  function closeModal(cancelled: boolean) {
    if (busy) return;
    if (cancelled && mode === "download") {
      finishPending({ ok: false, message: "" });
    }
    setOpen(false);
    setMessage("");
    setFiles([]);
    setError("");
    setThanks(false);
  }

  function openVoluntary() {
    if (pendingResolve.current) {
      finishPending({ ok: false, message: "" });
    }
    setMode("voluntary");
    setMessage("");
    setFiles([]);
    setError("");
    setThanks(false);
    setOpen(true);
  }

  async function downloadCvPdf(url: string): Promise<DownloadResult> {
    const first = await requestPdf(url);
    if (first.ok) return { ok: true, message: "" };
    if (!first.feedbackRequired) return { ok: false, message: first.message };

    return new Promise((resolve) => {
      if (pendingResolve.current) {
        pendingResolve.current({ ok: false, message: "" });
      }
      pendingResolve.current = resolve;
      pendingUrl.current = url;
      setMode("download");
      setMessage("");
      setFiles([]);
      setError("");
      setThanks(false);
      setOpen(true);
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("source", mode === "download" ? "pdf_download" : "voluntary");
      body.set("message", message);
      for (const file of files.slice(0, 3)) body.append("attachments", file);

      const response = await fetch("/api/feedback", {
        method: "POST",
        body,
        credentials: "include"
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Could not send feedback.");
        setBusy(false);
        return;
      }

      if (mode === "download" && pendingUrl.current) {
        const download = await requestPdf(pendingUrl.current);
        if (!download.ok) {
          setError(download.feedbackRequired ? "Feedback was saved. Please try the download again." : download.message);
          if (!download.feedbackRequired) finishPending({ ok: false, message: download.message });
          setBusy(false);
          return;
        }
        finishPending({ ok: true, message: "" });
        setOpen(false);
        setMessage("");
        setFiles([]);
        setBusy(false);
        return;
      }

      setThanks(true);
      setBusy(false);
    } catch {
      setError("Could not send feedback.");
      setBusy(false);
    }
  }

  const title = mode === "download" ? "Before your PDF downloads" : "Give feedback to improve CVScholar";
  const submitLabel =
    mode === "download" ? "Submit your feedback and download PDF" : "Submit feedback";

  return (
    <PeerFeedbackContext.Provider value={{ openVoluntary, downloadCvPdf }}>
      {children}
      {open ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => closeModal(true)}>
          <section
            className="auth-modal support-compose-modal peer-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="peer-feedback-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close" onClick={() => closeModal(true)}>
              <X size={18} />
            </button>
            <h2 id="peer-feedback-title">{title}</h2>
            {thanks ? (
              <>
                <p className="peer-feedback-note">
                  Thank you. Your note is with the CVScholar team. We read every peer review.
                </p>
                <button className="primary-action" type="button" onClick={() => closeModal(false)}>
                  Close
                </button>
              </>
            ) : (
              <>
                <p className="peer-feedback-note">
                  CVScholar is developed by academics, for academics and researchers. To keep this service free and
                  improve it further, your peer review is valuable, and we are glad to receive it.
                </p>
                <p className="peer-feedback-note">
                  If you have found a bottleneck or a gap in your academic life that we can bring into the system as a
                  feature, tell us. We will do our best to add it here and keep it free.
                </p>
                <form className="auth-form support-compose-form" onSubmit={(event) => void submit(event)}>
                  <label>
                    <span>Suggestions, features, bugs, or issues</span>
                    <textarea
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      rows={6}
                      minLength={10}
                      required
                      placeholder="What should we improve, fix, or add for your academic work?"
                    />
                  </label>
                  <label className="secondary-action compact-action support-file-btn">
                    <ImagePlus size={16} />
                    Attach a screenshot
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      hidden
                      onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))}
                    />
                  </label>
                  {files.length > 0 ? (
                    <div className="support-file-previews">
                      {files.map((file) => (
                        <span key={`${file.name}-${file.size}`} className="support-file-chip">
                          <Paperclip size={12} />
                          {file.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="peer-feedback-hint">Optional. JPG, PNG, GIF, or WebP, up to 3 images, 5MB each.</p>
                  )}
                  {error ? <p className="render-error">{error}</p> : null}
                  <button className="primary-action" type="submit" disabled={busy}>
                    {busy ? <Loader2 size={16} className="spin" /> : null}
                    {busy ? "Sending…" : submitLabel}
                  </button>
                </form>
              </>
            )}
          </section>
        </div>
      ) : null}
    </PeerFeedbackContext.Provider>
  );
}
