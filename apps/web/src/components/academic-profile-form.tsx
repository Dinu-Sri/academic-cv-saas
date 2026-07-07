"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Download,
  FileText,
  FileUp,
  Loader2,
  Plus,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { PdfCanvasPreview } from "@/components/pdf-canvas-preview";
import { entrySummary, personalFields, profileSections, type ProfileFieldDefinition } from "@/lib/profile-sections";

type SaveState = "idle" | "saving" | "saved" | "error";
type CompileState = "idle" | "compiling" | "ready" | "error";

type ProfilePayload = {
  id: string;
  displayName: string;
  headline: string;
  affiliation: string;
  location: string;
  email: string;
  websiteUrl: string;
  googleScholarUrl: string;
  orcidUrl: string;
  linkedinUrl: string;
  bio: string;
  researchSummary: string;
  completeness: number;
};

type EntryPayload = {
  id: string;
  sectionKey: string;
  entryOrder: number;
  data: Record<string, string>;
  isVisible: boolean;
};

type SectionPayload = {
  id: string;
  key: string;
  title: string;
  sectionOrder: number;
  isVisible: boolean;
  entries: EntryPayload[];
};

type MissingField = {
  sectionKey: string;
  entryId?: string;
  label: string;
};

type ImportReview = {
  sectionsFound: { key: string; title: string; count: number }[];
  newItems: number;
  skippedDuplicates: number;
  conflicts: { field: string; label: string; current: string; incoming: string }[];
  fillablePersonalFields: { field: string; label: string; incoming: string }[];
  unmappedCount: number;
  warnings: string[];
};

type ImportJob = {
  id: string;
  status: "queued" | "processing" | "ready" | "applied" | "failed";
  stage: string;
  message: string;
  sourceFilename: string;
  byteSize: number;
  review: ImportReview | null;
  error: string;
  mergeResult?: {
    addedEntries?: number;
    filledPersonalFields?: number;
    skippedDuplicates?: number;
    conflicts?: number;
    unmappedCount?: number;
  };
};

