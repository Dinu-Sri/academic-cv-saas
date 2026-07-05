import { headers } from "next/headers";
import { BuildCvWorkspace } from "@/components/build-cv-workspace";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { getProfileEditor } from "@/lib/profile-editor";

export const dynamic = "force-dynamic";

export default async function CvPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="cv" />;
  }

  const { profile, sections, document } = await getProfileEditor(session.user);
  const visibleSections = sections.filter((section) => section.entries.length > 0);
  const entryCount = sections.reduce((sum, section) => sum + section.entries.length, 0);

  return (
    <BuildCvWorkspace
      displayName={profile.displayName}
      completeness={profile.completeness}
      entryCount={entryCount}
      sectionCount={visibleSections.length}
      previewHtml={document?.previewHtml ?? ""}
      currentTemplate={document?.templateKey ?? "classic"}
      pdfReady={Boolean(document?.pdfPath)}
      pdfError={document?.renderError ?? ""}
    />
  );
}
