import { headers } from "next/headers";
import { WorkspaceScreen } from "@/components/workspace-screen";
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
    return <WorkspaceScreen screen="settings" />;
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return <WorkspaceScreen screen="settings" />;
  }

  const data = await getSettingsForUser(user);
  return <SettingsWorkspace initialData={data} />;
}
