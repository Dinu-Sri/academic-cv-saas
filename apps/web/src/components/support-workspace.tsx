"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ImagePlus, LifeBuoy, Loader2, MessageSquarePlus, Paperclip, Send, X } from "lucide-react";
import type { SupportTicketDetail, SupportTicketListItem } from "@/lib/support/types";
import { supportStatusLabel, supportTypeLabel } from "@/lib/support/types";

type SupportWorkspaceProps = {
  initialTickets: SupportTicketListItem[];
};

function subscribeDom(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function SupportWorkspace({ initialTickets }: SupportWorkspaceProps) {
  const searchParams = useSearchParams();
  const [tickets, setTickets] = useState(initialTickets);
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("ticket"));
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const statusSlot = useSyncExternalStore(
    subscribeDom,
    () => document.getElementById("support-status-slot"),
    () => null
  );

  const [type, setType] = useState("support");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [reply, setReply] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);

  const loadTickets = useCallback(async () => {
    const res = await fetch("/api/support/tickets", { credentials: "include" });
    if (!res.ok) return;
    const data = (await res.json()) as { tickets: SupportTicketListItem[] };
    setTickets(data.tickets);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    setError("");
    try {
      const res = await fetch(`/api/support/tickets/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load ticket.");
      setDetail(data.ticket as SupportTicketDetail);
      setTickets((prev) =>
        prev.map((t) => (t.id === id ? { ...t, hasUnreadAdminReply: false } : t))
      );
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

  const previewUrls = useMemo(
    () => files.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [files]
  );
  const replyPreviewUrls = useMemo(
    () => replyFiles.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })),
    [replyFiles]
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((p) => URL.revokeObjectURL(p.url));
      replyPreviewUrls.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previewUrls, replyPreviewUrls]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("type", type);
      fd.set("subject", subject);
      fd.set("message", message);
      for (const file of files) fd.append("attachments", file);

      const res = await fetch("/api/support/tickets", {
        method: "POST",
        credentials: "include",
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create ticket.");

      setComposeOpen(false);
      setSubject("");
      setMessage("");
      setFiles([]);
      setType("support");
      await loadTickets();
      setSelectedId(data.ticket.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.set("message", reply);
      for (const file of replyFiles) fd.append("attachments", file);

      const res = await fetch(`/api/support/tickets/${selectedId}/reply`, {
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

  const ticketsPanel = (
    <div className="support-status-panel">
      <div className="support-status-head">
        <span className="section-label">Your tickets</span>
        <strong>
          {tickets.length} open thread{tickets.length === 1 ? "" : "s"}
        </strong>
      </div>
      {tickets.length === 0 ? (
        <p className="support-empty">No tickets yet. Open one when you need help.</p>
      ) : (
        <ul className="support-ticket-list support-ticket-list-status">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                className={[
                  "support-ticket-item",
                  selectedId === ticket.id ? "is-active" : "",
                  ticket.hasUnreadAdminReply ? "has-unread" : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setSelectedId(ticket.id)}
              >
                <span className="support-ticket-top">
                  <strong>{ticket.ticketNumber}</strong>
                  {ticket.hasUnreadAdminReply ? <span className="support-unread-dot" title="New reply" /> : null}
                </span>
                <span className="support-ticket-subject">{ticket.subject}</span>
                <span className="support-ticket-meta">
                  <span className={`support-status status-${ticket.status}`}>
                    {supportStatusLabel(ticket.status)}
                  </span>
                  <span>{supportTypeLabel(ticket.type)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        className="primary-action support-status-new"
        type="button"
        onClick={() => {
          setComposeOpen(true);
          setError("");
        }}
      >
        <MessageSquarePlus size={16} />
        New ticket
      </button>
    </div>
  );

  return (
    <section className="support-workspace support-workspace-centered">
      <div className="support-main-column">
        <div className="screen-header">
          <div>
            <span className="section-label">Support</span>
            <h1>Help &amp; tickets</h1>
            <p>Ask about billing, PDFs, imports, or anything else. Our team replies here and by email.</p>
          </div>
          <button
            className="primary-action"
            type="button"
            onClick={() => {
              setComposeOpen(true);
              setError("");
            }}
          >
            <MessageSquarePlus size={16} />
            New ticket
          </button>
        </div>

        {error ? (
          <div className="support-banner is-error" role="alert">
            {error}
          </div>
        ) : null}

        <div className="support-thread-panel support-thread-panel-main">
          {!selectedId ? (
            <div className="support-placeholder">
              <LifeBuoy size={28} />
              <p>Select a ticket from the right panel, or create a new one.</p>
              <button
                className="primary-action"
                type="button"
                onClick={() => {
                  setComposeOpen(true);
                  setError("");
                }}
              >
                <MessageSquarePlus size={16} />
                New ticket
              </button>
            </div>
          ) : loadingDetail ? (
            <div className="support-placeholder">
              <Loader2 className="spin" size={24} />
              <p>Loading conversation…</p>
            </div>
          ) : detail ? (
            <>
              <header className="support-thread-header">
                <div>
                  <span className="support-ticket-number">{detail.ticketNumber}</span>
                  <h2>{detail.subject}</h2>
                  <p>
                    {supportTypeLabel(detail.type)} · {supportStatusLabel(detail.status)} ·{" "}
                    {detail.messageCount} message{detail.messageCount === 1 ? "" : "s"}
                  </p>
                </div>
              </header>

              <div className="support-messages">
                {detail.messages.map((msg) => (
                  <article
                    key={msg.id}
                    className={["support-message", msg.isAdminReply ? "is-admin" : "is-user"].join(" ")}
                  >
                    <header>
                      <strong>{msg.isAdminReply ? "CVScholar Support" : "You"}</strong>
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

              {detail.status === "closed" ? (
                <p className="support-closed-note">This ticket is closed. Open a new ticket if you need more help.</p>
              ) : (
                <form className="support-reply-form" onSubmit={handleReply}>
                  <label className="support-reply-field">
                    <span>Your reply</span>
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={4}
                      placeholder="Write a reply…"
                      required={replyFiles.length === 0}
                    />
                  </label>
                  <div className="support-form-actions">
                    <label className="secondary-action compact-action support-file-btn">
                      <ImagePlus size={16} />
                      <span>Add images</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        multiple
                        hidden
                        onChange={(e) => {
                          const list = Array.from(e.target.files || []).slice(0, 3);
                          setReplyFiles(list);
                        }}
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
              )}
            </>
          ) : (
            <div className="support-placeholder">
              <p>Ticket not found.</p>
            </div>
          )}
        </div>
      </div>

      {statusSlot ? createPortal(ticketsPanel, statusSlot) : null}

      {composeOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !busy && setComposeOpen(false)}>
          <section
            className="auth-modal support-compose-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-compose-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => !busy && setComposeOpen(false)}
            >
              <X size={18} />
            </button>
            <h2 id="support-compose-title">New support ticket</h2>
            <p>Describe the issue. You can attach up to 3 screenshots (5MB each).</p>
            <form className="auth-form support-compose-form" onSubmit={handleCreate}>
              <label>
                <span>Type</span>
                <select value={type} onChange={(e) => setType(e.target.value)} required>
                  <option value="support">General support</option>
                  <option value="bug">Bug report</option>
                  <option value="feature">Feature request</option>
                </select>
              </label>
              <label>
                <span>Subject</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  minLength={5}
                  required
                  placeholder="Short summary"
                />
              </label>
              <label>
                <span>Message</span>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  minLength={10}
                  required
                  placeholder="What happened? What did you expect?"
                />
              </label>
              <label className="secondary-action compact-action support-file-btn">
                <ImagePlus size={16} />
                Attach images
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  hidden
                  onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 3))}
                />
              </label>
              {previewUrls.length > 0 ? (
                <div className="support-file-previews">
                  {previewUrls.map((p) => (
                    <span key={p.url} className="support-file-chip">
                      <Paperclip size={12} />
                      {p.name}
                    </span>
                  ))}
                </div>
              ) : null}
              <button className="primary-action" type="submit" disabled={busy}>
                {busy ? "Sending…" : "Submit ticket"}
              </button>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
