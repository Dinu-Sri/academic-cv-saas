"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileUp,
  Globe2,
  MessageSquareText,
  Play,
  Sparkles,
  X
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MarketingCapturePopup } from "@/components/marketing-capture-popup";
import type { PublicImpactStats } from "@/lib/public-impact";

/**
 * Product walkthrough YouTube embed.
 * Leave empty until the real CVScholar video is ready — the hero modal shows a
 * “coming soon” state instead of loading a placeholder video.
 */
const DEMO_VIDEO_EMBED = "";

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
      <div className="home-social-links" aria-label="CVScholar on social media">
        <a
          href="https://www.facebook.com/cvschlar"
          target="_blank"
          rel="noopener noreferrer"
          className="home-social-link"
          aria-label="CVScholar on Facebook"
          title="Facebook"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M22 12.07C22 6.48 17.52 2 11.93 2S1.86 6.48 1.86 12.07c0 4.99 3.66 9.13 8.44 9.93v-7.02H7.9v-2.91h2.4V9.84c0-2.37 1.41-3.68 3.57-3.68 1.03 0 2.12.18 2.12.18v2.33h-1.19c-1.18 0-1.54.73-1.54 1.48v1.78h2.63l-.42 2.91h-2.21V22c4.78-.8 8.44-4.94 8.44-9.93z" />
          </svg>
        </a>
        <a href="#" className="home-social-link" aria-label="CVScholar on YouTube (coming soon)" title="YouTube">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8zM9.8 15.5v-7l6.3 3.5-6.3 3.5z" />
          </svg>
        </a>
        <a href="#" className="home-social-link" aria-label="CVScholar on LinkedIn (coming soon)" title="LinkedIn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.23 0H1.77A1.75 1.75 0 0 0 0 1.73v20.54C0 23.22.78 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.73V1.73C24 .78 23.2 0 22.23 0z" />
          </svg>
        </a>
      </div>
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
          <button
            className="home-video-frame home-video-button"
            type="button"
            aria-label="See a real academic CV built with CVScholar"
            onClick={() => setVideoOpen(true)}
          >
            <span className="home-video-story" aria-hidden="true">
              <span className="home-video-stage">
                <span className="home-video-stage-icon"><FileUp size={23} /></span>
                <span className="home-video-document-lines"><i /><i /><i /><i /></span>
                <b>Upload CV</b>
              </span>
              <ArrowRight className="home-video-flow-arrow" size={18} />
              <span className="home-video-stage is-processing">
                <span className="home-video-stage-icon"><MessageSquareText size={23} /><Sparkles size={14} /></span>
                <span className="home-video-chat-lines"><i /><i /><i /></span>
                <b>AI maps it</b>
              </span>
              <ArrowRight className="home-video-flow-arrow" size={18} />
              <span className="home-video-stage is-finished">
                <span className="home-video-stage-icon"><FileCheck2 size={23} /><Globe2 size={18} /></span>
                <span className="home-video-output-lines"><i /><i /></span>
                <b>CV + website</b>
              </span>
            </span>
            <span className="home-video-play">
              <Play size={24} />
            </span>
            <span className="home-video-caption">
              <small>{DEMO_VIDEO_EMBED ? "90-second product walkthrough" : "Video coming soon"}</small>
              <strong>
                {DEMO_VIDEO_EMBED
                  ? "See a real academic CV built with CVScholar"
                  : "Preview the walkthrough (available soon)"}
              </strong>
            </span>
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
            {DEMO_VIDEO_EMBED ? (
              <div className="home-video-embed">
                <iframe
                  title="CVScholar product walkthrough"
                  src={`${DEMO_VIDEO_EMBED}?autoplay=1`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="home-video-coming-soon" role="status">
                <Play size={28} aria-hidden="true" />
                <strong>Walkthrough video coming soon</strong>
                <p>
                  We are preparing a short product walkthrough. Until then, start free and try the
                  upload or AI chat flow yourself.
                </p>
                <Link href="/profile" className="primary-action home-cta home-cta-green" onClick={() => setVideoOpen(false)}>
                  Start free
                </Link>
              </div>
            )}
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

      {/* Guests only — HomeLanding redirects signed-in users to /profile. */}
      <MarketingCapturePopup />
    </div>
  );
}

function ImpactBand({ impact }: { impact: PublicImpactStats }) {
  const metrics = [
    [impact.academics, "Academics / Researchers"],
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
