import { headers } from "next/headers";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { websiteFeatureEnabled } from "@/lib/website/constants";
import { getWebsitePreviewForUser } from "@/lib/website/service";
import { ModernScholarPreview } from "@/components/website/modern-scholar-preview";

export const dynamic = "force-dynamic";

export default async function WebsitePreviewPage() {
  if (!websiteFeatureEnabled()) {
    return <PreviewGate message="Website feature is disabled." />;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return <PreviewGate message="Please login to preview your academic website draft." />;
  }

  let preview: Awaited<ReturnType<typeof getWebsitePreviewForUser>> | null = null;
  let loadError = "";
  try {
    preview = await getWebsitePreviewForUser(session.user);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Create a website draft before opening the preview.";
  }

  if (!preview) {
    return <PreviewGate message={loadError || "Create a website draft before opening the preview."} />;
  }

  return (
    <div className="website-preview-page">
      <div className="website-preview-banner">
        <strong>Private draft preview</strong>
        <span>Not public · not indexed · only visible while logged in</span>
        <Link href="/website" className="secondary-action">
          Back to website editor
        </Link>
      </div>
      <ModernScholarPreview model={preview} mode="preview" />
    </div>
  );
}

function PreviewGate({ message }: { message: string }) {
  return (
    <main className="website-preview-gate">
      <p>{message}</p>
      <Link href="/website" className="primary-action">
        Go to Academic Website
      </Link>
    </main>
  );
}
