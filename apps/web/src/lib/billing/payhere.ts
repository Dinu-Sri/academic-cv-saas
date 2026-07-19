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

/** Known PayHere notify IPs (production). Sandbox skips IP check. */
const PAYHERE_CIDRS = ["175.157.14.7", "175.157.14.11"];

export function verifyPayHereIp(ip: string | null, sandbox: boolean): boolean {
  if (sandbox) return true;
  if (!ip) return false;
  const clean = ip.replace(/^::ffff:/, "");
  return PAYHERE_CIDRS.includes(clean) || clean.startsWith("103.123.44.");
}

export function billingDevSimulateEnabled() {
  return (process.env.CVSCHOLAR_BILLING_DEV_SIMULATE || "0").trim() === "1";
}
