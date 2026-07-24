import { createHash, randomBytes } from "node:crypto";
import { promises as dns } from "node:dns";
import { CUSTOM_DOMAIN_LOCKED_CODE } from "@/lib/billing/plans";
import { getEntitlementsForWorkspace } from "@/lib/billing/entitlements";
import { prisma } from "@/lib/prisma";
import { websiteRootDomain } from "@/lib/website/public-url";

export const CUSTOM_DOMAIN_STATUSES = [
  "pending_dns",
  "pending_ssl",
  "active",
  "failed",
  "disabled"
] as const;

export type CustomDomainStatus = (typeof CUSTOM_DOMAIN_STATUSES)[number];

const BLOCKED_HOST_SUFFIXES = [
  "cvscholar.com",
  "cvscholar.local",
  "localhost",
  "local"
];

export function customDomainFeatureEnabled() {
  return process.env.CVSCHOLAR_CUSTOM_DOMAIN_ENABLED !== "0";
}

/** CNAME target users should point their hostname at. */
export function customDomainCnameTarget() {
  return (
    process.env.CVSCHOLAR_CUSTOM_DOMAIN_CNAME_TARGET ||
    process.env.NEXT_PUBLIC_CUSTOM_DOMAIN_CNAME_TARGET ||
    `sites.${websiteRootDomain()}`
  )
    .toLowerCase()
    .replace(/\.$/, "");
}

export function cloudflareCustomHostConfigured() {
  return Boolean(
    process.env.CLOUDFLARE_API_TOKEN &&
      process.env.CLOUDFLARE_ZONE_ID &&
      process.env.CVSCHOLAR_CUSTOM_DOMAIN_CF_ENABLED !== "0"
  );
}

/** Normalize user input to a bare hostname (no scheme/path/port). */
export function normalizeHostname(input: string): string {
  let value = (input || "").trim().toLowerCase();
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0] || "";
  value = value.split("?")[0] || "";
  value = value.split("#")[0] || "";
  value = value.replace(/:\d+$/, "");
  value = value.replace(/\.$/, "");
  // Strip trailing dots and whitespace again
  return value.trim();
}

export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (hostname.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return false;
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  return labels.every((label) => label.length >= 1 && label.length <= 63 && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(label));
}

export function isBlockedHostname(hostname: string): boolean {
  const root = websiteRootDomain();
  if (hostname === root || hostname.endsWith(`.${root}`)) return true;
  for (const suffix of BLOCKED_HOST_SUFFIXES) {
    if (hostname === suffix || hostname.endsWith(`.${suffix}`)) return true;
  }
  if (hostname === "localhost" || hostname.endsWith(".local")) return true;
  return false;
}

export function verificationTxtName(hostname: string) {
  return `_cvscholar-verify.${hostname}`;
}

function newVerificationToken() {
  return `cvscholar-verify-${randomBytes(16).toString("hex")}`;
}

export type CustomDomainDto = {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  verificationToken: string;
  verifiedAt: string | null;
  isPrimary: boolean;
  redirectSubdomain: boolean;
  lastCheckedAt: string | null;
  lastError: string;
  dns: {
    cnameHost: string;
    cnameTarget: string;
    txtHost: string;
    txtValue: string;
  };
  publicUrl: string;
  cloudflareConfigured: boolean;
};

function toDto(row: {
  id: string;
  hostname: string;
  status: string;
  sslStatus: string;
  verificationToken: string;
  verifiedAt: Date | null;
  isPrimary: boolean;
  redirectSubdomain: boolean;
  lastCheckedAt: Date | null;
  lastError: string;
}): CustomDomainDto {
  return {
    id: row.id,
    hostname: row.hostname,
    status: row.status,
    sslStatus: row.sslStatus,
    verificationToken: row.verificationToken,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    isPrimary: row.isPrimary,
    redirectSubdomain: row.redirectSubdomain,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastError: row.lastError,
    dns: {
      cnameHost: row.hostname,
      cnameTarget: customDomainCnameTarget(),
      txtHost: verificationTxtName(row.hostname),
      txtValue: row.verificationToken
    },
    publicUrl: `https://${row.hostname}`,
    cloudflareConfigured: cloudflareCustomHostConfigured()
  };
}

export async function listCustomDomainsForWebsite(websiteId: string) {
  const rows = await prisma.websiteCustomDomain.findMany({
    where: { websiteId },
    orderBy: { createdAt: "desc" }
  });
  return rows.map(toDto);
}

