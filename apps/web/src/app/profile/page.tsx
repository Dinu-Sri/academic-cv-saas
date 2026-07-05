import { headers } from "next/headers";
import { AcademicProfileForm } from "@/components/academic-profile-form";
import { WorkspaceScreen } from "@/components/workspace-screen";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  const sections = await prisma.profileSection.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "asc" }
  });

  return (
    <section className="workspace-screen">
      <AcademicProfileForm profile={profile} sections={sections} saved={params.saved === "1"} />
    </section>
  );
}
