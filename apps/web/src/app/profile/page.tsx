import { headers } from "next/headers";
import { AcademicProfileForm } from "@/components/academic-profile-form";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return <WorkspaceScreen screen="profile" />;
  }

  const { profile } = await getOrCreateWorkspaceForUser(session.user);

  return (
    <section className="workspace-screen">
      <div className="screen-header">
        <div>
          <h1>Academic Profile</h1>
          <p>Add your main academic details once. We use this information for your CV and website.</p>
        </div>
      </div>
      <article className="simple-panel profile-panel">
        <div>
          <span className="section-label">Saved Profile</span>
          <h2>Basic academic details</h2>
          <p>Keep this page simple. Add the information most visitors expect first.</p>
        </div>
        <div className="profile-save-note">
          Changes are saved to the new rewrite database.
        </div>
      </article>
      <AcademicProfileForm profile={profile} />
    </section>
  );
}
