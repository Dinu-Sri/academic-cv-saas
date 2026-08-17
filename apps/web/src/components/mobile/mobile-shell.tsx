"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { writeMobileModePreference } from "@/lib/mobile/preference";

type Props = {
  children: ReactNode;
  /** Show escape hatch to full site */
  showFullSiteLink?: boolean;
};

export function MobileShell({ children, showFullSiteLink = true }: Props) {
  function useFullSite() {
    writeMobileModePreference("full");
    window.location.href = "/profile";
  }

  return (
    <div className="mobile-flow">
      <header className="mobile-flow-header">
        <Link href="/m" className="mobile-flow-brand" aria-label="CVScholar mobile start">
          <Image src="/cvscholar-logo.svg" alt="" width={28} height={28} priority />
          <span>CVScholar</span>
        </Link>
        {showFullSiteLink ? (
          <button type="button" className="mobile-flow-escape" onClick={useFullSite}>
            Use full site
          </button>
        ) : null}
      </header>
      <main className="mobile-flow-main">{children}</main>
      <footer className="mobile-flow-footer">
        <p>Best experience on a laptop for editing, websites, and downloads.</p>
      </footer>
    </div>
  );
}