export async function getPrimaryCustomDomain(websiteId: string) {
  return prisma.websiteCustomDomain.findFirst({
    where: { websiteId, status: "active", isPrimary: true },
    orderBy: { updatedAt: "desc" }
  });
}

/** Fast public lookup for middleware / public pages. */
export async function lookupActiveCustomDomainUsername(hostnameInput: string): Promise<{
  username: string;
  websiteId: string;
  workspaceId: string;
  hostname: string;
} | null> {
  const hostname = normalizeHostname(hostnameInput);
  if (!hostname || !isValidHostname(hostname)) return null;

  const row = await prisma.websiteCustomDomain.findFirst({
    where: { hostname, status: "active" },
    include: {
      website: {
        select: {
          id: true,
          username: true,
          status: true,
          blockedAt: true,
          workspaceId: true
        }
      }
    }
  });

  if (!row || row.website.blockedAt) return null;
  if (row.website.status !== "published") return null;

  // Plan must still allow custom domain (auto-disable is best-effort; enforce at read time too).
  const entitlements = await getEntitlementsForWorkspace(row.website.workspaceId);
  if (!entitlements.canConnectCustomDomain) {
    await prisma.websiteCustomDomain.update({
      where: { id: row.id },
      data: {
        status: "disabled",
        lastError: "Scholar Annual required. Domain paused until the plan is renewed.",
        lastCheckedAt: new Date()
      }
    });
    return null;
  }

  return {
    username: row.website.username,
    websiteId: row.website.id,
    workspaceId: row.website.workspaceId,
    hostname: row.hostname
  };
}

export async function addCustomDomainForUser(
  user: { id: string },
  hostnameInput: string
): Promise<CustomDomainDto> {
  if (!customDomainFeatureEnabled()) {
    throw Object.assign(new Error("Custom domains are temporarily disabled."), { status: 503 });
  }

  const { getOrCreateWorkspaceForUser } = await import("@/lib/workspace");
  const { workspace, profile } = await getOrCreateWorkspaceForUser(user as never);
  const entitlements = await getEntitlementsForWorkspace(workspace.id);
  if (!entitlements.canConnectCustomDomain) {
    throw Object.assign(new Error("Custom domains require Scholar Annual."), {
      status: 402,
      code: CUSTOM_DOMAIN_LOCKED_CODE
    });
  }

  const website = await prisma.academicWebsite.findUnique({ where: { profileId: profile.id } });
  if (!website) {
    throw Object.assign(new Error("Create and save your academic website before connecting a domain."), {
      status: 400
    });
  }

  const hostname = normalizeHostname(hostnameInput);
  if (!isValidHostname(hostname)) {
    throw Object.assign(new Error("Enter a valid domain (e.g. www.yourname.edu)."), { status: 422 });
  }
  if (isBlockedHostname(hostname)) {
    throw Object.assign(new Error("That hostname cannot be used as a custom domain."), { status: 422 });
  }

  const existing = await prisma.websiteCustomDomain.findUnique({ where: { hostname } });
  if (existing && existing.websiteId !== website.id) {
    throw Object.assign(new Error("That domain is already connected to another site."), { status: 409 });
  }
  if (existing && existing.websiteId === website.id) {
    return toDto(existing);
  }

  // One primary domain per website for v1 — replace pending rows for same site.
  const count = await prisma.websiteCustomDomain.count({
    where: { websiteId: website.id, status: { not: "disabled" } }
  });
  if (count >= 1) {
    throw Object.assign(
      new Error("This site already has a domain. Remove it before adding another."),
      { status: 409 }
    );
  }

  const row = await prisma.websiteCustomDomain.create({
    data: {
      websiteId: website.id,
      hostname,
      status: "pending_dns",
      verificationToken: newVerificationToken(),
      sslStatus: cloudflareCustomHostConfigured() ? "pending" : "skipped",
      isPrimary: true
    }
  });

  return toDto(row);
}

async function resolveCnameChain(hostname: string): Promise<string[]> {
  const seen = new Set<string>();
  const results: string[] = [];
  let current = hostname;
  for (let i = 0; i < 6; i += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    try {
      const records = await dns.resolveCname(current);
      if (!records.length) break;
      for (const r of records) {
        const clean = r.replace(/\.$/, "").toLowerCase();
        results.push(clean);
        current = clean;
      }
    } catch {
      break;
    }
  }
  return results;
}

async function resolveTxtValues(name: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(name);
    return records.map((chunks) => chunks.join("").trim());
  } catch {
    return [];
  }
}

