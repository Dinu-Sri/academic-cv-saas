import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SupportWorkspace } from "@/components/support-workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listTicketsForUser } from "@/lib/support/service";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
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

  const tickets = await listTicketsForUser(user.id);

  return (
    <Suspense fallback={<section className="workspace-screen"><p>Loading support…</p></section>}>
      <SupportWorkspace initialTickets={tickets} />
    </Suspense>
  );
}
