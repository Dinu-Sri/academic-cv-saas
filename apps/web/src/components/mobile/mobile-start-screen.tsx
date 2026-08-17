"use client";

import Link from "next/link";
import { useEffect } from "react";
import { FileUp, PencilLine } from "lucide-react";
import { trackJourney } from "@/components/journey-tracker";
import { trackBrowserViewContent } from "@/lib/meta/browser";

export function MobileStartScreen() {
  useEffect(() => {
    trackJourney("mobile_start_viewed");
    trackBrowserViewContent({
      contentName: "MobileStart",
      contentCategory: "marketing"
    });
  }, []);

  return (
    <div className="mobile-flow-card-stack">
      <div className="mobile-flow-hero">
        <h1>Start your CV on mobile. Finish on laptop.</h1>
        <p>
          Get a head start now. We prepare an academic draft so you can refine and download it on a
          computer in minutes.
        </p>
      </div>

      <Link href="/m/upload" className="mobile-flow-choice">
        <span className="mobile-flow-choice-icon" aria-hidden>
          <FileUp size={22} />
        </span>
        <span className="mobile-flow-choice-body">
          <strong>I already have a CV</strong>
          <span>Upload a PDF and we will turn it into a polished academic CV.</span>
        </span>
      </Link>

      <Link href="/m/manual" className="mobile-flow-choice">
        <span className="mobile-flow-choice-icon is-secondary" aria-hidden>
          <PencilLine size={22} />
        </span>
        <span className="mobile-flow-choice-body">
          <strong>I am starting fresh</strong>
          <span>Answer a few quick questions and we will build your first draft.</span>
        </span>
      </Link>

      <ul className="mobile-flow-bullets">
        <li>Classic academic template trusted by scholars</li>
        <li>Progress is saved on this device (guest trial or your account)</li>
        <li>Pick up exactly where you left off on a laptop</li>
      </ul>
    </div>
  );
}
