import Link from "next/link";
import { MarkdownProse } from "@/components/marketing/markdown-prose";
import { ProductFooter } from "@/components/marketing/product-footer";
import { formatLegalUpdated, LEGAL_NAV, type LegalPage } from "@/lib/content/legal";
import { absoluteUrl } from "@/lib/content/site-url";
import {
  breadcrumbListJsonLd,
  jsonLdGraphScript,
  webPageJsonLd
} from "@/lib/seo/platform";

export function LegalPageView({ page }: { page: LegalPage }) {
  const url = absoluteUrl(page.path);
  const jsonLd = jsonLdGraphScript([
    webPageJsonLd({
      title: page.title,
      description: page.description,
      url,
      type: "WebPage",
      dateModified: page.updated || undefined
    }),
    breadcrumbListJsonLd([
      { name: "Home", url: absoluteUrl("/") },
      { name: page.title, url }
    ])
  ]);

  return (
    <div className="marketing-page legal-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd.replace(/</g, "\\u003c") }}
      />
      <header className="marketing-page-header">
        <nav className="marketing-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>{page.title}</span>
        </nav>
        <h1>{page.title}</h1>
        {page.updated ? (
          <p className="marketing-updated">Last updated: {formatLegalUpdated(page.updated)}</p>
        ) : null}
      </header>

      <nav className="legal-subnav" aria-label="Policy pages">
        {LEGAL_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={item.href === page.path ? "is-active" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <article className="legal-body">
        <MarkdownProse html={page.bodyHtml} />
      </article>

      <ProductFooter />
    </div>
  );
}
