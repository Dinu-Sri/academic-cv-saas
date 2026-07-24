"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  ImagePlus,
  Loader2,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  UserRound
} from "lucide-react";
import type { SupportTicketDetail, SupportTicketListItem } from "@/lib/support/types";
import { supportStatusLabel, supportTypeLabel } from "@/lib/support/types";

export function AdminSupportWorkspace() {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicketListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("ticket"));
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [replyStatus, setReplyStatus] = useState("in_progress");

  const loadTickets = useCallback(async () => {
    setLoadingList(true);
    try {
      const qs = new URLSearchParams();
      if (statusFilter) qs.set("status", statusFilter);
      if (typeFilter) qs.set("type", typeFilter);
      if (search.trim()) qs.set("search", search.trim());
      const res = await fetch(`/api/admin/support/tickets?${qs.toString()}`, {
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load tickets.");
      setTickets(data.tickets as SupportTicketListItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tickets.");
    } finally {
      setLoadingList(false);
    }
  }, [statusFilter, typeFilter, search]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/support/tickets/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load ticket.");
      const ticket = data.ticket as SupportTicketDetail;
      setDetail(ticket);
      setReplyStatus(ticket.status === "closed" ? "closed" : ticket.status === "resolved" ? "resolved" : "in_progress");
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, hasUnreadUserReply: false } : t)));
      window.dispatchEvent(new Event("cvscholar-support-unread-refresh"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load ticket.");
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadTickets();
    });
    return () => {
      cancelled = true;
    };
  }, [loadTickets]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      queueMicrotask(() => {
        if (!cancelled) setDetail(null);
      });
      return () => {
        cancelled = true;
      };
    }
    queueMicrotask(() => {
      if (!cancelled) void loadDetail(selectedId);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadDetail]);

  const replyPreviewUrls = useMemo(
    () => replyFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [replyFiles]
  );

  useEffect(() => {
    return () => replyPreviewUrls.forEach((p) => URL.revokeObjectURL(p.url));
  }, [replyPreviewUrls]);

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("message", reply);
      fd.set("status", replyStatus);
      for (const file of replyFiles) fd.append("attachments", file);

      const res = await fetch(`/api/admin/support/tickets/${selectedId}/reply`, {
        method: "POST",
        credentials: "include",
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send reply.");

      setReply("");
      setReplyFiles([]);
      setDetail(data.ticket as SupportTicketDetail);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reply.");
    } finally {
      setBusy(false);
    }
  }

  async function patchMeta(patch: { status?: string; priority?: string }) {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${selectedId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed.");
      setDetail(data.ticket as SupportTicketDetail);
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  const ctx = detail?.userContext;

  return (
    <section className="support-workspace admin-support-workspace">
      <div className="screen-header">
        <div>
          <span className="section-label">Admin</span>
          <h1>Support tickets</h1>
          <p>Reply to users, attach screenshots, and review account context.</p>
        </div>
      </div>

      {error ? (
        <div className="support-banner is-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="support-admin-filters">
        <label className="support-search">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ticket, subject, email…"
          />
        </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          <option value="support">Support</option>
          <option value="bug">Bug</option>
          <option value="feature">Feature</option>
        </select>
      </div>

      <div className="support-layout support-layout-admin">
        <aside className="support-list-panel">
          <h2>
            Queue {loadingList ? "" : `(${tickets.length})`}
          </h2>
          {loadingList ? (
            <p className="support-empty">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="support-empty">No tickets match filters.</p>
          ) : (
            <ul className="support-ticket-list">
              {tickets.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    className={[
                      "support-ticket-item",
                      selectedId === ticket.id ? "is-active" : "",
                      ticket.hasUnreadUserReply ? "has-unread" : ""
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => setSelectedId(ticket.id)}
                  >
                    <span className="support-ticket-top">
                      <strong>{ticket.ticketNumber}</strong>
                      {ticket.hasUnreadUserReply ? <span className="support-unread-dot" title="Unread" /> : null}
                    </span>
                    <span className="support-ticket-subject">{ticket.subject}</span>
                    <span className="support-ticket-meta">
                      <span>{ticket.user?.email || "—"}</span>
                      <span className={`support-status status-${ticket.status}`}>
                        {supportStatusLabel(ticket.status)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="support-thread-panel">
          {!selectedId ? (
            <div className="support-placeholder">
              <ShieldCheck size={28} />
              <p>Select a ticket from the queue.</p>
            </div>
          ) : loadingDetail ? (
            <div className="support-placeholder">
              <Loader2 className="spin" size={24} />
              <p>Loading…</p>
            </div>
          ) : detail ? (
            <>
              <header className="support-thread-header">
                <div>
                  <span className="support-ticket-number">{detail.ticketNumber}</span>
                  <h2>{detail.subject}</h2>
                  <p>
                    {supportTypeLabel(detail.type)} · Priority {detail.priority}
                  </p>
                </div>
                <div className="support-admin-meta-controls">
                  <label>
                    Status
                    <select
                      value={detail.status}
                      disabled={busy}
                      onChange={(e) => void patchMeta({ status: e.target.value })}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="resolved">Resolved</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label>
                    Priority
                    <select
                      value={detail.priority}
                      disabled={busy}
                      onChange={(e) => void patchMeta({ priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </label>
                </div>
              </header>

              {ctx ? (
                <aside className="support-user-context" aria-label="User details">
                  <h3>
                    <UserRound size={16} />
                    User context
                  </h3>
                  <dl className="support-context-grid">
                    <div>
                      <dt>Name</dt>
                      <dd>{ctx.name}</dd>
                    </div>
                    <div>
                      <dt>Email</dt>
                      <dd>{ctx.email}</dd>
                    </div>
                    <div>
                      <dt>Account created</dt>
                      <dd>{new Date(ctx.accountCreatedAt).toLocaleString()}</dd>
                    </div>
                    <div>
                      <dt>Email verified</dt>
                      <dd>{ctx.emailVerified ? "Yes" : "No"}</dd>
                    </div>
                    <div>
                      <dt>Plan</dt>
                      <dd>
                        {ctx.planName} ({ctx.planStatus})
                        {ctx.isPaid ? " · paid" : " · free"}
                      </dd>
                    </div>
                    <div>
                      <dt>Plan expiry</dt>
                      <dd>
                        {ctx.planExpiresAt
                          ? `${new Date(ctx.planExpiresAt).toLocaleDateString()}${
                              ctx.daysRemaining != null ? ` · ${ctx.daysRemaining}d left` : ""
                            }`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>Payments</dt>
                      <dd>
                        {ctx.paymentCount}
                        {ctx.lastPaymentAt
                          ? ` · last ${new Date(ctx.lastPaymentAt).toLocaleDateString()}`
                          : ""}
                      </dd>
                    </div>
                    <div>
                      <dt>Workspace</dt>
                      <dd>{ctx.workspaceSlug || "—"}</dd>
                    </div>
                    <div>
                      <dt>Profile</dt>
                      <dd>{ctx.profileDisplayName || "—"}</dd>
                    </div>
                    <div>
                      <dt>CV documents</dt>
                      <dd>{ctx.cvDocumentCount}</dd>
                    </div>
                    <div>
                      <dt>Website</dt>
                      <dd>
                        {ctx.websiteStatus || "none"}
                        {ctx.websiteUsername ? ` · ${ctx.websiteUsername}` : ""}
                      </dd>
                    </div>
                  </dl>
                </aside>
              ) : null}

              <div className="support-messages">
                {detail.messages.map((msg) => (
                  <article
                    key={msg.id}
                    className={["support-message", msg.isAdminReply ? "is-admin" : "is-user"].join(" ")}
                  >
                    <header>
                      <strong>
                        {msg.isAdminReply ? `Support · ${msg.authorName}` : msg.authorName}
                      </strong>
                      <time dateTime={msg.createdAt}>
                        {new Date(msg.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </time>
                    </header>
                    <p className="support-message-body">{msg.body}</p>
                    {msg.attachments.length > 0 ? (
                      <div className="support-attachments">
                        {msg.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noreferrer"
                            className="support-attachment-thumb"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={att.url} alt={att.filename} />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <form className="support-reply-form" onSubmit={handleReply}>
                <label className="support-reply-field">
                  <span>Reply as support</span>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={4}
                    placeholder="Write a reply to the user…"
                    required={replyFiles.length === 0}
                  />
                </label>
                <div className="support-form-actions support-form-actions-admin">
                  <div className="support-action-group">
                    <span className="support-action-label">After send</span>
                    <select
                      className="support-action-select"
                      value={replyStatus}
                      onChange={(e) => setReplyStatus(e.target.value)}
                      aria-label="Status after send"
                    >
                      <option value="in_progress">Mark in progress</option>
                      <option value="open">Keep open</option>
                      <option value="resolved">Mark resolved</option>
                      <option value="closed">Close ticket</option>
                    </select>
                  </div>
                  <label className="secondary-action compact-action support-file-btn">
                    <ImagePlus size={16} />
                    <span>Images</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      multiple
                      hidden
                      onChange={(e) => setReplyFiles(Array.from(e.target.files || []).slice(0, 3))}
                    />
                  </label>
                  <button className="primary-action support-send-btn" type="submit" disabled={busy}>
                    {busy ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                    Send reply
                  </button>
                </div>
                {replyPreviewUrls.length > 0 ? (
                  <div className="support-file-previews">
                    {replyPreviewUrls.map((p) => (
                      <span key={p.url} className="support-file-chip">
                        <Paperclip size={12} />
                        {p.name}
                      </span>
                    ))}
                    <button type="button" className="link-button" onClick={() => setReplyFiles([])}>
                      Clear
                    </button>
                  </div>
                ) : null}
              </form>
            </>
          ) : (
            <div className="support-placeholder">
              <p>Ticket not found.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
