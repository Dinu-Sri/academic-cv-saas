/**
 * Extract browser attribution cookies and request metadata for CAPI user_data.
 */

export type MetaRequestContext = {
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
  eventSourceUrl?: string;
};

function firstHeader(headers: Headers, name: string): string {
  return (headers.get(name) || "").trim();
}

/** Parse Cookie header into a simple map. */
export function parseCookieHeader(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

/**
 * Build fbc from fbclid if _fbc cookie is missing.
 * Format: fb.1.{timestamp}.{fbclid}
 */
export function fbcFromFbclid(fbclid: string | null | undefined, nowMs = Date.now()): string | undefined {
  const id = (fbclid || "").trim();
  if (!id) return undefined;
  return `fb.1.${Math.floor(nowMs / 1000)}.${id}`;
}

export function metaContextFromRequest(request: Request, extras?: { eventSourceUrl?: string }): MetaRequestContext {
  const headers = request.headers;
  const forwarded = firstHeader(headers, "x-forwarded-for");
  const clientIpAddress =
    forwarded.split(",")[0]?.trim() || firstHeader(headers, "x-real-ip") || undefined;
  const clientUserAgent = firstHeader(headers, "user-agent") || undefined;

  const cookies = parseCookieHeader(firstHeader(headers, "cookie"));
  const fbp = cookies._fbp || undefined;
  let fbc = cookies._fbc || undefined;

  try {
    const url = new URL(request.url);
    if (!fbc) {
      fbc = fbcFromFbclid(url.searchParams.get("fbclid") || undefined);
    }
  } catch {
    // ignore
  }

  return {
    clientIpAddress: clientIpAddress || undefined,
    clientUserAgent,
    fbp,
    fbc,
    eventSourceUrl: extras?.eventSourceUrl
  };
}

/** Headers-only helper (Next.js route handlers with `headers()`). */
export function metaContextFromHeaders(
  headerStore: Headers,
  extras?: { eventSourceUrl?: string; cookieHeader?: string }
): MetaRequestContext {
  const fake = new Request("https://cvscholar.local/", {
    headers: headerStore
  });
  // Ensure cookie header is present if passed separately
  if (extras?.cookieHeader && !headerStore.get("cookie")) {
    const h = new Headers(headerStore);
    h.set("cookie", extras.cookieHeader);
    return metaContextFromRequest(new Request("https://cvscholar.local/", { headers: h }), extras);
  }
  return metaContextFromRequest(fake, extras);
}
