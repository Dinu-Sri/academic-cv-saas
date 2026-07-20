import { WorkspaceScreen } from "@/components/workspace-screen";
import { WebsiteWorkspace } from "@/components/website/website-workspace";
import { websiteFeatureEnabled } from "@/lib/website/constants";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";
import { resolveRequestActor } from "@/lib/request-user";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  if (!websiteFeatureEnabled()) {
    return <WorkspaceScreen screen="website" />;
  }

  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return <WorkspaceScreen screen="website" />;
  }

  const data = await getWebsiteWorkspaceForUser(actor.user);
  if (!data.enabled) {
    return <WorkspaceScreen screen="website" />;
  }

  return <WebsiteWorkspace initialData={data} />;
}
