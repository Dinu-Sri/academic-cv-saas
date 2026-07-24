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
    customDomain?: string | null;
  };
  domain?: {
    enabled: boolean;
    cnameTarget: string;
    cloudflareConfigured: boolean;
    domains: CustomDomainRow[];
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

type CustomDomainRow = {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  verificationToken: string;
  verifiedAt: string | null;
  isPrimary: boolean;
  redirectSubdomain: boolean;
  lastCheckedAt: string | null;
  lastError: string;
  dns: {
    cnameHost: string;
    cnameTarget: string;
    txtHost: string;
    txtValue: string;
  };
  publicUrl: string;
  cloudflareConfigured: boolean;
};

type TabKey = "overview" | "pages" | "style" | "privacy" | "domain" | "messages" | "analytics";

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
  const [domainHostname, setDomainHostname] = useState("");
  const [domainBusy, setDomainBusy] = useState(false);
  const [domainError, setDomainError] = useState("");
  const [domainMessage, setDomainMessage] = useState("");
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
        <div className="website-overview-simple">
          <SiteStatusCard data={data} hostPreview={hostPreview} />

          <article className="website-panel website-editor-block">
            <header className="website-simple-head">
              <h3>Public identity</h3>
              <p>What visitors see first on your home page.</p>
            </header>
            <div className="website-block-controls">
              <label className="website-field">
                <span>Headline</span>
                <input
                  value={headline}
                  onChange={(event) => {
                    setHeadline(event.target.value);
                    queueAutosave();
                  }}
                  placeholder="Lecturer · Materials Science"
                />
              </label>
              <label className="website-field">
                <span>Introduction</span>
                <textarea
                  value={homeIntro}
                  onChange={(event) => {
                    setHomeIntro(event.target.value);
                    queueAutosave();
                  }}
                  rows={3}
                  placeholder="A short summary of your work"
                />
              </label>
              <label className="website-field">
                <span>CV download (optional)</span>
                <select
                  value={sourceCvDocumentId}
                  onChange={(event) => {
                    setSourceCvDocumentId(event.target.value);
                    queueAutosave();
                  }}
                >
                  <option value="">None</option>
                  {data.cvDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="website-inline-toggles">
                <label className="website-toggle">
                  <input
                    type="checkbox"
                    checked={contactFormEnabled}
                    onChange={(event) => {
                      setContactFormEnabled(event.target.checked);
                      queueAutosave();
                    }}
                  />
                  <span>Contact form</span>
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
                  <span>Search engines</span>
                </label>
              </div>
            </div>
          </article>
        </div>
      ) : null}

      {tab === "pages" ? (
        <article className="website-panel website-pages-panel website-editor-block">
          <header className="website-simple-head">
            <h3>Site pages</h3>
            <p>Pages appear only when your CV has enough content. Empty pages are never shown to visitors.</p>
          </header>
          <ul className="website-simple-page-list">
            {(data.preview?.composition.navigation || ["home", "contact"]).map((key) => (
              <li key={key}>
                <strong>{navPageLabel(key)}</strong>
                <span>On your site</span>
              </li>
            ))}
          </ul>
          <div className="website-simple-category-list">
            {(["research", "journey", "contributions"] as AcademicCategoryKey[]).map((key) => {
              const category = data.preview?.composition.categories[key];
              const reason = category?.reason || "empty";
              const status = pageStatusLabel(reason, enabledPages[key] !== false);
              return (
                <section key={key} className="website-simple-category">
                  <div className="website-simple-category-head">
                    <div>
                      <h4>{category?.label || pageLabel(key)}</h4>
                      <p>{status}</p>
                    </div>
                    <label className="website-toggle">
                      <input
                        type="checkbox"
                        checked={enabledPages[key] !== false}
                        onChange={(event) => {
                          setEnabledPages((current) => ({ ...current, [key]: event.target.checked }));
                          queueAutosave();
                        }}
                      />
                      <span>Allow page</span>
                    </label>
                  </div>
                  {category?.modules?.length ? (
                    <p className="website-simple-modules">
                      {category.modules.map((module) => `${module.label} (${module.entries.length})`).join(" · ")}
                    </p>
                  ) : (
                    <p className="website-simple-modules is-muted">Add related CV sections to fill this area.</p>
                  )}
                  <label className="website-field">
                    <span>Optional intro</span>
                    <textarea
                      rows={2}
                      value={
                        key === "research"
                          ? researchNarrative
                          : key === "journey"
                            ? journeyNarrative
                            : contributionsNarrative
                      }
                      onChange={(event) => {
                        if (key === "research") setResearchNarrative(event.target.value);
                        else if (key === "journey") setJourneyNarrative(event.target.value);
                        else setContributionsNarrative(event.target.value);
                        queueAutosave();
                      }}
                      placeholder="Optional short paragraph"
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
          <header className="website-simple-head">
            <h3>Look &amp; feel</h3>
            <p>Simple academic layout. Visitors can switch light or dark mode on the site.</p>
          </header>
          <ul className="website-simple-features">
            <li>Clear home snapshot</li>
            <li>Pages grow with your CV</li>
            <li>Light and dark mode</li>
          </ul>
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
            <strong>
              {data.website?.customDomain
                ? data.website.customDomain
                : data.entitlements?.canConnectCustomDomain
                  ? "Connect your domain"
                  : "Scholar Annual"}
            </strong>
            <p>
              {data.entitlements?.canConnectCustomDomain
                ? "Point your own domain (e.g. www.yourname.edu) at your Scholar site."
                : "Custom domains unlock on Scholar Annual. Free and PDF Pass use your CVScholar subdomain."}
            </p>
            <button className="secondary-action compact-action" type="button" onClick={() => setTab("domain")}>
              Open Domain settings
            </button>
            {data.entitlements?.showPlatformBranding !== false ? (
              <p className="website-field-hint">Live free/pass sites show a small “Academic website built with CVScholar” bar.</p>
            ) : (
              <p className="website-field-hint">Platform branding is off while Scholar Annual is active.</p>
            )}
          </div>
        </article>
      ) : null}

      {tab === "domain" ? (
        <DomainPanel
          data={data}
          domainHostname={domainHostname}
          setDomainHostname={setDomainHostname}
          domainBusy={domainBusy}
          domainError={domainError}
          domainMessage={domainMessage}
          setDomainError={setDomainError}
          setDomainMessage={setDomainMessage}
          setDomainBusy={setDomainBusy}
          onRefreshWorkspace={async () => {
            const response = await fetch("/api/website", { credentials: "include" });
            if (!response.ok) return;
            const payload = (await response.json()) as WebsiteWorkspaceData;
            setData(payload);
          }}
        />
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
  { key: "domain", label: "Domain" },
  { key: "messages", label: "Messages" },
  { key: "analytics", label: "Analytics" }
];

function domainStatusLabel(status: string) {
  switch (status) {
    case "active":
      return "Active";
    case "pending_dns":
      return "Waiting for DNS";
    case "pending_ssl":
      return "Provisioning SSL";
    case "failed":
      return "Failed";
    case "disabled":
      return "Paused";
    default:
      return status;
  }
}

function DomainPanel({
  data,
  domainHostname,
  setDomainHostname,
  domainBusy,
  domainError,
  domainMessage,
  setDomainError,
  setDomainMessage,
  setDomainBusy,
  onRefreshWorkspace
}: {
  data: WebsiteWorkspaceData;
  domainHostname: string;
  setDomainHostname: (v: string) => void;
  domainBusy: boolean;
  domainError: string;
  domainMessage: string;
  setDomainError: (v: string) => void;
  setDomainMessage: (v: string) => void;
  setDomainBusy: (v: boolean) => void;
  onRefreshWorkspace: () => Promise<void>;
}) {
  const domains = data.domain?.domains ?? [];
  const canConnect = Boolean(data.entitlements?.canConnectCustomDomain);
  const cnameTarget = data.domain?.cnameTarget || `sites.${data.rootDomain}`;
  const active = domains.find((d) => d.status === "active");
  const current = domains[0] || null;

  async function addDomain() {
    setDomainBusy(true);
    setDomainError("");
    setDomainMessage("");
    try {
      const response = await fetch("/api/website/domain", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: domainHostname })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not add domain.");
      setDomainMessage("Domain saved. Add the DNS records below, then click Verify.");
      setDomainHostname("");
      await onRefreshWorkspace();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Could not add domain.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function verifyDomain(domainId: string) {
    setDomainBusy(true);
    setDomainError("");
    setDomainMessage("");
    try {
      const response = await fetch("/api/website/domain", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action: "verify" })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Verification failed.");
      const domain = body.domain as CustomDomainRow;
      setDomainMessage(
        domain.status === "active"
          ? `Domain is active: ${domain.publicUrl}`
          : domain.lastError || `Status: ${domainStatusLabel(domain.status)}`
      );
      await onRefreshWorkspace();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function removeDomain(domainId: string) {
    if (!window.confirm("Remove this custom domain?")) return;
    setDomainBusy(true);
    setDomainError("");
    try {
      const response = await fetch(`/api/website/domain?domainId=${encodeURIComponent(domainId)}`, {
        method: "DELETE",
        credentials: "include"
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not remove domain.");
      setDomainMessage("Domain removed.");
      await onRefreshWorkspace();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Could not remove domain.");
    } finally {
      setDomainBusy(false);
    }
  }

  async function toggleRedirect(domainId: string, redirectSubdomain: boolean) {
    setDomainBusy(true);
    try {
      const response = await fetch("/api/website/domain", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domainId, action: "redirect", redirectSubdomain })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not update redirect.");
      await onRefreshWorkspace();
    } catch (err) {
      setDomainError(err instanceof Error ? err.message : "Could not update redirect.");
    } finally {
      setDomainBusy(false);
    }
  }

  return (
    <article className="website-panel website-domain-panel">
      <div className="website-panel-header">
        <div>
          <h3>Custom domain</h3>
          <p className="muted-text">
            Scholar subdomain stays available:{" "}
            <strong>
              {data.website ? `${data.website.username}.${data.rootDomain}` : `username.${data.rootDomain}`}
            </strong>
          </p>
        </div>
      </div>

      {!canConnect ? (
        <div className="website-domain-card">
          <strong>Scholar Annual required</strong>
          <p>Connect your own domain (e.g. www.yourname.edu) on the Scholar Annual plan.</p>
          <a className="primary-action compact-action" href="/billing">
            View Scholar Annual
          </a>
        </div>
      ) : !data.website ? (
        <div className="website-empty-state">
          <strong>Create your website first</strong>
          <span>Choose a username on Overview, then return here to connect a domain.</span>
        </div>
      ) : (
        <>
          {domainError ? <p className="form-error">{domainError}</p> : null}
          {domainMessage ? <p className="website-field-hint">{domainMessage}</p> : null}

          {!current ? (
            <div className="website-domain-form">
              <label>
                <span>Hostname</span>
                <input
                  value={domainHostname}
                  onChange={(e) => setDomainHostname(e.target.value)}
                  placeholder="www.yourname.edu"
                  autoComplete="off"
                />
              </label>
              <p className="website-field-hint">
                Prefer a hostname such as <code>www.</code> — apex domains need ALIAS/ANAME support at your DNS host.
              </p>
              <button
                className="primary-action"
                type="button"
                disabled={domainBusy || !domainHostname.trim()}
                onClick={() => void addDomain()}
              >
                {domainBusy ? "Saving…" : "Add domain"}
              </button>
            </div>
          ) : (
            <div className="website-domain-active-card">
              <div className="website-domain-status-row">
                <div>
                  <span className="section-label">Connected hostname</span>
                  <strong>{current.hostname}</strong>
                  <p className={`website-domain-status status-${current.status}`}>
                    {domainStatusLabel(current.status)}
                    {current.sslStatus && current.sslStatus !== "skipped"
                      ? ` · SSL ${current.sslStatus}`
                      : current.sslStatus === "skipped"
                        ? " · SSL via your DNS/proxy"
                        : ""}
                  </p>
                </div>
                {current.status === "active" ? (
                  <a className="secondary-action compact-action" href={current.publicUrl} target="_blank" rel="noreferrer">
                    Open site
                  </a>
                ) : null}
              </div>

              {current.lastError ? <p className="form-error">{current.lastError}</p> : null}

              <div className="website-dns-table-wrap">
                <h4>DNS records to add</h4>
                <table className="website-dns-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Name / Host</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>CNAME</td>
                      <td>
                        <code>{current.dns.cnameHost}</code>
                      </td>
                      <td>
                        <code>{current.dns.cnameTarget || cnameTarget}</code>
                      </td>
                    </tr>
                    <tr>
                      <td>TXT</td>
                      <td>
                        <code>{current.dns.txtHost}</code>
                      </td>
                      <td>
                        <code>{current.dns.txtValue}</code>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p className="website-field-hint">
                  Point the CNAME at <code>{cnameTarget}</code>. DNS propagation can take a few minutes to 48 hours.
                  {data.domain?.cloudflareConfigured
                    ? " SSL certificates are provisioned automatically after DNS verifies."
                    : " After DNS verifies, traffic is accepted; ensure TLS is handled by Cloudflare or your DNS host if SSL auto-provision is not configured."}
                </p>
              </div>

              <div className="website-domain-actions">
                <button
                  className="primary-action"
                  type="button"
                  disabled={domainBusy}
                  onClick={() => void verifyDomain(current.id)}
                >
                  {domainBusy ? "Checking…" : "Verify DNS"}
                </button>
                <button
                  className="secondary-action"
                  type="button"
                  disabled={domainBusy}
                  onClick={() => void removeDomain(current.id)}
                >
                  Remove domain
                </button>
              </div>

              {current.status === "active" ? (
                <label className="website-toggle">
                  <input
                    type="checkbox"
                    checked={current.redirectSubdomain}
                    disabled={domainBusy}
                    onChange={(e) => void toggleRedirect(current.id, e.target.checked)}
                  />
                  <span>
                    Prefer custom domain in your settings (subdomain{" "}
                    <code>
                      {data.website.username}.{data.rootDomain}
                    </code>{" "}
                    remains available)
                  </span>
                </label>
              ) : null}

              {active ? (
                <p className="website-field-hint">
                  Live custom URL:{" "}
                  <a href={active.publicUrl} target="_blank" rel="noreferrer">
                    {active.publicUrl}
                  </a>
                </p>
              ) : null}
            </div>
          )}
        </>
      )}
    </article>
  );
}

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

function navPageLabel(key: string) {
  if (key === "home") return "Home";
  if (key === "contact") return "Contact";
  if (key === "journey") return "Academic Journey";
  if (key === "research") return "Research";
  if (key === "contributions") return "Contributions";
  return key;
}

function pageStatusLabel(reason: string, allowed: boolean) {
  if (!allowed) return "Hidden by you";
  if (reason === "qualified") return "Own page on your site";
  if (reason === "merged_into_journey") return "Shown inside Academic Journey";
  if (reason === "merged_into_home") return "Shown on Home";
  if (reason === "hidden_by_user") return "Hidden by you";
  return "Not enough content yet";
}

function compositionModeLabel(mode?: string) {
  if (mode === "sparse") return "Simple site";
  if (mode === "rich") return "Full site";
  if (mode === "developing") return "Growing site";
  return "Adaptive site";
}

function compositionModeHint(mode?: string) {
  if (mode === "sparse") return "Home and Contact only. Extra CV sections appear on Home.";
  if (mode === "rich") return "Research, Journey, and Contributions each have their own page.";
  if (mode === "developing") return "Some category pages are live; the rest stays on Home until content grows.";
  return "Your public pages update automatically as you add CV content.";
}

function SiteStatusCard({
  data,
  hostPreview
}: {
  data: WebsiteWorkspaceData;
  hostPreview: string;
}) {
  const mode = data.preview?.composition.mode;
  const nav = data.preview?.composition.navigation || [];
  const missing = data.readiness.missingRequired || [];
  const requiredItems = data.readiness.items.filter((item) => item.category === "required");

  return (
    <article className="website-panel website-editor-block website-status-card">
      <header className="website-simple-head">
        <h3>Your site</h3>
        <p>
          {data.website?.status === "published" ? "Live" : "Draft"} · {hostPreview}
        </p>
      </header>

      <div className="website-status-pills">
        <span className={`website-status-pill ${data.readiness.canPublish ? "is-ready" : "is-blocked"}`}>
          {data.readiness.canPublish ? "Ready to publish" : "Needs a few details"}
        </span>
        <span className="website-status-pill is-mode">{compositionModeLabel(mode)}</span>
      </div>
      <p className="website-status-hint">{compositionModeHint(mode)}</p>

      <div className="website-status-grid">
        <section>
          <h4>Visitor pages</h4>
          {nav.length ? (
            <ul className="website-simple-page-list is-compact">
              {nav.map((key) => (
                <li key={key}>
                  <strong>{navPageLabel(key)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="website-status-hint">Home will appear once the draft is ready.</p>
          )}
        </section>
        <section>
          <h4>Before publish</h4>
          <ul className="website-readiness-list">
            {requiredItems.map((item) => (
              <li key={item.key} className={item.status === "complete" ? "is-done" : "is-missing"}>
                <span aria-hidden="true">{item.status === "complete" ? "✓" : "·"}</span>
                <span>
                  <strong>{item.label}</strong>
                  {item.status !== "complete" ? <small>{item.message}</small> : null}
                </span>
              </li>
            ))}
          </ul>
          {missing.length === 0 ? (
            <p className="website-status-hint is-ok">All required items are complete.</p>
          ) : null}
        </section>
      </div>
    </article>
  );
}
