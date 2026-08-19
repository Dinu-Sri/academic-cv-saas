import { createHash } from "crypto";

export type PayHereConfig = {
  merchantId: string;
  merchantSecret: string;
  currency: string;
  sandbox: boolean;
};

export function getPayHereConfig(): PayHereConfig | null {
  const merchantId = (process.env.PAYHERE_MERCHANT_ID || "").trim();
  const merchantSecret = (process.env.PAYHERE_MERCHANT_SECRET || "").trim();
  if (!merchantId || !merchantSecret) return null;

  return {
    merchantId,
    merchantSecret,
    currency: (process.env.PAYHERE_CURRENCY || "USD").trim() || "USD",
    sandbox: (process.env.PAYHERE_SANDBOX || "1").trim() !== "0"
  };
}

export function payHereIsConfigured() {
  return getPayHereConfig() !== null;
}

/** PayHere checkout hash: md5(merchant_id + order_id + amount + currency + md5(secret)).upper */
export function generatePayHereHash(orderId: string, amount: number, currency: string, config: PayHereConfig) {
  const amountStr = amount.toFixed(2);
  const hashedSecret = createHash("md5").update(config.merchantSecret).digest("hex").toUpperCase();
  return createHash("md5")
    .update(config.merchantId + orderId + amountStr + currency + hashedSecret)
    .digest("hex")
    .toUpperCase();
}

/** Verify PayHere notify md5sig. */
export function verifyPayHereNotification(
  post: Record<string, string>,
  config: PayHereConfig
): boolean {
  const merchantId = post.merchant_id || "";
  const orderId = post.order_id || "";
  const amount = post.payhere_amount || "";
  const currency = post.payhere_currency || "";
  const statusCode = post.status_code || "";
  const received = (post.md5sig || "").toUpperCase();

  const hashedSecret = createHash("md5").update(config.merchantSecret).digest("hex").toUpperCase();
  const expected = createHash("md5")
    .update(merchantId + orderId + amount + currency + statusCode + hashedSecret)
    .digest("hex")
    .toUpperCase();

  return expected === received && expected.length > 0;
}

/** Known PayHere notify IPs (production). Mirrors legacy PayHereService::PAYHERE_IPS. */
const PAYHERE_ALLOWLIST = ["175.157.14.7", "175.157.14.11", "103.123.44.0/24"] as const;

function ipInCidr(ip: string, cidr: string): boolean {
  const [subnet, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  if (!subnet || !Number.isFinite(bits)) return false;
  const ipNum = ipv4ToInt(ip);
  const subnetNum = ipv4ToInt(subnet);
  if (ipNum === null || subnetNum === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (subnetNum & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function verifyPayHereIp(ip: string | null, sandbox: boolean): boolean {
  if (sandbox) return true;
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "").trim();
  for (const allowed of PAYHERE_ALLOWLIST) {
    if (allowed.includes("/")) {
      if (ipInCidr(clean, allowed)) return true;
    } else if (clean === allowed) {
      return true;
    }
  }
  return false;
}

/** Prefer Cloudflare / proxy real client IP (PayHere → CF → tunnel → app). */
export function payHereClientIpFromHeaders(headers: Headers): string | null {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return null;
}

export function billingDevSimulateEnabled() {
  return (process.env.CVSCHOLAR_BILLING_DEV_SIMULATE || "0").trim() === "1";
}