export function AcademicProfileForm({
  profile,
  sections,
  previewHtml,
  pdfReady,
  pdfError,
  saved = false
}: {
  profile: ProfilePayload;
  sections: SectionPayload[];
  previewHtml: string;
  pdfReady: boolean;
  pdfError: string;
  saved?: boolean;
}) {
  const [activeKey, setActiveKey] = useState("personal");
  const [personal, setPersonal] = useState(profile);
  const [sectionState, setSectionState] = useState(sections);
  const [saveState, setSaveState] = useState<SaveState>(saved ? "saved" : "idle");
  const [compileState, setCompileState] = useState<CompileState>(previewHtml ? "ready" : "idle");
  const [downloadReady, setDownloadReady] = useState(pdfReady);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [renderError, setRenderError] = useState(pdfError);
  const [completeness, setCompleteness] = useState(profile.completeness);
  const [renderProgress, setRenderProgress] = useState(0);
  const [missing, setMissing] = useState<MissingField[]>([]);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importError, setImportError] = useState("");
  const [importStarting, setImportStarting] = useState(false);
  const [importApplying, setImportApplying] = useState(false);
  const [fieldSaveState, setFieldSaveState] = useState<SaveState>("saved");
  const [draftVisibleKeys, setDraftVisibleKeys] = useState<string[]>(() =>
    sections.filter((section) => section.isVisible).map((section) => section.key)
  );
  const personalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const entryTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pdfPreviewUrlRef = useRef("");
  const pdfRequestVersionRef = useRef(0);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const visibleSections = sectionState.filter((section) => section.isVisible);
  const activeSection = visibleSections.find((section) => section.key === activeKey);
  const activeDefinition = profileSections.find((section) => section.key === activeKey);
  const missingBySection = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of missing) {
      grouped.set(item.sectionKey, (grouped.get(item.sectionKey) ?? 0) + 1);
    }
    return grouped;
  }, [missing]);

  function queuePersonalSave(next: ProfilePayload) {
    setSaveState("saving");

    if (personalTimer.current) {
      clearTimeout(personalTimer.current);
    }

    personalTimer.current = setTimeout(async () => {
      const response = await fetch("/api/profile/personal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next)
      });

      if (!response.ok) {
        setSaveState("error");
        return;
      }

      const result = (await response.json()) as { completeness?: number };
      setCompleteness(result.completeness ?? completeness);
      setSaveState("saved");
    }, 700);
  }

  function updatePersonal(name: string, value: string) {
    const next = { ...personal, [name]: value };
    setPersonal(next);
    queuePersonalSave(next);
  }

  function updateEntry(sectionKey: string, entryId: string, name: string, value: string) {
    const nextSections = sectionState.map((section) => {
      if (section.key !== sectionKey) return section;

      return {
        ...section,
        entries: section.entries.map((entry) =>
          entry.id === entryId ? { ...entry, data: { ...entry.data, [name]: value } } : entry
        )
      };
    });

    setSectionState(nextSections);
    setSaveState("saving");

    if (entryTimers.current[entryId]) {
      clearTimeout(entryTimers.current[entryId]);
    }

    const entry = nextSections
      .find((section) => section.key === sectionKey)
      ?.entries.find((candidate) => candidate.id === entryId);

    entryTimers.current[entryId] = setTimeout(async () => {
      const response = await fetch(`/api/profile/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey, data: entry?.data ?? {} })
      });

      if (!response.ok) {
        setSaveState("error");
        return;
      }

      const result = (await response.json()) as { completeness?: number };
      setCompleteness(result.completeness ?? completeness);
      setSaveState("saved");
    }, 700);
  }

  async function addEntry(sectionKey: string) {
    setSaveState("saving");
    const response = await fetch(`/api/profile/sections/${sectionKey}/entries`, {
      method: "POST"
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const result = (await response.json()) as { entry: EntryPayload; completeness?: number };
    setSectionState((current) =>
      current.map((section) =>
        section.key === sectionKey ? { ...section, entries: [...section.entries, result.entry] } : section
      )
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
  }

  async function deleteEntry(sectionKey: string, entryId: string) {
    setSaveState("saving");
    const response = await fetch(`/api/profile/entries/${entryId}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      setSaveState("error");
      return;
    }

    const result = (await response.json()) as { completeness?: number };
    setSectionState((current) =>
      current.map((section) =>
        section.key === sectionKey
          ? { ...section, entries: section.entries.filter((entry) => entry.id !== entryId) }
          : section
      )
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
  }

  async function moveEntry(sectionKey: string, entryId: string, direction: -1 | 1) {
    const section = sectionState.find((candidate) => candidate.key === sectionKey);
    if (!section) return;

    const index = section.entries.findIndex((entry) => entry.id === entryId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= section.entries.length) return;

    const entries = [...section.entries];
    const [entry] = entries.splice(index, 1);
    entries.splice(nextIndex, 0, entry);

    setSectionState((current) =>
      current.map((candidate) =>
        candidate.key === sectionKey
          ? { ...candidate, entries: entries.map((item, itemIndex) => ({ ...item, entryOrder: itemIndex + 1 })) }
          : candidate
      )
    );

    setSaveState("saving");
    const response = await fetch(`/api/profile/sections/${sectionKey}/entries/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: entries.map((item) => item.id) })
    });

    setSaveState(response.ok ? "saved" : "error");
  }

  async function compileCv() {
    const validation = collectMissing();
    setMissing(validation);

    if (validation.length > 0) {
      setActiveKey(validation[0].sectionKey);
      return;
    }

    setCompileState("compiling");
    setRenderProgress(0);
    setDownloadReady(false);
    setRenderError("");
    clearPdfPreview();
    const response = await fetch("/api/cv/compile", { method: "POST" });

    if (!response.ok) {
      setCompileState("error");
      setRenderError("Could not start the PDF renderer.");
      return;
    }

    const result = (await response.json()) as { previewHtml: string; completeness?: number; jobId?: string; pdfReady?: boolean; pdfError?: string };
    setDownloadReady(Boolean(result.pdfReady));
    setRenderError(result.pdfError ?? "");
    setCompleteness(result.completeness ?? completeness);
    setCompileState(result.jobId ? "compiling" : result.pdfReady ? "ready" : "error");
    setRenderProgress(result.jobId ? 8 : result.pdfReady ? 100 : 0);

    if (result.jobId) {
      pollRenderJob(result.jobId);
    }
  }

  async function openImportModal() {
    setImportOpen(true);
    setImportError("");
    if (!importJob) {
      await checkActiveImport();
    }
  }

  async function checkActiveImport() {
    const response = await fetch("/api/import/cv", { credentials: "include" });
    if (!response.ok) return;
    const result = (await response.json()) as { job?: ImportJob | null };
    if (result.job) {
      setImportJob(result.job);
      if (["queued", "processing"].includes(result.job.status)) {
        pollImportJob(result.job.id);
      }
    }
  }

  async function startImport() {
    if (!importFile) {
      setImportError("Choose your old CV PDF first.");
      return;
    }

    setImportStarting(true);
    setImportError("");
    setImportJob(null);

    const formData = new FormData();
    formData.append("file", importFile);
    const response = await fetch("/api/import/cv", {
      method: "POST",
      body: formData,
      credentials: "include"
    });
    const result = (await response.json()) as { error?: string; job?: ImportJob };
    setImportStarting(false);

    if (!response.ok || !result.job) {
      setImportError(result.error ?? "Could not start the import.");
      return;
    }

    setImportJob(result.job);
    setImportFile(null);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }

    if (["queued", "processing"].includes(result.job.status)) {
      pollImportJob(result.job.id);
    }
  }

  function pollImportJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      const response = await fetch(`/api/import/cv/${jobId}`, { credentials: "include" });

      if (!response.ok) {
        setImportError("Could not check the import status.");
        return;
      }

      const result = (await response.json()) as { job: ImportJob };
      setImportJob(result.job);

      if (["ready", "applied", "failed"].includes(result.job.status)) {
        return;
      }

      if (attempts < 180) {
        window.setTimeout(check, 1200);
        return;
      }

      setImportError("Import is taking longer than expected. You can close this and check again shortly.");
    };

    window.setTimeout(check, 900);
  }

  async function applyImport() {
    if (!importJob || importJob.status !== "ready") return;

    setImportApplying(true);
    setImportError("");
    const response = await fetch(`/api/import/cv/${importJob.id}/apply`, {
      method: "POST",
      credentials: "include"
    });
    const result = (await response.json()) as { error?: string; result?: ImportJob["mergeResult"] };
    setImportApplying(false);

    if (!response.ok) {
      setImportError(result.error ?? "Could not apply imported data.");
      return;
    }

    setImportJob({
      ...importJob,
      status: "applied",
      stage: "applied",
      message: "Imported data applied.",
      mergeResult: result.result
    });
    setSaveState("saved");
  }

  function openFieldsModal() {
    setDraftVisibleKeys(sectionState.filter((section) => section.isVisible).map((section) => section.key));
    setFieldSaveState("saved");
    setFieldsOpen(true);
  }

  function toggleDraftSection(key: string) {
    const nextKeys = draftVisibleKeys.includes(key)
      ? draftVisibleKeys.filter((item) => item !== key)
      : [...draftVisibleKeys, key];
    setDraftVisibleKeys(nextKeys);
    void saveVisibleSections(nextKeys);
  }

  async function saveVisibleSections(activeKeys: string[]) {
    setSaveState("saving");
    setFieldSaveState("saving");
    const response = await fetch("/api/profile/sections/visibility", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeKeys })
    });

    if (!response.ok) {
      setSaveState("error");
      setFieldSaveState("error");
      return;
    }

    const result = (await response.json()) as { completeness?: number };
    const nextVisible = new Set(activeKeys);
    setSectionState((current) =>
      current.map((section) => ({ ...section, isVisible: nextVisible.has(section.key) }))
    );
    setCompleteness(result.completeness ?? completeness);
    setSaveState("saved");
    setFieldSaveState("saved");

    if (activeKey !== "personal" && !nextVisible.has(activeKey)) {
      setActiveKey(activeKeys[0] ?? "personal");
    }
  }

  function pollRenderJob(jobId: string) {
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      setRenderProgress((current) => Math.min(96, Math.max(current + 4, attempts * 4)));
      const response = await fetch(`/api/cv/jobs/${jobId}`);
      if (!response.ok) {
        setCompileState("error");
        setRenderError("Could not check PDF render status.");
        return;
      }

      const result = (await response.json()) as {
        status: string;
        message?: string;
        previewHtml?: string;
        pdfReady?: boolean;
        pdfError?: string;
      };

      if (result.pdfReady) {
        setRenderProgress(100);
        setDownloadReady(true);
        setRenderError("");
        setCompileState("ready");
        void loadPdfPreview();
        return;
      }

      if (result.status === "failed") {
        setRenderProgress(0);
        setDownloadReady(false);
        setRenderError(result.pdfError || result.message || "PDF rendering failed.");
        setCompileState("error");
        return;
      }

      if (attempts < 90) {
        window.setTimeout(check, 1000);
        return;
      }

      setCompileState("error");
      setRenderError("PDF rendering is taking longer than expected. Please check again shortly.");
    };

    window.setTimeout(check, 700);
  }

  async function loadPdfPreview() {
    pdfRequestVersionRef.current += 1;
    const response = await fetch(`/api/cv/download?disposition=inline&v=${pdfRequestVersionRef.current}`, {
      credentials: "include"
    });

    if (!response.ok) {
      setRenderError(response.status === 401 ? "Please login again before viewing or downloading the PDF." : "Could not load the generated PDF preview.");
      return;
    }

    const blob = await response.blob();
    const nextUrl = URL.createObjectURL(blob);
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
    }
    pdfPreviewUrlRef.current = nextUrl;
    setPdfPreviewUrl(nextUrl);
  }

  function clearPdfPreview() {
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
      pdfPreviewUrlRef.current = "";
    }
    setPdfPreviewUrl("");
  }

  async function downloadPdf() {
    pdfRequestVersionRef.current += 1;
    const response = await fetch(`/api/cv/download?v=${pdfRequestVersionRef.current}`, {
      credentials: "include"
    });

    if (!response.ok) {
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

  useEffect(() => {
    if (downloadReady) {
      void loadPdfPreview();
    }

    return () => {
      if (pdfPreviewUrlRef.current) {
        URL.revokeObjectURL(pdfPreviewUrlRef.current);
        pdfPreviewUrlRef.current = "";
      }
    };
  }, [downloadReady]);

  function collectMissing() {
    const nextMissing: MissingField[] = [];

    if (!personal.displayName.trim()) {
      nextMissing.push({ sectionKey: "personal", label: "Name" });
    }

    for (const section of visibleSections) {
      const definition = profileSections.find((item) => item.key === section.key);
      const requiredFields = definition?.fields.filter((field) => "required" in field && field.required) ?? [];

      for (const entry of section.entries) {
        for (const field of requiredFields) {
          if (!entry.data[field.name]?.trim()) {
            nextMissing.push({ sectionKey: section.key, entryId: entry.id, label: field.label });
          }
        }
      }
    }

    return nextMissing;
  }

  const isGenerating = compileState === "compiling";
  const statusPercent = isGenerating ? renderProgress : completeness;

  return (
    <div className="profile-editor-shell">
      <div className="profile-editor-main">
        <div className="editor-toolbar">
          <div className={`save-dot ${saveState}`}>
            {saveState === "saving" ? <Loader2 size={15} /> : saveState === "error" ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
            <span>{saveLabel(saveState)}</span>
          </div>
          <div className="editor-toolbar-actions">
            <button className="secondary-action compact-action import-cv-action" type="button" onClick={() => void openImportModal()}>
              <FileUp size={16} />
              Import Old CV
            </button>
            <button className="secondary-action compact-action" type="button" onClick={openFieldsModal}>
              <SlidersHorizontal size={16} />
              Add CV fields
            </button>
            {downloadReady ? (
              <button className="secondary-action compact-action" type="button" onClick={() => void downloadPdf()}>
                <Download size={16} />
                Download PDF
              </button>
            ) : null}
            <button className="primary-action generate-action" type="button" onClick={compileCv} disabled={compileState === "compiling"}>
              {compileState === "compiling" ? <Loader2 className="spin-icon" size={16} /> : <FileText size={16} />}
              {compileState === "compiling" ? "Generating" : "Generate My CV"}
            </button>
          </div>
        </div>

        <nav className="editor-tabs" aria-label="Profile sections">
          <button className={`editor-tab ${activeKey === "personal" ? "is-active" : ""} ${personal.displayName ? "is-complete" : ""}`} type="button" onClick={() => setActiveKey("personal")}>
            <span>Personal</span>
            {missingBySection.has("personal") ? <AlertCircle size={14} /> : personal.displayName ? <CheckCircle2 className="tab-check" size={15} strokeWidth={2.8} /> : null}
          </button>
          {visibleSections.map((section) => {
            const definition = profileSections.find((item) => item.key === section.key);
            const hasEntries = section.entries.length > 0;
            const hasMissing = missingBySection.has(section.key);

            return (
              <button
                className={`editor-tab ${activeKey === section.key ? "is-active" : ""} ${hasMissing ? "has-error" : ""} ${hasEntries ? "is-complete" : ""}`}
                key={section.key}
                type="button"
                onClick={() => setActiveKey(section.key)}
              >
                <span>{definition?.shortTitle ?? section.title}</span>
                {hasMissing ? <AlertCircle size={14} /> : hasEntries ? <CheckCircle2 className="tab-check" size={15} strokeWidth={2.8} /> : null}
              </button>
            );
          })}
        </nav>

        <section className="editor-panel">
          {activeKey === "personal" ? (
            <PersonalEditor personal={personal} onChange={updatePersonal} missing={missingBySection.has("personal")} />
          ) : activeSection && activeDefinition ? (
            <SectionEditor
              definition={activeDefinition}
              section={activeSection}
              missing={missing}
              onAdd={() => void addEntry(activeSection.key)}
              onDelete={(entryId) => void deleteEntry(activeSection.key, entryId)}
              onMove={(entryId, direction) => void moveEntry(activeSection.key, entryId, direction)}
              onEntryChange={(entryId, name, value) => updateEntry(activeSection.key, entryId, name, value)}
            />
          ) : null}
        </section>
      </div>

      <aside className={`editor-status-card ${isGenerating ? "is-generating" : ""}`}>
        <div className="editor-status-header">
          <span className="section-label">{isGenerating ? "Making your LaTeX CV" : "CV Status"}</span>
          <strong>{statusPercent}%</strong>
        </div>
        <div className="status-meter"><span style={{ width: `${statusPercent}%` }} /></div>
        {renderError ? <p className="render-error">{renderError}</p> : null}
        {missing.length > 0 ? (
          <button className="missing-jump" type="button" onClick={() => setActiveKey(missing[0].sectionKey)}>
            Fix {missing[0].label}
          </button>
        ) : null}
        <div className="cv-preview-frame">
          {pdfPreviewUrl ? (
            <PdfCanvasPreview sourceUrl={pdfPreviewUrl} />
          ) : isGenerating ? (
            <div className="preview-empty preview-progress">
              <Loader2 className="spin-icon" size={34} />
              <span>We are making your LaTeX CV.</span>
              <small>The PDF will appear here automatically.</small>
            </div>
          ) : (
            <div className="preview-empty">
              <FileText size={34} />
              <span>Add your entries and click Generate My CV to see your CV.</span>
            </div>
          )}
        </div>
      </aside>

      {importOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setImportOpen(false)}>
          <section
            className="cv-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cv-import-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="field-picker-head">
              <div>
                <span className="section-label">Old CV Import</span>
                <h2 id="cv-import-title">Import Old CV</h2>
                <small className="import-helper">Upload a PDF. We read it, map it into your CV fields, and ask before applying.</small>
              </div>
              <button className="icon-button modal-close-inline" type="button" aria-label="Close CV import" onClick={() => setImportOpen(false)}>
                <X size={17} />
              </button>
            </div>

            {importJob?.status === "applied" ? (
              <div className="import-result">
                <CheckCircle2 size={28} />
                <h3>Imported data added</h3>
                <div className="import-summary-grid">
                  <ImportFact label="Entries added" value={importJob.mergeResult?.addedEntries ?? 0} />
                  <ImportFact label="Profile fields filled" value={importJob.mergeResult?.filledPersonalFields ?? 0} />
                  <ImportFact label="Duplicates skipped" value={importJob.mergeResult?.skippedDuplicates ?? 0} />
                  <ImportFact label="Conflicts unchanged" value={importJob.mergeResult?.conflicts ?? 0} />
                </div>
                <button className="primary-action" type="button" onClick={() => window.location.reload()}>
                  Back to Build CV
                </button>
              </div>
            ) : importJob?.status === "ready" && importJob.review ? (
              <div className="import-review">
                <div className="import-progress is-ready">
                  <CheckCircle2 size={18} />
                  <span>Ready to review</span>
                </div>
                <div className="import-summary-grid">
                  <ImportFact label="New items" value={importJob.review.newItems} />
                  <ImportFact label="Profile fields" value={importJob.review.fillablePersonalFields.length} />
                  <ImportFact label="Duplicates" value={importJob.review.skippedDuplicates} />
                  <ImportFact label="Conflicts" value={importJob.review.conflicts.length} />
                </div>

                {importJob.review.sectionsFound.length > 0 ? (
                  <div className="import-section-list">
                    {importJob.review.sectionsFound.map((section) => (
                      <span key={section.key}>{section.title}: {section.count}</span>
                    ))}
                  </div>
                ) : null}

                {importJob.review.conflicts.length > 0 ? (
                  <p className="import-note">Existing profile fields with different values will stay unchanged.</p>
                ) : null}
                {importJob.review.unmappedCount > 0 ? (
                  <p className="import-note">{importJob.review.unmappedCount} item(s) were left unmapped because no matching CV field was clear.</p>
                ) : null}
                {importError ? <p className="form-error">{importError}</p> : null}

                <button className="primary-action" type="button" onClick={() => void applyImport()} disabled={importApplying}>
                  {importApplying ? <Loader2 className="spin-icon" size={16} /> : <CheckCircle2 size={16} />}
                  {importApplying ? "Applying" : "Apply Imported Data"}
                </button>
              </div>
            ) : importJob && ["queued", "processing"].includes(importJob.status) ? (
              <div className="import-processing">
                <div className="import-progress">
                  <Loader2 className="spin-icon" size={22} />
                  <span>{importStageLabel(importJob.stage)}</span>
                </div>
                <div className="import-step-list">
                  {["Uploading CV", "Reading PDF", "Mapping fields", "Ready to review"].map((step, index) => (
                    <span className={index <= importStepIndex(importJob.stage) ? "is-done" : ""} key={step}>
                      {step}
                    </span>
                  ))}
                </div>
                <p className="import-note">You can close this window. The import will continue in the background.</p>
              </div>
            ) : importJob?.status === "failed" ? (
              <div className="import-result import-failed">
                <AlertCircle size={28} />
                <h3>Import could not finish</h3>
                <p>{importJob.error || importJob.message || "Please try another PDF."}</p>
                <button className="secondary-action" type="button" onClick={() => setImportJob(null)}>
                  Try another PDF
                </button>
              </div>
            ) : (
              <div className="import-upload">
                <label className="import-drop-zone">
                  <FileUp size={28} />
                  <strong>{importFile ? importFile.name : "Choose old CV PDF"}</strong>
                  <span>PDF only. Maximum {process.env.NEXT_PUBLIC_CV_IMPORT_MAX_UPLOAD_MB || "8"} MB.</span>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                {importError ? <p className="form-error">{importError}</p> : null}
                <button className="primary-action" type="button" onClick={() => void startImport()} disabled={importStarting}>
                  {importStarting ? <Loader2 className="spin-icon" size={16} /> : <FileUp size={16} />}
                  {importStarting ? "Uploading" : "Start Import"}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {fieldsOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setFieldsOpen(false)}>
          <section
            className="field-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="field-picker-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="field-picker-head">
              <div>
                <span className="section-label">CV Fields</span>
                <h2 id="field-picker-title">Choose editor sections</h2>
                <small className={`field-save-note ${fieldSaveState}`}>{fieldSaveState === "saving" ? "Saving" : fieldSaveState === "error" ? "Could not save" : "Saved"}</small>
              </div>
              <button className="icon-button modal-close-inline" type="button" aria-label="Close field picker" onClick={() => setFieldsOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <div className="field-picker-grid">
              {profileSections.map((section) => {
                const active = draftVisibleKeys.includes(section.key);
                const count = sectionState.find((item) => item.key === section.key)?.entries.length ?? 0;

                return (
                  <button
                    className={`field-choice ${active ? "is-selected" : ""}`}
                    key={section.key}
                    type="button"
                    onClick={() => toggleDraftSection(section.key)}
                  >
                    <span className="field-choice-mark">{active ? "On" : "Off"}</span>
                    <strong>{section.title}</strong>
                    <small>{count ? `${count} entries` : section.description}</small>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ImportFact({ label, value }: { label: string; value: number }) {
  return (
    <div className="import-fact">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function importStepIndex(stage: string) {
  if (stage === "uploaded") return 0;
  if (stage === "reading_pdf") return 1;
  if (stage === "mapping_fields") return 2;
  if (stage === "ready_to_review") return 3;
  return 0;
}

function importStageLabel(stage: string) {
  if (stage === "reading_pdf") return "Reading your old CV";
  if (stage === "mapping_fields") return "Mapping CV fields";
  if (stage === "ready_to_review") return "Ready to review";
  return "Uploading CV";
}

function filenameFromDisposition(disposition: string | null) {
  if (!disposition) return "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? "";
}

function PersonalEditor({
  personal,
  onChange,
  missing
}: {
  personal: ProfilePayload;
  onChange: (name: string, value: string) => void;
  missing: boolean;
}) {
  return (
    <div>
      <div className="section-topline">
        <div>
          <h2>Personal Details</h2>
          <p>Core details used by your CV and website.</p>
        </div>
      </div>
      <div className="entry-form-grid">
        {personalFields.map((field) => (
          <FieldControl
            key={field.name}
            field={field}
            value={String(personal[field.name as keyof ProfilePayload] ?? "")}
            invalid={missing && field.name === "displayName"}
            onChange={(value) => onChange(field.name, value)}
          />
        ))}
      </div>
    </div>
  );
}

function SectionEditor({
  definition,
  section,
  missing,
  onAdd,
  onDelete,
  onMove,
  onEntryChange
}: {
  definition: (typeof profileSections)[number];
  section: SectionPayload;
  missing: MissingField[];
  onAdd: () => void;
  onDelete: (entryId: string) => void;
  onMove: (entryId: string, direction: -1 | 1) => void;
  onEntryChange: (entryId: string, name: string, value: string) => void;
}) {
  return (
    <div>
      <div className="section-topline">
        <div>
          <h2>{definition.title}</h2>
          <p>{definition.description}</p>
        </div>
        <button className="primary-action compact-action" type="button" onClick={onAdd}>
          <Plus size={16} />
          {definition.addLabel}
        </button>
      </div>

      <div className="entry-list">
        {section.entries.length === 0 ? (
          <button className="empty-entry-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            {definition.addLabel}
          </button>
        ) : null}
        {section.entries.map((entry, index) => {
          const entryMissing = missing.filter((item) => item.entryId === entry.id);
          return (
            <details className={`entry-card ${entryMissing.length ? "has-error" : ""}`} key={entry.id} open={index === section.entries.length - 1}>
              <summary>
                <span className="entry-move">
                  <button type="button" aria-label="Move up" onClick={(event) => { event.preventDefault(); onMove(entry.id, -1); }} disabled={index === 0}>
                    <ArrowUp size={14} />
                  </button>
                  <button type="button" aria-label="Move down" onClick={(event) => { event.preventDefault(); onMove(entry.id, 1); }} disabled={index === section.entries.length - 1}>
                    <ArrowDown size={14} />
                  </button>
                </span>
                <strong>{entrySummary(section.key, entry.data)}</strong>
                {entryMissing.length ? <span className="entry-error-pill">Needs info</span> : null}
                <ChevronDown size={16} />
              </summary>
              <div className="entry-card-body">
                <div className="entry-form-grid">
                  {definition.fields.map((field) => (
                    <FieldControl
                      key={field.name}
                      field={field}
                      value={entry.data[field.name] ?? ""}
                      invalid={entryMissing.some((item) => item.label === field.label)}
                      onChange={(value) => onEntryChange(entry.id, field.name, value)}
                    />
                  ))}
                </div>
                <div className="entry-actions">
                  <button className="danger-action" type="button" onClick={() => onDelete(entry.id)}>
                    <Trash2 size={15} />
                    Remove
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  invalid,
  onChange
}: {
  field: ProfileFieldDefinition;
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  const shared = {
    name: field.name,
    value,
    placeholder: field.placeholder ?? "",
    className: invalid ? "is-invalid" : "",
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(event.target.value)
  };

  return (
    <label className={field.type === "textarea" ? "full" : ""}>
      <span>{field.label}{field.required ? <b>*</b> : null}</span>
      {field.type === "textarea" ? (
        <textarea {...shared} rows={3} />
      ) : field.type === "select" ? (
        <select {...shared}>
          <option value="">Select</option>
          {(field.options ?? []).map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      ) : (
        <input {...shared} type={field.type} />
      )}
    </label>
  );
}

function saveLabel(state: SaveState) {
  if (state === "saving") return "Saving";
  if (state === "saved") return "Saved";
  if (state === "error") return "Save failed";
  return "Ready";
}
