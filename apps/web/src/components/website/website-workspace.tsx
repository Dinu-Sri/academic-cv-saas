"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Circle, ExternalLink, Globe2, LoaderCircle } from "lucide-react";
import { WEBSITE_PAGE_KEYS, WEBSITE_PAGE_LABELS, type WebsitePageKey } from "@/lib/website/constants";

type WebsiteWorkspaceData = {
  enabled: true;
  state: "not_created" | "draft_ready" | "published";
  workspaceId: string;
  rootDomain: string;
  profile: {
    id: string;
    displayName: string;
    headline: string;
    affiliation: string;
    completeness: number;
  };
  readiness: {
    score: number;
    canPublish: boolean;
    items: { key: string; label: string; category: string; status: string; message: string }[];
    missingRequired: string[];
  };
  cvDocuments: { id: string; title: string; templateKey: string; updatedAt: string }[];
  website?: {
    id: string;
    username: string;
    status: string;
    version: number;
    headlineOverride: string;
    sourceCvDocumentId: string | null;
    contactFormEnabled: boolean;
    searchIndexingEnabled: boolean;
    publicUrl: string;
  };
  config?: {
    pageContent: Record<string, string>;
    enabledPages: Record<string, boolean>;
    navigation: WebsitePageKey[];
    fieldVisibility: Record<string, boolean>;
    sectionVisibility: Record<string, boolean>;
  };
};

type Props = {
  initialData: WebsiteWorkspaceData;
};

type TabKey = "pages" | "privacy" | "settings" | "messages" | "analytics";

type InboxMessage = {
  id: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
  readAt: string | null;
};

type AnalyticsSummary = {
  totalViews: number;
  days: number;
  pages: { pagePath: string; views: number }[];
  series: { date: string; pagePath: string; views: number }[];
};

