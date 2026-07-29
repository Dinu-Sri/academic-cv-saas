import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, ShieldCheck } from "lucide-react";
import { ProductFooter } from "@/components/marketing/product-footer";
import { CV_TIME_MEASUREMENT_STARTED_ON, CV_TIME_MEASUREMENT_VERSION } from "@/lib/cv-time-to-value";
import { MIN_PUBLIC_CV_TIME_SAMPLE, getPublicImpactStats } from "@/lib/public-impact";
import { absoluteUrl } from "@/lib/content/site-url";

export const metadata: Metadata = {
  title: "Time to First Academic CV Methodology | CVScholar",
  description: "How CVScholar measures the median active time to a first successfully generated academic CV.",
  alternates: { canonical: absoluteUrl("/methodology/time-to-first-cv") }
};

export default async function TimeToFirstCvMethodologyPage() {
  const impact = await getPublicImpactStats();

  return (
    <div className="marketing-page metric-methodology-page">
      <header className="metric-methodology-hero">
        <div>
          <span className="section-label">Public metric methodology</span>
          <h1>Median time to first finished academic CV</h1>
          <p className="marketing-lead">
            A practical time-to-value measure: how much active editing time passes before a person creates their first
            successful, substantive academic CV PDF.
          </p>
        </div>
        <div className="metric-methodology-reading" aria-label="Current measurement">
          <Clock3 size={22} aria-hidden="true" />
          <strong>{impact.medianFirstCvSeconds === null ? "Measuring now" : formatDuration(impact.medianFirstCvSeconds)}</strong>
          <span>
            {impact.medianSampleSize < MIN_PUBLIC_CV_TIME_SAMPLE
              ? `Published after ${MIN_PUBLIC_CV_TIME_SAMPLE} valid completions`
              : `Median across ${impact.medianSampleSize} valid first completions`}
          </span>
        </div>
      </header>

      <main className="metric-methodology-content">
        <section>
          <h2>What starts the clock</h2>
          <p>
            Measurement begins with the first real interaction in the CV editor. A compile request also starts the
            clock when no editor heartbeat exists, covering import-led and chat-led workflows.
          </p>
        </section>
        <section>
          <h2>How active time is counted</h2>
          <p>
            The editor sends a heartbeat every 30 seconds only while the tab is visible and the person has interacted
            within the previous minute. Each interval is capped at 45 seconds, preventing inactive tabs and long gaps
            from inflating the result.
          </p>
        </section>
        <section>
          <h2>What counts as finished</h2>
          <p>
            The first successful LaTeX PDF render must use a non-placeholder name and contain academic depth: an
            academic title, affiliation, short bio, or at least one active CV entry. Failed compiles and empty sample
            profiles do not qualify.
          </p>
        </section>
        <section>
          <h2>Why we publish the median</h2>
          <p>
            The median represents the middle valid completion and is less distorted by interruptions or unusually
            complex CVs than an average. Each profile contributes only its first qualifying completion.
          </p>
        </section>
        <section>
          <h2>Publication and privacy rules</h2>
          <p>
            The public figure is withheld until at least {MIN_PUBLIC_CV_TIME_SAMPLE} valid completions exist. We store
            timing totals and completion identifiers for this calculation, never CV field text or document content in
            the metric record.
          </p>
        </section>
        <aside className="metric-methodology-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <p>
            Measurement version <strong>{CV_TIME_MEASUREMENT_VERSION}</strong> began on <strong>{CV_TIME_MEASUREMENT_STARTED_ON}</strong>.
            The definition is versioned so future methodology changes do not silently mix unlike samples.
          </p>
        </aside>
      </main>

      <p className="blog-back"><Link href="/">Back to CVScholar</Link></p>
      <ProductFooter />
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hours`;
}
