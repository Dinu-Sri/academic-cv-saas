import type { Metadata } from "next";
import { MobileManualScreen } from "@/components/mobile/mobile-manual-screen";

export const metadata: Metadata = {
  title: "Start CV on mobile"
};

export default function MobileManualPage() {
  return <MobileManualScreen />;
}
