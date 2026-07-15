"use client";

import { useEffect, useState } from "react";

type MemoryItem = {
  id: string;
  scope: string;
  category: string;
  content: string;
  rationale: string;
  confidence: number;
  sensitivity: string;
  createdAt: string;
};

type MemoryCandidate = {
  id: string;
  category: string;
  content: string;
  rationale: string;
  confidence: number;
  sensitivity: string;
  createdAt: string;
};

type ActivityRun = {
  id: string;
  status: string;
  intent: string;
  currentNode: string;
  error: string;
  createdAt: string;
  lastEvent: { message: string; status: string } | null;
};

export function AgentMemorySettings() {
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [runs, setRuns] = useState<ActivityRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [memoryResponse, activityResponse] = await Promise.all([
        fetch("/api/agent/memory", { credentials: "include" }),
        fetch("/api/agent/activity", { credentials: "include" })
      ]);
      if (!memoryResponse.ok) throw new Error("Could not load agent memory.");
      if (!activityResponse.ok) throw new Error("Could not load agent activity.");
      const memoryPayload = await memoryResponse.json();
      const activityPayload = await activityResponse.json();
      setMemories(memoryPayload.memories ?? []);
      setCandidates(memoryPayload.candidates ?? []);
      setRuns(activityPayload.runs ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load agent settings.");
    } finally {
      setLoading(false);
    }
  }

  async function memoryAction(action: "promote_candidate" | "reject_candidate" | "delete_memory", id: string) {
    const response = await fetch("/api/agent/memory", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id })
    });
    if (!response.ok) {
      setError("Could not update memory.");
      return;
    }
    const payload = await response.json();
    setMemories(payload.memories ?? []);
    setCandidates(payload.candidates ?? []);
  }

  return (
    <section className="workspace-screen agent-settings-screen">
      <div className="screen-header">
        <div>
          <h1>Agent Settings</h1>
          <p>Control what CVScholar remembers and inspect recent agent activity.</p>
        </div>
        <button className="secondary-action" type="button" onClick={() => void loadAll()}>
          Refresh
        </button>
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted-text">Loading agent controls...</p> : null}

      <article className="simple-panel agent-memory-panel">
        <div>
          <span className="section-label">What CVScholar remembers</span>
          <h2>Approved memories</h2>
          <p>These are advisory preferences or task notes. They never replace verified profile facts.</p>
        </div>
        <div className="memory-list">
          {memories.length === 0 ? <p className="muted-text">No approved memories yet.</p> : null}
          {memories.map((memory) => (
            <div className="memory-card" key={memory.id}>
              <span className="memory-tag">{memory.category}</span>
              <p>{memory.content}</p>
              {memory.rationale ? <small>{memory.rationale}</small> : null}
              <button className="secondary-action compact-action" type="button" onClick={() => void memoryAction("delete_memory", memory.id)}>
                Delete memory
              </button>
            </div>
          ))}
        </div>
      </article>

      <article className="simple-panel agent-memory-panel">
        <div>
          <span className="section-label">Memory candidates</span>
          <h2>Review before remembering</h2>
          <p>CVScholar asks before promoting task-specific or sensitive statements into reusable memory.</p>
        </div>
        <div className="memory-list">
          {candidates.length === 0 ? <p className="muted-text">No pending memory candidates.</p> : null}
          {candidates.map((candidate) => (
            <div className="memory-card" key={candidate.id}>
              <span className="memory-tag">{candidate.category}</span>
              <p>{candidate.content}</p>
              {candidate.rationale ? <small>{candidate.rationale}</small> : null}
              <div className="memory-actions">
                <button className="primary-action compact-action" type="button" onClick={() => void memoryAction("promote_candidate", candidate.id)}>
                  Remember
                </button>
                <button className="secondary-action compact-action" type="button" onClick={() => void memoryAction("reject_candidate", candidate.id)}>
                  Do not remember
                </button>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="simple-panel agent-memory-panel">
        <div>
          <span className="section-label">Agent activity</span>
          <h2>Recent runs</h2>
          <p>Use this when diagnosing failed or paused agent work.</p>
        </div>
        <div className="memory-list">
          {runs.length === 0 ? <p className="muted-text">No agent runs yet.</p> : null}
          {runs.slice(0, 8).map((run) => (
            <div className="memory-card" key={run.id}>
              <span className="memory-tag">{run.status}</span>
              <p>{run.intent} {run.currentNode ? `- ${run.currentNode}` : ""}</p>
              <small>{run.error || run.lastEvent?.message || new Date(run.createdAt).toLocaleString()}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
