import { HomeLanding } from "@/components/home-landing";
import { getPublicImpactStats } from "@/lib/public-impact";

export default async function RootPage() {
  const impact = await getPublicImpactStats();
  return <HomeLanding impact={impact} />;
}
