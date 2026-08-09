import type { Metadata } from "next";
import { NotFoundExperience } from "@/components/not-found-experience";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false }
};

export default function NotFoundPage() {
  return <NotFoundExperience />;
}
