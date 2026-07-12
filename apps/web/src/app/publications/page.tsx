import { WorkspaceScreen } from "@/components/workspace-screen";
import { headers } from "next/headers";
import { PublicationsWorkspace } from "@/components/publications-workspace";
import { auth } from "@/lib/auth";
import { getPublicationWorkspace } from "@/lib/publications";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function PublicationsPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="publications" />;
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);
  const data = await getPublicationWorkspace(profile.id);

  return <PublicationsWorkspace initialData={data} />;
}
