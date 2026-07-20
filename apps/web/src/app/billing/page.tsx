import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BillingWorkspace } from "@/components/billing-workspace";
import { auth } from "@/lib/auth";
import { getBillingStatusForUser } from "@/lib/billing/service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    redirect("/?login=1");
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.isGuest) {
    redirect("/?login=1");
  }

  const data = await getBillingStatusForUser(user);
  return <BillingWorkspace initialData={data} />;
}
