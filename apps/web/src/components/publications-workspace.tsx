"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  DownloadCloud,
  Edit3,
  ExternalLink,
  FilePlus2,
  Loader2,
  Merge,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  publicationFieldExamples,
  publicationStatusOptions,
  publicationTypeOptions,
  publicationYearOptions,
  type ProfileFieldType
} from "@/lib/profile-sections";
import { handleGuestLimitResponse } from "@/lib/guest-client";

type PublicationData = {
  title: string;
  authors: string;
  year: string;
  publication_type: string;
  venue: string;
  volume_issue_pages: string;
  doi: string;
  url: string;
  status: string;
};

type ApprovedPublication = {
  id: string;
  source: string;
  entryOrder: number;
  data: PublicationData;
  warning: string;
};

type DuplicateCandidate = {
  entryId: string;
  data: PublicationData;
  source: string;
  matchType: string;
  confidence: number;
  reason: string;
};

type ReviewItem = {
  id: string;
  source: string;
  status: string;
  rawData: PublicationData;
  cleanedData: PublicationData;
  duplicateCandidates: DuplicateCandidate[];
  aiDecision: unknown;
  duplicateEntryId: string;
  recommendedAction: string;
  confidence: number;
  reason: string;
  createdAt: string;
};

type PublicationWorkspacePayload = {
  sectionId: string;
  approved: ApprovedPublication[];
  pending: ReviewItem[];
  stats: {
    approved: number;
    pending: number;
    duplicates: number;
    doiCount: number;
  };
};

const emptyPublication: PublicationData = {
  title: "",
  authors: "",
  year: "",
  publication_type: "",
  venue: "",
  volume_issue_pages: "",
  doi: "",
  url: "",
  status: ""
};

const pageSize = 5;
const publicationFieldConfig: Record<keyof PublicationData, {
  label: string;
  type: ProfileFieldType;
  options?: string[];
  full?: boolean;
}> = {
  title: { label: "Title", type: "text", full: true },
  authors: { label: "Authors", type: "textarea", full: true },
  year: { label: "Year", type: "select", options: publicationYearOptions() },
  publication_type: { label: "Publication Type", type: "select", options: publicationTypeOptions },
  venue: { label: "Journal / Conference / Book", type: "text" },
  volume_issue_pages: { label: "Volume / Issue / Pages", type: "text" },
  doi: { label: "DOI", type: "text" },
  url: { label: "URL", type: "url" },
  status: { label: "Status", type: "select", options: publicationStatusOptions }
};

