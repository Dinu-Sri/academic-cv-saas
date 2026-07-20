import { CreditCard, FileText, Globe2, Home, LibraryBig, Settings, ShieldCheck, UserRound } from "lucide-react";

export const navigationItems = [
  { label: "Build CV", href: "/profile", icon: UserRound, guests: true },
  { label: "Manage CVs", href: "/cv", icon: FileText, guests: true },
  { label: "Academic Website", href: "/website", icon: Globe2, guests: true },
  { label: "Publications", href: "/publications", icon: LibraryBig, guests: true },
  { label: "Billing", href: "/billing", icon: CreditCard, guests: false },
  { label: "Settings", href: "/settings", icon: Settings, guests: false },
  { label: "Admin", href: "/admin", icon: ShieldCheck, guests: false, adminOnly: true }
] as const;

export const guestHomeItem = { label: "Home", href: "/", icon: Home, guests: true } as const;

export function navigationForUser(options: { isGuest: boolean; isAdmin: boolean }) {
  const items = [];
  if (options.isGuest) {
    items.push(guestHomeItem);
  }
  for (const item of navigationItems) {
    if (options.isGuest && !item.guests) continue;
    if ("adminOnly" in item && item.adminOnly && !options.isAdmin) continue;
    items.push(item);
  }
  return items;
}
