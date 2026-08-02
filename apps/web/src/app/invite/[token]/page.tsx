import { InviteRedeemClient } from "@/components/invite-redeem-client";

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;
  return <InviteRedeemClient token={token} />;
}
