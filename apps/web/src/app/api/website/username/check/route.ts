import { NextResponse } from "next/server";
import { websiteFeatureEnabled } from "@/lib/website/constants";
import { checkWebsiteUsernameAvailability } from "@/lib/website/service";

export async function GET(request: Request) {
  if (!websiteFeatureEnabled()) {
    return NextResponse.json({ error: "Website feature is disabled." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const value = searchParams.get("value") || "";
  const result = await checkWebsiteUsernameAvailability(value);
  return NextResponse.json(result);
}
