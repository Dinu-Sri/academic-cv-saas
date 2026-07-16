import { NextResponse } from "next/server";
import { CLASSIC_LAYOUT_VERSION } from "@/lib/latex";

export const dynamic = "force-dynamic";

/** Deploy probe for rewrite stack: https://rewrite.cvscholar.com/api/version */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "cvscholar-rewrite",
    layout_version: CLASSIC_LAYOUT_VERSION,
    classic_pdf_engine: process.env.CVSCHOLAR_LATEX_ENGINE || "tectonic",
    deploy_ok: CLASSIC_LAYOUT_VERSION === "classic-layout-v6.1",
    time: new Date().toISOString()
  });
}
