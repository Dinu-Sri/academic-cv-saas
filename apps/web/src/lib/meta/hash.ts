import { createHash } from "crypto";

/** Normalize then SHA-256 hex (Meta customer information params). */
export function sha256Normalized(value: string): string {
  const normalized = value.trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

export function hashEmail(email: string): string {
  return sha256Normalized(email);
}

export function hashExternalId(userId: string): string {
  return sha256Normalized(userId);
}
