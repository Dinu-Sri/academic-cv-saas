import { Suspense } from "react";
import { headers } from "next/headers";
import { AdminSupportWorkspace } from "@/components/admin-support-workspace";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return (
      <section className="workspace-screen">
        <div className="screen-header">
          <div>
            <span className="section-label">Admin Support</span>
            <h1>Login required</h1>
            <p>Please login with an admin account to manage support tickets.</p>
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
            <span className="section-label">Admin Support</span>
            <h1>Admin access required</h1>
            <p>This account is not listed in CVSCHOLAR_ADMIN_EMAILS.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <Suspense fallback={<section className="workspace-screen"><p>Loading tickets…</p></section>}>
      <AdminSupportWorkspace />
    </Suspense>
  );
}
