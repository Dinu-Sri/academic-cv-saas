import { headers } from "next/headers";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { BillingWorkspace } from "@/components/billing-workspace";
import { auth } from "@/lib/auth";
import { getBillingStatusForUser } from "@/lib/billing/service";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="billing" />;
  }

  const data = await getBillingStatusForUser(session.user);
  return <BillingWorkspace initialData={data} />;
}
