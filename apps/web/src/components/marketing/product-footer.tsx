import Link from "next/link";
import { LEGAL_NAV } from "@/lib/content/legal";

export function ProductFooter() {
  return (
    <footer className="product-footer" role="contentinfo">
      <div className="product-footer-inner">
        <div className="product-footer-brand">
          <strong>CVScholar</strong>
          <span>Academic CVs, PDFs, and Scholar Pages</span>
        </div>
        <nav className="product-footer-nav" aria-label="Product links">
          <Link href="/">Home</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/profile">Build CV</Link>
          <Link href="/billing">Billing</Link>
        </nav>
        <nav className="product-footer-legal" aria-label="Legal">
          {LEGAL_NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <p className="product-footer-meta">
          © {new Date().getFullYear()} Clossyan Technologies (Pvt) Ltd · CVScholar
        </p>
      </div>
    </footer>
  );
}
