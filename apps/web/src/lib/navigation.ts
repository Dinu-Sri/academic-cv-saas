import { CreditCard, FileText, Globe2, LibraryBig, Settings, UserRound } from "lucide-react";

export const navigationItems = [
  { label: "Build CV", href: "/profile", icon: UserRound },
  { label: "Managed CVs", href: "/cv", icon: FileText },
  { label: "Academic Website", href: "/website", icon: Globe2 },
  { label: "Publications", href: "/publications", icon: LibraryBig },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings }
] as const;
