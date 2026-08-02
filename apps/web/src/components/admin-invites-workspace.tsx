"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, MailPlus, RefreshCw } from "lucide-react";

type InviteRow = {
  id: string;
  email: string;
  planKey: string;
  planName: string;
  expiresAt: string;
  status: string;
  redeemUrl: string;
  createdAt: string;
  note: string;
};

type BulkCreated = {
  email: string;
  redeemUrl: string;
  status: "created" | "error";
  error?: string;
};

function Badge({ children }: { children: string }) {
  return <span className="admin-badge">{children}</span>;
}

function parseEmailList(raw: string) {
  const parts = raw
    .split(/[\n,;]+/g)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const email of parts) {
    if (seen.has(email)) continue;
    seen.add(email);
    unique.push(email);
  }
  return unique;
}

export function AdminInvitesWorkspace() {
  const [emailsText, setEmailsText] = useState("");
  const [planKey, setPlanKey] = useState<"pdf_pass" | "scholar_annual">("pdf_pass");
  const [expiresInDays, setExpiresInDays] = useState(14);
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createdLinks, setCreatedLinks] = useState<BulkCreated[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInvites = useCallback(async () => {
    const response = await fetch("/api/admin/invites", { credentials: "include" });
    if (!response.ok) return;
    const payload = (await response.json()) as { invitations?: InviteRow[] };
    setInvites(payload.invitations || []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadInvites();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadInvites]);

  async function createInvites() {
    const emails = parseEmailList(emailsText);
    if (emails.length === 0) {
      setError("Enter at least one email address.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    setCreatedLinks([]);
    try {
      const response = await fetch("/api/admin/invites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails,
          planKey,
          expiresInDays,
          note,
          sendEmail
        })
      });
      const payload = (await response.json()) as {
        error?: string;
        results?: BulkCreated[];
        created?: number;
        failed?: number;
        email?: { sent?: number; skipped?: number };
      };
      if (!response.ok) throw new Error(payload.error || "Could not create invitations.");

      const results = payload.results || [];
      setCreatedLinks(results);
      const created = payload.created ?? results.filter((row) => row.status === "created").length;
      const failed = payload.failed ?? results.filter((row) => row.status === "error").length;
      setMessage(
        `Created ${created} invitation${created === 1 ? "" : "s"}${
          failed ? ` · ${failed} failed` : ""
        }${
          sendEmail && payload.email
            ? ` · emailed ${payload.email.sent ?? 0}`
            : sendEmail
              ? ""
              : " · links ready to copy (email not sent)"
        }.`
      );
      if (created > 0) {
        setEmailsText("");
        setNote("");
      }
      await loadInvites();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create invitations.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      window.prompt("Copy this link:", value);
    }
  }

  async function copyAllLinks() {
    const lines = createdLinks
      .filter((row) => row.status === "created" && row.redeemUrl)
      .map((row) => `${row.email}\t${row.redeemUrl}`);
    if (lines.length === 0) return;
    await copyText(lines.join("\n"));
  }

  const emailCount = parseEmailList(emailsText).length;

  return (
    <section className="workspace-screen admin-invites-screen">
      <header className="screen-header">
        <div>
          <span className="section-label">Admin</span>
          <h1>Package invitations</h1>
          <p className="muted-text">
            Generate single-use plan links for one email or many at once. Recipients must sign in with the invited email
            to activate PDF Pass or Scholar Annual.
          </p>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={() => void loadInvites()}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      <article className="admin-panel admin-invites-create">
        <h2>Create invitations</h2>
        <div className="admin-invite-form admin-invite-form-bulk">
          <label className="admin-invite-emails">
            <span>Emails (one per line, or comma-separated)</span>
            <textarea
              value={emailsText}
              onChange={(event) => setEmailsText(event.target.value)}
              rows={8}
              placeholder={"scholar1@university.edu\nscholar2@university.edu\nscholar3@university.edu"}
              spellCheck={false}
            />
            <small className="muted-text">
              {emailCount > 0 ? `${emailCount} unique email${emailCount === 1 ? "" : "s"} ready` : "Paste many addresses to generate links in bulk."}
            </small>
          </label>
          <div className="admin-invite-options">
            <label>
              <span>Plan</span>
              <select value={planKey} onChange={(event) => setPlanKey(event.target.value as "pdf_pass" | "scholar_annual")}>
                <option value="pdf_pass">PDF Pass</option>
                <option value="scholar_annual">Scholar Annual</option>
              </select>
            </label>
            <label>
              <span>Link expires (days)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(Number(event.target.value) || 14)}
              />
            </label>
            <label>
              <span>Note (optional)</span>
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Conference grant, pilot cohort, etc." />
            </label>
            <label className="admin-invite-check">
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />
              <span>Also email each invitation link</span>
            </label>
            <button
              className="primary-action"
              type="button"
              disabled={busy || emailCount === 0}
              onClick={() => void createInvites()}
            >
              {busy ? <Loader2 size={16} className="spin" /> : <MailPlus size={16} />}
              {busy ? "Creating…" : emailCount > 1 ? `Create ${emailCount} invitations` : "Create invitation"}
            </button>
          </div>
        </div>

        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="form-success">{message}</p> : null}

        {createdLinks.length > 0 ? (
          <div className="admin-invite-results">
            <div className="admin-invite-results-head">
              <h3>Generated links</h3>
              <button className="secondary-action compact-action" type="button" onClick={() => void copyAllLinks()}>
                <Copy size={15} />
                Copy all (email + link)
              </button>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Link</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {createdLinks.map((row) => (
                    <tr key={`${row.email}-${row.redeemUrl || row.error || "x"}`}>
                      <td>
                        <strong>{row.email}</strong>
                      </td>
                      <td>
                        {row.redeemUrl ? (
                          <button type="button" className="linkish-button" onClick={() => void copyText(row.redeemUrl)}>
                            {row.redeemUrl}
                          </button>
                        ) : (
                          <small className="form-error">{row.error || "Failed"}</small>
                        )}
                      </td>
                      <td>
                        <Badge>{row.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </article>

      <article className="admin-panel">
        <h2>Recent invitations</h2>
        {loading ? <p className="muted-text">Loading…</p> : null}
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Created</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <small>No invitations yet.</small>
                  </td>
                </tr>
              ) : (
                invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>
                      <strong>{invite.email}</strong>
                      {invite.note ? <small>{invite.note}</small> : null}
                    </td>
                    <td>{invite.planName}</td>
                    <td>
                      <Badge>{invite.status}</Badge>
                    </td>
                    <td>
                      <small>{new Date(invite.expiresAt).toLocaleString()}</small>
                    </td>
                    <td>
                      <small>{new Date(invite.createdAt).toLocaleDateString()}</small>
                    </td>
                    <td>
                      {invite.redeemUrl ? (
                        <button type="button" className="linkish-button" onClick={() => void copyText(invite.redeemUrl)}>
                          Copy
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
