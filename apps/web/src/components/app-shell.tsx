"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Coins,
  Globe2,
  LockKeyhole,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ServerCog,
  Settings2,
  ShieldCheck,
  UsersRound,
  Workflow,
  X
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { navigationItems } from "@/lib/navigation";
import { PublicationStatusPanel } from "@/components/publication-status-panel";

type AppShellProps = {
  children: ReactNode;
};

const ADMIN_SECTIONS = [
  ["overview", "Overview", Activity],
  ["runs", "Agent Runs", Bot],
  ["workflow", "Workflow", Workflow],
  ["policy", "Policy", ShieldCheck],
  ["memory", "Memory", BrainCircuit],
  ["knowledge", "Knowledge", BookOpen],
  ["website", "Website", Globe2],
  ["jobs", "Jobs", ServerCog],
  ["config", "Config", Settings2],
  ["architecture", "Architecture", Network],
  ["users", "Users", UsersRound]
] as const;

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isBarePublicSite = pathname.startsWith("/website/preview") || pathname.startsWith("/u/");
  const hideGlobalStatus = pathname.startsWith("/profile");
  const showCvStatusSlot = pathname.startsWith("/cv");
  const showWebsiteStatus = pathname.startsWith("/website") && !isBarePublicSite;
  const showPublicationStatus = pathname.startsWith("/publications");
  const showAdminStatus = pathname.startsWith("/admin");
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const session = authClient.useSession();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authError, setAuthError] = useState("");
  const [authPending, setAuthPending] = useState(false);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      const result =
        authMode === "signup"
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setAuthError(result.error.message ?? "Login failed.");
        return;
      }

      setAuthOpen(false);
      window.location.reload();
    } finally {
      setAuthPending(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    window.location.reload();
  }

  // Clean full-page website preview / public sites without app chrome.
  if (isBarePublicSite) {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <button
          className="icon-button mobile-menu"
          type="button"
          aria-label="Open menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu size={20} />
        </button>

        <Link href="/profile" className="brand-lockup" aria-label="CVScholar">
          <span className="brand-mark">
            <Image src="/favicon.webp" alt="" width={36} height={36} priority />
          </span>
          <span>
            <strong>CVScholar</strong>
          </span>
        </Link>

        <div className="top-actions">
          <div className="credit-pill" aria-label="Credit balance">
            <Coins size={16} />
            <span>50 credits</span>
          </div>
          {session.data?.user ? (
            <button className="secondary-action compact-action" type="button" onClick={handleSignOut}>
              Sign out
            </button>
          ) : (
            <button className="primary-action" type="button" onClick={() => setAuthOpen(true)}>
              <LockKeyhole size={16} />
              Login
            </button>
          )}
        </div>
      </header>

      <div
        className={[
          "app-grid",
          hideGlobalStatus ? "no-status" : "",
          navCollapsed ? "nav-collapsed" : "",
          mobileNavOpen ? "mobile-nav-open" : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
          <div className="sidebar-header">
            <span className="section-label">Menu</span>
            <div className="sidebar-header-actions">
              <button
                className="icon-button sidebar-collapse-toggle"
                type="button"
                aria-label={navCollapsed ? "Expand menu" : "Collapse menu"}
                title={navCollapsed ? "Expand menu" : "Collapse menu"}
                onClick={() => setNavCollapsed((prev) => !prev)}
              >
                {navCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                className="icon-button close-nav"
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
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
                  aria-label={navCollapsed ? item.label : undefined}
                  title={item.label}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <Icon size={19} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="workspace">{children}</main>

        {hideGlobalStatus ? null : (
          <aside className="status-panel" aria-label="Status">
            {showCvStatusSlot ? (
              <div id="managed-cv-status-slot" />
            ) : showWebsiteStatus ? (
              <div id="website-status-slot" className="website-status-slot" />
            ) : showAdminStatus ? (
              <AdminStatusPanel />
            ) : showPublicationStatus ? (
              <PublicationStatusPanel />
            ) : (
              <>
                <span className="section-label">Status</span>
                <div className="status-list">
                  <StatusItem label="Profile" value="Ready to edit" done />
                  <StatusItem label="CV" value="Not created yet" />
                  <StatusItem label="Website" value="Not published yet" />
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {mobileNavOpen ? <button className="nav-backdrop" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} /> : null}

      {authOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setAuthOpen(false)}>
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close login" onClick={() => setAuthOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="auth-title">{authMode === "signin" ? "Login" : "Create account"}</h2>
            <p>Sign in to save your profile, create CVs, and publish your academic website.</p>
            <form className="auth-form" onSubmit={handleAuthSubmit}>
              {authMode === "signup" ? (
                <label>
                  <span>Name</span>
                  <input name="name" autoComplete="name" required />
                </label>
              ) : null}
              <label>
                <span>Email</span>
                <input name="email" type="email" autoComplete="email" required />
              </label>
              <label>
                <span>Password</span>
                <input name="password" type="password" autoComplete={authMode === "signin" ? "current-password" : "new-password"} required />
              </label>
              {authError ? <p className="form-error">{authError}</p> : null}
              <button className="primary-action" type="submit" disabled={authPending}>
                {authPending ? "Please wait" : authMode === "signin" ? "Login" : "Create account"}
              </button>
            </form>
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthMode(authMode === "signin" ? "signup" : "signin");
              }}
            >
              {authMode === "signin" ? "Create a new account" : "Already have an account? Login"}
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function AdminStatusPanel() {
  const [activeSection, setActiveSection] = useState("overview");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    function syncFromHash() {
      const section = window.location.hash.replace("#", "");
      if (ADMIN_SECTIONS.some(([id]) => id === section)) {
        setActiveSection(section);
      }
    }

    function onLoading(event: Event) {
      const detail = (event as CustomEvent<{ loading?: boolean }>).detail;
      setRefreshing(Boolean(detail?.loading));
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("cvscholar-admin-loading", onLoading);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("cvscholar-admin-loading", onLoading);
    };
  }, []);

  return (
    <div className="admin-status-nav">
      <div className="sidebar-header admin-status-header">
        <span className="section-label">Admin</span>
      </div>
      <nav className="nav-list" aria-label="Admin sections">
        {ADMIN_SECTIONS.map(([id, label, Icon]) => {
          const active = activeSection === id;
          return (
            <a
              key={id}
              href={`#${id}`}
              className={`nav-item ${active ? "is-active" : ""}`}
              title={label}
              onClick={(event) => {
                event.preventDefault();
                setActiveSection(id);
                if (window.location.hash !== `#${id}`) {
                  window.location.hash = id;
                } else {
                  window.dispatchEvent(new Event("hashchange"));
                }
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <div className="admin-status-footer">
        <button
          className="secondary-action admin-refresh-button"
          type="button"
          disabled={refreshing}
          onClick={() => window.dispatchEvent(new Event("cvscholar-admin-refresh"))}
        >
          <RefreshCw size={16} />
          {refreshing ? "Refreshing" : "Refresh"}
        </button>
      </div>
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
