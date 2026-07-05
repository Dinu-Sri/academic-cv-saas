"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  LockKeyhole,
  Menu,
  Sparkles,
  X
} from "lucide-react";
import { navigationItems, secondaryItems } from "@/lib/navigation";

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
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          <Menu size={18} />
        </button>
        <Link href="/" className="brand-lockup" aria-label="CVScholar home">
          <span className="brand-mark">CV</span>
          <span>
            <strong>CVScholar</strong>
            <small>Academic Profile OS</small>
          </span>
        </Link>

        <div className="top-actions">
          <div className="credit-pill" aria-label="Credit balance">
            <Coins size={16} />
            <span>50 credits</span>
          </div>
          <div className="plan-pill">Free plan</div>
          <button className="icon-button" type="button" aria-label="Notifications">
            <Bell size={17} />
          </button>
          <button className="primary-action" type="button" onClick={() => setAuthOpen(true)}>
            <LockKeyhole size={16} />
            Login
          </button>
        </div>
      </header>

      <div className="app-grid">
        <aside className={`sidebar ${navOpen ? "is-open" : ""}`}>
          <div className="sidebar-header">
            <span className="section-label">Workspace</span>
            <button
              className="icon-button close-nav"
              type="button"
              aria-label="Close navigation"
              onClick={() => setNavOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          <nav className="nav-list" aria-label="Primary navigation">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "is-active" : ""}`}
                  onClick={() => setNavOpen(false)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-card">
            <div className="sidebar-card-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <strong>Stage 1 scaffold</strong>
              <p>No backend writes. This shell is isolated from the PHP production app.</p>
            </div>
          </div>

          <nav className="nav-list secondary" aria-label="Secondary navigation">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} href={item.href} className="nav-item subtle">
                  <Icon size={17} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="workspace">{children}</main>

        <aside className="status-panel" aria-label="Status panel">
          <div className="panel-section">
            <div className="panel-heading">
              <span className="section-label">Status</span>
              <Activity size={16} />
            </div>
            <div className="status-list">
              <StatusItem icon={<CheckCircle2 size={16} />} label="Profile data" value="Not connected" tone="neutral" />
              <StatusItem icon={<Clock3 size={16} />} label="PDF jobs" value="No queue yet" tone="neutral" />
              <StatusItem icon={<CheckCircle2 size={16} />} label="Website" value="Draft concept" tone="success" />
            </div>
          </div>

          <div className="panel-section">
            <div className="panel-heading">
              <span className="section-label">Next step</span>
              <ChevronRight size={16} />
            </div>
            <p className="panel-copy">
              Confirm this app shell direction, then add Better Auth, PostgreSQL, Prisma, and workspace-scoped data.
            </p>
          </div>

          <div className="panel-section compact">
            <span className="section-label">Rewrite guardrail</span>
            <p className="panel-copy">
              The current PHP/XAMPP app remains the production system until staging parity and migration checks pass.
            </p>
          </div>
        </aside>
      </div>

      {navOpen ? <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setNavOpen(false)} /> : null}

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
            <span className="section-label">Coming in Phase 2</span>
            <h2 id="auth-title">Login will open here</h2>
            <p>
              Better Auth will power this modal and return users to the action they attempted, such as saving, publishing,
              or generating a PDF.
            </p>
            <div className="modal-actions">
              <button className="primary-action" type="button">Continue with Google</button>
              <button className="secondary-action" type="button">Email magic link</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function StatusItem({
  icon,
  label,
  value,
  tone
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "neutral" | "success";
}) {
  return (
    <div className={`status-item ${tone}`}>
      <span className="status-icon">{icon}</span>
      <span>
        <strong>{label}</strong>
        <small>{value}</small>
      </span>
    </div>
  );
}
