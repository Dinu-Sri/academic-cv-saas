# Agent flow (simple tables)

Plain-language reference for how the CVScholar rewrite agent works. Use this to teach, redesign admin monitoring, and extend documentation.

**Simple rule for every message**

```text
AI plans → Policy allows → Tools/agent execute → User approves writes
```

---

## 1) Main flow

| Step | What happens | Layer |
|---|---|---|
| Session start | Open/find the chat for this profile | Conversation |
| Task ready | Reuse the goal (e.g. “Build my academic CV”), or create it once | Conversation |
| Thread ready | Stay on the current chapter of chat (many messages share it) | Conversation |
| User sends message | Save the user message in that session/task/thread | Conversation |
| Start a Run | Create one work ticket for this message | Orchestration |
| Optional fast pre-check | Empty message? attachment only? abuse? | Guardrails |
| **AI Planner (API)** | Understand message → output **jobs[]** + confidence + clarify? | Planner (Model) |
| Validate plan | Only known job types; drop unknown; max 2–3 jobs | Policy + Guardrails |
| If unclear | Ask one clarifying question; stop this turn | Planner + Conversation |
| If out of scope | Refuse politely; show what CVScholar can do | Policy |
| Choose allowed tools | For each job type, guardrails pick allowed tools | Policy |
| Load context | Load profile, recent chat, and useful memory | Context |
| Run tools | Call safe tools for the job(s) (often read profile first) | Tools |
| Optional knowledge | Fetch guidance tips if needed (review/improve style asks) | Knowledge |
| Optional memory recall | Load accepted preferences/facts if useful | Memory |
| Call executor AI | For each job (in order), send context + tool results to the strong model | Model (Executor) |
| Get reply | Get text answer + optional patches (suggested edits) | Model (Executor) |
| Validate patches | Check suggested edits match allowed CV fields | Policy |
| Create proposal | If edits are real, hold them for Approve/Reject | Write path |
| Show to user | Show assistant message (+ approval card if needed) | Conversation |
| User approves | Apply approved edits to the real profile DB | Write path |
| User rejects | Close proposal; profile stays unchanged | Write path |
| Finish run | Mark run completed, paused (waiting approval), or failed; log planner jobs | Orchestration |
| Next message | Same session/task/thread; **new run** for the new message | Conversation + Orchestration |

**Keyword fallback:** if the planner API fails, the system can fall back to simple keyword intent matching so chat still works.

---

## 2) Side jobs (separate from chat turns)

| Side job | When it runs | What it does | Layer / system |
|---|---|---|---|
| Attachment extraction | User uploads a file | Store file first, extract text later | Side job (worker) |
| Old CV import | User imports an old CV PDF | Vision/extract → map into profile fields (review/apply flow) | Side job (import worker) |
| PDF render | User/agent asks for PDF | Queue compile job → Tectonic → save PDF file | Side job (PDF worker) |
| Agent run worker | Queue mode is on | Process the run in background instead of inside the web request | Side job (agent worker) |
| Memory candidate creation | During/after a turn | Suggest things to remember later (not auto-truth) | Memory |
| Knowledge retrieval | When enabled + relevant | Pull guidance chunks into context | Knowledge |

**Simple rule:**
**Run** = one chat-message brain turn.
**Side job** = background worker work (PDF, import, extract).
**Planner job** = one unit of work *inside* a run (not a background worker).

| Word | Meaning |
|---|---|
| Run | Process one user message |
| Planner job | e.g. “add PhD”, “review CV”, “make PDF” inside that run |
| Side job / queue job | PDF worker, import worker, attachment extraction |

---

## 3) When a thread is too long

| Topic | Simple answer |
|---|---|
| What is a thread? | A chat chapter inside a task |
| Do we start a new thread every message? | **No** |
| When do we compact? | When the chapter has too many tokens/messages |
| What is compaction? | Older messages get summarized; recent ones stay full |
| When do we start Thread 2? | After too much compaction / length, system rolls over to a new chapter |
| How is it detected? | Count messages + estimate tokens in the active thread, compare to limits |
| Typical limits (defaults) | Recent window ~16 messages; context token limit ~6000; thread message limit ~80; rollover after several compactions |
| What is kept after rollover? | Same session + same task goal; new thread chapter; summaries of older talk |
| What does user notice? | Usually little; chat continues, but system load is lighter |
| Where this lives | Conversation layer (thread management), helps Context stay small |

