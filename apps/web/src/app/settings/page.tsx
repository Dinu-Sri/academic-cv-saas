import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SettingsWorkspace } from "@/components/settings-workspace";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettingsForUser } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
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

  const data = await getSettingsForUser(user);
  return <SettingsWorkspace initialData={data} />;
}
