import {
  BookOpenText,
  CreditCard,
  FileArchive,
  FileText,
  Globe2,
  Home,
  LibraryBig,
  Settings,
  UserRound
} from "lucide-react";

export const navigationItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Academic Profile", href: "/profile", icon: UserRound },
  { label: "Build CV", href: "/cv", icon: FileText },
  { label: "Academic Website", href: "/website", icon: Globe2 },
  { label: "Publications", href: "/publications", icon: LibraryBig },
  { label: "Files / PDFs", href: "/files", icon: FileArchive },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings }
] as const;

export const secondaryItems = [
  { label: "Templates", href: "/cv", icon: BookOpenText },
  { label: "Profile OS", href: "/profile", icon: UserRound }
] as const;
