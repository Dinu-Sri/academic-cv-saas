"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, Loader2, Mail, MessageCircle } from "lucide-react";
import { trackJourney } from "@/components/journey-tracker";
import { trackMetaBrowserCustom } from "@/lib/meta/browser";
import { writeMobileModePreference } from "@/lib/mobile/preference";

type Props = {
  isAuthenticated: boolean;
};

export function MobileReadyScreen({ isAuthenticated }: Props) {
  const searchParams = useSearchParams();
  const documentId = searchParams.get("documentId") || "";
  const [toast, setToast] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [previewOk, setPreviewOk] = useState(false);

  const continueUrl = useMemo(() => {
    if (typeof window === "undefined") return "/profile?from=mobile";
    return `${window.location.origin}/profile?from=mobile`;
  }, []);

  const whatsappHref = useMemo(() => {
    const text = `Here is my CVScholar laptop link to finish my CV: ${continueUrl}`;
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  }, [continueUrl]);

  useEffect(() => {
    trackJourney("mobile_ready_viewed", { documentId: documentId || "none" });
    trackMetaBrowserCustom("MobileDraftReady", {
      content_name: "MobileDraftReady",
      content_category: "cv",
      value: 3,
      currency: "USD"
    });
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;
    // Lightweight readiness probe for preview link
    void fetch(`/api/cv/documents`, { credentials: "include" })
      .then((r) => r.json())
      .then((body: { documents?: Array<{ id: string; pdfReady?: boolean }> }) => {
        const doc = (body.documents || []).find((d) => d.id === documentId);
        setPreviewOk(Boolean(doc?.pdfReady));
      })
      .catch(() => undefined);
  }, [documentId]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(continueUrl);
      trackJourney("mobile_handoff_copy");
      showToast("Link copied");
    } catch {
      showToast("Could not copy — long-press the link instead");
    }
  }

  async function emailLink() {
    if (!isAuthenticated) {
      trackJourney("mobile_handoff_email_needs_auth");
      window.dispatchEvent(new CustomEvent("cvscholar-guest-limit", {
        detail: { message: "Create a free account so we can email your laptop link." }
      }));
      // Guest gate lives in AppShell; open auth by navigating home with intent
      window.location.href = `/?login=1&returnTo=${encodeURIComponent("/m/ready" + (documentId ? `?documentId=${documentId}` : ""))}`;
      return;
    }
    setEmailBusy(true);
    try {
      const res = await fetch("/api/mobile/handoff-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ continuePath: "/profile?from=mobile" })
      });
      const body = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        showToast(body.error || "Could not send email");
      } else {
        trackJourney("mobile_handoff_email");
        showToast(body.message || "Email sent");
      }
    } catch {
      showToast("Could not send email");
    } finally {
      setEmailBusy(false);
    }
  }

  function continueOnLaptop() {
    trackJourney("mobile_handoff_continue");
    // Keep minimal mode until they open full editor on a wide screen; desktop users keep cookie.
    window.location.href = "/profile?from=mobile";
  }

  return (
    <div className="mobile-flow-card-stack">
      <div className="mobile-flow-hero is-success">
        <div className="mobile-flow-success-icon" aria-hidden>
          <CheckCircle2 size={32} />
        </div>
        <h1>Your CV draft is ready</h1>
        <p>
          Finish remaining sections and download the final version on a laptop. Your progress is
          saved.
        </p>
      </div>

      <div className="mobile-flow-preview">
        {documentId && previewOk ? (
          <p className="mobile-flow-preview-ok">PDF preview is ready on your account.</p>
        ) : documentId ? (
          <p className="mobile-flow-preview-wait">
            <Loader2 className="spin-icon" size={16} /> Draft saved
            {previewOk ? "" : " — PDF may still be rendering."}
          </p>
        ) : (
          <p className="mobile-flow-preview-wait">Draft saved. Open on a laptop to review.</p>
        )}
        {documentId ? (
          <Link href={`/cv?from=mobile`} className="mobile-flow-text-link" onClick={() => writeMobileModePreference("full")}>
            Open Manage CVs (full site)
          </Link>
        ) : null}
      </div>

      <button type="button" className="mobile-flow-primary" onClick={continueOnLaptop}>
        Continue on laptop
      </button>

      <div className="mobile-flow-handoff">
        <button type="button" className="mobile-flow-secondary" disabled={emailBusy} onClick={() => void emailLink()}>
          {emailBusy ? <Loader2 className="spin-icon" size={16} /> : <Mail size={16} />}
          Email me the laptop link
        </button>
        <a
          className="mobile-flow-secondary"
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackJourney("mobile_handoff_whatsapp")}
        >
          <MessageCircle size={16} />
          Send link to WhatsApp
        </a>
        <button type="button" className="mobile-flow-secondary" onClick={() => void copyLink()}>
          <Copy size={16} />
          Copy link
        </button>
      </div>

      <p className="mobile-flow-hint">
        On a laptop, open the link while signed in (or with this browser&apos;s guest session) to
        continue editing.
      </p>

      <Link href="/m" className="mobile-flow-text-link center">
        I will continue later
      </Link>

      {toast ? <div className="mobile-flow-toast">{toast}</div> : null}
    </div>
  );
}
