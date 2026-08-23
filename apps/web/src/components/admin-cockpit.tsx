"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  Globe2,
  KeyRound,
  Laptop,
  Loader2,
  MonitorSmartphone,
  Search,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Tablet,
  UsersRound,
  X
} from "lucide-react";

type CockpitPayload = {
  generatedAt: string;
  overview: Record<string, number>;
  users: Array<{ id: string; name: string; email: string; createdAt: string }>;
  runs: AgentRun[];
  runStatuses: { status: string; count: number }[];
  proposals: AgentProposal[];
  memory: { items: MemoryItem[]; candidates: MemoryItem[] };
  knowledge: { documents: KnowledgeDocument[]; chunkCount: number };
  tasks: AgentTask[];
  jobs: { queues: QueueHealth[]; pdfJobs: JobItem[]; importJobs: JobItem[] };
  website?: {
    counts: {
      total: number;
      published: number;
      draft: number;
      blocked: number;
      failedJobs: number;
      unreadMessages: number;
    };
    websites: WebsiteAdminRow[];
    recentJobs: WebsiteJobRow[];
    recentSnapshots: WebsiteSnapshotRow[];
  };
  policy: {
    tools: ToolPolicy[];
    intentMatrix: { intent: string; allowedTools: string[] }[];
    guardrails: string[];
  };
  configuration: {
    features: ConfigValue[];
    models: ConfigValue[];
    secrets: { name: string; configured: boolean }[];
    runtime: Record<string, string | boolean>;
  };
  billing?: {
    subscriptions: BillingSubscriptionRow[];
    payments: BillingPaymentRow[];
  };
};

type WebsiteAdminRow = {
  id: string;
  username: string;
  status: string;
  version: number;
  publicPath: string;
  blockedAt: string | null;
  blockedReason: string;
  publishedAt: string | null;
  updatedAt: string;
  profile: { id: string; displayName: string; email: string };
  workspace: { id: string; name: string; slug: string };
  counts: { snapshots: number; publishJobs: number; contactMessages: number };
};

type WebsiteJobRow = {
  id: string;
  websiteId: string;
  username: string;
  websiteStatus: string;
  status: string;
  stage: string;
  message: string;
  error: string;
  attempts: number;
  createdAt: string;
  finishedAt: string | null;
};

type WebsiteSnapshotRow = {
  id: string;
  websiteId: string;
  username: string;
  version: number;
  status: string;
  publishedAt: string;
  retiredAt: string | null;
};

type ManagedUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  planKey: string;
  planName: string;
  planExpiresAt: string | null;
  hasPassword: boolean;
  hasGoogle: boolean;
  cvCount: number;
  pdfCount: number;
  lastDevice: string;
  lastDeviceLabel: string;
  isAdmin: boolean;
  workspaceId: string | null;
};

type ManagedUserDetail = ManagedUserRow & {
  firstLoginAt: string | null;
  firstDevice: string;
  firstDeviceLabel: string;
  lastUserAgent: string | null;
  sessionCount: number;
  aiChatMessageCount: number;
  agentRunCount: number;
  lastPdfAt: string | null;
  lastPdfStatus: string | null;
  lastPdfDownloadUrl: string | null;
  websitePublished: boolean;
  websiteStatus: string | null;
  websiteUsername: string | null;
  websiteUrl: string | null;
  profileDisplayName: string | null;
  paymentCount: number;
  lastPaymentAt: string | null;
};

type BillingPaymentRow = {
  id: string;
  orderId: string;
  planKey: string;
  planName: string;
  amount: number;
  currency: string;
  status: string;
  billingDays: number;
  createdAt: string;
  workspaceId: string;
  workspaceName: string;
  ownerName: string;
  ownerEmail: string;
  source: string;
};

type BillingSubscriptionRow = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  ownerName: string;
  ownerEmail: string;
  planKey: string;
  planName: string;
  status: string;
  expiresAt: string | null;
  previousPlanKey: string | null;
};

type AgentRun = {
  id: string;
  status: string;
  mode: string;
  intent: string;
  currentNode: string;
  resumeStatus: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostCents: number;
  latencyMs: number;
  promptVersion: string;
  toolVersion: string;
  error: string;
  createdAt: string;
  finishedAt: string | null;
  workspace: { id: string; name: string; slug: string };
  profile: { id: string; displayName: string; affiliation: string; completeness: number };
  message: { role: string; content: string; createdAt: string } | null;
  events: EventItem[];
  toolCalls: ToolCall[];
  checkpoints: Checkpoint[];
};

type EventItem = {
  id: string;
  sequence: number;
  type: string;
  status: string;
  message: string;
  payload: unknown;
  createdAt: string;
};

type ToolCall = {
  id: string;
  toolName: string;
  toolVersion: string;
  risk: string;
  status: string;
  input: unknown;
  output: unknown;
  error: string;
  startedAt: string;
  finishedAt: string | null;
};

type Checkpoint = {
  id: string;
  nodeName: string;
  status: string;
  state: unknown;
  createdAt: string;
};

type AgentProposal = {
  id: string;
  status: string;
  title: string;
  summary: string;
  changes: { id: string; patchType: string; targetType: string; targetField: string; sectionKey: string; status: string; before: unknown; after: unknown }[];
  approvals: { id: string; decision: string; decidedBy: string; reason: string; createdAt: string }[];
  createdAt: string;
};

type MemoryItem = {
  id: string;
  category: string;
  status: string;
  content: string;
  rationale: string;
  sensitivity: string;
  confidence: number;
  updatedAt?: string;
  createdAt?: string;
};

type KnowledgeDocument = {
  id: string;
  namespace: string;
  visibility: string;
  sourceType: string;
  title: string;
  version: string;
  status: string;
  sourceUri: string;
  chunkCount: number;
  updatedAt: string;
};

type AgentTask = {
  id: string;
  title: string;
  goal: string;
  status: string;
  activeThreadId: string;
  updatedAt: string;
  threads: { id: string; chapterNumber: number; title: string; status: string; tokenEstimate: number; messageCount: number; compactionCount: number; rolloverReason: string }[];
  summaries: { id: string; coveredMessageCount: number; tokenEstimate: number; createdAt: string }[];
};

