/**
 * Map internal agent failures to calm, human-facing copy.
 * Keep technical detail in logs / admin run.error; never show raw timeouts to users.
 */

export const AGENT_TIMEOUT_ERROR = "Agent run timed out.";
export const AGENT_CANCELLED_ERROR = "Agent run was cancelled.";

/** User-facing reply when AI capacity/timeout/stream issues interrupt a turn. */
export const AGENT_CAPACITY_USER_MESSAGE =
  "I’m having a temporary technical issue connecting to our AI reasoning service — this can happen when the models are under high demand or capacity limits. Please try again in a short while. If it keeps happening, open a support ticket and include a screenshot of this chat so we can investigate.";

export function isAgentTimeoutError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    message === AGENT_TIMEOUT_ERROR ||
    /timed?\s*out|timeout|deadline|aborted|ETIMEDOUT|AbortError/i.test(message)
  );
}

export function isAgentCapacityError(error: unknown): boolean {
  const message = errorMessage(error);
  return (
    isAgentTimeoutError(error) ||
    /rate limit|capacity|overloaded|503|502|429|service unavailable|temporarily unavailable|ECONNRESET|fetch failed/i.test(
      message
    )
  );
}

/**
 * Prefer this for anything shown in the chat UI or assistant bubbles.
 * Admin/cockpit can still store the raw error for debugging.
 */
export function friendlyAgentUserMessage(error: unknown): string {
  if (isAgentCapacityError(error)) {
    return AGENT_CAPACITY_USER_MESSAGE;
  }
  if (errorMessage(error) === AGENT_CANCELLED_ERROR || /cancelled/i.test(errorMessage(error))) {
    return "That request was cancelled. Send a new message whenever you are ready to continue.";
  }
  return (
    errorMessage(error) ||
    "I could not finish that step just now. Please try again in a short while. If it keeps happening, open a support ticket with a screenshot of this chat."
  );
}

/** True when the message already looks like our capacity copy (avoid double-wrapping). */
export function isFriendlyCapacityMessage(message: string): boolean {
  return /temporary technical issue|AI reasoning service|support ticket/i.test(message);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || "";
  if (typeof error === "string") return error;
  return "";
}
