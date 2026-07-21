import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/admin";
import { getAdminUserDetail } from "@/lib/admin-users";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const gate = await requirePlatformAdmin();
  if (gate.response) return gate.response;

  const { id } = await params;
  const user = await getAdminUserDetail(id);
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({ user });
}