| Detection signal | Meaning |
|---|---|
| High message count in thread | Chapter getting long |
| High token estimate | Prompt would be too big/expensive |
| Compaction count high | Already summarized several times → consider rollover |
| Rollover reason saved | Why chapter 2/3 started |

---

## 4) Guardrails, policy, knowledge, memory, planner (simple)

| Area | What it is | What it contains / does | What it does **not** do |
|---|---|---|---|
| **Planner** | AI that understands the user message | Outputs jobs[], confidence, clarify?, out_of_scope | Does **not** write the profile or bypass tools |
| **Policy** | Rules for each job | Job type → which tools are allowed; risk levels (read / proposal / draft) | Does not store the user’s CV facts |
| **Guardrails** | Safety locks around policy + writes | Ownership checks; schema validation; approval required before DB edits; soft-archive not hard-delete; untrusted attachment text; feature flags; only known job types | Does not chat with the user by itself |
| **Knowledge** | Shared guidance library | Academic CV tips, product guidance chunks, namespaces | Not the user’s personal CV data |
| **Memory** | Personal recall for this user/profile | Accepted preferences/facts; pending candidates waiting approval | Not the official CV record (profile is) |

### Tiny examples

| Area | Example |
|---|---|
| Planner | “Add PhD, review CV, make PDF” → 3 jobs with order + confidence |
| Policy | Job `profile_update` → allow propose-entry tools |
| Guardrails | AI suggests a bad field → rejected; AI wants DB write → must get user approval |
| Knowledge | “How to present education on academic CVs” |
| Memory | “User prefers a short teaching-focused CV” (if accepted) |

### Memory sub-types (keep these separate)

| Memory type | Meaning |
|---|---|
| Session memory (legacy) | Rough progress: done sections, pending questions, tone |
| Memory candidate | “Maybe remember this?” still pending |
| Memory item | Accepted lasting memory used later |

---

## 5) One-line map (cheat sheet)

| You see | System meaning |
|---|---|
| Chat room | Session |
| Goal | Task |
| Chapter | Thread |
| One user bubble processed | Run |
| “What does user want?” | AI Planner → one or more jobs |
| One unit of work inside a run | Planner job |
| “What is AI allowed to do?” | Guardrails + tool allowlist per job type |
| “What does AI know right now?” | Context (+ tools/knowledge/memory) |
| Main reply + patches model | Executor (Model) |
| “Suggested CV edits” | Patches → Proposal |
| “Yes/No” | Write path |
| PDF/import/extract | Side jobs (workers) |

---

## 6) How understanding works (AI planner)

### 6a) Big idea

| Rule | Meaning |
|---|---|
| AI decides meaning | Planner reads the user message |
| Code decides permissions | Policy maps each job type → allowed tools |
| User decides writes | Proposals still need Approve / Reject |
| Keywords remain fallback | If planner API fails, use keyword intent matching |

```text
User message
  → AI Planner (API, fast model, JSON only)
  → jobs[] + confidence + clarify? + out_of_scope?
  → Policy validates job types + tool allowlists
  → Executor runs each job (tools + strong model)
  → Write path: patches → proposal → user approval
```

### 6b) Planner vs executor (two API roles)

| Role | Job | Model style | Writes profile? |
|---|---|---|---|
| **Planner** | Understand message; plan jobs | Fast / cheap / strict JSON via **API** | **No** |
| **Executor** | Reply text, patches, review, use tools | Stronger reasoning via **API** | Only via proposal + user approval |

| Local VPS model? | Decision |
|---|---|
| For planner | **No** — use API |
| Why not local on VPS | Needs GPU/ops; weaker unless large model; more moving parts |
| When reconsider local | Very high volume + dedicated GPU capacity |

### 6c) How many outside model calls?

| Case | API calls |
|---|---|
| Empty / blocked / obvious rule-only | 0–1 |
| Planner says “clarify only” | 1 (planner), then stop |
| Planner fails | Fallback keywords + 1 executor |
| Normal single or multi job | 2 (planner + executor) |

