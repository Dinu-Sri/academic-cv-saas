"use client";

import { useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, X } from "lucide-react";

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

type PublicationStats = {
  approved: number;
  pending: number;
  duplicates: number;
  doiCount: number;
};

type PublicationQualityIssue = {
  id: string;
  entryId: string;
  field: keyof PublicationData;
  action: "update" | "remove";
  severity: "warning" | "suggestion";
  message: string;
  current: string;
  suggestion: string;
  suggestedData: PublicationData;
};

type PublicationQualityScan = {
  status: "clean" | "issues" | "ai_unavailable";
  summary: string;
  checked: number;
  issues: PublicationQualityIssue[];
};

export function PublicationStatusPanel() {
  const [stats, setStats] = useState<PublicationStats>({ approved: 0, pending: 0, duplicates: 0, doiCount: 0 });
  const [scan, setScan] = useState<PublicationQualityScan | null>(null);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [addressed, setAddressed] = useState<string[]>([]);

  const pendingIssues = (scan?.issues ?? []).filter((issue) => !addressed.includes(issue.id));
  const reviewComplete = Boolean(scan) && pendingIssues.length === 0;

  useEffect(() => {
    void refreshStats();
  }, []);

  async function refreshStats() {
    const response = await fetch("/api/publications", { credentials: "include" });
    const payload = (await response.json()) as { stats?: PublicationStats };
    if (response.ok && payload.stats) {
      setStats(payload.stats);
    }
  }

  async function runReview() {
    setWorking("review");
    setError("");
    try {
      const response = await fetch("/api/publications/review/quality", { credentials: "include" });
      const payload = (await response.json()) as { scan?: PublicationQualityScan; error?: string };
      if (!response.ok || !payload.scan) {
        throw new Error(payload.error || "Could not review publications.");
      }
      setAddressed([]);
      setScan(payload.scan);
      setReviewOpen(payload.scan.issues.length > 0);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Could not review publications.");
    } finally {
      setWorking("");
    }
  }

  async function applyIssue(issue: PublicationQualityIssue) {
    setWorking(issue.id);
    setError("");
    try {
      const response = await fetch("/api/publications/review/quality", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: issue.entryId, action: issue.action, data: issue.suggestedData })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not apply suggestion.");
      }
      setAddressed((current) => [...current, issue.id]);
      await refreshStats();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Could not apply suggestion.");
    } finally {
      setWorking("");
    }
  }

  async function applyAll() {
    for (const issue of pendingIssues) {
      await applyIssue(issue);
    }
  }

  function rejectIssue(issueId: string) {
    setAddressed((current) => [...current, issueId]);
  }

  return (
    <>
      <span className="section-label">Publications</span>
      <section className={`status-review-card ${reviewComplete ? "is-complete" : ""}`}>
        <div className="status-review-head">
          <span className="status-review-title">
            <Bot size={16} />
            CV Scholar AI
          </span>
        </div>
        <button className={`secondary-action compact-action status-review-button ${reviewComplete ? "is-success-action" : ""}`} type="button" onClick={() => void runReview()} disabled={working === "review"}>
          {working === "review" ? <Loader2 className="spin-icon" size={15} /> : <CheckCircle2 size={15} />}
          Review
        </button>
        <p>{scan?.summary ?? "Run review after imports or edits."}</p>
        {scan ? <small>{scan.checked} publication{scan.checked === 1 ? "" : "s"} checked</small> : null}
        {pendingIssues.length > 0 ? (
          <button className="primary-action compact-action status-review-open" type="button" onClick={() => setReviewOpen(true)}>
            View Suggestions ({pendingIssues.length})
          </button>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
      </section>
      <div className="status-figure-list">
        <StatusFigure label="Approved" value={stats.approved} />
        <StatusFigure label="Pending review" value={stats.pending} />
        <StatusFigure label="Possible duplicates" value={stats.duplicates} />
      </div>

      {reviewOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setReviewOpen(false)}>
          <section className="publication-review-modal" role="dialog" aria-modal="true" aria-label="Publication suggestions" onMouseDown={(event) => event.stopPropagation()}>
            <div className="field-picker-head publication-review-head">
              <div>
                <span className="section-label">Publication Review</span>
                <h2>Review suggested fixes</h2>
                <small className="import-helper">Compare current metadata with the optimized suggestion before applying.</small>
              </div>
              {pendingIssues.length > 0 ? (
                <button className="primary-action compact-action publication-review-apply-all" type="button" onClick={() => void applyAll()} disabled={Boolean(working)}>
                  {working ? <Loader2 className="spin-icon" size={15} /> : <CheckCircle2 size={15} />}
                  Apply All Suggestions
                </button>
              ) : null}
              <button className="modal-close-inline" type="button" aria-label="Close publication suggestions" onClick={() => setReviewOpen(false)}>
                <X size={18} />
              </button>
            </div>
            {pendingIssues.length > 0 ? (
              <>
                <div className="publication-suggestion-list">
                  {pendingIssues.map((issue) => (
                    <article className="publication-suggestion" key={issue.id}>
                      <div className="publication-suggestion-top">
                        <strong>{issue.message}</strong>
                        <small>{fieldLabel(issue.field)}</small>
                        <h3>{issue.suggestedData.title || "Untitled publication"}</h3>
                        <p>{publicationMeta(issue.suggestedData)}</p>
                      </div>
                      <div className="publication-suggestion-compare">
                        <CompareValue label="Current value" value={issue.current || "Empty"} />
                        <CompareValue label={issue.action === "remove" ? "Recommended action" : "Suggested value"} value={issue.suggestion} />
                      </div>
                      <div className="publication-suggestion-actions">
                        <button className="primary-action compact-action" type="button" onClick={() => void applyIssue(issue)} disabled={Boolean(working)}>
                          {issue.action === "remove" ? "Remove" : "Apply"}
                        </button>
                        <button className="secondary-action compact-action" type="button" onClick={() => rejectIssue(issue.id)} disabled={Boolean(working)}>
                          Reject
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <div className="publication-review-empty">
                <CheckCircle2 size={24} />
                <strong>All suggestions addressed</strong>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function StatusFigure({ label, value }: { label: string; value: number }) {
  return (
    <div className="status-figure">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function CompareValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function fieldLabel(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function publicationMeta(data: PublicationData) {
  return [data.authors, data.year, data.venue].filter(Boolean).join(" - ") || "Publication details are incomplete.";
}
