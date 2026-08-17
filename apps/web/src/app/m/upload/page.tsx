import type { Metadata } from "next";
import { MobileUploadScreen } from "@/components/mobile/mobile-upload-screen";

export const metadata: Metadata = {
  title: "Upload CV on mobile"
};

export default function MobileUploadPage() {
  return <MobileUploadScreen />;
}
