"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CheckCircle2, Play, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/** Temporary free YouTube embed — replace with product walkthrough later. */
const DEMO_VIDEO_EMBED = "https://www.youtube.com/embed/aqz-KE-bpKQ";

const FEATURES = [
  "Real LaTeX PDFs",
  "Import old CVs",
  "AI CV assistant",
  "Academic website",
  "Multiple CV variants",
  "Free guest trial"
] as const;

/** Compact pain → solution pairs (legacy homepage themes, short form). */
const PAIN_POINTS = [
  { pain: "Generic resume builders", solution: "18+ academic sections" },
  { pain: "Word & LaTeX waste hours", solution: "Real TeX PDFs, no coding" },
  { pain: "Retyping an old CV", solution: "Upload PDF → auto-map" },
  { pain: "One CV for every job", solution: "Multiple variants from one profile" },
  { pain: "Blank fields, weak bullets", solution: "Academic field guidance" },
  { pain: "Sharing goes stale", solution: "Living profile + fresh PDFs" },
  { pain: "No online presence", solution: "Scholar Pages website" },
  { pain: "Enterprise tools cost more", solution: "Try free · pay when you need" }
] as const;

function subscribeDom(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function HomeLanding() {
  const session = authClient.useSession();
  const [videoOpen, setVideoOpen] = useState(false);
  const statusSlot = useSyncExternalStore(
    subscribeDom,
    () => document.getElementById("home-status-slot"),
    () => null
  );

  useEffect(() => {
    if (session.data?.user) {
      window.location.replace("/profile");
    }
  }, [session.data?.user]);

  const featurePanel = (
    <div className="home-status-panel">
      <span className="section-label">Features</span>
      <ul className="home-feature-list home-feature-list-minimal">
        {FEATURES.map((title) => (
          <li key={title}>
            <CheckCircle2 size={15} />
            <span>{title}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="home-landing home-landing-fit">
      <section className="home-hero home-hero-compact">
        <div className="home-hero-copy">
          <p className="home-eyebrow">Academic CV builder</p>
          <h1>
            Your academic career
            <br />
            deserves a better CV
          </h1>
          <p className="home-lead">
            Build a publication-ready academic CV in minutes — free guest trial, no card required.
          </p>
          <div className="home-hero-actions">
            <Link href="/profile" className="primary-action home-cta home-cta-green">
              Start free
            </Link>
            <button className="secondary-action home-cta" type="button" onClick={() => setVideoOpen(true)}>
              <Play size={16} />
              See how it works
            </button>
          </div>
          <ul className="home-hero-points">
            <li>
              <CheckCircle2 size={14} /> Guest editor · 3 compiles · 10 AI chats
            </li>
            <li>
              <CheckCircle2 size={14} /> Sign up later — your work is saved
            </li>
          </ul>
        </div>
        <div className="home-hero-media">
          <button className="home-video-frame home-video-button" type="button" onClick={() => setVideoOpen(true)}>
            <span className="home-video-play">
              <Play size={24} />
            </span>
            <strong>Product walkthrough</strong>
          </button>
        </div>
      </section>

      <section className="home-pain-section home-pain-compact" id="pain-points">
        <h2>Pain → solution</h2>
        <ul className="home-pain-list">
          {PAIN_POINTS.map((item) => (
            <li key={item.pain}>
              <span className="home-pain-point">
                <span className="home-pain-kicker">Pain</span>
                {item.pain}
              </span>
              <span className="home-pain-arrow" aria-hidden="true">
                →
              </span>
              <span className="home-solution-point">
                <span className="home-solution-kicker">Solution</span>
                {item.solution}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {statusSlot ? createPortal(featurePanel, statusSlot) : null}

      {videoOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setVideoOpen(false)}>
          <section
            className="home-video-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-video-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="home-video-modal-head">
              <h2 id="home-video-title">See how it works</h2>
              <button className="modal-close" type="button" aria-label="Close video" onClick={() => setVideoOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="home-video-embed">
              <iframe
                title="CVScholar product walkthrough"
                src={`${DEMO_VIDEO_EMBED}?autoplay=1`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>
        </div>
      ) : null}

      <nav className="home-legal-links" aria-label="Resources and legal">
        <Link href="/blog">Blog</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cookie-policy">Cookies</Link>
        <Link href="/refund-policy">Refunds</Link>
      </nav>
    </div>
  );
}
