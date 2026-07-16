import { headers } from "next/headers";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { WebsiteWorkspace } from "@/components/website/website-workspace";
import { auth } from "@/lib/auth";
import { websiteFeatureEnabled } from "@/lib/website/constants";
import { getWebsiteWorkspaceForUser } from "@/lib/website/service";

export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  if (!websiteFeatureEnabled()) {
    return <WorkspaceScreen screen="website" />;
  }

  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="website" />;
  }

  const data = await getWebsiteWorkspaceForUser(session.user);
  if (!data.enabled) {
    return <WorkspaceScreen screen="website" />;
  }

  return <WebsiteWorkspace initialData={data} />;
}
