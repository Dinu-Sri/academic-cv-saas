import { NextResponse } from "next/server";
import { payHereClientIpFromHeaders } from "@/lib/billing/payhere";
import { handlePayHereNotify } from "@/lib/billing/service";

/**
 * PayHere server-to-server notify (form-urlencoded).
 * Same role as legacy POST /payment/notify — must stay publicly reachable.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const payload: Record<string, string> = {};
  form.forEach((value, key) => {
    payload[key] = String(value);
  });

  // Behind Cloudflare Tunnel, use CF-Connecting-IP (PayHere origin), not the tunnel hop.
  const clientIp = payHereClientIpFromHeaders(request.headers);

  const result = await handlePayHereNotify(payload, clientIp);
  if (!result.ok) {
    console.error("[billing/notify]", result.status, result.message, {
      orderId: payload.order_id || "",
      statusCode: payload.status_code || "",
      clientIp
    });
  }
  return new NextResponse(result.message, { status: result.status });
}
