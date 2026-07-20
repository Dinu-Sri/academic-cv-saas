import { HomeLanding } from "@/components/home-landing";

// Marketing home for guests — keep static/fast (no server session + guest bootstrap).
export default function RootPage() {
  return <HomeLanding />;
}
