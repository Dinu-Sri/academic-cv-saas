import { PublicationsWorkspace } from "@/components/publications-workspace";
import { getPublicationWorkspace } from "@/lib/publications";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function PublicationsPage() {
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) return null;

  const { profile } = await getOrCreateWorkspaceForUser(actor.user);
  const data = await getPublicationWorkspace(profile.id);

  return <PublicationsWorkspace initialData={data} />;
}