export function WebsiteWorkspace({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [username, setUsername] = useState(initialData.website?.username || "");
  const [usernameStatus, setUsernameStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("pages");
  const [headline, setHeadline] = useState(initialData.website?.headlineOverride || "");
  const [homeIntro, setHomeIntro] = useState(initialData.config?.pageContent.homeIntro || "");
  const [aboutNarrative, setAboutNarrative] = useState(initialData.config?.pageContent.aboutNarrative || "");
  const [researchNarrative, setResearchNarrative] = useState(initialData.config?.pageContent.researchNarrative || "");
  const [enabledPages, setEnabledPages] = useState(initialData.config?.enabledPages || {});
  const [fieldVisibility, setFieldVisibility] = useState(initialData.config?.fieldVisibility || {});
  const [sourceCvDocumentId, setSourceCvDocumentId] = useState(initialData.website?.sourceCvDocumentId || "");
  const [contactFormEnabled, setContactFormEnabled] = useState(initialData.website?.contactFormEnabled ?? true);
  const [searchIndexingEnabled, setSearchIndexingEnabled] = useState(initialData.website?.searchIndexingEnabled ?? true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "queued" | "error">("idle");
  const [publishMessage, setPublishMessage] = useState("");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const statusSlot = useSyncExternalStore(
    subscribeToStaticDom,
    () => document.getElementById("website-status-slot"),
    () => null
  );
  const saveTimerRef = useRef<number | null>(null);
  const draftRef = useRef({
    headline,
    homeIntro,
    aboutNarrative,
    researchNarrative,
    enabledPages,
    fieldVisibility,
    sourceCvDocumentId,
    contactFormEnabled,
    searchIndexingEnabled,
    version: initialData.website?.version ?? 1
  });

  useEffect(() => {
    draftRef.current = {
      headline,
      homeIntro,
      aboutNarrative,
      researchNarrative,
      enabledPages,
      fieldVisibility,
      sourceCvDocumentId,
      contactFormEnabled,
      searchIndexingEnabled,
      version: data.website?.version ?? draftRef.current.version
    };
  }, [
    aboutNarrative,
    contactFormEnabled,
    data.website?.version,
    enabledPages,
    fieldVisibility,
    headline,
    homeIntro,
    researchNarrative,
    searchIndexingEnabled,
    sourceCvDocumentId
  ]);

  useEffect(() => {
    if (data.state === "not_created" || !username.trim()) return;
    const handle = window.setTimeout(async () => {
      const response = await fetch(`/api/website/username/check?value=${encodeURIComponent(username)}`);
      const result = await response.json();
      if (!response.ok) return;
      if (!result.valid) setUsernameStatus(result.reason === "reserved" ? "Reserved name" : "Invalid format");
      else if (!result.available) setUsernameStatus("Already taken");
      else setUsernameStatus(`Available · ${result.normalized}.${data.rootDomain}`);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [username, data.state, data.rootDomain]);

  const hostPreview = useMemo(() => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "your-name";
    return `${clean}.${data.rootDomain}`;
  }, [username, data.rootDomain]);

  const persistDraft = useCallback(async () => {
    if (!data.website) return;
    const draft = draftRef.current;
    setSaveState("saving");
    setError("");
    try {
      const response = await fetch("/api/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: draft.version,
          headlineOverride: draft.headline,
          pageContent: {
            homeIntro: draft.homeIntro,
            aboutNarrative: draft.aboutNarrative,
            researchNarrative: draft.researchNarrative
          },
          enabledPages: draft.enabledPages,
          fieldVisibility: draft.fieldVisibility,
          sourceCvDocumentId: draft.sourceCvDocumentId || null,
          contactFormEnabled: draft.contactFormEnabled,
          searchIndexingEnabled: draft.searchIndexingEnabled
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save website draft.");
      setData(result);
      if (result.website?.version) {
        draftRef.current.version = result.website.version;
      }
      setSaveState("saved");
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "Could not save website draft.");
    }
  }, [data.website]);

  const queueAutosave = useCallback(() => {
    if (!data.website) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistDraft();
    }, 450);
  }, [data.website, persistDraft]);

  async function publishSite() {
    setPublishState("publishing");
    setPublishMessage("");
    setError("");
    try {
      const response = await fetch("/api/website/publish", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not publish website.");

      if (result.workspace) setData(result.workspace);

      if (result.status === "queued" && result.jobId) {
        setPublishState("queued");
        setPublishMessage("Publishing…");
        await pollPublishJob(result.jobId);
      } else {
        setPublishState("idle");
        setPublishMessage("Published.");
        const refresh = await fetch("/api/website");
        if (refresh.ok) setData(await refresh.json());
      }
    } catch (publishError) {
      setPublishState("error");
      setError(publishError instanceof Error ? publishError.message : "Could not publish website.");
    }
  }

  async function pollPublishJob(jobId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      const response = await fetch(`/api/website/publish/jobs/${jobId}`);
      const result = await response.json();
      if (!response.ok) continue;
      const status = result.job?.status as string;
      if (status === "completed") {
        setPublishState("idle");
        setPublishMessage("Published.");
        const refresh = await fetch("/api/website");
        if (refresh.ok) setData(await refresh.json());
        return;
      }
      if (status === "failed") {
        setPublishState("error");
        setError(result.job?.error || "Publish failed.");
        return;
      }
      setPublishMessage(result.job?.message || "Publishing…");
    }
    setPublishState("error");
    setError("Publish is taking longer than expected. Refresh in a moment.");
  }

  async function unpublishSite() {
    setPublishState("publishing");
    setError("");
    try {
      const response = await fetch("/api/website/unpublish", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not unpublish website.");
      if (result.workspace) setData(result.workspace);
      setPublishState("idle");
      setPublishMessage("Unpublished. Draft is private again.");
    } catch (unpublishError) {
      setPublishState("error");
      setError(unpublishError instanceof Error ? unpublishError.message : "Could not unpublish website.");
    }
  }

  async function createDraft() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create website draft.");
      setData(result);
      setHeadline(result.website?.headlineOverride || "");
      setHomeIntro(result.config?.pageContent.homeIntro || "");
      setAboutNarrative(result.config?.pageContent.aboutNarrative || "");
      setResearchNarrative(result.config?.pageContent.researchNarrative || "");
      setEnabledPages(result.config?.enabledPages || {});
      setFieldVisibility(result.config?.fieldVisibility || {});
      setSourceCvDocumentId(result.website?.sourceCvDocumentId || "");
      setContactFormEnabled(result.website?.contactFormEnabled ?? true);
      setSearchIndexingEnabled(result.website?.searchIndexingEnabled ?? true);
      setSaveState("saved");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create website draft.");
    } finally {
      setBusy(false);
    }
  }

  async function loadMessages() {
    setMessagesLoading(true);
    try {
      const response = await fetch("/api/website/messages", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load messages.");
      setMessages(result.messages || []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load messages.");
    } finally {
      setMessagesLoading(false);
    }
  }

  async function markMessageRead(messageId: string) {
    try {
      const response = await fetch(`/api/website/messages/${encodeURIComponent(messageId)}`, {
        method: "PATCH",
        credentials: "include"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update message.");
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, status: result.message?.status || "read", readAt: result.message?.readAt || new Date().toISOString() }
            : message
        )
      );
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not update message.");
    }
  }

  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const response = await fetch("/api/website/analytics", { credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load analytics.");
      setAnalytics(result.analytics || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load analytics.");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  const statusPanel = statusSlot
    ? createPortal(
        data.state === "not_created" ? (
          <div className="website-status-panel">
            <span className="section-label">Website</span>
            <p className="website-save-meta">Choose a username to create your draft site.</p>
          </div>
        ) : (
          <div className="website-status-panel">
            <div className="website-status-head">
              <span className="section-label">Readiness</span>
              <strong>{data.readiness.score}%</strong>
            </div>
            <ul className="website-readiness-list">
              {data.readiness.items.map((item) => (
                <li key={item.key} className={item.status === "complete" ? "is-complete" : ""}>
                  {item.status === "complete" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.message}</small>
                  </span>
                </li>
              ))}
            </ul>
            <div className="website-status-footer">
              <p className="website-save-meta">
                {saveState === "saving"
                  ? "Saving…"
                  : saveState === "saved"
                    ? "All changes saved"
                    : saveState === "error"
                      ? "Save failed"
                      : "Autosave on"}
              </p>
              {publishMessage ? <p className="website-save-meta">{publishMessage}</p> : null}
              {data.website?.status === "published" ? (
                <a
                  className="secondary-action website-preview-button"
                  href={`/u/${data.website.username}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} />
                  View live site
                </a>
              ) : null}
              <a className="secondary-action website-preview-button" href="/website/preview" target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Preview draft
              </a>
              {data.website?.status === "published" ? (
                <button
                  className="secondary-action website-preview-button"
                  type="button"
                  disabled={publishState === "publishing" || publishState === "queued"}
                  onClick={() => void unpublishSite()}
                >
                  Unpublish
                </button>
              ) : (
                <button
                  className="primary-action website-preview-button"
                  type="button"
                  disabled={!data.readiness.canPublish || publishState === "publishing" || publishState === "queued"}
                  onClick={() => void publishSite()}
                >
                  {publishState === "publishing" || publishState === "queued" ? (
                    <>
                      <LoaderCircle size={16} className="spin" />
                      Publishing…
                    </>
                  ) : (
                    "Publish website"
                  )}
                </button>
              )}
            </div>
          </div>
        ),
        statusSlot
      )
    : null;

  if (data.state === "not_created") {
    return (
      <section className="workspace-screen website-workspace website-claim">
        <article className="website-claim-card">
          <label className="website-field">
            <span>Website username</span>
            <div className="website-username-row">
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your-name"
                autoComplete="off"
              />
              <span className="website-host-hint">.{data.rootDomain}</span>
            </div>
          </label>
          <p className="website-field-hint">{usernameStatus || hostPreview}</p>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action website-claim-action" type="button" disabled={busy || !username.trim()} onClick={() => void createDraft()}>
            <Globe2 size={16} />
            {busy ? "Creating…" : "Continue"}
          </button>
        </article>
      </section>
    );
  }

  return (
    <section className="workspace-screen website-workspace website-editor">
      {statusPanel}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="website-tabs">
        {(["pages", "privacy", "settings", "messages", "analytics"] as const).map((item) => (
          <button
            key={item}
            className={tab === item ? "is-active" : ""}
            type="button"
            onClick={() => {
              setTab(item);
              if (item === "messages") void loadMessages();
              if (item === "analytics") void loadAnalytics();
            }}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "pages" ? (
        <article className="website-panel">
          <div className="website-toggle-grid">
            {WEBSITE_PAGE_KEYS.map((key) => (
              <label key={key} className="website-toggle">
                <input
                  type="checkbox"
                  checked={enabledPages[key] !== false}
                  onChange={(event) => {
                    setEnabledPages((current) => ({ ...current, [key]: event.target.checked }));
                    queueAutosave();
                  }}
                />
                <span>{WEBSITE_PAGE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </article>
      ) : null}

      {tab === "privacy" ? (
        <article className="website-panel">
          <div className="website-toggle-grid">
            {[
              ["showEmail", "Show email"],
              ["showLocation", "Show location"],
              ["showPhone", "Show phone"],
              ["showReferences", "Show references"],
              ["showOrcid", "Show ORCID"],
              ["showGoogleScholar", "Show Google Scholar"],
              ["showLinkedIn", "Show LinkedIn"]
            ].map(([key, label]) => (
              <label key={key} className="website-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(fieldVisibility[key])}
                  onChange={(event) => {
                    setFieldVisibility((current) => ({ ...current, [key]: event.target.checked }));
                    queueAutosave();
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </article>
      ) : null}

      {tab === "settings" ? (
        <article className="website-panel website-settings-panel">
          <label className="website-field">
            <span>Public headline</span>
            <input
              value={headline}
              onChange={(event) => {
                setHeadline(event.target.value);
                queueAutosave();
              }}
              placeholder="Professor of Materials Science"
            />
          </label>
          <label className="website-field">
            <span>Home introduction</span>
            <textarea
              value={homeIntro}
              onChange={(event) => {
                setHomeIntro(event.target.value);
                queueAutosave();
              }}
              rows={3}
              placeholder="Short public introduction"
            />
          </label>
          <label className="website-field">
            <span>About narrative</span>
            <textarea
              value={aboutNarrative}
              onChange={(event) => {
                setAboutNarrative(event.target.value);
                queueAutosave();
              }}
              rows={4}
              placeholder="Optional longer about text"
            />
          </label>
          <label className="website-field">
            <span>Research narrative</span>
            <textarea
              value={researchNarrative}
              onChange={(event) => {
                setResearchNarrative(event.target.value);
                queueAutosave();
              }}
              rows={4}
              placeholder="Optional research overview"
            />
          </label>
          <label className="website-field">
            <span>Selected CV document</span>
            <select
              value={sourceCvDocumentId}
              onChange={(event) => {
                setSourceCvDocumentId(event.target.value);
                queueAutosave();
              }}
            >
              <option value="">None selected</option>
              {data.cvDocuments.map((document) => (
                <option key={document.id} value={document.id}>
                  {document.title}
                </option>
              ))}
            </select>
          </label>
          <label className="website-toggle">
            <input
              type="checkbox"
              checked={contactFormEnabled}
              onChange={(event) => {
                setContactFormEnabled(event.target.checked);
                queueAutosave();
              }}
            />
            <span>Enable contact form</span>
          </label>
          <label className="website-toggle">
            <input
              type="checkbox"
              checked={searchIndexingEnabled}
              onChange={(event) => {
                setSearchIndexingEnabled(event.target.checked);
                queueAutosave();
              }}
            />
            <span>Allow search indexing after publish</span>
          </label>
        </article>
      ) : null}

      {tab === "messages" ? (
        <article className="website-panel">
          <div className="website-panel-header">
            <h3>Contact inbox</h3>
            <button className="secondary-action" type="button" disabled={messagesLoading} onClick={() => void loadMessages()}>
              {messagesLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {messages.length === 0 ? (
            <p className="muted-text">No contact messages yet. Messages from your public contact form appear here.</p>
          ) : (
            <ul className="website-message-list">
              {messages.map((message) => (
                <li key={message.id} className={message.status === "unread" ? "is-unread" : ""}>
                  <div className="website-message-meta">
                    <strong>
                      {message.visitorName} &lt;{message.visitorEmail}&gt;
                    </strong>
                    <span>{new Date(message.createdAt).toLocaleString()}</span>
                  </div>
                  {message.subject ? <p className="website-message-subject">{message.subject}</p> : null}
                  <p className="website-message-body">{message.message}</p>
                  {message.status === "unread" ? (
                    <button className="secondary-action" type="button" onClick={() => void markMessageRead(message.id)}>
                      Mark read
                    </button>
                  ) : (
                    <span className="website-save-meta">Read</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </article>
      ) : null}

      {tab === "analytics" ? (
        <article className="website-panel">
          <div className="website-panel-header">
            <h3>Privacy-safe views</h3>
            <button className="secondary-action" type="button" disabled={analyticsLoading} onClick={() => void loadAnalytics()}>
              {analyticsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {!analytics ? (
            <p className="muted-text">Load analytics to see published page views (no visitor identity stored).</p>
          ) : (
            <>
              <p className="website-save-meta">
                {analytics.totalViews} total views in the last {analytics.days} days
              </p>
              {analytics.pages.length === 0 ? (
                <p className="muted-text">No page views recorded yet for your published site.</p>
              ) : (
                <ul className="website-analytics-list">
                  {analytics.pages.map((page) => (
                    <li key={page.pagePath}>
                      <strong>{page.pagePath}</strong>
                      <span>{page.views} views</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </article>
      ) : null}
    </section>
  );
}

function subscribeToStaticDom() {
  return () => {};
}
