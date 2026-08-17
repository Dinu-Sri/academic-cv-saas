import type { Metadata } from "next";
import { MobileStartScreen } from "@/components/mobile/mobile-start-screen";

export const metadata: Metadata = {
  title: "Start your CV on mobile",
  description: "Start your academic CV on your phone and finish on a laptop with CVScholar."
};

export default function MobileStartPage() {
  return <MobileStartScreen />;
}
