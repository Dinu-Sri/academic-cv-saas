"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Globe2, LoaderCircle } from "lucide-react";
import type { AcademicCategoryKey, WebsiteComposition } from "@/lib/website/composition-types";
import type { WebsitePageKey } from "@/lib/website/constants";

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
  preview?: {
    composition: WebsiteComposition;
    showPlatformBranding?: boolean;
  };
  entitlements?: {
    planKey: string;
    planName: string;
    isPaid: boolean;
    canDownloadPdf: boolean;
    showPlatformBranding: boolean;
    canConnectCustomDomain: boolean;
    canEnablePublicCvDownload: boolean;
  };
};

type Props = {
  initialData: WebsiteWorkspaceData;
};

type TabKey = "overview" | "pages" | "style" | "privacy" | "messages" | "analytics";

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
  const [tab, setTab] = useState<TabKey>("overview");
  const [headline, setHeadline] = useState(initialData.website?.headlineOverride || "");
  const [homeIntro, setHomeIntro] = useState(initialData.config?.pageContent.homeIntro || "");
  const [researchNarrative, setResearchNarrative] = useState(initialData.config?.pageContent.researchNarrative || "");
  const [journeyNarrative, setJourneyNarrative] = useState(initialData.config?.pageContent.journeyNarrative || "");
  const [contributionsNarrative, setContributionsNarrative] = useState(initialData.config?.pageContent.contributionsNarrative || "");
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
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const statusSlot = useSyncExternalStore(
    subscribeToStaticDom,
    () => document.getElementById("website-status-slot"),
    () => null
  );
  const saveTimerRef = useRef<number | null>(null);
  const draftRef = useRef({
    headline,
    homeIntro,
    researchNarrative,
    journeyNarrative,
    contributionsNarrative,
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
      researchNarrative,
      journeyNarrative,
      contributionsNarrative,
      enabledPages,
      fieldVisibility,
      sourceCvDocumentId,
      contactFormEnabled,
      searchIndexingEnabled,
      version: data.website?.version ?? draftRef.current.version
    };
  }, [
    contactFormEnabled,
    contributionsNarrative,
    data.website?.version,
    enabledPages,
    fieldVisibility,
    headline,
    homeIntro,
    journeyNarrative,
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
            researchNarrative: draft.researchNarrative,
            journeyNarrative: draft.journeyNarrative,
            contributionsNarrative: draft.contributionsNarrative
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
      setResearchNarrative(result.config?.pageContent.researchNarrative || "");
      setJourneyNarrative(result.config?.pageContent.journeyNarrative || "");
      setContributionsNarrative(result.config?.pageContent.contributionsNarrative || "");
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

  async function loadAnalytics(days = analyticsDays) {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`/api/website/analytics?days=${days}`, { credentials: "include" });
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
          <div className="website-status-panel website-editor-sidebar">
            <div>
              <span className="section-label">Website</span>
              <WebsiteSectionNav
                active={tab}
                onSelect={(item) => {
                  setTab(item);
                  if (item === "messages") void loadMessages();
                  if (item === "analytics") void loadAnalytics();
                }}
              />
            </div>
            <div className="website-status-footer">
              <div className="website-publish-summary">
                <span className={`website-live-dot ${data.website?.status === "published" ? "is-live" : ""}`} />
                <strong>{data.website?.status === "published" ? "Published" : "Draft"}</strong>
                <span>{data.readiness.score}% ready</span>
              </div>
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
                  href={data.website.publicUrl || `https://${data.website.username}.${data.rootDomain}`}
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

      <div className="website-mobile-tabs">
        <WebsiteSectionNav
          active={tab}
          onSelect={(item) => {
            setTab(item);
            if (item === "messages") void loadMessages();
            if (item === "analytics") void loadAnalytics();
          }}
        />
      </div>

      {tab === "overview" ? (
        <article className="website-panel website-overview-panel website-editor-block">
          <div className="website-block-preview website-identity-preview">
            <span>Public identity</span>
            <strong>{headline || data.profile.headline || data.profile.displayName}</strong>
            <small>{data.profile.affiliation || hostPreview}</small>
          </div>
          <div className="website-block-controls">
            <label className="website-field">
              <span>Headline</span>
              <input value={headline} onChange={(event) => { setHeadline(event.target.value); queueAutosave(); }} placeholder="Professor of Materials Science" />
            </label>
            <label className="website-field">
              <span>Introduction</span>
              <textarea value={homeIntro} onChange={(event) => { setHomeIntro(event.target.value); queueAutosave(); }} rows={3} placeholder="Your academic work and focus" />
            </label>
            <label className="website-field">
              <span>Public CV</span>
              <select value={sourceCvDocumentId} onChange={(event) => { setSourceCvDocumentId(event.target.value); queueAutosave(); }}>
                <option value="">None selected</option>
                {data.cvDocuments.map((document) => <option key={document.id} value={document.id}>{document.title}</option>)}
              </select>
            </label>
            <div className="website-inline-toggles">
              <label className="website-toggle"><input type="checkbox" checked={contactFormEnabled} onChange={(event) => { setContactFormEnabled(event.target.checked); queueAutosave(); }} /><span>Contact page</span></label>
              <label className="website-toggle"><input type="checkbox" checked={searchIndexingEnabled} onChange={(event) => { setSearchIndexingEnabled(event.target.checked); queueAutosave(); }} /><span>Search indexing</span></label>
            </div>
          </div>
        </article>
      ) : null}

      {tab === "pages" ? (
        <article className="website-panel website-pages-panel website-editor-block">
          <div className="website-block-preview website-pages-preview">
            <span>Adaptive structure</span>
            <strong>{data.preview?.composition.pages.length || 0} public pages</strong>
            <small>{data.preview?.composition.mode || "adaptive"} composition</small>
          </div>
          <div className="website-page-card-grid">
            {(["research", "journey", "contributions"] as AcademicCategoryKey[]).map((key) => {
              const category = data.preview?.composition.categories[key];
              const reason = category?.reason || "empty";
              return (
                <section key={key} className={`website-page-card is-${category?.strength || "empty"}`}>
                  <div className="website-page-card-head">
                    <div><span className="website-page-state">{category?.strength || "Empty"}</span><h4>{category?.label || pageLabel(key)}</h4></div>
                    <label className="website-page-switch">
                      <input type="checkbox" checked={enabledPages[key] !== false} onChange={(event) => { setEnabledPages((current) => ({ ...current, [key]: event.target.checked })); queueAutosave(); }} />
                      <span>{enabledPages[key] !== false ? "Included" : "Hidden"}</span>
                    </label>
                  </div>
                  <p className="website-page-reason">{compositionReason(reason)}</p>
                  {category?.modules?.length ? <ul className="website-page-modules">{category.modules.map((module) => <li key={module.key}>{module.label}<span>{module.entries.length}</span></li>)}</ul> : <p className="website-page-empty">Complete related profile sections to strengthen this category.</p>}
                  <label className="website-field">
                    <span>Introduction</span>
                    <textarea
                      rows={3}
                      value={key === "research" ? researchNarrative : key === "journey" ? journeyNarrative : contributionsNarrative}
                      onChange={(event) => {
                        if (key === "research") setResearchNarrative(event.target.value);
                        else if (key === "journey") setJourneyNarrative(event.target.value);
                        else setContributionsNarrative(event.target.value);
                        queueAutosave();
                      }}
                      placeholder={`Introduce your ${pageLabel(key).toLowerCase()}`}
                    />
                  </label>
                </section>
              );
            })}
          </div>
        </article>
      ) : null}

      {tab === "style" ? (
        <article className="website-panel website-style-panel website-editor-block">
          <div className="website-style-swatch" aria-hidden="true"><span>Quiet</span><strong>Authority</strong><i>Academic editorial</i></div>
          <div className="website-style-copy"><span className="section-label">Visual system</span><h3>Quiet Authority</h3><p>Warm paper, scholarly type, mineral blue, and oxidized copper.</p><ul className="website-style-features"><li>Responsive</li><li>Light and dark</li><li>Print ready</li></ul></div>
        </article>
      ) : null}

      {tab === "privacy" ? (
        <article className="website-panel website-editor-block website-privacy-panel">
          <div className="website-block-preview website-privacy-preview">
            <span>Public details</span>
            <strong>{Object.values(fieldVisibility).filter(Boolean).length} visible</strong>
            <small>You control every personal field.</small>
          </div>
          <div className="website-block-controls website-toggle-grid">
            {[
              ["showEmail", "Show email"],
              ["showLocation", "Show location"],
              ["showPhone", "Show phone"],
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
          <label className="website-toggle website-cv-permission">
            <input
              type="checkbox"
              checked={Boolean(fieldVisibility.showCvDownload) && Boolean(data.entitlements?.canEnablePublicCvDownload)}
              disabled={!sourceCvDocumentId || !data.entitlements?.canEnablePublicCvDownload}
              onChange={(event) => {
                setFieldVisibility((current) => ({ ...current, showCvDownload: event.target.checked }));
                queueAutosave();
              }}
            />
            <span>Allow visitors to download the selected CV</span>
          </label>
          {!sourceCvDocumentId ? <p className="website-field-hint">Select a CV on Overview before enabling public download.</p> : null}
          {!data.entitlements?.canEnablePublicCvDownload ? (
            <p className="website-field-hint">
              Public CV download needs PDF Pass or Scholar Annual.{" "}
              <a href="/billing">Unlock on Billing</a>
            </p>
          ) : null}

          <div className="website-domain-card">
            <span className="section-label">Custom domain</span>
            <strong>{data.entitlements?.canConnectCustomDomain ? "Available on your plan" : "Scholar Annual"}</strong>
            <p>
              {data.entitlements?.canConnectCustomDomain
                ? "Connect your own domain (e.g. name.edu) from settings — DNS setup ships with the payment release."
                : "Free and PDF Pass use your CVScholar subdomain. Scholar Annual removes the platform badge and unlocks custom domain connect."}
            </p>
            {!data.entitlements?.canConnectCustomDomain ? (
              <a className="secondary-action compact-action" href="/billing">
                View Scholar Annual
              </a>
            ) : (
              <p className="website-field-hint">Domain connect UI is prepared; final DNS wiring ships with payments.</p>
            )}
            {data.entitlements?.showPlatformBranding !== false ? (
              <p className="website-field-hint">Live free/pass sites show a small “Academic website built with CVScholar” bar.</p>
            ) : (
              <p className="website-field-hint">Platform branding is off while Scholar Annual is active.</p>
            )}
          </div>
        </article>
      ) : null}

      {tab === "messages" ? (
        <article className="website-panel website-messages-panel">
          <div className="website-panel-header">
            <h3>Inbox</h3>
            <button className="secondary-action" type="button" disabled={messagesLoading} onClick={() => void loadMessages()}>
              {messagesLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {messages.length === 0 ? (
            <div className="website-empty-state"><strong>No messages yet</strong><span>New website enquiries will appear here.</span></div>
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
        <article className="website-panel website-analytics-panel">
          <div className="website-analytics-toolbar">
            <div className="website-range-control" aria-label="Analytics period">
              {[7, 14, 30, 90].map((days) => (
                <button key={days} type="button" className={analyticsDays === days ? "is-active" : ""} onClick={() => { setAnalyticsDays(days); void loadAnalytics(days); }}>
                  {days}d
                </button>
              ))}
            </div>
            <button className="secondary-action" type="button" disabled={analyticsLoading} onClick={() => void loadAnalytics()}>
              {analyticsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
          {!analytics ? (
            <div className="website-empty-state"><strong>No analytics loaded</strong><span>Only anonymous page counts are collected.</span></div>
          ) : (
            <AnalyticsDashboard analytics={analytics} />
          )}
        </article>
      ) : null}
    </section>
  );
}

function subscribeToStaticDom() {
  return () => {};
}

const WEBSITE_TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "pages", label: "Pages" },
  { key: "style", label: "Style" },
  { key: "privacy", label: "Privacy" },
  { key: "messages", label: "Messages" },
  { key: "analytics", label: "Analytics" }
];

function WebsiteSectionNav({ active, onSelect }: { active: TabKey; onSelect: (tab: TabKey) => void }) {
  return (
    <nav className="website-section-nav" aria-label="Website settings">
      {WEBSITE_TABS.map((item) => (
        <button key={item.key} className={active === item.key ? "is-active" : ""} type="button" onClick={() => onSelect(item.key)}>
          <span>{item.label}</span>
          <span aria-hidden="true">&#8594;</span>
        </button>
      ))}
    </nav>
  );
}

function AnalyticsDashboard({ analytics }: { analytics: AnalyticsSummary }) {
  const daily = aggregateDailyViews(analytics);
  const maxViews = Math.max(1, ...daily.map((point) => point.views));
  const points = daily.map((point, index) => {
    const x = daily.length === 1 ? 50 : (index / (daily.length - 1)) * 100;
    const y = 92 - (point.views / maxViews) * 78;
    return `${x},${y}`;
  }).join(" ");
  const activeDays = daily.filter((point) => point.views > 0).length;
  const topPage = analytics.pages[0];

  return (
    <div className="website-analytics-dashboard">
      <dl className="website-analytics-stats">
        <div><dt>Views</dt><dd>{analytics.totalViews}</dd></div>
        <div><dt>Daily average</dt><dd>{(analytics.totalViews / analytics.days).toFixed(1)}</dd></div>
        <div><dt>Active days</dt><dd>{activeDays}</dd></div>
        <div><dt>Top page</dt><dd className="is-path">{friendlyPagePath(topPage?.pagePath || "/")}</dd></div>
      </dl>
      <section className="website-chart-card">
        <div className="website-chart-heading"><strong>Views over time</strong><span>Last {analytics.days} days</span></div>
        <div className="website-line-chart" role="img" aria-label={`${analytics.totalViews} page views over ${analytics.days} days`}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="website-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity="0.2"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
            <line x1="0" y1="92" x2="100" y2="92" className="website-chart-axis" />
            <polygon points={`0,92 ${points} 100,92`} fill="url(#website-chart-fill)" />
            <polyline points={points} fill="none" vectorEffect="non-scaling-stroke" />
          </svg>
          <span>{daily[0]?.label}</span><span>{daily[daily.length - 1]?.label}</span>
        </div>
      </section>
      <section className="website-chart-card">
        <div className="website-chart-heading"><strong>Top pages</strong><span>Views</span></div>
        {analytics.pages.length ? (
          <ol className="website-page-bars">
            {analytics.pages.slice(0, 6).map((page) => (
              <li key={page.pagePath}>
                <div><span>{friendlyPagePath(page.pagePath)}</span><strong>{page.views}</strong></div>
                <i style={{ width: `${Math.max(4, (page.views / Math.max(1, topPage.views)) * 100)}%` }} />
              </li>
            ))}
          </ol>
        ) : <div className="website-empty-state is-compact"><strong>No views yet</strong><span>Charts will populate after publication.</span></div>}
      </section>
    </div>
  );
}

function aggregateDailyViews(analytics: AnalyticsSummary) {
  const byDate = new Map<string, number>();
  for (const point of analytics.series) byDate.set(point.date, (byDate.get(point.date) || 0) + point.views);
  const points: { date: string; label: string; views: number }[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let offset = analytics.days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - offset);
    const key = date.toISOString().slice(0, 10);
    points.push({ date: key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" }), views: byDate.get(key) || 0 });
  }
  return points;
}

function friendlyPagePath(path: string) {
  if (!path || path === "/") return "Home";
  return path.replace(/^\//, "").split("/")[0].replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pageLabel(key: AcademicCategoryKey) {
  if (key === "journey") return "Academic Journey";
  return key[0].toUpperCase() + key.slice(1);
}

function compositionReason(reason: string) {
  if (reason === "qualified") return "This category has enough varied content to become a public page.";
  if (reason === "merged_into_journey") return "This content will appear within Academic Journey so the site stays balanced.";
  if (reason === "merged_into_home") return "This content will appear as a curated Home section until the category grows.";
  if (reason === "hidden_by_user") return "The page is hidden; useful content is placed elsewhere when possible.";
  return "No publishable content is available for this category yet.";
}
