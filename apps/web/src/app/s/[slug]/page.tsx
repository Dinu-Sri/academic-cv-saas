import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cvSharePdfUrl,
  getActiveCvShareBySlug,
  getCvSharePdfAsset,
  recordCvShareView
} from "@/lib/cv-share";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const share = await getActiveCvShareBySlug(slug);
  if (!share) {
    return { title: "Shared CV not found · CVScholar", robots: { index: false, follow: false } };
  }

  const name = share.profile.displayName || "Academic CV";
  const parts = [share.profile.headline, share.profile.affiliation].filter(Boolean);
  const title = parts.length ? `${name} — ${parts.join(", ")}` : name;
  const description =
    share.profile.headline && share.profile.affiliation
      ? `${share.profile.headline} at ${share.profile.affiliation}`
      : share.profile.affiliation || share.document.title || "Academic Curriculum Vitae";

  return {
    title: `${title} · Shared CV`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `/s/${encodeURIComponent(share.shareSlug)}`
    },
    robots: { index: false, follow: false }
  };
}

export default async function SharedCvPage({ params }: Params) {
  const { slug } = await params;
  const share = await getActiveCvShareBySlug(slug);
  if (!share) notFound();

  const asset = await getCvSharePdfAsset({
    documentId: share.documentId,
    profileId: share.profileId
  });
  if (!asset) notFound();

  // Count each page open (not every PDF byte range request).
  await recordCvShareView(share.id);

  const name = share.profile.displayName || "Academic CV";
  const subtitle = [share.profile.headline, share.profile.affiliation].filter(Boolean).join(" · ");
  const pdfUrl = cvSharePdfUrl(share.shareSlug);

  return (
    <main className="cv-share-public">
      <header className="cv-share-public-head">
        <div>
          <p className="cv-share-kicker">Shared academic CV</p>
          <h1>{name}</h1>
          {subtitle ? <p className="cv-share-subtitle">{subtitle}</p> : null}
        </div>
        <div className="cv-share-public-actions">
          <a className="primary-action" href={pdfUrl} download>
            Download PDF
          </a>
          <Link className="secondary-action" href="/">
            Built with CVScholar
          </Link>
        </div>
      </header>
      <section className="cv-share-frame-wrap" aria-label="CV PDF preview">
        <iframe className="cv-share-frame" title={`${name} CV`} src={`${pdfUrl}#view=FitH`} />
      </section>
    </main>
  );
}
