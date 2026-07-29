"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Clock3, Play, X } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { PublicImpactStats } from "@/lib/public-impact";

/** Temporary free YouTube embed — replace with product walkthrough later. */
const DEMO_VIDEO_EMBED = "https://www.youtube.com/embed/aqz-KE-bpKQ";

const FEATURES = [
  "ORCID & Google Scholar publication sync",
  "Professional academic website from your CV",
  "Real LaTeX CV in under 5 minutes",
  "Import and map your old CV",
  "Build your CV by chatting with AI"
] as const;

/** Compact pain → solution pairs (legacy homepage themes, short form). */
const PAIN_POINTS = [
  { pain: "Hours lost formatting", solution: "LaTeX CV in under 5 minutes" },
  { pain: "Retyping an old CV", solution: "Upload once and let AI map it" },
  { pain: "Manually updating publications", solution: "Sync ORCID and Google Scholar" },
  { pain: "No professional web presence", solution: "Generate a site from your CV" },
  { pain: "Blank forms slow you down", solution: "Build by chatting with AI" },
  { pain: "Generic resume sections", solution: "Academic fields made for researchers" }
] as const;

function subscribeDom(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export function HomeLanding({ impact }: { impact: PublicImpactStats }) {
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
          <p className="home-eyebrow">Built by academics, for academics</p>
          <h1>
            Academic CVs and websites,
            <br />
            ready in minutes
          </h1>
          <p className="home-lead">
            Import an old CV or chat with AI. CVScholar creates your polished LaTeX CV and professional academic website, then keeps publications synced.
          </p>
          <div className="home-hero-actions">
            <Link href="/profile" className="primary-action home-cta home-cta-green">
              Save hours - start free
            </Link>
            <button className="secondary-action home-cta" type="button" onClick={() => setVideoOpen(true)}>
              <Play size={16} />
              See how it works
            </button>
          </div>
          <ul className="home-hero-points">
            <li>
              <CheckCircle2 size={14} /> No manual form filling required
            </li>
            <li>
              <CheckCircle2 size={14} /> Free to build - no card required
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
                <span className="home-pain-kicker" aria-label="Pain">
                  <AlertCircle size={15} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="home-pain-text">{item.pain}</span>
              </span>
              <span className="home-pain-arrow" aria-hidden="true">
                →
              </span>
              <span className="home-solution-point">
                <span className="home-solution-kicker" aria-label="Solution">
                  <CheckCircle2 size={15} strokeWidth={2.4} aria-hidden="true" />
                </span>
                <span className="home-solution-text">{item.solution}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <ImpactBand impact={impact} />

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
        <Link href="/pricing">Pricing</Link>
        <Link href="/methodology/time-to-first-cv">Methodology</Link>
      </nav>
    </div>
  );
}

function ImpactBand({ impact }: { impact: PublicImpactStats }) {
  const metrics = [
    [impact.academics, "Academics"],
    [impact.cvsGenerated, "CVs generated"],
    [impact.websitesPublished, "Websites published"],
    [impact.publicationsSynced, "Publications synced"],
    [impact.aiImprovementsApplied, "AI improvements"]
  ] as const;

  return (
    <section className="home-impact-band" aria-labelledby="home-impact-title">
      <div className="home-impact-heading">
        <span className="section-label">Growing academic impact</span>
        <h2 id="home-impact-title">Work completed with CVScholar</h2>
      </div>
      <dl className="home-impact-metrics">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <dt>{formatImpactNumber(value)}</dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
      <div className="home-impact-context">
        {impact.countriesRepresented > 0 ? <span>{impact.countriesRepresented} countries</span> : null}
        {impact.academicFieldsRepresented > 0 ? <span>{impact.academicFieldsRepresented} academic fields</span> : null}
        {impact.oldCvsImported > 0 ? <span>{formatImpactNumber(impact.oldCvsImported)} old CVs imported</span> : null}
        <Link href="/methodology/time-to-first-cv" className="home-time-metric">
          <Clock3 size={14} aria-hidden="true" />
          {impact.medianFirstCvSeconds === null
            ? "Time-to-first-CV measurement now live"
            : `${formatDuration(impact.medianFirstCvSeconds)} median to first finished CV`}
        </Link>
      </div>
    </section>
  );
}

function formatImpactNumber(value: number) {
  if (value < 1_000) return new Intl.NumberFormat("en").format(value);
  const magnitude = value >= 1_000_000 ? 1_000_000 : 1_000;
  const suffix = magnitude === 1_000_000 ? "M" : "K";
  const roundedDown = Math.floor((value / magnitude) * 10) / 10;
  return `${roundedDown.toFixed(roundedDown >= 10 ? 0 : 1)}${suffix}+`;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}
