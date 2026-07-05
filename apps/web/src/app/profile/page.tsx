import { headers } from "next/headers";
import { AcademicProfileForm } from "@/components/academic-profile-form";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { getOrCreateWorkspaceForUser } from "@/lib/workspace";

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

  const { profile } = await getOrCreateWorkspaceForUser(session.user);

  return (
    <section className="workspace-screen">
      <AcademicProfileForm profile={profile} saved={params.saved === "1"} />
    </section>
  );
}
