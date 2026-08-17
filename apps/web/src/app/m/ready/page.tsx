import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { MobileReadyScreen } from "@/components/mobile/mobile-ready-screen";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Your CV draft is ready"
};

export default async function MobileReadyPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <Suspense fallback={<div className="mobile-flow-card-stack"><p className="mobile-flow-hint">Loading…</p></div>}>
      <MobileReadyScreen isAuthenticated={Boolean(session?.user)} />
    </Suspense>
  );
}
