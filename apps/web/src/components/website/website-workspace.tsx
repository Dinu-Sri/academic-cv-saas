"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Globe2, RefreshCw } from "lucide-react";
import { ModernScholarPreview } from "@/components/website/modern-scholar-preview";
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
  preview?: Parameters<typeof ModernScholarPreview>[0]["model"];
};

type Props = {
  initialData: WebsiteWorkspaceData;
};

export function WebsiteWorkspace({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [username, setUsername] = useState(initialData.website?.username || "");
  const [usernameStatus, setUsernameStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"content" | "pages" | "privacy" | "settings">("content");
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

  useEffect(() => {
    if (data.state === "not_created" || !username.trim()) return;
    const handle = window.setTimeout(async () => {
      const response = await fetch(`/api/website/username/check?value=${encodeURIComponent(username)}`);
      const result = await response.json();
      if (!response.ok) return;
      if (!result.valid) setUsernameStatus(result.reason === "reserved" ? "Reserved name" : "Invalid format");
      else if (!result.available) setUsernameStatus("Already taken");
      else setUsernameStatus(`Available: ${result.normalized}.${data.rootDomain}`);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [username, data.state, data.rootDomain]);

  const hostPreview = useMemo(() => {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9-]/g, "") || "your-name";
    return `${clean}.${data.rootDomain}`;
  }, [username, data.rootDomain]);

  const saveDraft = useCallback(async () => {
    if (!data.website) return;
    setSaveState("saving");
    setError("");
    try {
      const response = await fetch("/api/website", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: data.website.version,
          headlineOverride: headline,
          pageContent: {
            homeIntro,
            aboutNarrative,
            researchNarrative
          },
          enabledPages,
          fieldVisibility,
          sourceCvDocumentId: sourceCvDocumentId || null,
          contactFormEnabled,
          searchIndexingEnabled
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save website draft.");
      setData(result);
      setSaveState("saved");
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "Could not save website draft.");
    }
  }, [
    aboutNarrative,
    contactFormEnabled,
    data.website,
    enabledPages,
    fieldVisibility,
    headline,
    homeIntro,
    researchNarrative,
    searchIndexingEnabled,
    sourceCvDocumentId
  ]);

  async function createDraft() {
    setBusy(true);
    setError("");
    setMessage("");
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
      setMessage("Website draft created. Review readiness, then customize your public pages.");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create website draft.");
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const response = await fetch("/api/website");
    const result = await response.json();
    if (response.ok) setData(result);
  }

  if (data.state === "not_created") {
    return (
      <section className="workspace-screen website-workspace">
        <div className="screen-header">
          <div>
            <span className="section-label">Academic Website</span>
            <h1>Claim your website address</h1>
            <p>Choose a professional username. Your public site will be available later at a CVScholar subdomain.</p>
          </div>
        </div>

        <article className="website-claim-card">
          <label>
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
          <p className="muted-text">{usernameStatus || `Preview: ${hostPreview}`}</p>
          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="muted-text">{message}</p> : null}
          <button className="primary-action" type="button" disabled={busy || !username.trim()} onClick={() => void createDraft()}>
            <Globe2 size={16} />
            {busy ? "Creating draft..." : "Create My Website Draft"}
          </button>
          <ul className="simple-steps">
            <li><CheckCircle2 size={16} /><span>Reuse your Master Academic Profile</span></li>
            <li><CheckCircle2 size={16} /><span>Keep private fields hidden by default</span></li>
            <li><CheckCircle2 size={16} /><span>Preview before any public publish</span></li>
          </ul>
        </article>
      </section>
    );
  }

  return (
    <section className="workspace-screen website-workspace">
      <div className="screen-header">
        <div>
          <span className="section-label">Academic Website</span>
          <h1>{data.website?.publicUrl || "Website draft"}</h1>
          <p>
            Status: <strong>{data.website?.status}</strong> · Readiness {data.readiness.score}% ·{" "}
            {saveState === "saving" ? "Saving..." : saveState === "saved" ? "Draft saved" : saveState === "error" ? "Save failed" : "Unsaved changes possible"}
          </p>
        </div>
        <div className="website-header-actions">
          <button className="secondary-action" type="button" onClick={() => void refresh()}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="secondary-action" type="button" onClick={() => void saveDraft()} disabled={saveState === "saving"}>
            {saveState === "saving" ? "Saving..." : "Save draft"}
          </button>
          <Link className="primary-action" href="/website/preview" target="_blank">
            Preview draft
            <ExternalLink size={16} />
          </Link>
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="muted-text">{message}</p> : null}

      <div className="website-layout">
        <div className="website-main">
          <div className="website-tabs">
            {(["content", "pages", "privacy", "settings"] as const).map((item) => (
              <button key={item} className={tab === item ? "is-active" : ""} type="button" onClick={() => setTab(item)}>
                {item}
              </button>
            ))}
          </div>

          {tab === "content" ? (
            <article className="website-panel">
              <label>
                <span>Public headline override</span>
                <input value={headline} onChange={(event) => setHeadline(event.target.value)} placeholder="Professor of Materials Science" />
              </label>
              <label>
                <span>Home introduction</span>
                <textarea value={homeIntro} onChange={(event) => setHomeIntro(event.target.value)} rows={4} placeholder="A short public introduction for your homepage." />
              </label>
              <label>
                <span>About narrative</span>
                <textarea value={aboutNarrative} onChange={(event) => setAboutNarrative(event.target.value)} rows={5} placeholder="Optional longer about text. Leave blank to use your profile bio." />
              </label>
              <label>
                <span>Research narrative</span>
                <textarea value={researchNarrative} onChange={(event) => setResearchNarrative(event.target.value)} rows={5} placeholder="Optional research overview." />
              </label>
            </article>
          ) : null}

          {tab === "pages" ? (
            <article className="website-panel">
              <p className="muted-text">Choose which pages can appear on your public site. Empty pages still hide automatically in the preview.</p>
              <div className="website-toggle-grid">
                {WEBSITE_PAGE_KEYS.map((key) => (
                  <label key={key} className="website-toggle">
                    <input
                      type="checkbox"
                      checked={enabledPages[key] !== false}
                      onChange={(event) => setEnabledPages((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span>{WEBSITE_PAGE_LABELS[key]}</span>
                  </label>
                ))}
              </div>
            </article>
          ) : null}

          {tab === "privacy" ? (
            <article className="website-panel">
              <p className="muted-text">Sensitive fields stay private unless you explicitly enable them.</p>
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
                      onChange={(event) => setFieldVisibility((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </article>
          ) : null}

          {tab === "settings" ? (
            <article className="website-panel">
              <label>
                <span>Selected CV document</span>
                <select value={sourceCvDocumentId} onChange={(event) => setSourceCvDocumentId(event.target.value)}>
                  <option value="">None selected</option>
                  {data.cvDocuments.map((document) => (
                    <option key={document.id} value={document.id}>
                      {document.title} ({document.templateKey})
                    </option>
                  ))}
                </select>
              </label>
              <label className="website-toggle">
                <input type="checkbox" checked={contactFormEnabled} onChange={(event) => setContactFormEnabled(event.target.checked)} />
                <span>Enable contact form (public submit comes in a later phase)</span>
              </label>
              <label className="website-toggle">
                <input type="checkbox" checked={searchIndexingEnabled} onChange={(event) => setSearchIndexingEnabled(event.target.checked)} />
                <span>Allow search indexing after publish</span>
              </label>
              <p className="muted-text">Publishing to a live subdomain is intentionally disabled in Phase 1. Draft + private preview are available now.</p>
            </article>
          ) : null}
        </div>

        <aside className="website-side">
          <article className="website-panel">
            <div className="website-side-head">
              <strong>Readiness</strong>
              <span>{data.readiness.score}%</span>
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
            {!data.readiness.canPublish ? (
              <p className="muted-text">Complete required items before publish will be enabled.</p>
            ) : (
              <p className="muted-text">Required profile details look ready. Publish will unlock in the next phase.</p>
            )}
          </article>

          {data.preview ? (
            <article className="website-panel website-mini-preview">
              <div className="website-side-head">
                <strong>Live draft preview</strong>
                <Link href="/website/preview">Open full</Link>
              </div>
              <div className="website-mini-preview-frame">
                <ModernScholarPreview model={data.preview} mode="preview" />
              </div>
            </article>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
