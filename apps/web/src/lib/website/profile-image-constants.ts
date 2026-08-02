/** Shared client/server constants (no Node-only imports / no Prisma). */
export const PROFILE_IMAGE_OUTPUT_SIZE = 512;
export const PROFILE_IMAGE_MAX_BYTES = 900_000;

export function profileImagePublicUrl(username: string, version?: string | number | null) {
  const base = `/api/public-sites/${encodeURIComponent(username.toLowerCase())}/photo`;
  if (version == null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}

export function profileImageOwnerUrl(version?: string | number | null) {
  const base = "/api/website/profile-image";
  if (version == null || version === "") return base;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}
