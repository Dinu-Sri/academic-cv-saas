import { redirect } from "next/navigation";

/** Alias for legacy/short cookie policy URL. */
export default function CookiesAliasPage() {
  redirect("/cookie-policy");
}
