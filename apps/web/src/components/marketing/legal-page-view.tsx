import Link from "next/link";
import { MarkdownProse } from "@/components/marketing/markdown-prose";
import { ProductFooter } from "@/components/marketing/product-footer";
import { formatLegalUpdated, LEGAL_NAV, type LegalPage } from "@/lib/content/legal";

export function LegalPageView({ page }: { page: LegalPage }) {
  return (
    <div className="marketing-page legal-page">
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
