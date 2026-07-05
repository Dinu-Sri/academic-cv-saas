"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { CheckCircle2, Circle, Coins, LockKeyhole, Menu, X } from "lucide-react";
import { navigationItems } from "@/lib/navigation";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label="Open menu"
          onClick={() => setNavOpen(true)}
        >
          <Menu size={20} />
        </button>

        <Link href="/profile" className="brand-lockup" aria-label="CVScholar">
          <span className="brand-mark">CV</span>
          <span>
            <strong>CVScholar</strong>
            <small>Academic CV and Website</small>
          </span>
        </Link>

        <div className="top-actions">
          <div className="credit-pill" aria-label="Credit balance">
            <Coins size={16} />
            <span>50 credits</span>
          </div>
          <button className="primary-action" type="button" onClick={() => setAuthOpen(true)}>
            <LockKeyhole size={16} />
            Login
          </button>
        </div>
      </header>

      <div className="app-grid">
        <aside className={`sidebar ${navOpen ? "is-open" : ""}`}>
          <div className="sidebar-header">
            <span className="section-label">Menu</span>
            <button
              className="icon-button close-nav"
              type="button"
              aria-label="Close menu"
              onClick={() => setNavOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="nav-list" aria-label="Main menu">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "is-active" : ""}`}
                  onClick={() => setNavOpen(false)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="workspace">{children}</main>

        <aside className="status-panel" aria-label="Status">
          <span className="section-label">Status</span>
          <div className="status-list">
            <StatusItem label="Profile" value="Ready to edit" done />
            <StatusItem label="CV" value="Not created yet" />
            <StatusItem label="Website" value="Not published yet" />
          </div>
        </aside>
      </div>

      {navOpen ? <button className="nav-backdrop" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}

      {authOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="icon-button modal-close" type="button" aria-label="Close login" onClick={() => setAuthOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="auth-title">Login</h2>
            <p>Sign in to save your profile, create CVs, and publish your academic website.</p>
            <div className="modal-actions">
              <button className="primary-action" type="button">Continue with Google</button>
              <button className="secondary-action" type="button">Email login link</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function StatusItem({ label, value, done = false }: { label: string; value: string; done?: boolean }) {
  const Icon = done ? CheckCircle2 : Circle;

  return (
    <div className="status-item">
      <Icon size={17} />
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
    </div>
  );
}
