import Link from "next/link";
import Image from "next/image";
import { LEGAL_NAV } from "@/lib/content/legal";

export function ProductFooter() {
  return (
    <footer className="product-footer" role="contentinfo">
      <div className="product-footer-inner">
        <div className="product-footer-brand">
          <div className="product-footer-brand-lockup">
            <Image src="/cvscholar-logo.svg" alt="" width={36} height={36} />
            <strong>CVScholar</strong>
          </div>
          <span>Academic CVs, PDFs, and professional academic websites</span>
        </div>
        <div className="product-footer-columns">
          <nav className="product-footer-nav" aria-label="Product links">
            <span className="product-footer-col-label">Product</span>
            <Link href="/">Home</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/profile">Build CV</Link>
            <Link href="/website">Academic Website</Link>
          </nav>
          <nav className="product-footer-legal" aria-label="Legal">
            <span className="product-footer-col-label">Legal</span>
            {LEGAL_NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
            <Link href="/pricing">Pricing</Link>
          </nav>
        </div>
        <p className="product-footer-meta">
          © {new Date().getFullYear()} Clossyan Technologies (Pvt) Ltd · CVScholar
        </p>
      </div>
    </footer>
  );
}
