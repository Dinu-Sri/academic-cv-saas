import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminEmailsWorkspace } from "@/components/admin-emails-workspace";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminEmailsPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return (
      <section className="workspace-screen">
        <div className="screen-header">
          <div>
            <span className="section-label">Admin Emails</span>
            <h1>Login required</h1>
            <p>Please login with an admin account to test transactional emails.</p>
          </div>
        </div>
      </section>
    );
  }

  if (!isPlatformAdmin(session.user.email)) {
    return (
      <section className="workspace-screen">
        <div className="screen-header">
          <div>
            <span className="section-label">Admin Emails</span>
            <h1>Admin access required</h1>
            <p>This account is not listed in CVSCHOLAR_ADMIN_EMAILS.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={<section className="workspace-screen"><p>Loading emails…</p></section>}>
      <AdminEmailsWorkspace />
    </Suspense>
  );
}
