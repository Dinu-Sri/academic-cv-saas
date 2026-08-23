"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, X } from "lucide-react";

const DISMISS_KEY = "cvscholar_mkt_popup_dismiss";
const DISMISS_DAYS = 45;
const DELAY_MS = 8000;
const SCROLL_RATIO = 0.35;

function wasDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = Number(raw);
    if (!Number.isFinite(until)) return false;
    return until > Date.now();
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000));
  } catch {
    // ignore
  }
}

/**
 * Soft homepage marketing capture for guests.
 * Shows once after ~8s or 35% scroll; dismissed for 45 days.
 */
export function MarketingCapturePopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (wasDismissed()) return;

    let shown = false;
    let timer: number | undefined;

    function show() {
      if (shown || wasDismissed()) return;
      shown = true;
      setOpen(true);
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    }

    function onScroll() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      if (window.scrollY / max >= SCROLL_RATIO) show();
    }

    timer = window.setTimeout(show, DELAY_MS);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  function close() {
    dismiss();
    setOpen(false);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/marketing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "homepage_popup",
          company
        })
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        setError(body.error || "Could not subscribe. Try again.");
        return;
      }
      setDone(true);
      dismiss();
      window.setTimeout(() => setOpen(false), 1800);
    } catch {
      setError("Could not subscribe. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop mkt-popup-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="mkt-capture-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mkt-capture-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button className="modal-close" type="button" aria-label="Close" onClick={close}>
          <X size={18} />
        </button>
        <div className="mkt-capture-icon" aria-hidden="true">
          <Mail size={22} />
        </div>
        <h2 id="mkt-capture-title">Academic CV tips, free</h2>
        <p>
          Get occasional product updates and practical advice for academic CVs and websites. Unsubscribe anytime.
        </p>
        {done ? (
          <p className="form-success" role="status">
            You are on the list. Welcome.
          </p>
        ) : (
          <form className="mkt-capture-form" onSubmit={(e) => void submit(e)}>
            <label>
              <span className="sr-only">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={busy}
              />
            </label>
            {/* Honeypot */}
            <label className="mkt-honeypot" aria-hidden="true">
              <span>Company</span>
              <input
                tabIndex={-1}
                autoComplete="off"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-action" type="submit" disabled={busy || !email.trim()}>
              {busy ? (
                <>
                  <Loader2 size={16} className="spin" />
                  Joining…
                </>
              ) : (
                "Join the list"
              )}
            </button>
          </form>
        )}
        <button className="link-button mkt-capture-dismiss" type="button" onClick={close}>
          No thanks
        </button>
      </section>
    </div>
  );
}