export type DnsCheckResult = {
  cnameOk: boolean;
  txtOk: boolean;
  cnameFound: string[];
  txtFound: string[];
  expectedCname: string;
  expectedTxt: string;
  message: string;
};

export async function checkDomainDns(row: {
  hostname: string;
  verificationToken: string;
}): Promise<DnsCheckResult> {
  const expectedCname = customDomainCnameTarget();
  const expectedTxt = row.verificationToken;
  const cnameFound = await resolveCnameChain(row.hostname);
  // Also accept ALIAS/ANAME setups that resolve CNAME on www only — check hostname as-is.
  const txtFound = await resolveTxtValues(verificationTxtName(row.hostname));

  const cnameOk = cnameFound.some(
    (c) => c === expectedCname || c.endsWith(`.${expectedCname}`) || expectedCname.endsWith(`.${c}`)
  );
  // Looser match: target appears as suffix of found CNAME
  const cnameOkLoose =
    cnameOk ||
    cnameFound.some((c) => c.includes(expectedCname.replace(/^sites\./, "")) && c.includes("cvscholar"));

  const txtOk = txtFound.some((t) => t === expectedTxt || t.includes(expectedTxt));

  let message = "";
  if (txtOk && (cnameOk || cnameOkLoose)) {
    message = "DNS looks correct.";
  } else if (!txtOk && !(cnameOk || cnameOkLoose)) {
    message = "TXT verification and CNAME target not found yet. DNS can take time to propagate.";
  } else if (!txtOk) {
    message = "CNAME looks OK, but verification TXT record is missing.";
  } else {
    message = `TXT verified, but CNAME should point to ${expectedCname}.`;
  }

  return {
    cnameOk: cnameOk || cnameOkLoose,
    txtOk,
    cnameFound,
    txtFound,
    expectedCname,
    expectedTxt,
    message
  };
}

async function provisionCloudflareHostname(hostname: string): Promise<{
  id: string;
  sslStatus: string;
  error?: string;
}> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) {
    return { id: "", sslStatus: "skipped" };
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      hostname,
      ssl: {
        method: "http",
        type: "dv",
        settings: {
          min_tls_version: "1.2"
        }
      }
    })
  });

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    errors?: { message?: string }[];
    result?: { id?: string; ssl?: { status?: string } };
  };

  if (!response.ok || !body.success) {
    // Already exists — try list
    if (response.status === 409 || body.errors?.some((e) => /already exists/i.test(e.message || ""))) {
      const listed = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(hostname)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const listBody = (await listed.json().catch(() => ({}))) as {
        result?: { id?: string; ssl?: { status?: string } }[];
      };
      const hit = listBody.result?.[0];
      if (hit?.id) {
        return { id: hit.id, sslStatus: hit.ssl?.status === "active" ? "active" : "pending" };
      }
    }
    return {
      id: "",
      sslStatus: "error",
      error: body.errors?.map((e) => e.message).filter(Boolean).join("; ") || `Cloudflare error ${response.status}`
    };
  }

  return {
    id: body.result?.id || "",
    sslStatus: body.result?.ssl?.status === "active" ? "active" : "pending"
  };
}

async function refreshCloudflareSsl(hostnameId: string): Promise<string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId || !hostnameId) return "skipped";

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${hostnameId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const body = (await response.json().catch(() => ({}))) as {
    result?: { ssl?: { status?: string } };
  };
  const status = body.result?.ssl?.status || "";
  if (status === "active") return "active";
  if (status === "pending_validation" || status === "pending_issuance" || status === "pending_deployment") {
    return "pending";
  }
  if (!response.ok) return "error";
  return status || "pending";
}

