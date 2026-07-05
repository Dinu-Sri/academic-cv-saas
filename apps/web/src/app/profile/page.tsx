import { headers } from "next/headers";
import { AcademicProfileForm } from "@/components/academic-profile-form";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { getProfileEditor } from "@/lib/profile-editor";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="profile" />;
  }

  const { profile, sections, document, renderJob } = await getProfileEditor(session.user);

  return (
    <section className="workspace-screen profile-workspace">
      <AcademicProfileForm
        profile={{
          id: profile.id,
          displayName: profile.displayName,
          headline: profile.headline,
          affiliation: profile.affiliation,
          location: profile.location,
          email: profile.email,
          websiteUrl: profile.websiteUrl,
          googleScholarUrl: profile.googleScholarUrl,
          orcidUrl: profile.orcidUrl,
          linkedinUrl: profile.linkedinUrl,
          bio: profile.bio,
          researchSummary: profile.researchSummary,
          completeness: profile.completeness
        }}
        sections={sections.map((section) => ({
          id: section.id,
          key: section.key,
          title: section.title,
          sectionOrder: section.sectionOrder,
          isVisible: section.isVisible,
          entries: section.entries.map((entry) => ({
            id: entry.id,
            sectionKey: entry.sectionKey,
            entryOrder: entry.entryOrder,
            data: entry.data as Record<string, string>,
            isVisible: entry.isVisible
          }))
        }))}
        previewHtml={document?.previewHtml ?? ""}
        renderStatus={renderJob?.status ?? ""}
        pdfReady={Boolean(document?.pdfPath)}
        pdfError={document?.renderError ?? ""}
        saved={params.saved === "1"}
      />
    </section>
  );
}
