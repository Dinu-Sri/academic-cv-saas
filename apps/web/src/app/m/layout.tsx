import type { ReactNode } from "react";
import { MobileShell } from "@/components/mobile/mobile-shell";

export default function MobileFlowLayout({ children }: { children: ReactNode }) {
  return <MobileShell>{children}</MobileShell>;
}