**Cost note:** Planner prompt is small (message + schema). Executor is the expensive call. Wrong intent is more costly for trust than one cheap planner call.

### 6d) What planner outputs (structured, not free chat)

| Field | Meaning |
|---|---|
| `jobs[]` | List of work items |
| `type` | Known job type only |
| `summary` | Short human label |
| `confidence` | 0–1 |
| `order` | What to do first |
| `needs_clarification` | true/false |
| `clarifying_question` | One question if needed |

Example message: *“Add my Oxford PhD, review my CV, and make a PDF”*

| Order | Job type | Summary |
|---|---|---|
| 1 | `profile_update` | Add Oxford PhD |
| 2 | `cv_review` | Review CV |
| 3 | `pdf_render` | Generate PDF |

### 6e) Known job types

| Job type | Meaning |
|---|---|
| `profile_update` | Change CV data |
| `profile_read` | Show / summarize saved data |
| `cv_review` | Critique / improve advice |
| `cv_document` | Versions / drafts / section visibility |
| `pdf_render` | Compile / download PDF |
| `attachment_review` | Use uploaded file as evidence |
| `clarification_needed` | Not enough info |
| `out_of_scope` | Not a CVScholar job |

### 6f) Confidence rules

| Confidence | Action |
|---|---|
| High (≥ ~0.8) | Proceed |
| Medium (~0.5–0.8) | Proceed carefully or ask 1 short confirm |
| Low (< ~0.5) | Ask clarification — do not invent |
| Out of scope high | Refuse + list supported actions |

### 6g) Multi-job rules

| Rule | Why |
|---|---|
| Max 2–3 jobs per turn | Avoid chaos and cost |
| If more than 3 | Show a short plan and ask what first |
| Writes always via proposal | Keep safety model |
| PDF after updates when both requested | Don’t compile stale CV by default |
| Log planner output on the Run | Admin can debug wrong plans |

### 6h) Critical safety rules for planner

| Rule | Why |
|---|---|
| Planner cannot write DB | Only classify/plan |
| Planner cannot invent tools | Only known job types |
| Policy still maps job → tools | Hard allowlist |
| Low confidence → ask | Don’t guess wrong |
| Keywords as fallback | Planner API outage path |

### 6i) Keyword fallback (if planner fails)

| Priority | If message has… | Intent / job |
|---|---|---|
| 1 | Attachment, or file / pdf / document… | `attachment_review` |
| 2 | render / compile / pdf / download / preview | `pdf_render` |
| 3 | review/improve… **and** cv/resume/profile | `cv_review` |
| 4 | cv version / draft cv / section order… | `cv_document` |
| 5 | add / update / change / remove / delete… | `profile_update` |
| 6 | list / show / what / overview… | `profile_read` |
| 7 | Nothing matched | `general` / treat carefully |

---

## 7) Four hard cases (how the system behaves)

| Case | Example | Behavior |
|---|---|---|
| One clear job | “Add my Oxford PhD 2019” | One `profile_update` job |
| Several jobs | “Add PhD, review CV, make PDF” | Split → ordered jobs → one proposal for writes |
| Fuzzy wording | “Put Uni of Oxford doctorate in” | Still `profile_update` via planner |
| Out of scope | “What’s the weather?” / grant budget | `out_of_scope` + redirect |

---

## Related code (for later deep dives)

| Topic | Main location |
|---|---|
| Main turn logic | `apps/web/src/lib/cv-agent/service.ts` |
| Task / thread / compaction | `apps/web/src/lib/agent/task-thread.ts` |
| Intent + tool policy | `apps/web/src/lib/agent/policy.ts` |
| Tools | `apps/web/src/lib/agent/tools.ts` |
| Patches / proposals | `apps/web/src/lib/cv-agent/patches.ts` |
| Memory | `apps/web/src/lib/agent/memory.ts` |
| Knowledge | `apps/web/src/lib/agent/knowledge.ts` |
| Model gateway | `apps/web/src/lib/agent/model-gateway.ts` |
| Agent rules | `apps/web/AGENTS.md` |
