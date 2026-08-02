"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { DragEvent } from "react";
import {
  ArrowUpDown,
  Copy,
  Download,
  Eye,
  FilePlus2,
  FileText,
  Link2,
  Loader2,
  Lock,
  Plus,
  Share2,
  SlidersHorizontal,
  X
} from "lucide-react";
import Link from "next/link";
import { SvgCvPreview } from "@/components/svg-cv-preview";
import { PDF_DOWNLOAD_LOCKED_CODE } from "@/lib/billing/plans";

type CvShareInfo = {
  id: string;
  documentId: string;
  shareSlug: string;
  isActive: boolean;
  viewCount: number;
  lastViewedAt: string | null;
  shareUrl: string;
  pdfUrl: string;
};

type CvTemplate = {
  key: "classic" | "modern" | "detailed";
  name: string;
  description: string;
};

type CvDocumentSummary = {
  id: string;
  title: string;
  templateKey: string;
  visibleSectionKeys: string[];
  pdfReady: boolean;
  pdfError: string;
  updatedAt: string;
};

type SectionOption = {
  key: string;
  title: string;
  description: string;
  entryCount: number;
};

type BuildCvWorkspaceProps = {
  displayName: string;
  completeness: number;
  documents: CvDocumentSummary[];
  sectionOptions: SectionOption[];
  canDownloadPdf?: boolean;
};

// Only Classic is offered in Manage CVs for now; other templates stay available in code later.
const cvTemplates: CvTemplate[] = [
  {
    key: "classic",
    name: "Classic",
    description: "Traditional academic CV."
  }
];

