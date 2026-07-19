import { NextResponse } from "next/server";
import { handlePayHereNotify } from "@/lib/billing/service";

export async function POST(request: Request) {
  const form = await request.formData();
  const payload: Record<string, string> = {};
  form.forEach((value, key) => {
    payload[key] = String(value);
  });

  const forwarded = request.headers.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null;

  const result = await handlePayHereNotify(payload, clientIp);
  return new NextResponse(result.message, { status: result.status });
}
