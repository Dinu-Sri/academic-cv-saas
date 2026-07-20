"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  CheckCircle2,
  FileText,
  Globe2,
  Rocket,
  Sparkles,
  Upload,
  Clock3
} from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function HomeLanding() {
  const session = authClient.useSession();

  // Logged-in users land on the editor; keep home server-render free of auth DB work.
  useEffect(() => {
    if (session.data?.user) {
      window.location.replace("/profile");
    }
  }, [session.data?.user]);

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
            <Link href="/profile" className="primary-action home-cta">
              <Rocket size={18} />
              Start free — no card needed
            </Link>
            <a href="#how-it-works" className="secondary-action home-cta">
              See how it works
            </a>
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
          <div className="home-video-frame">
            <div className="home-video-placeholder">
              <Sparkles size={28} />
              <strong>Product walkthrough</strong>
              <span>Add your demo video URL later (YouTube / Loom embed).</span>
            </div>
            {/* Replace placeholder with iframe when ready:
            <iframe title="CVScholar demo" src="https://www.youtube.com/embed/VIDEO_ID" allowFullScreen />
            */}
          </div>
          <div className="home-template-pills">
            <span>Classic Academic</span>
            <span>Modern Professional</span>
            <span>Research-ready PDF</span>
          </div>
        </div>
      </section>

      <section className="home-section" id="how-it-works">
        <h2>Academic CVs are hard. We make them easy.</h2>
        <p className="home-section-sub">
          Built exclusively for scholars — publications, grants, supervision, and more.
        </p>
        <div className="home-feature-grid">
          <article>
            <Upload size={22} />
            <h3>Upload or build</h3>
            <p>Start from scratch or import an existing CV PDF. Map sections without retyping everything.</p>
          </article>
          <article>
            <FileText size={22} />
            <h3>Real LaTeX PDFs</h3>
            <p>Production-quality academic typography — not HTML-to-PDF hacks.</p>
          </article>
          <article>
            <Sparkles size={22} />
            <h3>AI CV assistant</h3>
            <p>Chat to polish sections. You approve every change before it is applied.</p>
          </article>
          <article>
            <Globe2 size={22} />
            <h3>Academic website</h3>
            <p>Turn your profile into a Scholar Pages site when you are ready to publish.</p>
          </article>
          <article>
            <Clock3 size={22} />
            <h3>Ready in minutes</h3>
            <p>Focus on research — not fighting margins and citation lists in Word.</p>
          </article>
          <article>
            <CheckCircle2 size={22} />
            <h3>Free to try</h3>
            <p>Explore the full workspace as a guest. Create an account only when you need more compiles or chat.</p>
          </article>
        </div>
        <div className="home-bottom-cta">
          <Link href="/profile" className="primary-action home-cta">
            Open the CV editor
          </Link>
        </div>
      </section>
    </div>
  );
}
