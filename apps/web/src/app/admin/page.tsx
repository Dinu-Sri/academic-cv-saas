import { headers } from "next/headers";
import { AdminCockpit } from "@/components/admin-cockpit";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/admin";

export default async function AdminPage() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return (
      <section className="workspace-screen">
        <div className="screen-header">
          <div>
            <span className="section-label">Admin Cockpit</span>
            <h1>Login required</h1>
            <p>Please login with an admin account before opening the CVScholar control center.</p>
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
            <span className="section-label">Admin Cockpit</span>
            <h1>Admin access required</h1>
            <p>This account is signed in, but it is not listed in CVSCHOLAR_ADMIN_EMAILS.</p>
          </div>
        </div>
      </section>
    );
  }

  return <AdminCockpit />;
}
