export type AgentToolRisk = "read" | "draft" | "proposal" | "execution";

export type AgentIntent =
  | "profile_read"
  | "profile_update"
  | "cv_review"
  | "cv_document"
  | "attachment_review"
  | "pdf_render"
  | "general";

export type ToolPolicy = {
  name: string;
  version: string;
  risk: AgentToolRisk;
  requiresApproval: boolean;
  requiresEvidence: boolean;
  description: string;
};

export const toolPolicies: Record<string, ToolPolicy> = {
  get_profile_overview: policy("get_profile_overview", "read", "Read compact profile fields and section counts."),
  list_section_entries: policy("list_section_entries", "read", "List active entries in a profile section."),
  get_profile_entry: policy("get_profile_entry", "read", "Read one active profile entry."),
  propose_personal_update: policy("propose_personal_update", "proposal", "Draft a personal profile update for approval.", true),
  propose_entry_add: policy("propose_entry_add", "proposal", "Draft a section entry addition for approval.", true),
  propose_entry_update: policy("propose_entry_update", "proposal", "Draft a section entry update for approval.", true),
  propose_entry_archive: policy("propose_entry_archive", "proposal", "Draft a section entry archive for approval.", true),
  review_cv: policy("review_cv", "read", "Review the current saved CV/profile for strengths, gaps, and next actions."),
  identify_missing_information: policy("identify_missing_information", "read", "Identify missing academic CV information from saved profile data."),
  retrieve_knowledge: policy("retrieve_knowledge", "read", "Retrieve workspace-safe academic and product guidance."),
  list_cv_documents: policy("list_cv_documents", "read", "List CV document versions."),
  get_cv_document: policy("get_cv_document", "read", "Read one CV document version."),
  create_cv_draft: policy("create_cv_draft", "draft", "Create a separate purpose-specific CV draft without changing the source profile."),
  get_attachment_status: policy("get_attachment_status", "read", "Read attachment processing status."),
  get_extracted_evidence: policy("get_extracted_evidence", "read", "Read extracted attachment evidence as untrusted data.", false, true),
  start_pdf_render_job: policy("start_pdf_render_job", "draft", "Queue a PDF render job."),
  get_pdf_job_status: policy("get_pdf_job_status", "read", "Read a PDF render job status.")
};

function policy(
  name: string,
  risk: AgentToolRisk,
  description: string,
  requiresApproval = false,
  requiresEvidence = false
): ToolPolicy {
  return {
    name,
    risk,
    description,
    requiresApproval,
    requiresEvidence,
    version: "phase2-v1"
  };
}

export function classifyAgentIntent(message: string, attachmentCount = 0): AgentIntent {
  const normalized = message.toLowerCase();
  if (attachmentCount > 0 || /\b(attachment|file|pdf|document|evidence|extract)\b/.test(normalized)) return "attachment_review";
  if (/\b(render|compile|pdf|download|preview)\b/.test(normalized)) return "pdf_render";
  if (/\b(review|feedback|think|opinion|improve|strength|weakness|gap|ready|readiness|critique|evaluate)\b/.test(normalized) && /\b(cv|resume|profile)\b/.test(normalized)) return "cv_review";
  if (/\b(cv version|cv document|targeted cv|new cv|draft cv|section order|visibility)\b/.test(normalized)) return "cv_document";
  if (/\b(add|update|change|correct|remove|delete|archive|keep only)\b/.test(normalized)) return "profile_update";
  if (/\b(list|show|what|summari[sz]e|overview|get)\b/.test(normalized)) return "profile_read";
  return "general";
}

export function allowedToolsForIntent(intent: AgentIntent) {
  const common = ["get_profile_overview"];
  const read = ["list_section_entries", "get_profile_entry"];
  const advancedEnabled = process.env.CVSCHOLAR_AGENT_ADVANCED_TOOLS_ENABLED !== "0";
  const retrievalEnabled = process.env.CVSCHOLAR_AGENT_RETRIEVAL_ENABLED !== "0";

  if (intent === "profile_update") {
    return [...common, ...read, "propose_personal_update", "propose_entry_add", "propose_entry_update", "propose_entry_archive"];
  }

  if (intent === "cv_document") {
    return withOptionalTools([...common, "list_cv_documents", "get_cv_document"], [
      ...(advancedEnabled ? ["create_cv_draft"] : []),
      ...(retrievalEnabled ? ["retrieve_knowledge"] : [])
    ]);
  }

  if (intent === "cv_review") {
    return withOptionalTools([...common, "list_cv_documents", "get_cv_document"], [
      ...(advancedEnabled ? ["review_cv", "identify_missing_information"] : []),
      ...(retrievalEnabled ? ["retrieve_knowledge"] : [])
    ]);
  }

  if (intent === "attachment_review") {
    return [...common, "get_attachment_status", "get_extracted_evidence"];
  }

  if (intent === "pdf_render") {
    return [...common, "list_cv_documents", "start_pdf_render_job", "get_pdf_job_status"];
  }

  if (intent === "profile_read") {
    return withOptionalTools([...common, ...read, "list_cv_documents"], [
      ...(advancedEnabled ? ["review_cv"] : []),
      ...(retrievalEnabled ? ["retrieve_knowledge"] : [])
    ]);
  }

  return common;
}

function withOptionalTools(base: string[], optional: string[]) {
  return Array.from(new Set([...base, ...optional]));
}

export function enforceToolPolicy({
  toolName,
  allowedTools
}: {
  toolName: string;
  allowedTools: string[];
}) {
  const policy = toolPolicies[toolName];
  if (!policy) {
    throw new Error(`Unknown agent tool: ${toolName}`);
  }

  if (!allowedTools.includes(toolName)) {
    throw new Error(`Tool ${toolName} is not allowed for this request.`);
  }

  if (policy.risk === "execution") {
    throw new Error(`Execution tool ${toolName} is not exposed to the model.`);
  }

  return policy;
}