export function BuildCvWorkspace({
  displayName,
  completeness,
  documents,
  sectionOptions,
  canDownloadPdf = false
}: BuildCvWorkspaceProps) {
  const fallbackDocument = useMemo<CvDocumentSummary>(
    () => ({
      id: "",
      title: displayName ? `${displayName} CV` : "Main Academic CV",
      templateKey: "classic",
      visibleSectionKeys: sectionOptions.filter((section) => section.entryCount > 0).map((section) => section.key),
      pdfReady: false,
      pdfError: "",
      updatedAt: ""
    }),
    [displayName, sectionOptions]
  );
  const [cvDocuments, setCvDocuments] = useState<CvDocumentSummary[]>(documents.length > 0 ? documents : [fallbackDocument]);
  const [activeDocumentId, setActiveDocumentId] = useState(cvDocuments[0]?.id ?? "");
  const [status, setStatus] = useState<"idle" | "generating" | "ready" | "error">(cvDocuments[0]?.pdfReady ? "ready" : "idle");
  const [renderError, setRenderError] = useState(cvDocuments[0]?.pdfError ?? "");
  const [renderProgress, setRenderProgress] = useState(0);
  const [previewVersion, setPreviewVersion] = useState(0);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [fieldSaveState, setFieldSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dragSectionKey, setDragSectionKey] = useState("");
  const [dragTargetKey, setDragTargetKey] = useState("");
  const [downloadUnlocked, setDownloadUnlocked] = useState(canDownloadPdf);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  /** Share state keyed by document so switching CVs does not need sync setState-in-effect. */
  const [shareCache, setShareCache] = useState<{ documentId: string; info: CvShareInfo | null } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareMessage, setShareMessage] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const statusSlot = useSyncExternalStore(
    subscribeToStaticDom,
    () => document.getElementById("managed-cv-status-slot"),
    () => null
  );

  const activeDocument = cvDocuments.find((document) => document.id === activeDocumentId) ?? cvDocuments[0] ?? fallbackDocument;
  // Force Classic for now even if an older document stored another template key.
  const activeTemplate = cvTemplates[0];
  const sectionsWithData = sectionOptions.filter((section) => section.entryCount > 0);
  const selectedKeys = new Set(activeDocument.visibleSectionKeys);
  const statusPercent = status === "generating" ? renderProgress : completeness;
  const isGenerating = status === "generating";
  const shareInfo = shareCache?.documentId === activeDocument.id ? shareCache.info : null;

  async function createCv() {
    const response = await fetch("/api/cv/documents", {
      method: "POST"
    });

    if (!response.ok) {
      setRenderError("Could not create a new CV version.");
      return;
    }

    const result = (await response.json()) as { document: CvDocumentSummary };
    setCvDocuments((items) => [result.document, ...items.filter((item) => item.id)]);
    setPreviewVersion((current) => current + 1);
    setStatus("idle");
    setRenderError("");
    setActiveDocumentId(result.document.id);
  }

  function selectDocument(document: CvDocumentSummary) {
    setPreviewVersion((current) => current + 1);
    setStatus(document.pdfReady ? "ready" : "idle");
    setRenderError(document.pdfError ?? "");
    setActiveDocumentId(document.id);
  }

  function updateActiveDocument(update: Partial<Pick<CvDocumentSummary, "templateKey" | "visibleSectionKeys" | "title">>) {
    if (!activeDocument.id) return;

    const nextDocument = { ...activeDocument, ...update };
    setCvDocuments((items) => items.map((item) => (item.id === activeDocument.id ? nextDocument : item)));
    setRenderError("");

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      void saveDocument(nextDocument);
    }, 350);
  }

  async function saveDocument(document: CvDocumentSummary) {
    const response = await fetch(`/api/cv/documents/${document.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: document.title,
        templateKey: "classic",
        visibleSectionKeys: document.visibleSectionKeys
      })
    });

    if (!response.ok) {
      setRenderError("Could not save this CV version.");
      setFieldSaveState("error");
      return;
    }

    const result = (await response.json()) as { document: CvDocumentSummary };
    setCvDocuments((items) => items.map((item) => (item.id === result.document.id ? { ...result.document, templateKey: "classic" } : item)));
    setFieldSaveState("saved");
  }

  async function generateCv() {
    let document = activeDocument;
    if (!document.id) {
      const response = await fetch("/api/cv/documents", { method: "POST" });
      if (!response.ok) {
        setRenderError("Could not create a CV version before generating.");
        return;
      }
      const result = (await response.json()) as { document: CvDocumentSummary };
      document = { ...result.document, templateKey: "classic" };
      setCvDocuments([document]);
      setActiveDocumentId(document.id);
    }

    setStatus("generating");
    setRenderProgress(0);
    setRenderError("");
    setPreviewVersion((current) => current + 1);

    const response = await fetch("/api/cv/compile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: document.id,
        templateKey: "classic",
        visibleSectionKeys: document.visibleSectionKeys
      })
    });

    if (!response.ok) {
      const { handleGuestLimitResponse } = await import("@/lib/guest-client");
      if (await handleGuestLimitResponse(response)) {
        setStatus("idle");
        return;
      }
      setStatus("error");
      setRenderError("Could not start the PDF renderer.");
      return;
    }

    const result = (await response.json()) as { documentId: string; jobId?: string; pdfReady?: boolean; pdfError?: string };
    setRenderError(result.pdfError ?? "");
    setStatus(result.jobId ? "generating" : result.pdfReady ? "ready" : "error");
    setRenderProgress(result.jobId ? 8 : result.pdfReady ? 100 : 0);

    if (result.jobId) {
      pollRenderJob(result.jobId, result.documentId);
    }
  }

  function pollRenderJob(jobId: string, documentId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      setRenderProgress((current) => Math.min(96, Math.max(current + 4, attempts * 4)));
      const response = await fetch(`/api/cv/jobs/${jobId}`);
      if (!response.ok) {
        setStatus("error");
        setRenderError("Could not check PDF render status.");
        return;
      }

      const result = (await response.json()) as {
        status: string;
        message?: string;
        pdfReady?: boolean;
        pdfError?: string;
      };

      if (result.pdfReady) {
        setRenderProgress(100);
        setStatus("ready");
        setRenderError("");
        setCvDocuments((items) => items.map((item) => (item.id === documentId ? { ...item, pdfReady: true, pdfError: "" } : item)));
        setPreviewVersion((current) => current + 1);
        return;
      }

      if (result.status === "failed") {
        setRenderProgress(0);
        setStatus("error");
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setCvDocuments((items) => items.map((item) => (item.id === documentId ? { ...item, pdfReady: false, pdfError: result.pdfError || result.message || "" } : item)));
        return;
      }

      if (attempts < 90) {
        window.setTimeout(check, 1000);
        return;
      }

      setStatus("error");
      setRenderError("PDF rendering is taking longer than expected. Please check again shortly.");
    };

    window.setTimeout(check, 700);
  }

  async function downloadPdf() {
    if (!activeDocument.id) return;
    if (!downloadUnlocked) {
      setPaywallOpen(true);
      return;
    }

    const response = await fetch(`/api/cv/download?documentId=${encodeURIComponent(activeDocument.id)}`, {
      credentials: "include"
    });

    if (!response.ok) {
      if (response.status === 402) {
        try {
          const body = await response.json();
          if (body.code === PDF_DOWNLOAD_LOCKED_CODE) {
            setDownloadUnlocked(false);
            setPaywallOpen(true);
            return;
          }
        } catch {
          /* fall through */
        }
      }
      setRenderError(response.status === 401 ? "Please login again before downloading the PDF." : "Could not download the generated PDF.");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filenameFromDisposition(response.headers.get("Content-Disposition")) || "academic-cv.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function toggleSection(sectionKey: string) {
    const nextKeys = selectedKeys.has(sectionKey)
      ? activeDocument.visibleSectionKeys.filter((key) => key !== sectionKey)
      : [...activeDocument.visibleSectionKeys, sectionKey];
    setFieldSaveState("saving");
    updateActiveDocument({ visibleSectionKeys: nextKeys });
  }

  function reorderSection(targetKey: string) {
    if (!dragSectionKey || dragSectionKey === targetKey) return;
    setFieldSaveState("saving");
    updateActiveDocument({ visibleSectionKeys: reorderKeys(activeDocument.visibleSectionKeys, dragSectionKey, targetKey) });
  }

  useEffect(() => {
    if (!activeDocument.id || !activeDocument.pdfReady) return;
    const documentId = activeDocument.id;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(`/api/cv/share?documentId=${encodeURIComponent(documentId)}`, {
          credentials: "include"
        });
        if (!response.ok || cancelled) return;
        const payload = (await response.json()) as { exists?: boolean; share?: CvShareInfo };
        if (cancelled) return;
        setShareCache({
          documentId,
          info: payload.exists && payload.share ? payload.share : null
        });
      } catch {
        // Non-blocking — share panel loads on demand.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeDocument.id, activeDocument.pdfReady]);

  async function createOrLoadShare() {
    if (!activeDocument.id || !activeDocument.pdfReady) {
      setShareError("Generate your CV first, then create a share link.");
      return;
    }
    const documentId = activeDocument.id;
    setShareBusy(true);
    setShareError("");
    setShareMessage("");
    try {
      const response = await fetch("/api/cv/share", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId })
      });
      const payload = (await response.json()) as { error?: string; share?: CvShareInfo; created?: boolean };
      if (!response.ok) throw new Error(payload.error || "Could not create share link.");
      if (payload.share) {
        setShareCache({ documentId, info: payload.share });
      }
      setShareMessage(payload.created ? "Share link created." : "Share link ready.");
      setShareOpen(true);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not create share link.");
      setShareOpen(true);
    } finally {
      setShareBusy(false);
    }
  }

  async function toggleShareActive(nextActive: boolean) {
    if (!activeDocument.id) return;
    const documentId = activeDocument.id;
    setShareBusy(true);
    setShareError("");
    try {
      const response = await fetch("/api/cv/share", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, isActive: nextActive })
      });
      const payload = (await response.json()) as { error?: string; share?: CvShareInfo };
      if (!response.ok) throw new Error(payload.error || "Could not update share link.");
      if (payload.share) {
        setShareCache({ documentId, info: payload.share });
      }
      setShareMessage(nextActive ? "Share link is active." : "Share link disabled.");
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Could not update share link.");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareUrl() {
    if (!shareInfo?.shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareInfo.shareUrl);
      setShareMessage("Link copied to clipboard.");
    } catch {
      window.prompt("Copy this share link:", shareInfo.shareUrl);
    }
  }

  return (
    <section className="workspace-screen cv-workspace">
      <div className="managed-cv-shell">
        <main className="managed-cv-main">
          <section className="managed-cv-panel">
            <div className="managed-cv-header">
              <div className="editor-toolbar-actions">
                {activeDocument.pdfReady ? (
                  <button className="secondary-action compact-action" type="button" onClick={() => void downloadPdf()}>
                    {downloadUnlocked ? <Download size={16} /> : <Lock size={16} />}
                    {downloadUnlocked ? "Download PDF" : "Unlock PDF"}
                  </button>
                ) : null}
                {activeDocument.pdfReady ? (
                  <button
                    className="secondary-action compact-action"
                    type="button"
                    disabled={shareBusy || !activeDocument.id}
                    onClick={() => {
                      setShareOpen(true);
                      if (!shareInfo) void createOrLoadShare();
                    }}
                  >
                    {shareBusy ? <Loader2 className="spin-icon" size={16} /> : <Share2 size={16} />}
                    Share CV
                  </button>
                ) : null}
                <button className="primary-action generate-action" type="button" onClick={() => void generateCv()} disabled={isGenerating}>
                  {isGenerating ? <Loader2 className="spin-icon" size={16} /> : <FileText size={16} />}
                  {isGenerating ? "Generating" : "Generate My CV"}
                </button>
              </div>
            </div>

            <label className="cv-title-field">
              <span>CV name</span>
              <input value={activeDocument.title} onChange={(event) => updateActiveDocument({ title: event.target.value })} />
            </label>

            <section className="cv-builder-section compact-builder-section">
              <h2>Choose Template</h2>
              <div className="template-choice-grid">
                {cvTemplates.map((template) => (
                  <button
                    className={`template-choice ${activeTemplate.key === template.key ? "is-selected" : ""}`}
                    key={template.key}
                    type="button"
                    onClick={() => updateActiveDocument({ templateKey: template.key })}
                  >
                    <strong>{template.name}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="cv-builder-section compact-builder-section">
              <button
                className="field-popup-trigger"
                type="button"
                onClick={() => {
                  setFieldSaveState("saved");
                  setFieldsOpen(true);
                }}
              >
                <SlidersHorizontal size={17} />
                Turn On/Off CV Fields
              </button>
            </section>
          </section>

          <aside className={`cv-build-preview managed-preview ${isGenerating ? "is-generating" : ""}`}>
            <div className="editor-status-header">
              <span className="section-label">{isGenerating ? "Making your LaTeX CV" : "CV Preview"}</span>
              <strong>{statusPercent}%</strong>
            </div>
            <div className="status-meter"><span style={{ width: `${statusPercent}%` }} /></div>
            {renderError ? <p className="render-error">{renderError}</p> : null}
            <div className="cv-preview-frame large-preview">
              {activeDocument.pdfReady ? (
                <SvgCvPreview documentId={activeDocument.id} version={previewVersion} />
              ) : isGenerating ? (
                <div className="preview-empty preview-progress">
                  <Loader2 className="spin-icon" size={34} />
                  <span>We are making your LaTeX CV.</span>
                  <small>The PDF will appear here automatically.</small>
                </div>
              ) : (
                <div className="preview-empty">
                  <FileText size={34} />
                  <span>Add entries, then click Generate My CV to see your CV.</span>
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>

      {statusSlot
        ? createPortal(
            <AvailableCvsPanel
              activeDocumentId={activeDocument.id}
              documents={cvDocuments}
              onCreate={() => void createCv()}
              onSelect={selectDocument}
            />,
            statusSlot
          )
        : null}

      {shareOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShareOpen(false)}>
          <section
            className="cv-share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv-share-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setShareOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="cv-share-title">Share this CV</h2>
            <p className="muted-text">
              Create a public short link to your generated PDF. View counts update when someone opens the page.
            </p>
            {!shareInfo ? (
              <button className="primary-action" type="button" disabled={shareBusy || !activeDocument.pdfReady} onClick={() => void createOrLoadShare()}>
                {shareBusy ? <Loader2 size={16} className="spin-icon" /> : <Link2 size={16} />}
                {shareBusy ? "Creating…" : "Create share link"}
              </button>
            ) : (
              <div className="cv-share-modal-body">
                <label className="website-field">
                  <span>Public link</span>
                  <div className="cv-share-url-row">
                    <input readOnly value={shareInfo.shareUrl} onFocus={(event) => event.currentTarget.select()} />
                    <button className="secondary-action compact-action" type="button" onClick={() => void copyShareUrl()}>
                      <Copy size={15} />
                      Copy
                    </button>
                  </div>
                </label>
                <div className="cv-share-stats">
                  <span>
                    <Eye size={15} />
                    {shareInfo.viewCount} view{shareInfo.viewCount === 1 ? "" : "s"}
                  </span>
                  <span className={shareInfo.isActive ? "is-active" : "is-off"}>
                    {shareInfo.isActive ? "Active" : "Disabled"}
                  </span>
                  {shareInfo.lastViewedAt ? (
                    <small>Last view {new Date(shareInfo.lastViewedAt).toLocaleString()}</small>
                  ) : (
                    <small>No views yet</small>
                  )}
                </div>
                <div className="cv-share-modal-actions">
                  <a className="secondary-action compact-action" href={shareInfo.shareUrl} target="_blank" rel="noreferrer">
                    Open page
                  </a>
                  <button
                    className="secondary-action compact-action"
                    type="button"
                    disabled={shareBusy}
                    onClick={() => void toggleShareActive(!shareInfo.isActive)}
                  >
                    {shareInfo.isActive ? "Disable link" : "Enable link"}
                  </button>
                </div>
              </div>
            )}
            {shareError ? <p className="form-error">{shareError}</p> : null}
            {shareMessage ? <p className="form-success">{shareMessage}</p> : null}
          </section>
        </div>
      ) : null}

      {paywallOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setPaywallOpen(false)}>
          <section
            className="billing-checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-paywall-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setPaywallOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="pdf-paywall-title">Unlock PDF download</h2>
            <p className="billing-checkout-lead">
              Preview is free. Download the official PDF with PDF Pass ($5 / 30 days) or Scholar Annual.
            </p>
            <Link className="primary-action billing-pay-btn" href="/billing" onClick={() => setPaywallOpen(false)}>
              View plans
            </Link>
          </section>
        </div>
      ) : null}

      {fieldsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setFieldsOpen(false)}>
          <section
            className="field-picker-modal compact-field-picker"
            role="dialog"
            aria-modal="true"
            aria-labelledby="managed-field-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="field-picker-head">
              <div>
                <span className="section-label">CV Fields</span>
                <h2 id="managed-field-picker-title">Turn fields on or off</h2>
                <small className={`field-save-note ${fieldSaveState}`}>{fieldSaveState === "saving" ? "Saving" : fieldSaveState === "error" ? "Could not save" : "Saved"}</small>
              </div>
              <button className="modal-close-inline" type="button" aria-label="Close field picker" onClick={() => setFieldsOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <ManagedSectionPicker
              sections={sectionsWithData}
              activeKeys={activeDocument.visibleSectionKeys}
              dropTargetKey={dragTargetKey}
              onToggle={toggleSection}
              onDragStart={setDragSectionKey}
              onDragTarget={setDragTargetKey}
              onDrop={reorderSection}
              onDragEnd={() => {
                setDragSectionKey("");
                setDragTargetKey("");
              }}
            />
            {sectionsWithData.length === 0 ? (
              <p className="empty-field-note">Add entries in Build CV first. Then fields will appear here.</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}

function AvailableCvsPanel({
  activeDocumentId,
  documents,
  onCreate,
  onSelect
}: {
  activeDocumentId: string;
  documents: CvDocumentSummary[];
  onCreate: () => void;
  onSelect: (document: CvDocumentSummary) => void;
}) {
  return (
    <div className="cv-version-panel">
      <div className="cv-version-header">
        <span className="section-label">Available CVs</span>
        <button className="icon-button" type="button" onClick={onCreate} aria-label="Create CV">
          <Plus size={18} />
        </button>
      </div>
      <div className="cv-version-list">
        {documents.filter((item) => item.id).map((document) => (
          <button
            className={`cv-version-item ${document.id === activeDocumentId ? "is-active" : ""}`}
            key={document.id}
            type="button"
            onClick={() => onSelect(document)}
          >
            <FilePlus2 size={18} />
            <span>
              <strong>{document.title}</strong>
              <small>{templateName(document.templateKey)} template</small>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ManagedSectionPicker({
  sections,
  activeKeys,
  dropTargetKey,
  onToggle,
  onDragStart,
  onDragTarget,
  onDrop,
  onDragEnd
}: {
  sections: SectionOption[];
  activeKeys: string[];
  dropTargetKey: string;
  onToggle: (key: string) => void;
  onDragStart: (key: string) => void;
  onDragTarget: (key: string) => void;
  onDrop: (key: string) => void;
  onDragEnd: () => void;
}) {
  const activeSet = new Set(activeKeys);
  const sectionMap = new Map(sections.map((section) => [section.key, section]));
  const activeSections = activeKeys
    .map((key) => sectionMap.get(key))
    .filter((section): section is SectionOption => Boolean(section));
  const inactiveSections = sections.filter((section) => !activeSet.has(section.key));

  return (
    <div className="field-picker-groups">
      <div className="field-picker-inline-hint">
        <ArrowUpDown size={16} />
        <span>Drag active sections to reorder</span>
      </div>
      <ManagedSectionGroup
        title="Active sections"
        active
        sections={activeSections}
        dropTargetKey={dropTargetKey}
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragTarget={onDragTarget}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
      <ManagedSectionGroup
        title="Available sections"
        sections={inactiveSections}
        dropTargetKey=""
        onToggle={onToggle}
        onDragStart={onDragStart}
        onDragTarget={onDragTarget}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      />
    </div>
  );
}

function ManagedSectionGroup({
  title,
  sections,
  active = false,
  dropTargetKey,
  onToggle,
  onDragStart,
  onDragTarget,
  onDrop,
  onDragEnd
}: {
  title: string;
  sections: SectionOption[];
  active?: boolean;
  dropTargetKey: string;
  onToggle: (key: string) => void;
  onDragStart: (key: string) => void;
  onDragTarget: (key: string) => void;
  onDrop: (key: string) => void;
  onDragEnd: () => void;
}) {
  return (
    <section className="field-picker-group">
      <div className="field-picker-group-head">
        <strong>{title}</strong>
        <small>{active ? "Drag to reorder" : "Click to activate"}</small>
      </div>
      <div className="field-picker-grid">
        {sections.map((section) => (
          <button
            className={`field-choice ${active ? "is-selected is-draggable" : ""} ${dropTargetKey === section.key ? "is-drop-target" : ""}`}
            key={section.key}
            type="button"
            draggable={active}
            onDragStart={(event: DragEvent<HTMLButtonElement>) => {
              if (!active) return;
              onDragStart(section.key);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              if (active) {
                event.preventDefault();
                onDragTarget(section.key);
              }
            }}
            onDrop={() => {
              if (active) onDrop(section.key);
            }}
            onDragEnd={onDragEnd}
            onClick={() => onToggle(section.key)}
          >
            <span className="field-choice-toggle">
              <span className="toggle-track">
                <span className="toggle-thumb" />
              </span>
            </span>
            <span>
              <strong>{section.title}</strong>
              <em>{shortSectionDescription(section.description)}</em>
              <small>{section.entryCount} item{section.entryCount === 1 ? "" : "s"} available</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "";
}

function templateName(templateKey: string) {
  return cvTemplates.find((template) => template.key === templateKey)?.name ?? "Classic";
}

function subscribeToStaticDom() {
  return () => {};
}

function reorderKeys(keys: string[], sourceKey: string, targetKey: string) {
  const next = [...keys];
  const sourceIndex = next.indexOf(sourceKey);
  const targetIndex = next.indexOf(targetKey);
  if (sourceIndex < 0 || targetIndex < 0) return keys;
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function shortSectionDescription(description: string) {
  return description
    .replace(/[.,].*$/, "")
    .split(/\s+/)
    .slice(0, 7)
    .join(" ");
}
