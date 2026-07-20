import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { HomeLanding } from "@/components/home-landing";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) {
    redirect("/profile");
  }
  return <HomeLanding />;
}