type QueueHealth = {
  name: string;
  status: string;
  counts?: Record<string, number>;
  error?: string;
};

type JobItem = {
  id: string;
  status: string;
  templateKey?: string;
  stage?: string;
  sourceFilename?: string;
  message: string;
  attempts?: number;
  createdAt: string;
  finishedAt?: string | null;
};

type ToolPolicy = {
  name: string;
  version: string;
  risk: string;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  description: string;
};

type ConfigValue = {
  name: string;
  value: string;
};

const sections = [
  "overview",
  "journey",
  "runs",
  "workflow",
  "policy",
  "memory",
  "knowledge",
  "website",
  "jobs",
  "config",
  "architecture",
  "users",
  "billing"
] as const;

export function AdminCockpit() {
  const [payload, setPayload] = useState<CockpitPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<(typeof sections)[number]>(() => {
    if (typeof window === "undefined") return "overview";
    const section = window.location.hash.replace("#", "");
    return sections.includes(section as (typeof sections)[number]) ? (section as (typeof sections)[number]) : "overview";
  });
  const [selectedRunId, setSelectedRunId] = useState("");

  const loadCockpit = useCallback(async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "refresh") {
      setLoading(true);
      setError("");
      window.dispatchEvent(new CustomEvent("cvscholar-admin-loading", { detail: { loading: true } }));
    }

    try {
      const response = await fetch("/api/admin/cockpit", { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load admin cockpit.");
      setPayload(data);
      setSelectedRunId(data.runs?.[0]?.id ?? "");
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load admin cockpit.");
    } finally {
      setLoading(false);
      window.dispatchEvent(new CustomEvent("cvscholar-admin-loading", { detail: { loading: false } }));
    }
  }, []);

  useEffect(() => {
    // Initial load starts with loading=true; avoid synchronous setState in the effect body.
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/cockpit", { credentials: "include" });
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) throw new Error(data.error || "Could not load admin cockpit.");
        setPayload(data);
        setSelectedRunId(data.runs?.[0]?.id ?? "");
        setError("");
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Could not load admin cockpit.");
      } finally {
        if (!cancelled) {
          setLoading(false);
          window.dispatchEvent(new CustomEvent("cvscholar-admin-loading", { detail: { loading: false } }));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function syncFromHash() {
      const section = window.location.hash.replace("#", "");
      if (sections.includes(section as (typeof sections)[number])) {
        setActiveSection(section as (typeof sections)[number]);
      }
    }

    function onExternalRefresh() {
      void loadCockpit("refresh");
    }

    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("cvscholar-admin-refresh", onExternalRefresh);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("cvscholar-admin-refresh", onExternalRefresh);
    };
  }, [loadCockpit]);

  const selectedRun = payload?.runs.find((run) => run.id === selectedRunId) ?? payload?.runs[0] ?? null;

  return (
    <section className="workspace-screen admin-cockpit-screen">
      {error ? <p className="form-error admin-alert">{error}</p> : null}
      {loading && !payload ? <p className="muted-text admin-loading">Loading admin cockpit...</p> : null}
      {payload ? (
        <div id={activeSection}>
          {activeSection === "overview" ? <OverviewPanel payload={payload} /> : null}
          {activeSection === "journey" ? <JourneyPanel /> : null}
          {activeSection === "runs" ? <RunsPanel runs={payload.runs} selectedRun={selectedRun} setSelectedRunId={setSelectedRunId} /> : null}
          {activeSection === "workflow" ? <WorkflowPanel selectedRun={selectedRun} tasks={payload.tasks} proposals={payload.proposals} /> : null}
          {activeSection === "policy" ? <PolicyPanel payload={payload} /> : null}
          {activeSection === "memory" ? <MemoryPanel memory={payload.memory} /> : null}
          {activeSection === "knowledge" ? <KnowledgePanel knowledge={payload.knowledge} /> : null}
          {activeSection === "website" ? <WebsiteOpsPanel website={payload.website} onChanged={() => void loadCockpit("refresh")} /> : null}
          {activeSection === "jobs" ? <JobsPanel jobs={payload.jobs} /> : null}
          {activeSection === "config" ? <ConfigPanel configuration={payload.configuration} generatedAt={payload.generatedAt} /> : null}
          {activeSection === "architecture" ? <ArchitectureCanvas /> : null}
          {activeSection === "users" ? <UsersPanel onChanged={() => void loadCockpit("refresh")} /> : null}
          {activeSection === "billing" ? (
            <BillingPanel billing={payload.billing} onChanged={() => void loadCockpit("refresh")} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function OverviewPanel({ payload }: { payload: CockpitPayload }) {
  const cards = [
    ["Users", payload.overview.users, UsersRound],
    ["Workspaces", payload.overview.totalWorkspaces, Database],
    ["Agent runs", payload.overview.agentRuns, Bot],
    ["Failed runs", payload.overview.failedRuns, AlertTriangle],
    ["Pending approvals", payload.overview.pendingProposals, CheckCircle2],
    ["Knowledge chunks", payload.overview.knowledgeChunks, BookOpen],
    ["Websites", payload.overview.websites ?? 0, Globe2],
    ["Published sites", payload.overview.publishedWebsites ?? 0, CheckCircle2],
    ["Blocked sites", payload.overview.blockedWebsites ?? 0, AlertTriangle],
    ["Failed publish jobs", payload.overview.failedPublishJobs ?? 0, ServerCog],
    ["Memories", payload.overview.activeMemories, BrainCircuit],
    ["Memory candidates", payload.overview.pendingMemoryCandidates, Activity]
  ] as const;

  return (
    <article className="admin-panel">
      <div className="admin-metric-grid">
        {cards.map(([label, value, Icon]) => (
          <div className="admin-metric" key={label}>
            <Icon size={18} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="admin-two-column">
        <MiniList title="Run status" items={payload.runStatuses.map((status) => `${status.status}: ${status.count}`)} />
        <MiniList title="Queue health" items={payload.jobs.queues.map((queue) => `${queue.name}: ${queue.status}${queue.counts ? ` (${Object.entries(queue.counts).map(([key, value]) => `${key} ${value}`).join(", ")})` : ""}`)} />
      </div>
    </article>
  );
}

type JourneyAnalytics = {
  generatedAt: string;
  range: { key: string; from: string; to: string };
  summary: {
    visitors: number;
    guestVisitors: number;
    registeredVisitors: number;
    convertedVisitors: number;
    conversionRate: number;
    events: number;
  };
  timeline: { label: string; guest: number; registered: number }[];
  pages: JourneyBar[];
  actions: JourneyBar[];
  funnels: {
    id: string;
    name: string;
    audience: string;
    steps: { label: string; count: number; rate: number; dropOff: number }[];
  }[];
};

type JourneyBar = {
  label: string;
  guest: number;
  registered: number;
  visitors: number;
  events: number;
};

const journeyRanges = [
  ["realtime", "Realtime"],
  ["24h", "24 hours"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["month", "This month"],
  ["custom", "Custom"]
] as const;

function JourneyPanel() {
  const [range, setRange] = useState<(typeof journeyRanges)[number][0]>("7d");
  const [customFrom, setCustomFrom] = useState(() => dateInputValue(new Date(Date.now() - 7 * 86_400_000)));
  const [customTo, setCustomTo] = useState(() => dateInputValue(new Date()));
  const [data, setData] = useState<JourneyAnalytics | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ range });
    if (range === "custom") {
      params.set("from", new Date(`${customFrom}T00:00:00Z`).toISOString());
      params.set("to", new Date(`${customTo}T23:59:59Z`).toISOString());
    }
    void fetch(`/api/admin/journey?${params.toString()}`, { credentials: "include" })
      .then(async (response) => {
        const payload = (await response.json()) as JourneyAnalytics & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Could not load user journeys.");
        if (!cancelled) {
          setData(payload);
          setError("");
        }
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load user journeys.");
      });
    return () => {
      cancelled = true;
    };
  }, [range, customFrom, customTo, refreshKey]);

  const summary = data?.summary;
  return (
    <section className="admin-journey-panel">
      <div className="admin-panel-head journey-panel-head">
        <div>
          <span className="section-label">User Journey</span>
          <h2>Behavior, conversion, and drop-off</h2>
          <p>Follow guest and registered journeys from first visit to CV, publication, website, and pricing outcomes.</p>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={() => setRefreshKey((value) => value + 1)}>
          Refresh
        </button>
      </div>

      <div className="journey-filter-row" role="group" aria-label="Journey time range">
        {journeyRanges.map(([key, label]) => (
          <button key={key} type="button" className={range === key ? "is-active" : ""} onClick={() => setRange(key)}>
            {label}
          </button>
        ))}
        {range === "custom" ? (
          <div className="journey-custom-dates">
            <label>From<input type="date" value={customFrom} max={customTo} onChange={(event) => setCustomFrom(event.target.value)} /></label>
            <label>To<input type="date" value={customTo} min={customFrom} onChange={(event) => setCustomTo(event.target.value)} /></label>
          </div>
        ) : null}
      </div>

      {error ? <p className="form-error admin-alert">{error}</p> : null}
      {!data ? <p className="muted-text admin-loading">Loading journey analytics...</p> : null}
      {data && summary ? (
        <>
          <div className="journey-summary-grid">
            <JourneyMetric label="Visitors" value={summary.visitors} note={`${summary.events} tracked actions`} />
            <JourneyMetric label="Guests" value={summary.guestVisitors} note="Anonymous sessions" />
            <JourneyMetric label="Registered" value={summary.registeredVisitors} note="Active account sessions" />
            <JourneyMetric label="Guest conversions" value={summary.convertedVisitors} note={`${summary.conversionRate}% conversion`} />
          </div>

          <section className="journey-volume-section">
            <div className="journey-section-title">
              <div><span className="section-label">Traffic rhythm</span><h3>Activity over time</h3></div>
              <JourneyLegend />
            </div>
            <TimelineBars values={data.timeline} />
          </section>

          <div className="journey-funnel-grid">
            {data.funnels.map((funnel) => <JourneyFunnel key={funnel.id} funnel={funnel} />)}
          </div>

          <div className="journey-analysis-grid">
            <JourneyBarList title="Top paths" items={data.pages} />
            <JourneyBarList title="High-value actions" items={data.actions} humanize />
          </div>
        </>
      ) : null}
    </section>
  );
}

function JourneyMetric({ label, value, note }: { label: string; value: number; note: string }) {
  return <div className="journey-metric"><span>{label}</span><strong>{value.toLocaleString()}</strong><small>{note}</small></div>;
}

function JourneyLegend() {
  return <div className="journey-legend"><span><i className="is-guest" />Guests</span><span><i className="is-registered" />Registered</span></div>;
}

function TimelineBars({ values }: { values: JourneyAnalytics["timeline"] }) {
  const max = Math.max(1, ...values.map((item) => item.guest + item.registered));
  return (
    <div className="journey-timeline" aria-label="Guest and registered activity chart">
      {values.map((item, index) => (
        <div className="journey-timeline-column" key={`${item.label}-${index}`} title={`${item.label}: ${item.guest} guest, ${item.registered} registered`}>
          <div className="journey-timeline-stack" style={{ height: `${Math.max(4, ((item.guest + item.registered) / max) * 100)}%` }}>
            <span className="is-registered" style={{ flex: item.registered }} />
            <span className="is-guest" style={{ flex: item.guest }} />
          </div>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  );
}

function JourneyFunnel({ funnel }: { funnel: JourneyAnalytics["funnels"][number] }) {
  const max = Math.max(1, funnel.steps[0]?.count ?? 0);
  return (
    <section className="journey-funnel">
      <div className="journey-funnel-head"><h3>{funnel.name}</h3><span>{funnel.audience}</span></div>
      <ol>
        {funnel.steps.map((step) => (
          <li key={step.label}>
            <div><strong>{step.label}</strong><span>{step.count.toLocaleString()} <small>{step.rate}%</small></span></div>
            <div className="journey-funnel-bar"><span style={{ width: `${Math.max(step.count ? 6 : 0, (step.count / max) * 100)}%` }} /></div>
            {step.dropOff ? <small className="journey-dropoff">-{step.dropOff} from previous step</small> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function JourneyBarList({ title, items, humanize = false }: { title: string; items: JourneyBar[]; humanize?: boolean }) {
  const max = Math.max(1, ...items.map((item) => item.visitors));
  return (
    <section className="journey-bar-list">
      <div className="journey-section-title"><h3>{title}</h3><JourneyLegend /></div>
      {items.length ? items.map((item) => (
        <div className="journey-bar-row" key={item.label}>
          <div><strong>{humanize ? humanizeEvent(item.label) : item.label}</strong><span>{item.visitors} visitors</span></div>
          <div className="journey-split-bar" style={{ width: `${Math.max(5, (item.visitors / max) * 100)}%` }}>
            <span className="is-guest" style={{ flex: item.guest }} />
            <span className="is-registered" style={{ flex: item.registered }} />
          </div>
        </div>
      )) : <p className="muted-text">No activity in this period.</p>}
    </section>
  );
}

function humanizeEvent(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function DeviceIcon({ device }: { device: string }) {
  if (device === "mobile") return <Smartphone size={14} />;
  if (device === "tablet") return <Tablet size={14} />;
  if (device === "desktop") return <Laptop size={14} />;
  return <MonitorSmartphone size={14} />;
}

function UsersPanel({ onChanged }: { onChanged: () => void }) {
  const [users, setUsers] = useState<ManagedUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [includeGuests, setIncludeGuests] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [grantError, setGrantError] = useState("");
  const [grantOk, setGrantOk] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagedUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async (nextPage: number, nextSearch: string, nextIncludeGuests: boolean) => {
    setLoading(true);
    setError("");
    try {
      const qs = new URLSearchParams({
        page: String(nextPage),
        pageSize: "10",
        ...(nextSearch.trim() ? { search: nextSearch.trim() } : {}),
        ...(nextIncludeGuests ? { includeGuests: "1" } : {})
      });
      const response = await fetch(`/api/admin/users?${qs.toString()}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load users.");
      setUsers(data.users as ManagedUserRow[]);
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadUsers(1, "", false);
    });
    return () => {
      cancelled = true;
    };
  }, [loadUsers]);

  async function openDetail(userId: string) {
    setSelectedId(userId);
    setDetail(null);
    setDetailLoading(true);
    setGrantError("");
    setGrantOk("");
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { credentials: "include" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load user.");
      setDetail(data.user as ManagedUserDetail);
    } catch (loadError) {
      setGrantError(loadError instanceof Error ? loadError.message : "Could not load user.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function grantPlan(workspaceId: string, planKey: "free" | "pdf_pass" | "scholar_annual") {
    setBusyId(`${workspaceId}-${planKey}`);
    setGrantError("");
    setGrantOk("");
    try {
      const response = await fetch("/api/admin/billing/grant", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          planKey,
          notifyUser: true,
          note: `Admin grant ${planKey}`
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Grant failed");
      setGrantOk(
        `Granted ${planKey}${body.expiresAt ? ` until ${new Date(body.expiresAt).toLocaleDateString()}` : ""}`
      );
      onChanged();
      await loadUsers(page, search, includeGuests);
      if (selectedId) await openDetail(selectedId);
    } catch (grantErr) {
      setGrantError(grantErr instanceof Error ? grantErr.message : "Grant failed");
    } finally {
      setBusyId("");
    }
  }

  return (
    <article className="admin-panel">
      <div className="admin-panel-head-row">
        <div>
          <h2>Registered users</h2>
          <p className="muted-text">
            {total} {includeGuests ? "user" : "account"}
            {total === 1 ? "" : "s"}
            {includeGuests ? " (including guests)" : " (guests hidden)"} · 10 per page
          </p>
        </div>
      </div>

      <form
        className="admin-search admin-users-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput);
          void loadUsers(1, searchInput, includeGuests);
        }}
      >
        <Search size={16} />
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by name or email"
        />
        <label className="admin-users-guest-toggle">
          <input
            type="checkbox"
            checked={includeGuests}
            onChange={(event) => {
              const next = event.target.checked;
              setIncludeGuests(next);
              void loadUsers(1, searchInput, next);
            }}
          />
          <span>Include guests</span>
        </label>
        <button className="secondary-action compact-action" type="submit">
          Search
        </button>
      </form>

      {error ? <p className="form-error admin-alert">{error}</p> : null}
      {grantError ? <p className="form-error admin-alert">{grantError}</p> : null}
      {grantOk ? <p className="muted-text admin-alert">{grantOk}</p> : null}

      <div className="admin-table-wrap">
        <table className="admin-table admin-users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Plan</th>
              <th>Auth</th>
              <th>CVs / PDFs</th>
              <th>Device</th>
              <th>Joined</th>
              <th>Last login</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="admin-empty-cell">
                  <Loader2 className="spin" size={18} /> Loading users…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={7} className="admin-empty-cell">
                  No registered users found.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.id}
                  className="admin-user-row"
                  onClick={() => void openDetail(user.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      void openDetail(user.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${user.name}`}
                >
                  <td>
                    <strong>
                      {user.name}
                      {user.isAdmin ? <span className="admin-badge">Admin</span> : null}
                    </strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <strong>{user.planName}</strong>
                    <small>
                      {user.planExpiresAt
                        ? `Until ${new Date(user.planExpiresAt).toLocaleDateString()}`
                        : user.planKey === "free"
                          ? "Free forever"
                          : "—"}
                    </small>
                  </td>
                  <td>
                    <span className="admin-auth-icons" title="Sign-in methods">
                      {user.hasGoogle ? <span className="admin-auth-pill">Google</span> : null}
                      {user.hasPassword ? (
                        <span className="admin-auth-pill">
                          <KeyRound size={12} /> Email
                        </span>
                      ) : null}
                      {!user.hasGoogle && !user.hasPassword ? <span className="muted-text">—</span> : null}
                    </span>
                  </td>
                  <td>
                    {user.cvCount} CV{user.cvCount === 1 ? "" : "s"} · {user.pdfCount} PDF
                    {user.pdfCount === 1 ? "" : "s"}
                  </td>
                  <td>
                    <span className="admin-device-pill">
                      <DeviceIcon device={user.lastDevice} />
                      {user.lastDeviceLabel}
                    </span>
                  </td>
                  <td className="admin-date-cell">
                    {new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric"
                    })}
                  </td>
                  <td className="admin-date-cell">
                    {user.lastLoginAt
                      ? new Date(user.lastLoginAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })
                      : "Never"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <nav className="admin-users-pagination" aria-label="Users pagination">
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => void loadUsers(page - 1, search, includeGuests)}
          >
            ← Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            className="secondary-action compact-action"
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => void loadUsers(page + 1, search, includeGuests)}
          >
            Next →
          </button>
        </nav>
      ) : null}

      {selectedId ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        >
          <section
            className="auth-modal admin-user-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-user-detail-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => {
                setSelectedId(null);
                setDetail(null);
              }}
            >
              <X size={18} />
            </button>
            {detailLoading || !detail ? (
              <div className="admin-user-detail-loading">
                <Loader2 className="spin" size={22} />
                <p>Loading user details…</p>
              </div>
            ) : (
              <>
                <span className="section-label">User details</span>
                <h2 id="admin-user-detail-title">{detail.name}</h2>
                <p className="muted-text">{detail.email}</p>

                <dl className="admin-user-detail-grid">
                  <div>
                    <dt>Joined</dt>
                    <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>First login</dt>
                    <dd>
                      {detail.firstLoginAt ? new Date(detail.firstLoginAt).toLocaleString() : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last login</dt>
                    <dd>
                      {detail.lastLoginAt ? new Date(detail.lastLoginAt).toLocaleString() : "Never"}
                    </dd>
                  </div>
                  <div>
                    <dt>Sessions</dt>
                    <dd>{detail.sessionCount}</dd>
                  </div>
                  <div>
                    <dt>First device</dt>
                    <dd>
                      <span className="admin-device-pill">
                        <DeviceIcon device={detail.firstDevice} />
                        {detail.firstDeviceLabel}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Last device</dt>
                    <dd>
                      <span className="admin-device-pill">
                        <DeviceIcon device={detail.lastDevice} />
                        {detail.lastDeviceLabel}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Auth</dt>
                    <dd>
                      {[detail.hasGoogle ? "Google" : null, detail.hasPassword ? "Email/password" : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Email verified</dt>
                    <dd>{detail.emailVerified ? "Yes" : "No"}</dd>
                  </div>
                  <div>
                    <dt>Plan</dt>
                    <dd>
                      {detail.planName}
                      {detail.planExpiresAt
                        ? ` · until ${new Date(detail.planExpiresAt).toLocaleDateString()}`
                        : ""}
                    </dd>
                  </div>
                  <div>
                    <dt>CV documents</dt>
                    <dd>{detail.cvCount}</dd>
                  </div>
                  <div>
                    <dt>PDF generations</dt>
                    <dd>{detail.pdfCount}</dd>
                  </div>
                  <div>
                    <dt>Last PDF</dt>
                    <dd>
                      {detail.lastPdfAt
                        ? `${new Date(detail.lastPdfAt).toLocaleString()}${
                            detail.lastPdfStatus ? ` · ${detail.lastPdfStatus}` : ""
                          }`
                        : "None yet"}
                      {detail.lastPdfDownloadUrl ? (
                        <>
                          {" · "}
                          <a href={detail.lastPdfDownloadUrl} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        </>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>AI chat messages</dt>
                    <dd>{detail.aiChatMessageCount}</dd>
                  </div>
                  <div>
                    <dt>Agent runs</dt>
                    <dd>{detail.agentRunCount}</dd>
                  </div>
                  <div>
                    <dt>Website</dt>
                    <dd>
                      {detail.websitePublished || detail.websiteStatus === "published"
                        ? "Published"
                        : detail.websiteStatus || "None"}
                      {detail.websiteUrl ? (
                        <>
                          {" · "}
                          <a href={detail.websiteUrl} target="_blank" rel="noreferrer">
                            {detail.websiteUsername || "Open site"}
                          </a>
                        </>
                      ) : detail.websiteUsername ? (
                        ` · ${detail.websiteUsername}`
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Profile name</dt>
                    <dd>{detail.profileDisplayName || "—"}</dd>
                  </div>
                  <div>
                    <dt>Payments</dt>
                    <dd>
                      {detail.paymentCount}
                      {detail.lastPaymentAt
                        ? ` · last ${new Date(detail.lastPaymentAt).toLocaleDateString()}`
                        : ""}
                    </dd>
                  </div>
                </dl>

                {detail.lastUserAgent ? (
                  <p className="admin-user-ua muted-text" title={detail.lastUserAgent}>
                    Last UA: {detail.lastUserAgent.slice(0, 120)}
                    {detail.lastUserAgent.length > 120 ? "…" : ""}
                  </p>
                ) : null}

                {detail.workspaceId ? (
                  <div className="admin-grant-actions admin-user-grant-row">
                    <span className="muted-text">Grant plan</span>
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void grantPlan(detail.workspaceId!, "pdf_pass")}
                    >
                      {busyId === `${detail.workspaceId}-pdf_pass` ? "…" : "PDF Pass"}
                    </button>
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void grantPlan(detail.workspaceId!, "scholar_annual")}
                    >
                      {busyId === `${detail.workspaceId}-scholar_annual` ? "…" : "Annual"}
                    </button>
                    <button
                      className="secondary-action compact-action"
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void grantPlan(detail.workspaceId!, "free")}
                    >
                      {busyId === `${detail.workspaceId}-free` ? "…" : "Free"}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </div>
      ) : null}
    </article>
  );
}

function BillingPanel({
  billing,
  onChanged
}: {
  billing?: CockpitPayload["billing"];
  onChanged: () => void;
}) {
  const payments = billing?.payments ?? [];
  const subscriptions = billing?.subscriptions ?? [];
  const paidCount = subscriptions.filter((s) => s.planKey !== "free").length;

  return (
    <article className="admin-panel">
      <div className="admin-panel-head-row">
        <div>
          <h2>Billing</h2>
          <p className="muted-text">
            {paidCount} paid workspace{paidCount === 1 ? "" : "s"} · {payments.length} recent payments (gateway deferred — admin grants only)
          </p>
        </div>
        <button className="secondary-action compact-action" type="button" onClick={onChanged}>
          Refresh
        </button>
      </div>

      <p className="muted-text admin-invites-move-hint">
        Package invitations moved to{" "}
        <a href="/admin/invites">Admin → Invites</a> (single and bulk email link generation) ·{" "}
        <a href="/admin/discount-codes">Discount codes</a> (checkout promo codes).
      </p>

      <h3>Active subscriptions</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Owner</th>
              <th>Workspace</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <small>No subscription rows yet. Open /billing once as a user to create free defaults.</small>
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.workspaceId}>
                  <td>
                    <strong>{sub.ownerName || "—"}</strong>
                    <small>{sub.ownerEmail}</small>
                  </td>
                  <td>
                    <strong>{sub.workspaceName}</strong>
                    <small>{sub.workspaceSlug}</small>
                  </td>
                  <td>{sub.planName}</td>
                  <td>
                    <Badge>{sub.status}</Badge>
                  </td>
                  <td>
                    <small>
                      {sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : "—"}
                      {sub.previousPlanKey ? ` · was ${sub.previousPlanKey}` : ""}
                    </small>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3>Recent payments / grants</h3>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Owner</th>
              <th>Plan</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <small>No payments yet.</small>
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <small>{new Date(p.createdAt).toLocaleString()}</small>
                  </td>
                  <td>
                    <strong>{p.ownerName || "—"}</strong>
                    <small>{p.ownerEmail}</small>
                  </td>
                  <td>
                    {p.planName}
                    <small>{p.billingDays ? `${p.billingDays} days` : ""}</small>
                  </td>
                  <td>
                    {p.currency} {p.amount.toFixed(2)}
                  </td>
                  <td>
                    <Badge>{p.status}</Badge>
                  </td>
                  <td>
                    <small>{p.source}</small>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function RunsPanel({ runs, selectedRun, setSelectedRunId }: { runs: AgentRun[]; selectedRun: AgentRun | null; setSelectedRunId: (id: string) => void }) {
  return (
    <article className="admin-panel">
      <div className="admin-run-layout">
        <div className="admin-run-list">
          {runs.map((run) => (
            <button className={selectedRun?.id === run.id ? "is-active" : ""} key={run.id} type="button" onClick={() => setSelectedRunId(run.id)}>
              <span><Badge>{run.status}</Badge><Badge>{run.intent}</Badge></span>
              <strong>{run.profile.displayName || "Unnamed profile"}</strong>
              <small>{run.currentNode || run.model || run.createdAt}</small>
            </button>
          ))}
        </div>
        <RunDetail run={selectedRun} />
      </div>
    </article>
  );
}

function RunDetail({ run }: { run: AgentRun | null }) {
  if (!run) return <p className="muted-text">No agent run has been recorded yet.</p>;

  return (
    <div className="admin-run-detail">
      <div className="admin-detail-head">
        <div>
          <h3>{run.intent} run</h3>
          <p>{run.workspace.name} / {run.profile.displayName || "Unnamed profile"}</p>
        </div>
        <Badge>{run.promptVersion}</Badge>
      </div>
      <div className="admin-detail-grid">
        <KeyValue label="Model" value={run.model || "fallback/local"} />
        <KeyValue label="Provider" value={run.provider || "not recorded"} />
        <KeyValue label="Latency" value={`${run.latencyMs} ms`} />
        <KeyValue label="Tokens" value={`${run.inputTokens} in / ${run.outputTokens} out`} />
        <KeyValue label="Cost" value={`${run.estimatedCostCents} cents`} />
        <KeyValue label="Resume" value={run.resumeStatus} />
      </div>
      {run.message ? (
        <div className="admin-code-card">
          <span className="section-label">User message snapshot</span>
          <pre>{run.message.content}</pre>
        </div>
      ) : null}
      <Timeline title="Events" items={run.events.map((event) => ({ label: `${event.sequence}. ${event.type}`, meta: event.status, text: event.message, code: event.payload }))} />
      <Timeline title="Tool calls" items={run.toolCalls.map((call) => ({ label: call.toolName, meta: `${call.risk} / ${call.status}`, text: call.error || call.toolVersion, code: { input: call.input, output: call.output } }))} />
      <Timeline title="Checkpoints" items={run.checkpoints.map((checkpoint) => ({ label: checkpoint.nodeName, meta: checkpoint.status, text: checkpoint.createdAt, code: checkpoint.state }))} />
      {run.error ? <p className="form-error admin-alert">{run.error}</p> : null}
    </div>
  );
}

function WorkflowPanel({ selectedRun, tasks, proposals }: { selectedRun: AgentRun | null; tasks: AgentTask[]; proposals: AgentProposal[] }) {
  const workflow = [
    "authenticate",
    "load workspace",
    "classify intent",
    "build context",
    "retrieve memory",
    "retrieve knowledge",
    "select tools",
    "execute tools",
    "create answer or proposal",
    "approval gate",
    "persist events",
    "extract memory candidate"
  ];

  return (
    <article className="admin-panel">
      <div className="admin-flow">
        {workflow.map((node, index) => (
          <div className={selectedRun?.checkpoints.some((checkpoint) => checkpoint.nodeName.toLowerCase().includes(node.split(" ")[0])) ? "is-hit" : ""} key={node}>
            <strong>{String(index + 1).padStart(2, "0")}</strong>
            <span>{node}</span>
          </div>
        ))}
      </div>
      <div className="admin-two-column">
        <MiniList title="Active task continuity" items={tasks.slice(0, 8).map((task) => `${task.title} / ${task.status} / ${task.threads[0]?.messageCount ?? 0} messages`)} />
        <MiniList title="Recent proposals" items={proposals.slice(0, 8).map((proposal) => `${proposal.title} / ${proposal.status} / ${proposal.changes.length} changes`)} />
      </div>
    </article>
  );
}

function PolicyPanel({ payload }: { payload: CockpitPayload }) {
  return (
    <article className="admin-panel">
      <div className="admin-two-column">
        <div className="admin-card-list">
          {payload.policy.guardrails.map((guardrail) => (
            <div className="admin-card" key={guardrail}>
              <ShieldCheck size={16} />
              <p>{guardrail}</p>
            </div>
          ))}
        </div>
        <div className="admin-card-list">
          {payload.policy.intentMatrix.map((intent) => (
            <div className="admin-card" key={intent.intent}>
              <strong>{intent.intent}</strong>
              <p>{intent.allowedTools.join(", ")}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Tool</th>
              <th>Risk</th>
              <th>Approval</th>
              <th>Evidence</th>
              <th>Purpose</th>
            </tr>
          </thead>
          <tbody>
            {payload.policy.tools.map((tool) => (
              <tr key={tool.name}>
                <td><strong>{tool.name}</strong><small>{tool.version}</small></td>
                <td><Badge>{tool.risk}</Badge></td>
                <td>{tool.requiresApproval ? "required" : "not required"}</td>
                <td>{tool.requiresEvidence ? "required" : "optional"}</td>
                <td>{tool.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function MemoryPanel({ memory }: { memory: CockpitPayload["memory"] }) {
  return (
    <article className="admin-panel">
      <div className="admin-two-column">
        <MiniCards title="Approved memories" items={memory.items.map((item) => ({ title: item.category, text: item.content, meta: `${item.status} / ${item.sensitivity} / ${Math.round(item.confidence * 100)}%` }))} />
        <MiniCards title="Pending candidates" items={memory.candidates.map((item) => ({ title: item.category, text: item.content, meta: `${item.status} / ${item.sensitivity} / ${Math.round(item.confidence * 100)}%` }))} />
      </div>
    </article>
  );
}

function KnowledgePanel({ knowledge }: { knowledge: CockpitPayload["knowledge"] }) {
  return (
    <article className="admin-panel">
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Document</th>
              <th>Namespace</th>
              <th>Visibility</th>
              <th>Version</th>
              <th>Chunks</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {knowledge.documents.map((document) => (
              <tr key={document.id}>
                <td><strong>{document.title}</strong><small>{document.sourceUri || document.sourceType}</small></td>
                <td><Badge>{document.namespace}</Badge></td>
                <td>{document.visibility}</td>
                <td>{document.version}</td>
                <td>{document.chunkCount}</td>
                <td>{document.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function JobsPanel({ jobs }: { jobs: CockpitPayload["jobs"] }) {
  return (
    <article className="admin-panel">
      <div className="admin-metric-grid">
        {jobs.queues.map((queue) => (
          <div className="admin-metric" key={queue.name}>
            <ServerCog size={18} />
            <strong>{queue.status}</strong>
            <span>{queue.name}</span>
            {queue.counts ? <small>{Object.entries(queue.counts).map(([key, value]) => `${key}: ${value}`).join(" / ")}</small> : <small>{queue.error}</small>}
          </div>
        ))}
      </div>
      <div className="admin-two-column">
        <MiniCards title="PDF jobs" items={jobs.pdfJobs.map((job) => ({ title: `${job.status} / ${job.templateKey ?? "template"}`, text: job.message || job.id, meta: job.createdAt }))} />
        <MiniCards title="Import jobs" items={jobs.importJobs.map((job) => ({ title: `${job.status} / ${job.stage ?? "stage"}`, text: job.message || job.sourceFilename || job.id, meta: job.createdAt }))} />
      </div>
    </article>
  );
}

function WebsiteOpsPanel({
  website,
  onChanged
}: {
  website?: CockpitPayload["website"];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [snapshots, setSnapshots] = useState<{ id: string; version: number; status: string; publishedAt: string }[]>([]);
  const [snapshotUsername, setSnapshotUsername] = useState("");

  if (!website) {
    return (
      <article className="admin-panel">
        <p className="muted-text">Website ops data is not available yet.</p>
      </article>
    );
  }

  async function blockSite(id: string, block: boolean) {
    setBusyId(id);
    setError("");
    try {
      const reason = block ? window.prompt("Block reason (optional)", "Abuse / policy") || "" : "";
      const response = await fetch(`/api/admin/websites/${encodeURIComponent(id)}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: block ? "block" : "unblock", reason })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update website.");
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not update website.");
    } finally {
      setBusyId("");
    }
  }

  async function retryJob(jobId: string) {
    setBusyId(jobId);
    setError("");
    try {
      const response = await fetch(`/api/admin/websites/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: "POST",
        credentials: "include"
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not retry job.");
      onChanged();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not retry job.");
    } finally {
      setBusyId("");
    }
  }

  async function loadSnapshots(websiteId: string, username: string) {
    setBusyId(websiteId);
    setError("");
    try {
      const response = await fetch(`/api/admin/websites/${encodeURIComponent(websiteId)}`, { credentials: "include" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load snapshots.");
      setSnapshots(result.snapshots || []);
      setSnapshotUsername(username);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Could not load snapshots.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <article className="admin-panel">
      {error ? <p className="form-error admin-alert">{error}</p> : null}
      <div className="admin-metric-grid">
        {[
          ["Total", website.counts.total],
          ["Published", website.counts.published],
          ["Draft", website.counts.draft],
          ["Blocked", website.counts.blocked],
          ["Failed jobs", website.counts.failedJobs],
          ["Unread messages", website.counts.unreadMessages]
        ].map(([label, value]) => (
          <div className="admin-metric" key={label}>
            <Globe2 size={18} />
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Counts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {website.websites.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.username}</strong>
                  <small>
                    <a href={row.publicPath} target="_blank" rel="noreferrer">
                      {row.publicPath}
                    </a>
                  </small>
                </td>
                <td>
                  <strong>{row.profile.displayName}</strong>
                  <small>{row.profile.email}</small>
                </td>
                <td>
                  <Badge>{row.blockedAt ? "blocked" : row.status}</Badge>
                  {row.blockedReason ? <small>{row.blockedReason}</small> : null}
                </td>
                <td>
                  snapshots {row.counts.snapshots} · jobs {row.counts.publishJobs} · msgs {row.counts.contactMessages}
                </td>
                <td>
                  <div className="admin-inline-actions">
                    {row.blockedAt ? (
                      <button className="secondary-action" type="button" disabled={busyId === row.id} onClick={() => void blockSite(row.id, false)}>
                        Unblock
                      </button>
                    ) : (
                      <button className="secondary-action" type="button" disabled={busyId === row.id} onClick={() => void blockSite(row.id, true)}>
                        Block
                      </button>
                    )}
                    <button className="secondary-action" type="button" disabled={busyId === row.id} onClick={() => void loadSnapshots(row.id, row.username)}>
                      Snapshots
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-two-column">
        <div className="admin-mini-list">
          <h3>Recent publish jobs</h3>
          {website.recentJobs.length ? (
            website.recentJobs.map((job) => (
              <div className="admin-card" key={job.id}>
                <strong>
                  {job.username} · {job.status}
                </strong>
                <p>{job.error || job.message || job.id}</p>
                <small>{job.createdAt}</small>
                {job.status === "failed" ? (
                  <button className="secondary-action" type="button" disabled={busyId === job.id} onClick={() => void retryJob(job.id)}>
                    Retry
                  </button>
                ) : null}
              </div>
            ))
          ) : (
            <p className="muted-text">No publish jobs yet.</p>
          )}
        </div>
        <div className="admin-mini-list">
          <h3>{snapshotUsername ? `Snapshots · ${snapshotUsername}` : "Recent snapshots"}</h3>
          {(snapshots.length ? snapshots : website.recentSnapshots).length ? (
            (snapshots.length ? snapshots : website.recentSnapshots).map((snapshot) => (
              <div className="admin-card" key={snapshot.id}>
                <strong>
                  {"username" in snapshot ? `${snapshot.username} · v${snapshot.version}` : `v${snapshot.version}`} · {snapshot.status}
                </strong>
                <p>{snapshot.id}</p>
                <small>{snapshot.publishedAt}</small>
              </div>
            ))
          ) : (
            <p className="muted-text">No snapshots yet.</p>
          )}
        </div>
      </div>
    </article>
  );
}

function ConfigPanel({ configuration, generatedAt }: { configuration: CockpitPayload["configuration"]; generatedAt: string }) {
  return (
    <article className="admin-panel">
      <div className="admin-two-column">
        <MiniCards title="Feature flags" items={configuration.features.map((item) => ({ title: item.name, text: item.value || "default/empty", meta: "env" }))} />
        <MiniCards title="Model routing" items={configuration.models.map((item) => ({ title: item.name, text: item.value || "default/empty", meta: "model" }))} />
      </div>
      <div className="admin-two-column">
        <MiniCards title="Secrets" items={configuration.secrets.map((item) => ({ title: item.name, text: item.configured ? "configured" : "missing", meta: "redacted" }))} />
        <MiniCards title="Runtime" items={Object.entries(configuration.runtime).map(([key, value]) => ({ title: key, text: String(value), meta: generatedAt }))} />
      </div>
    </article>
  );
}

function ArchitectureCanvas() {
  const layers = [
    ["User features", "Profile editor", "Managed CVs", "Academic website", "Publications", "Billing"],
    ["AI agent", "Intent router", "Context builder", "Tool policy", "Memory", "Knowledge"],
    ["Safety stack", "Approval gate", "Evidence rules", "Redaction", "Workspace scope", "Audit events"],
    ["Data layer", "PostgreSQL", "Prisma", "R2/local files", "Redis queues", "Structured logs"],
    ["Workers", "PDF renderer", "Import worker", "Attachment worker", "Agent worker", "Website publish"]
  ];

  return (
    <article className="admin-panel">
      <div className="architecture-canvas" role="img" aria-label="CVScholar layered architecture map">
        <svg viewBox="0 0 1000 560" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="admin-flow-gradient" x1="0" x2="1" y1="0" y2="1">
              <stop offset="0%" stopColor="#3563b0" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#1f7a5a" stopOpacity="0.14" />
            </linearGradient>
          </defs>
          <rect x="20" y="20" width="960" height="520" rx="28" fill="url(#admin-flow-gradient)" />
          <path d="M170 110 C310 60 420 120 510 92 C650 50 740 116 850 86" fill="none" stroke="#3563b0" strokeWidth="4" strokeOpacity=".38" />
          <path d="M120 455 C280 380 420 470 560 405 C715 332 820 410 910 342" fill="none" stroke="#1f7a5a" strokeWidth="4" strokeOpacity=".34" />
        </svg>
        <div className="architecture-layers">
          {layers.map(([title, ...items]) => (
            <section key={title}>
              <h3>{title}</h3>
              <div>
                {items.map((item) => <span key={item}>{item}</span>)}
              </div>
            </section>
          ))}
        </div>
        <div className="architecture-core">
          <Bot size={28} />
          <strong>CVScholar expert agent</strong>
          <span>Profile data + policy + academic knowledge + approval-safe tools</span>
        </div>
      </div>
    </article>
  );
}

function MiniList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="admin-mini-list">
      <h3>{title}</h3>
      {items.length ? items.map((item) => <p key={item}>{item}</p>) : <p className="muted-text">No records yet.</p>}
    </div>
  );
}

function MiniCards({ title, items }: { title: string; items: { title: string; text: string; meta: string }[] }) {
  return (
    <div className="admin-mini-list">
      <h3>{title}</h3>
      {items.length ? items.map((item) => (
        <div className="admin-card" key={`${item.title}-${item.text}`}>
          <strong>{item.title}</strong>
          <p>{item.text}</p>
          <small>{item.meta}</small>
        </div>
      )) : <p className="muted-text">No records yet.</p>}
    </div>
  );
}

function Timeline({ title, items }: { title: string; items: { label: string; meta: string; text: string; code?: unknown }[] }) {
  return (
    <div className="admin-timeline">
      <h3>{title}</h3>
      {items.length ? items.map((item, index) => (
        <details key={`${item.label}-${index}`}>
          <summary>
            <strong>{item.label}</strong>
            <span>{item.meta}</span>
          </summary>
          {item.text ? <p>{item.text}</p> : null}
          {item.code ? <pre>{JSON.stringify(item.code, null, 2)}</pre> : null}
        </details>
      )) : <p className="muted-text">No {title.toLowerCase()} recorded.</p>}
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-key-value">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="admin-badge">{children}</span>;
}
