import { NextResponse } from "next/server";
import {
  getPlanInvitationByToken,
  invitationStatus,
  redeemPlanInvitation
} from "@/lib/billing/invitations";
import { planDisplayName } from "@/lib/billing/plans";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

type Params = { params: Promise<{ token: string }> };

export async function GET(_: Request, { params }: Params) {
  const { token } = await params;
  const invite = await getPlanInvitationByToken(token);
  if (!invite) {
    return NextResponse.json({ error: "This invitation link is invalid." }, { status: 404 });
  }

  const status = invitationStatus(invite);
  return NextResponse.json({
    ok: true,
    invitation: {
      email: invite.email,
      planKey: invite.planKey,
      planName: planDisplayName(invite.planKey),
      expiresAt: invite.expiresAt.toISOString(),
      status,
      note: invite.note
    }
  });
}

export async function POST(_: Request, { params }: Params) {
  const actor = await resolveRequestActor({ allowGuest: false });
  if (!actor || actor.isGuest) {
    return NextResponse.json({ error: "Please login with the invited email to redeem this plan." }, { status: 401 });
  }

  const { token } = await params;
  const { workspace } = await getOrCreateWorkspaceForUser(actor.user);
  const result = await redeemPlanInvitation({
    token,
    user: { id: actor.user.id, email: actor.user.email, name: actor.user.name },
    workspaceId: workspace.id
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, expectedEmail: "expectedEmail" in result ? result.expectedEmail : undefined },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    planKey: result.planKey,
    planName: result.planName,
    expiresAt: result.expiresAt?.toISOString() ?? null
  });
}
