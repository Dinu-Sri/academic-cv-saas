import { RESERVED_WEBSITE_USERNAMES } from "./constants";

export type UsernameCheckResult = {
  input: string;
  normalized: string;
  valid: boolean;
  available: boolean;
  reason: string | null;
  suggestions: string[];
};

export function normalizeWebsiteUsername(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function validateWebsiteUsernameFormat(username: string) {
  if (username.length < 3 || username.length > 50) {
    return { valid: false, reason: "length" as const };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(username)) {
    return { valid: false, reason: "format" as const };
  }
  if (username.includes("--")) {
    return { valid: false, reason: "format" as const };
  }
  if (RESERVED_WEBSITE_USERNAMES.has(username)) {
    return { valid: false, reason: "reserved" as const };
  }
  return { valid: true, reason: null };
}

export function buildUsernameSuggestions(base: string) {
  const seed = normalizeWebsiteUsername(base).replace(/-+$/g, "") || "scholar";
  const year = new Date().getFullYear();
  return Array.from(
    new Set([
      `${seed}-research`,
      `dr-${seed}`.slice(0, 50),
      `${seed}-${String(year).slice(-2)}`,
      `${seed}-lab`,
      `${seed}-academic`
    ])
  )
    .map(normalizeWebsiteUsername)
    .filter((item) => validateWebsiteUsernameFormat(item).valid)
    .slice(0, 5);
}

export async function checkWebsiteUsernameAvailability(input: string, options?: { excludeWebsiteId?: string }): Promise<UsernameCheckResult> {
  const normalized = normalizeWebsiteUsername(input);
  const format = validateWebsiteUsernameFormat(normalized);

  if (!format.valid) {
    return {
      input,
      normalized,
      valid: false,
      available: false,
      reason: format.reason,
      suggestions: buildUsernameSuggestions(normalized || input)
    };
  }

  // Lazy import keeps pure username helpers usable without DATABASE_URL.
  const { prisma } = await import("@/lib/prisma");
  const existing = await prisma.academicWebsite.findUnique({
    where: { username: normalized },
    select: { id: true }
  });

  const taken = Boolean(existing && existing.id !== options?.excludeWebsiteId);
  return {
    input,
    normalized,
    valid: true,
    available: !taken,
    reason: taken ? "taken" : null,
    suggestions: taken ? buildUsernameSuggestions(normalized) : []
  };
}
