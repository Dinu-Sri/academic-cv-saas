import { Suspense } from "react";
import { AcademicProfileForm } from "@/components/academic-profile-form";
import { getEntitlementsForWorkspace } from "@/lib/billing/entitlements";
import { getProfileEditor } from "@/lib/profile-editor";
import { resolveRequestActor } from "@/lib/request-user";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string; ai?: string }>;
}) {
  const params = await searchParams;
  const actor = await resolveRequestActor({ allowGuest: true });
  if (!actor) {
    return null;
  }

  const { workspace } = await getOrCreateWorkspaceForUser(actor.user);
  const entitlements = await getEntitlementsForWorkspace(workspace.id);
  const { profile, sections, document } = await getProfileEditor(actor.user);

  return (
    <section className="workspace-screen profile-workspace">
      <Suspense fallback={<p className="muted-text">Loading editor…</p>}>
        <AcademicProfileForm
          profile={{
            id: profile.id,
            displayName: profile.displayName,
            headline: profile.headline,
            affiliation: profile.affiliation,
            location: profile.location,
            countryCode: profile.countryCode,
            academicFieldGroup: profile.academicFieldGroup,
            academicField: profile.academicField,
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
          pdfReady={Boolean(document?.pdfPath)}
          pdfError={document?.renderError ?? ""}
          saved={params.saved === "1"}
          canDownloadPdf={entitlements.canDownloadPdf}
        />
      </Suspense>
    </section>
  );
}
