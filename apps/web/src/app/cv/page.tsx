import { headers } from "next/headers";
import { BuildCvWorkspace } from "@/components/build-cv-workspace";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { getProfileEditor } from "@/lib/profile-editor";
import { defaultVisibleSectionKeys } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

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
  const cvDocuments = await prisma.cvDocument.findMany({
    where: { profileId: profile.id },
    orderBy: { updatedAt: "desc" }
  });
  const initialDocuments = cvDocuments.length > 0 ? cvDocuments : document ? [document] : [];

  return (
    <BuildCvWorkspace
      displayName={profile.displayName}
      completeness={profile.completeness}
      entryCount={entryCount}
      sectionCount={visibleSections.length}
      documents={initialDocuments.map((item) => ({
        id: item.id,
        title: item.title,
        templateKey: item.templateKey,
        visibleSectionKeys: Array.isArray(item.visibleSectionKeys) ? item.visibleSectionKeys.filter((key): key is string => typeof key === "string") : defaultVisibleSectionKeys,
        pdfReady: Boolean(item.pdfPath),
        pdfError: item.renderError,
        updatedAt: item.updatedAt.toISOString()
      }))}
      sectionOptions={sections.map((section) => ({
        key: section.key,
        title: section.title,
        entryCount: section.entries.length
      }))}
    />
  );
}
