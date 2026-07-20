"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileText,
  Globe2,
  Play,
  Rocket,
  Share2,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

/** Temporary free YouTube embed — replace with product walkthrough later. */
const DEMO_VIDEO_EMBED = "https://www.youtube.com/embed/aqz-KE-bpKQ";

const FEATURES = [
  {
    icon: FileText,
    title: "Real LaTeX PDFs",
    text: "Scholarly typography via a real TeX engine — not HTML-to-PDF hacks."
  },
  {
    icon: Upload,
    title: "Import old CVs",
    text: "Upload a PDF and map education, experience, and publications automatically."
  },
  {
    icon: Sparkles,
    title: "AI CV assistant",
    text: "Chat to polish sections. You approve every change before it is applied."
  },
  {
    icon: Globe2,
    title: "Academic website",
    text: "Turn your profile into Scholar Pages when you are ready to publish."
  },
  {
    icon: Clock3,
    title: "Ready in minutes",
    text: "Focus on research — not fighting margins and citation lists in Word."
  },
  {
    icon: CheckCircle2,
    title: "Free to try",
    text: "Use the full editor as a guest. Sign up only when you need more compiles or chat."
  }
] as const;

const PAIN_POINTS = [
  {
    pain: "Generic resume builders",
    solution:
      "Corporate tools ignore publications, grants, supervision, and academic service. CVScholar is built only for scholarly careers — with 18+ academic sections."
  },
  {
    pain: "Word & LaTeX waste hours",
    solution:
      "Stop fighting templates and broken formatting. Generate clean, production-ready academic PDFs without writing LaTeX yourself."
  },
  {
    pain: "Retyping an old CV",
    solution:
      "Upload an existing CV PDF and map education, experience, publications, and skills into the right structure automatically."
  },
  {
    pain: "One CV doesn’t fit every application",
    solution:
      "Tenure packages need a full record; postdoc calls need focus. Build multiple CV variants from one academic profile."
  },
  {
    pain: "Blank fields and weak bullets",
    solution:
      "Academic-specific guidance and examples for each field so you never stare at an empty box again."
  },
  {
    pain: "Sharing is messy",
    solution:
      "Email attachments go stale. Keep a living profile, generate fresh PDFs, and grow into a public academic website when ready."
  },
  {
    pain: "No online academic presence",
    solution:
      "Hiring committees will Google you. Publish a Scholar Pages site synced with your CV content."
  },
  {
    pain: "Enterprise tools cost too much",
    solution:
      "Try free as a guest. Pay only when you need PDF unlocks or a long-term professional plan — no bloated enterprise seat fees."
  }
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
      <div className="website-status-head">
        <strong>What you get</strong>
      </div>
      <p className="home-status-lead">Purpose-built features for academic careers.</p>
      <ul className="home-feature-list">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <li key={feature.title}>
              <Icon size={18} />
              <div>
                <strong>{feature.title}</strong>
                <small>{feature.text}</small>
              </div>
            </li>
          );
        })}
      </ul>
      <Link href="/profile" className="primary-action home-cta-green home-status-cta">
        <Rocket size={18} />
        Open the CV editor
      </Link>
    </div>
  );

  return (
    <div className="home-landing">
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-eyebrow">Academic CV builder</p>
          <h1>
            Your academic career
            <br />
            deserves a better CV
          </h1>
          <p className="home-lead">
            Stop wrestling with Word templates and LaTeX. Build a publication-ready academic CV in
            minutes — try the full editor free, no account required.
          </p>
          <div className="home-hero-actions">
            <Link href="/profile" className="primary-action home-cta home-cta-green">
              <Rocket size={18} />
              Start free — no card needed
            </Link>
            <button className="secondary-action home-cta" type="button" onClick={() => setVideoOpen(true)}>
              <Play size={18} />
              See how it works
            </button>
          </div>
          <ul className="home-hero-points">
            <li>
              <CheckCircle2 size={16} /> Try the editor as a guest
            </li>
            <li>
              <CheckCircle2 size={16} /> 3 free PDF compiles · 10 AI chat messages
            </li>
            <li>
              <CheckCircle2 size={16} /> Sign up later — your work is saved
            </li>
          </ul>
        </div>
        <div className="home-hero-media">
          <button className="home-video-frame home-video-button" type="button" onClick={() => setVideoOpen(true)}>
            <span className="home-video-play">
              <Play size={28} />
            </span>
            <strong>Product walkthrough</strong>
            <span>Watch a short demo of building an academic CV</span>
          </button>
          <div className="home-template-pills">
            <span>Classic Academic</span>
            <span>Modern Professional</span>
            <span>Research-ready PDF</span>
          </div>
        </div>
      </section>

      <section className="home-section home-pain-section" id="pain-points">
        <h2>Academic CVs are hard. We make them easy.</h2>
        <p className="home-section-sub">
          Researchers waste hours on formatting instead of research. Here is the pain — and how CVScholar
          solves it.
        </p>
        <div className="home-pain-grid">
          {PAIN_POINTS.map((item) => (
            <article key={item.pain} className="home-pain-card">
              <div className="home-pain-row">
                <AlertTriangle size={18} className="home-pain-icon" />
                <div>
                  <span className="home-pain-label">Pain</span>
                  <h3>{item.pain}</h3>
                </div>
              </div>
              <div className="home-pain-row home-solution-row">
                <CheckCircle2 size={18} className="home-solution-icon" />
                <div>
                  <span className="home-solution-label">Solution</span>
                  <p>{item.solution}</p>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="home-bottom-cta">
          <Link href="/profile" className="primary-action home-cta home-cta-green home-cta-large">
            <Rocket size={20} />
            Open the CV editor
          </Link>
          <p className="home-cta-note">No account required to start. Sign up only when you need more compiles or AI chat.</p>
        </div>
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
            <p className="home-cta-note">Placeholder demo video — replace with the CVScholar walkthrough when ready.</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