export async function verifyCustomDomain(domainId: string, websiteId: string): Promise<CustomDomainDto> {
  const row = await prisma.websiteCustomDomain.findFirst({
    where: { id: domainId, websiteId }
  });
  if (!row) {
    throw Object.assign(new Error("Domain not found."), { status: 404 });
  }

  const website = await prisma.academicWebsite.findUnique({ where: { id: websiteId } });
  if (!website) throw Object.assign(new Error("Website not found."), { status: 404 });

  const entitlements = await getEntitlementsForWorkspace(website.workspaceId);
  if (!entitlements.canConnectCustomDomain) {
    const disabled = await prisma.websiteCustomDomain.update({
      where: { id: row.id },
      data: {
        status: "disabled",
        lastError: "Scholar Annual required.",
        lastCheckedAt: new Date()
      }
    });
    return toDto(disabled);
  }

  const dns = await checkDomainDns(row);
  let status = row.status;
  let sslStatus = row.sslStatus;
  let cloudflareHostnameId = row.cloudflareHostnameId;
  let verifiedAt = row.verifiedAt;
  let lastError = "";

  if (dns.txtOk && dns.cnameOk) {
    verifiedAt = verifiedAt || new Date();
    if (cloudflareCustomHostConfigured()) {
      if (!cloudflareHostnameId) {
        const cf = await provisionCloudflareHostname(row.hostname);
        cloudflareHostnameId = cf.id;
        sslStatus = cf.sslStatus;
        if (cf.error) lastError = cf.error;
      } else {
        sslStatus = await refreshCloudflareSsl(cloudflareHostnameId);
      }
      status = sslStatus === "active" || sslStatus === "skipped" ? "active" : "pending_ssl";
      if (sslStatus === "error") {
        status = "failed";
        lastError = lastError || "SSL provisioning failed. Check Cloudflare custom hostname settings.";
      }
    } else {
      // DNS verified; SSL terminated by user's proxy or later CF setup.
      sslStatus = "skipped";
      status = "active";
    }
  } else {
    status = "pending_dns";
    lastError = dns.message;
  }

  const updated = await prisma.websiteCustomDomain.update({
    where: { id: row.id },
    data: {
      status,
      sslStatus,
      cloudflareHostnameId,
      verifiedAt,
      lastCheckedAt: new Date(),
      lastError
    }
  });

  return toDto(updated);
}

export async function removeCustomDomain(domainId: string, websiteId: string) {
  const row = await prisma.websiteCustomDomain.findFirst({
    where: { id: domainId, websiteId }
  });
  if (!row) {
    throw Object.assign(new Error("Domain not found."), { status: 404 });
  }

  // Best-effort Cloudflare cleanup
  if (row.cloudflareHostnameId && cloudflareCustomHostConfigured()) {
    const token = process.env.CLOUDFLARE_API_TOKEN!;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID!;
    await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${row.cloudflareHostnameId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    ).catch(() => undefined);
  }

  await prisma.websiteCustomDomain.delete({ where: { id: row.id } });
  return { ok: true as const };
}

export async function setCustomDomainRedirectSubdomain(
  domainId: string,
  websiteId: string,
  redirectSubdomain: boolean
) {
  const row = await prisma.websiteCustomDomain.updateMany({
    where: { id: domainId, websiteId },
    data: { redirectSubdomain, updatedAt: new Date() }
  });
  if (!row.count) throw Object.assign(new Error("Domain not found."), { status: 404 });
  const updated = await prisma.websiteCustomDomain.findUniqueOrThrow({ where: { id: domainId } });
  return toDto(updated);
}

/** Disable all custom domains for a workspace (plan expiry). */
export async function disableCustomDomainsForWorkspace(workspaceId: string, reason: string) {
  const sites = await prisma.academicWebsite.findMany({
    where: { workspaceId },
    select: { id: true }
  });
  if (!sites.length) return { count: 0 };
  const result = await prisma.websiteCustomDomain.updateMany({
    where: {
      websiteId: { in: sites.map((s) => s.id) },
      status: { in: ["pending_dns", "pending_ssl", "active", "failed"] }
    },
    data: {
      status: "disabled",
      lastError: reason,
      lastCheckedAt: new Date()
    }
  });
  return { count: result.count };
}

/** Re-enable disabled domains when Scholar Annual returns (back to pending_dns for re-verify). */
export async function reactivateCustomDomainsForWorkspace(workspaceId: string) {
  const sites = await prisma.academicWebsite.findMany({
    where: { workspaceId },
    select: { id: true }
  });
  if (!sites.length) return { count: 0 };
  const result = await prisma.websiteCustomDomain.updateMany({
    where: {
      websiteId: { in: sites.map((s) => s.id) },
      status: "disabled"
    },
    data: {
      status: "pending_dns",
      sslStatus: cloudflareCustomHostConfigured() ? "pending" : "skipped",
      lastError: "Plan restored — re-run domain verification.",
      lastCheckedAt: new Date()
    }
  });
  return { count: result.count };
}

export async function getCustomDomainPayloadForWebsite(websiteId: string) {
  const domains = await listCustomDomainsForWebsite(websiteId);
  return {
    enabled: customDomainFeatureEnabled(),
    cnameTarget: customDomainCnameTarget(),
    cloudflareConfigured: cloudflareCustomHostConfigured(),
    domains
  };
}

/** Stable hash for cache keys (optional). */
export function hostCacheKey(hostname: string) {
  return createHash("sha256").update(normalizeHostname(hostname)).digest("hex").slice(0, 16);
}
