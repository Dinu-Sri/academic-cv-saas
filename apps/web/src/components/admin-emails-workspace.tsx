"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, Send } from "lucide-react";

type KindRow = { kind: string; label: string };

export function AdminEmailsWorkspace() {
  const [to, setTo] = useState("");
  const [kinds, setKinds] = useState<KindRow[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewSubject, setPreviewSubject] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/emails/test", { credentials: "include" });
    if (!res.ok) return;
    const body = (await res.json()) as {
      configured?: boolean;
      provider?: string | null;
      kinds?: KindRow[];
    };
    setConfigured(Boolean(body.configured));
    setProvider(body.provider || null);
    const list = body.kinds || [];
    setKinds(list);
    setSelected((prev) => prev || list[0]?.kind || "");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function preview() {
    if (!selected) return;
    setPreviewBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: to.trim() || "preview@cvscholar.com",
          kind: selected,
          previewOnly: true
        })
      });
      const body = (await res.json()) as { error?: string; html?: string; subject?: string };
      if (!res.ok) {
        setError(body.error || "Could not preview.");
        return;
      }
      setPreviewHtml(body.html || "");
      setPreviewSubject(body.subject || "");
    } catch {
      setError("Could not preview.");
    } finally {
      setPreviewBusy(false);
    }
  }

  async function sendTest() {
    if (!selected || !to.trim()) {
      setError("Enter a destination email and choose a template.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/emails/test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim(), kind: selected, previewOnly: false })
      });
      const body = (await res.json()) as {
        error?: string;
        provider?: string;
        subject?: string;
        messageId?: string;
      };
      if (!res.ok) {
        setError(body.error || "Send failed.");
        return;
      }
      setMessage(
        `Sent via ${body.provider || "provider"}: ${body.subject || selected}${
          body.messageId ? ` · id ${body.messageId}` : ""
        }`
      );
    } catch {
      setError("Send failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendAll() {
    if (!to.trim()) {
      setError("Enter a destination email first.");
      return;
    }
    if (
      !window.confirm(
        `Send ALL ${kinds.length} transactional test emails to ${to.trim()}? Subject lines will be prefixed with [TEST].`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    let ok = 0;
    let fail = 0;
    for (const row of kinds) {
      try {
        const res = await fetch("/api/admin/emails/test", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: to.trim(), kind: row.kind, previewOnly: false })
        });
        if (res.ok) ok += 1;
        else fail += 1;
        await new Promise((r) => window.setTimeout(r, 400));
      } catch {
        fail += 1;
      }
    }
    setBusy(false);
    setMessage(`Batch finished: ${ok} sent, ${fail} failed.`);
  }

  return (
    <section className="workspace-screen admin-emails-workspace">
      <div className="screen-header">
        <div>
          <span className="section-label">Admin</span>
          <h1>Emails</h1>
          <p>
            Preview and send sample transactional emails to any address. Subjects are prefixed with{" "}
            <strong>[TEST]</strong>.
          </p>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <div className="admin-emails-status card-panel">
        <Mail size={18} />
        <div>
          <strong>Provider:</strong> {configured ? provider || "configured" : "not configured"}
          {!configured ? (
            <span className="muted"> — set BREVO_API_KEY (or RESEND_API_KEY) in Portainer.</span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="billing-banner is-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}
      {message ? (
        <div className="billing-banner is-success" role="status">
          <span>{message}</span>
        </div>
      ) : null}

      <div className="admin-emails-grid">
        <div className="card-panel">
          <h2>Send a test</h2>
          <label>
            <span>Destination email</span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
            />
          </label>
          <label>
            <span>Template</span>
            <select value={selected} onChange={(e) => setSelected(e.target.value)} disabled={busy || loading}>
              {kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <div className="admin-emails-actions">
            <button
              className="secondary-action"
              type="button"
              disabled={previewBusy || !selected}
              onClick={() => void preview()}
            >
              {previewBusy ? <Loader2 size={16} className="spin" /> : null}
              Preview
            </button>
            <button
              className="primary-action"
              type="button"
              disabled={busy || !configured || !selected || !to.trim()}
              onClick={() => void sendTest()}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
              Send test
            </button>
          </div>
          <button
            className="secondary-action admin-emails-send-all"
            type="button"
            disabled={busy || !configured || !to.trim() || kinds.length === 0}
            onClick={() => void sendAll()}
          >
            Send all templates
          </button>
        </div>

        <div className="card-panel admin-emails-preview">
          <h2>Preview</h2>
          {previewSubject ? <p className="muted">Subject: {previewSubject}</p> : null}
          {previewHtml ? (
            <iframe title="Email preview" className="admin-emails-iframe" srcDoc={previewHtml} />
          ) : (
            <p className="muted">Choose a template and click Preview.</p>
          )}
        </div>
      </div>
    </section>
  );
}