export function PublicationsWorkspace({ initialData }: { initialData: PublicationWorkspacePayload }) {
  const [data, setData] = useState(initialData);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [doiOpen, setDoiOpen] = useState(false);
  const [orcidInput, setOrcidInput] = useState("");
  const [scholarInput, setScholarInput] = useState("");
  const [doiInput, setDoiInput] = useState("");
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<ApprovedPublication | null>(null);
  const [page, setPage] = useState(1);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const duplicateItems = data.pending.filter((item) => item.recommendedAction !== "approve");
  const normalPending = data.pending.filter((item) => item.recommendedAction === "approve");
  const filteredApproved = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data.approved;
    return data.approved.filter((item) =>
      [item.data.title, item.data.authors, item.data.year, item.data.venue, item.data.doi, item.source]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [data.approved, query]);
  const pageCount = Math.max(1, Math.ceil(filteredApproved.length / pageSize));
  const activePage = Math.min(page, pageCount);
  const pagedApproved = filteredApproved.slice((activePage - 1) * pageSize, activePage * pageSize);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/publications", { credentials: "include" });
    const payload = (await response.json()) as PublicationWorkspacePayload & { error?: string };
    if (!response.ok) {
      setMessage(payload.error || "Could not refresh publications.");
      return;
    }
    setData(payload);
    setSelected([]);
  }, []);

  useEffect(() => {
    const handlePublicationsChanged = () => {
      void refresh();
    };

    window.addEventListener("cvscholar:publications-changed", handlePublicationsChanged);
    return () => window.removeEventListener("cvscholar:publications-changed", handlePublicationsChanged);
  }, [refresh]);

  async function runAction(label: string, action: () => Promise<void>) {
    setWorking(label);
    setMessage("");
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setWorking("");
    }
  }

  async function postJson<T>(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!response.ok) await handleGuestLimitResponse(response);
    const payload = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Request failed.");
    }
    return payload;
  }

  async function importSource(source: "orcid" | "scholar") {
    await runAction(source, async () => {
      await postJson(`/api/publications/import/${source}`, { input: source === "orcid" ? orcidInput : scholarInput });
      if (source === "orcid") {
        setOrcidInput("");
      } else {
        setScholarInput("");
      }
      setImportOpen(false);
      await refresh();
    });
  }

  async function lookupDoi() {
    await runAction("doi", async () => {
      await postJson("/api/publications/doi", { doi: doiInput });
      setDoiInput("");
      setDoiOpen(false);
      await refresh();
    });
  }

  async function addManual() {
    await runAction("manual", async () => {
      const response = await fetch("/api/publications", { method: "POST", credentials: "include" });
      if (!response.ok) await handleGuestLimitResponse(response);
      const payload = (await response.json()) as { publication?: ApprovedPublication; error?: string };
      if (!response.ok || !payload.publication) {
        throw new Error(payload.error || "Could not add publication.");
      }
      await refresh();
      setEditing(payload.publication);
    });
  }

  async function approveSelected() {
    await runAction("approve", async () => {
      await postJson("/api/publications/review/approve", { itemIds: selected });
      await refresh();
    });
  }

  async function rejectItems(itemIds: string[]) {
    await runAction("reject", async () => {
      await postJson("/api/publications/review/reject", { itemIds });
      await refresh();
    });
  }

  async function mergeItem(itemId: string) {
    await runAction(`merge-${itemId}`, async () => {
      await postJson("/api/publications/review/merge", { itemId });
      await refresh();
    });
  }

  async function keepBoth(itemId: string) {
    await runAction(`keep-${itemId}`, async () => {
      await postJson("/api/publications/review/approve", { itemIds: [itemId], forceKeepBoth: true });
      await refresh();
    });
  }

  function openExisting(candidate?: DuplicateCandidate) {
    if (!candidate) return;
    const existing = data.approved.find((item) => item.id === candidate.entryId);
    if (existing) setEditing(existing);
  }

  function queueEditSave(next: ApprovedPublication) {
    setEditing(next);
    setData((current) => ({
      ...current,
      approved: current.approved.map((item) => (item.id === next.id ? next : item))
    }));

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(async () => {
      const response = await fetch(`/api/profile/entries/${next.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey: "publications", data: next.data })
      });
      setMessage(response.ok ? "Saved" : "Could not save publication.");
    }, 600);
  }

  async function deletePublication(item: ApprovedPublication) {
    await runAction(`delete-${item.id}`, async () => {
      const response = await fetch(`/api/profile/entries/${item.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error || "Could not delete publication.");
      }
      setEditing(null);
      await refresh();
    });
  }

  async function sortNewestFirst() {
    await runAction("sort", async () => {
      const ordered = [...data.approved]
        .sort((a, b) => Number(b.data.year || 0) - Number(a.data.year || 0) || a.data.title.localeCompare(b.data.title))
        .map((item) => item.id);
      await postJson("/api/profile/sections/publications/entries/reorder", { order: ordered });
      await refresh();
    });
  }

  async function movePublication(item: ApprovedPublication, direction: -1 | 1) {
    const index = data.approved.findIndex((publication) => publication.id === item.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= data.approved.length) return;

    await runAction(`move-${item.id}-${direction}`, async () => {
      const ordered = [...data.approved];
      const [moved] = ordered.splice(index, 1);
      ordered.splice(nextIndex, 0, moved);
      await postJson("/api/profile/sections/publications/entries/reorder", { order: ordered.map((publication) => publication.id) });
      await refresh();
    });
  }

  return (
    <section className="workspace-screen publications-workspace">
      <div className="publication-toolbar">
        <div>
          <span className="section-label">Publications</span>
          <h1>Publication Library</h1>
        </div>
        <div className="publication-actions">
          {duplicateItems.length ? (
            <a className="secondary-action compact-action" href="#duplicate-review">
              <AlertTriangle size={16} />
              Review Duplicates
            </a>
          ) : null}
          <button className="secondary-action compact-action" type="button" onClick={() => setDoiOpen(true)}>
            <Search size={16} />
            Add by DOI
          </button>
          <button className="secondary-action compact-action" type="button" onClick={() => void addManual()}>
            <Plus size={16} />
            Add Manually
          </button>
          <button className="primary-action compact-action" type="button" onClick={() => setImportOpen(true)}>
            <DownloadCloud size={16} />
            <span className="action-copy">
              <strong>Import Publications</strong>
              <small>Google Scholar and ORCID</small>
            </span>
          </button>
        </div>
      </div>

      {message ? <p className={`publication-message ${message === "Saved" ? "is-saved" : ""}`}>{message}</p> : null}

      <div className="publication-layout">
        <main className="publication-main">
          {duplicateItems.length ? (
            <section className="publication-panel duplicate-panel" id="duplicate-review">
              <PanelHeader title="Possible duplicates" note="Review these before approving. The incoming item may already exist." />
              <div className="duplicate-list">
                {duplicateItems.map((item) => {
                  const candidate = item.duplicateCandidates[0];
                  return (
                    <article className="duplicate-item" key={item.id}>
                      <PublicationCompare incoming={item.cleanedData} existing={candidate?.data ?? emptyPublication} reason={item.reason} />
                      <div className="duplicate-actions">
                        <button className="primary-action compact-action" type="button" onClick={() => void mergeItem(item.id)} disabled={Boolean(working)}>
                          {working === `merge-${item.id}` ? <Loader2 className="spin-icon" size={16} /> : <Merge size={16} />}
                          Merge Duplicate
                        </button>
                        <button className="secondary-action compact-action" type="button" onClick={() => void keepBoth(item.id)} disabled={Boolean(working)}>
                          Keep Both
                        </button>
                        <button className="secondary-action compact-action" type="button" onClick={() => openExisting(candidate)}>
                          Open Existing
                        </button>
                        <button className="danger-action" type="button" onClick={() => void rejectItems([item.id])} disabled={Boolean(working)}>
                          Remove Incoming
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {normalPending.length ? (
            <section className="publication-panel">
              <PanelHeader title="Pending review" note="Approve only the imported publications you want in your CV and website." />
              <div className="publication-review-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={selected.length === normalPending.length}
                    onChange={(event) => setSelected(event.target.checked ? normalPending.map((item) => item.id) : [])}
                  />
                  Select all
                </label>
                <button className="primary-action compact-action" type="button" onClick={() => void approveSelected()} disabled={selected.length === 0 || Boolean(working)}>
                  <CheckCircle2 size={16} />
                  Approve Selected
                </button>
                <button className="secondary-action compact-action" type="button" onClick={() => void rejectItems(selected)} disabled={selected.length === 0 || Boolean(working)}>
                  Remove Selected
                </button>
              </div>
              <div className="publication-list">
                {normalPending.map((item) => (
                  <label className="publication-row is-review" key={item.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected((current) =>
                          event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id)
                        )
                      }
                    />
                    <PublicationSummary data={item.cleanedData} source={item.source} warning={item.reason} />
                  </label>
                ))}
              </div>
            </section>
          ) : null}

          <section className="publication-panel">
            <div className="publication-list-head">
              <PanelHeader title="Approved publications" note="These records are used by your CV and academic website." />
              <div className="publication-filter">
                <div className="publication-search">
                  <Search size={16} />
                  <input
                    value={query}
                    placeholder="Search"
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <button className="secondary-action compact-action" type="button" onClick={() => void sortNewestFirst()} disabled={Boolean(working)}>
                  Sort Newest First
                </button>
              </div>
            </div>

            {filteredApproved.length ? (
              <>
                <div className="publication-list">
                  {pagedApproved.map((item) => (
                    <article className="publication-row" key={item.id}>
                      <PublicationSummary data={item.data} source={item.source} warning={item.warning} />
                      <div className="publication-row-actions">
                        <button className="icon-button" type="button" aria-label="Move publication up" onClick={() => void movePublication(item, -1)}>
                          <ArrowUp size={16} />
                        </button>
                        <button className="icon-button" type="button" aria-label="Move publication down" onClick={() => void movePublication(item, 1)}>
                          <ArrowDown size={16} />
                        </button>
                        {item.data.url ? (
                          <a className="icon-button" href={item.data.url} target="_blank" rel="noreferrer" aria-label="Open publication link">
                            <ExternalLink size={16} />
                          </a>
                        ) : null}
                        <button className="icon-button" type="button" aria-label="Edit publication" onClick={() => setEditing(item)}>
                          <Edit3 size={16} />
                        </button>
                        <button className="icon-button danger-icon" type="button" aria-label="Delete publication" onClick={() => void deletePublication(item)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <PublicationPagination
                  page={activePage}
                  pageCount={pageCount}
                  total={filteredApproved.length}
                  onPage={setPage}
                />
              </>
            ) : (
              <div className="publication-empty">
                <FilePlus2 size={30} />
                <span>No approved publications yet.</span>
              </div>
            )}
          </section>
        </main>
      </div>

      {importOpen ? (
        <PublicationModal title="Import Publications" onClose={() => setImportOpen(false)}>
          <div className="publication-source-grid">
            <SourceImport
              label="ORCID"
              description="Best for DOI-backed works from an ORCID profile."
              value={orcidInput}
              placeholder="0000-0000-0000-0000"
              working={working === "orcid"}
              onChange={setOrcidInput}
              onSubmit={() => void importSource("orcid")}
            />
            <SourceImport
              label="Google Scholar"
              description="Best for title, author, year, and citation-style records."
              value={scholarInput}
              placeholder="https://scholar.google.com/citations?user=..."
              working={working === "scholar"}
              onChange={setScholarInput}
              onSubmit={() => void importSource("scholar")}
            />
          </div>
        </PublicationModal>
      ) : null}

      {doiOpen ? (
        <PublicationModal title="Add by DOI" onClose={() => setDoiOpen(false)}>
          <div className="doi-lookup">
            <label>
              <span>DOI</span>
              <input value={doiInput} placeholder="10.1234/example" onChange={(event) => setDoiInput(event.target.value)} />
            </label>
            <button className="primary-action" type="button" onClick={() => void lookupDoi()} disabled={working === "doi"}>
              {working === "doi" ? <Loader2 className="spin-icon" size={16} /> : <Search size={16} />}
              Look Up DOI
            </button>
          </div>
        </PublicationModal>
      ) : null}

      {editing ? (
        <PublicationModal title="Edit Publication" onClose={() => setEditing(null)}>
          <div className="publication-edit-grid">
            {(Object.keys(publicationFieldConfig) as (keyof PublicationData)[]).map((key) => (
              <PublicationFieldControl
                key={key}
                fieldKey={key}
                value={editing.data[key]}
                onChange={(value) => queueEditSave({ ...editing, data: { ...editing.data, [key]: value } })}
              />
            ))}
          </div>
          <div className="publication-modal-actions">
            <button className="danger-action" type="button" onClick={() => void deletePublication(editing)}>
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        </PublicationModal>
      ) : null}
    </section>
  );
}

function PublicationPagination({
  page,
  pageCount,
  total,
  onPage
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className="publication-pagination">
      <span>
        Showing {Math.min(total, (page - 1) * pageSize + 1)}-{Math.min(total, page * pageSize)} of {total}
      </span>
      <div>
        <button className="icon-button" type="button" aria-label="Previous publications page" onClick={() => onPage(Math.max(1, page - 1))} disabled={page === 1}>
          <ChevronLeft size={16} />
        </button>
        <small>{page} / {pageCount}</small>
        <button className="icon-button" type="button" aria-label="Next publications page" onClick={() => onPage(Math.min(pageCount, page + 1))} disabled={page === pageCount}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function PublicationFieldControl({
  fieldKey,
  value,
  onChange
}: {
  fieldKey: keyof PublicationData;
  value: string;
  onChange: (value: string) => void;
}) {
  const config = publicationFieldConfig[fieldKey];
  const example = publicationFieldExamples[fieldKey];

  return (
    <label className={config.full ? "full" : ""}>
      <span>{config.label}</span>
      {config.type === "textarea" ? (
        <textarea rows={3} value={value} placeholder={example} onChange={(event) => onChange(event.target.value)} />
      ) : config.type === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">Select</option>
          {(config.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input value={value} type={config.type} placeholder={example} onChange={(event) => onChange(event.target.value)} />
      )}
      {example ? <small className="field-example">Example: {example}</small> : null}
    </label>
  );
}

function PanelHeader({ title, note }: { title: string; note: string }) {
  return (
    <div className="publication-panel-head">
      <h2>{title}</h2>
      <p>{note}</p>
    </div>
  );
}

function PublicationSummary({ data, source, warning }: { data: PublicationData; source: string; warning?: string }) {
  return (
    <div className="publication-summary">
      <strong>{data.title || "Untitled publication"}</strong>
      <span>{[data.authors, data.year, data.venue].filter(Boolean).join(" - ") || "Publication details not added yet"}</span>
      <div className="publication-badges">
        <small>{sourceLabel(source)}</small>
        {data.doi ? <small>DOI</small> : null}
        {warning ? <small className="warning-badge">{warning}</small> : null}
      </div>
    </div>
  );
}

function PublicationCompare({ incoming, existing, reason }: { incoming: PublicationData; existing: PublicationData; reason: string }) {
  return (
    <div className="publication-compare">
      <CompareColumn label="Incoming" data={incoming} />
      <CompareColumn label="Existing" data={existing} />
      <p>{reason}</p>
    </div>
  );
}

function CompareColumn({ label, data }: { label: string; data: PublicationData }) {
  return (
    <div>
      <span className="section-label">{label}</span>
      <strong>{data.title || "Untitled"}</strong>
      <small>{[data.authors, data.year, data.venue, data.doi].filter(Boolean).join(" - ")}</small>
    </div>
  );
}

function PublicationModal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="publication-modal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="publication-modal-head">
          <h2>{title}</h2>
          <button className="modal-close-inline" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SourceImport({
  label,
  description,
  value,
  placeholder,
  working,
  onChange,
  onSubmit
}: {
  label: string;
  description: string;
  value: string;
  placeholder: string;
  working: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="publication-source">
      <strong>{label}</strong>
      <p>{description}</p>
      <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
      <button className="primary-action compact-action" type="button" onClick={onSubmit} disabled={working}>
        {working ? <Loader2 className="spin-icon" size={16} /> : <DownloadCloud size={16} />}
        Import {label}
      </button>
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "google_scholar") return "Google Scholar";
  if (source === "orcid") return "ORCID";
  if (source === "doi") return "DOI";
  if (source.includes("+")) return "Merged";
  return "Manual";
}
