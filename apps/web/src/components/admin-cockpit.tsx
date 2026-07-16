"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  Search,
  ServerCog,
  ShieldCheck,
  UsersRound
} from "lucide-react";

type CockpitPayload = {
  generatedAt: string;
  overview: Record<string, number>;
  users: AdminUser[];
  runs: AgentRun[];
  runStatuses: { status: string; count: number }[];
  proposals: AgentProposal[];
  memory: { items: MemoryItem[]; candidates: MemoryItem[] };
  knowledge: { documents: KnowledgeDocument[]; chunkCount: number };
  tasks: AgentTask[];
  jobs: { queues: QueueHealth[]; pdfJobs: JobItem[]; importJobs: JobItem[] };
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
};

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  sessions: number;
  profiles: number;
  workspaces: {
    id: string;
    name: string;
    slug: string;
    role: string;
    credits: number;
    profileCount: number;
    agentRunCount: number;
    pdfJobCount: number;
  }[];
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
  "runs",
  "workflow",
  "policy",
  "memory",
  "knowledge",
  "jobs",
  "config",
  "architecture",
  "users"
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
  const [query, setQuery] = useState("");

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
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!payload || !normalized) return payload?.users ?? [];
    return payload.users.filter((user) => `${user.name} ${user.email} ${user.workspaces.map((workspace) => workspace.name).join(" ")}`.toLowerCase().includes(normalized));
  }, [payload, query]);

  return (
    <section className="workspace-screen admin-cockpit-screen">
      {error ? <p className="form-error admin-alert">{error}</p> : null}
      {loading && !payload ? <p className="muted-text admin-loading">Loading admin cockpit...</p> : null}
      {payload ? (
        <div id={activeSection}>
          {activeSection === "overview" ? <OverviewPanel payload={payload} /> : null}
          {activeSection === "runs" ? <RunsPanel runs={payload.runs} selectedRun={selectedRun} setSelectedRunId={setSelectedRunId} /> : null}
          {activeSection === "workflow" ? <WorkflowPanel selectedRun={selectedRun} tasks={payload.tasks} proposals={payload.proposals} /> : null}
          {activeSection === "policy" ? <PolicyPanel payload={payload} /> : null}
          {activeSection === "memory" ? <MemoryPanel memory={payload.memory} /> : null}
          {activeSection === "knowledge" ? <KnowledgePanel knowledge={payload.knowledge} /> : null}
          {activeSection === "jobs" ? <JobsPanel jobs={payload.jobs} /> : null}
          {activeSection === "config" ? <ConfigPanel configuration={payload.configuration} generatedAt={payload.generatedAt} /> : null}
          {activeSection === "architecture" ? <ArchitectureCanvas /> : null}
          {activeSection === "users" ? <UsersPanel users={filteredUsers} query={query} setQuery={setQuery} /> : null}
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

function UsersPanel({ users, query, setQuery }: { users: AdminUser[]; query: string; setQuery: (value: string) => void }) {
  return (
    <article className="admin-panel">
      <label className="admin-search">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search users, emails, or workspaces" />
      </label>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Workspace</th>
              <th>Role</th>
              <th>Credits</th>
              <th>Profiles</th>
              <th>Agent runs</th>
              <th>PDF jobs</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) =>
              user.workspaces.map((workspace) => (
                <tr key={`${user.id}-${workspace.id}`}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <strong>{workspace.name}</strong>
                    <small>{workspace.slug}</small>
                  </td>
                  <td><Badge>{workspace.role}</Badge></td>
                  <td>{workspace.credits}</td>
                  <td>{workspace.profileCount}</td>
                  <td>{workspace.agentRunCount}</td>
                  <td>{workspace.pdfJobCount}</td>
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
    ["Workers", "PDF renderer", "Import worker", "Attachment worker", "Agent worker", "Retry loops"]
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
