/** Client-safe guest limit constants (no Node crypto). */
export const GUEST_LIMIT_CODE = "GUEST_LIMIT_REACHED";
export const GUEST_MAX_COMPILE = 3;
export const GUEST_MAX_CHAT = 10;

export function notifyGuestLimit(message?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("cvscholar-guest-limit", {
      detail: { message: message || "Create a free account to continue." }
    })
  );
}

/** If a response is the guest trial limit, open the login gate. Returns true when handled. */
export async function handleGuestLimitResponse(response: Response) {
  if (response.status !== 402) return false;
  try {
    const body = (await response.clone().json()) as { code?: string; error?: string };
    if (body.code === GUEST_LIMIT_CODE) {
      notifyGuestLimit(body.error);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
