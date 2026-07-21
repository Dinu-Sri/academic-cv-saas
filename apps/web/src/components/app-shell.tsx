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
  FileText,
  Globe2,
  LifeBuoy,
  LockKeyhole,
  Menu,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Rocket,
  ServerCog,
  Settings2,
  ShieldCheck,
  UserRound,
  UsersRound,
  Workflow,
  X
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { isMarketingPath, navigationForUser } from "@/lib/navigation";
import { PublicationStatusPanel } from "@/components/publication-status-panel";
import { isScholarPublicHost } from "@/lib/website/public-host";

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
  ["users", "Users", UsersRound],
  ["billing", "Billing", Coins]
] as const;

function isBarePublicPath(pathname: string) {
  return pathname.startsWith("/website/preview") || pathname.startsWith("/u/");
}

function isBarePublicHostOnClient() {
  if (typeof window === "undefined") return false;
  return isScholarPublicHost(window.location.host);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  // Path-based public routes + scholar subdomains (host is username.rootDomain).
  const isBarePublicSite = isBarePublicPath(pathname) || isBarePublicHostOnClient();
  const isMarketing = isMarketingPath(pathname);
  const hideGlobalStatus = pathname.startsWith("/profile") || isMarketing;
  const showHomeStatus = pathname === "/";
  const showCvStatusSlot = pathname.startsWith("/cv");
  const showWebsiteStatus = pathname.startsWith("/website") && !isBarePublicSite;
  const showPublicationStatus = pathname.startsWith("/publications");
  const showBillingStatus = pathname.startsWith("/billing");
  const showSettingsStatus = pathname.startsWith("/settings");
  const showAdminStatus = pathname.startsWith("/admin");
  const [authOpen, setAuthOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("login") === "1";
  });
  const [guestGateOpen, setGuestGateOpen] = useState(false);
  const [guestGateMessage, setGuestGateMessage] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const session = authClient.useSession();
  // ?login=1 opens the login dialog (sign-in, not signup).
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authPending, setAuthPending] = useState(false);
  const [googleAuthEnabled, setGoogleAuthEnabled] = useState(false);
  const [headerCta, setHeaderCta] = useState<{
    kind: "unlock" | "active" | "renew" | "scholar" | "none";
    label: string;
  }>({ kind: "none", label: "" });
  const [isAdmin, setIsAdmin] = useState(false);
  const [supportUnread, setSupportUnread] = useState(0);
  const [adminSupportUnread, setAdminSupportUnread] = useState(0);
  const isAuthenticated = Boolean(session.data?.user);
  // Derive cleared header state when logged out — avoid setState-in-effect.
  const visibleHeaderCta = isAuthenticated ? headerCta : { kind: "none" as const, label: "" };
  const visibleIsAdmin = isAuthenticated && isAdmin;
  const visibleSupportUnread = isAuthenticated ? supportUnread : 0;
  const visibleAdminSupportUnread = visibleIsAdmin ? adminSupportUnread : 0;
  const navItems = navigationForUser({
    isGuest: !isAuthenticated,
    isAdmin: visibleIsAdmin
  });
  const isHome = pathname === "/";

  // Lightweight limit check only on product pages (not Home / marketing) — does not create guest rows.
  useEffect(() => {
    if (isAuthenticated || isHome || isMarketing) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/guest/status", { credentials: "include" });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (cancelled || !data.exhausted) return;
        // Defer setState out of the synchronous effect body (lint).
        queueMicrotask(() => {
          if (cancelled) return;
          setGuestGateMessage(
            data.usage?.compileRemaining === 0
              ? "Free trial compiles are used up. Create a free account to continue."
              : "Free trial AI messages are used up. Create a free account to continue."
          );
          setAuthMode("signup");
          setAuthOpen(true);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.data?.user?.id, pathname, isAuthenticated, isHome, isMarketing]);

  useEffect(() => {
    const userId = session.data?.user?.id;
    if (!userId) return;

    // Claim guest workspace after login/signup
    void fetch("/api/guest/claim", { method: "POST", credentials: "include" }).catch(() => undefined);

    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/account/summary", { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          planKey?: string;
          isPaid?: boolean;
          daysRemaining?: number | null;
          isExpiringSoon?: boolean;
          canDownloadPdf?: boolean;
          hasPdfReady?: boolean;
          unlockPriceUsd?: number;
          isAdmin?: boolean;
        };
        if (cancelled) return;
        queueMicrotask(() => {
          if (cancelled) return;
          setIsAdmin(Boolean(data.isAdmin));
          setHeaderCta(buildHeaderCta(data));
        });
      } catch {
        /* keep quiet */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session.data?.user?.id, pathname]);

  // Support badge: unread admin replies for users; unread user replies for admins.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;

    async function refreshUnread() {
      try {
        const response = await fetch("/api/support/unread", { credentials: "include" });
        if (!response.ok || cancelled) return;
        const data = (await response.json()) as { count?: number; adminCount?: number };
        queueMicrotask(() => {
          if (cancelled) return;
          setSupportUnread(Number(data.count) || 0);
          setAdminSupportUnread(Number(data.adminCount) || 0);
        });
      } catch {
        /* ignore */
      }
    }

    void refreshUnread();
    function onRefresh() {
      void refreshUnread();
    }
    window.addEventListener("cvscholar-support-unread-refresh", onRefresh);
    const interval = window.setInterval(() => void refreshUnread(), 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("cvscholar-support-unread-refresh", onRefresh);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, session.data?.user?.id, pathname]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/providers")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { google?: boolean } | null) => {
        if (cancelled || !data) return;
        queueMicrotask(() => {
          if (!cancelled) setGoogleAuthEnabled(Boolean(data.google));
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onGuestLimit(event: Event) {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setGuestGateMessage(detail?.message || "Create a free account to continue.");
      setAuthMode("signup");
      // Open the real auth modal directly when limits are hit.
      setGuestGateOpen(false);
      setAuthOpen(true);
    }
    window.addEventListener("cvscholar-guest-limit", onGuestLimit);
    return () => window.removeEventListener("cvscholar-guest-limit", onGuestLimit);
  }, []);

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setAuthPending(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      if (authMode === "forgot") {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: `${window.location.origin}/reset-password`
        });
        if (result.error) {
          setAuthError(result.error.message ?? "Could not send reset email.");
          return;
        }
        setAuthMessage("If an account exists for that email, a reset link is on its way.");
        return;
      }

      const result =
        authMode === "signup"
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });

      if (result.error) {
        setAuthError(result.error.message ?? "Login failed.");
        return;
      }

      // Move guest CV data onto the new account before reload.
      await fetch("/api/guest/claim", { method: "POST", credentials: "include" }).catch(() => undefined);
      setAuthOpen(false);
      setGuestGateOpen(false);
      window.location.href = "/profile";
    } finally {
      setAuthPending(false);
    }
  }

  async function handleGoogleSignIn() {
    setAuthError("");
    setAuthPending(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/profile"
      });
    } catch {
      setAuthError("Google sign-in could not start. Try again or use email.");
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

        <Link href={isAuthenticated ? "/profile" : "/"} className="brand-lockup" aria-label="CVScholar">
          <span className="brand-mark">
            <Image src="/favicon.webp" alt="" width={36} height={36} priority />
          </span>
          <span>
            <strong>CVScholar</strong>
          </span>
        </Link>

        <div className="top-actions">
          {isAuthenticated ? (
            <>
              {visibleHeaderCta.kind === "unlock" ? (
                <Link href="/billing" className="primary-action header-unlock-cta" aria-label={visibleHeaderCta.label}>
                  {visibleHeaderCta.label}
                </Link>
              ) : null}
              {visibleHeaderCta.kind === "renew" ? (
                <Link href="/billing" className="primary-action header-unlock-cta" aria-label={visibleHeaderCta.label}>
                  {visibleHeaderCta.label}
                </Link>
              ) : null}
              {visibleHeaderCta.kind === "active" || visibleHeaderCta.kind === "scholar" ? (
                <Link href="/billing" className="credit-pill plan-pill header-plan-status" aria-label={visibleHeaderCta.label}>
                  <span>{visibleHeaderCta.label}</span>
                </Link>
              ) : null}
              <button className="secondary-action compact-action" type="button" onClick={handleSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthMessage("");
                setAuthMode("signin");
                setAuthOpen(true);
              }}
            >
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
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : item.href === "/admin"
                    ? pathname === "/admin" || (pathname.startsWith("/admin/") && !pathname.startsWith("/admin/support"))
                    : pathname.startsWith(item.href);
              const badgeCount =
                item.href === "/support"
                  ? visibleSupportUnread
                  : item.href === "/admin/support"
                    ? visibleAdminSupportUnread
                    : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "is-active" : ""}`}
                  aria-label={navCollapsed ? item.label : undefined}
                  title={item.label}
                  onClick={() => setMobileNavOpen(false)}
                >
                  <span className="nav-item-icon-wrap">
                    <Icon size={19} />
                    {badgeCount > 0 ? (
                      <span className="nav-unread-badge" aria-label={`${badgeCount} unread`}>
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          {!isAuthenticated && !pathname.startsWith("/profile") ? (
            <div className="sidebar-footer-cta">
              <Link
                href="/profile"
                className="primary-action home-cta-green sidebar-open-editor"
                onClick={() => setMobileNavOpen(false)}
                title="Open the CV editor"
              >
                <Rocket size={18} />
                <span>Open the CV editor</span>
              </Link>
            </div>
          ) : null}
        </aside>

        <main className="workspace">{children}</main>

        {hideGlobalStatus ? null : (
          <aside className="status-panel" aria-label="Status">
            {showHomeStatus ? (
              <div id="home-status-slot" className="home-status-slot" />
            ) : showCvStatusSlot ? (
              <div id="managed-cv-status-slot" />
            ) : showWebsiteStatus ? (
              <div id="website-status-slot" className="website-status-slot" />
            ) : showBillingStatus ? (
              <div id="billing-status-slot" className="billing-status-slot" />
            ) : showSettingsStatus ? (
              <SettingsStatusPanel />
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
            <h2 id="auth-title">
              {authMode === "signup" ? "Create free account" : authMode === "forgot" ? "Reset password" : "Login"}
            </h2>
            <p>
              {guestGateMessage ||
                (authMode === "signup"
                  ? "Your guest CV work is kept when you sign up. No card required."
                  : authMode === "forgot"
                    ? "Enter your account email and we will send a reset link if it exists."
                    : "Sign in to continue on this device with your saved academic profile.")}
            </p>
            {authMode !== "forgot" && googleAuthEnabled ? (
              <>
                <button
                  className="secondary-action auth-google-btn"
                  type="button"
                  disabled={authPending}
                  onClick={() => void handleGoogleSignIn()}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#FFC107"
                      d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.3 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.3 5.3C36.9 39 44 34 44 24c0-1.3-.1-2.7-.4-3.5z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <div className="auth-divider" role="separator">
                  <span>or</span>
                </div>
              </>
            ) : null}
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
              {authMode !== "forgot" ? (
                <label>
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                    required
                  />
                </label>
              ) : null}
              {authMode === "signin" ? (
                <button
                  className="link-button auth-forgot-link"
                  type="button"
                  onClick={() => {
                    setAuthError("");
                    setAuthMessage("");
                    setAuthMode("forgot");
                  }}
                >
                  Forgot password?
                </button>
              ) : null}
              {authMode === "signup" ? (
                <p className="auth-legal-note">
                  By creating an account you agree to our{" "}
                  <Link href="/terms" target="_blank" rel="noreferrer">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" target="_blank" rel="noreferrer">
                    Privacy Policy
                  </Link>
                  .
                </p>
              ) : null}
              {authError ? <p className="form-error">{authError}</p> : null}
              {authMessage ? <p className="form-success">{authMessage}</p> : null}
              <button className="primary-action" type="submit" disabled={authPending}>
                {authPending
                  ? "Please wait"
                  : authMode === "signup"
                    ? "Create account"
                    : authMode === "forgot"
                      ? "Send reset link"
                      : "Login"}
              </button>
            </form>
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setAuthError("");
                setAuthMessage("");
                if (authMode === "forgot") {
                  setAuthMode("signin");
                  return;
                }
                setAuthMode(authMode === "signin" ? "signup" : "signin");
              }}
            >
              {authMode === "signin"
                ? "Create a new account"
                : authMode === "forgot"
                  ? "Back to login"
                  : "Already have an account? Login"}
            </button>
          </section>
        </div>
      ) : null}

      {guestGateOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setGuestGateOpen(false)}>
          <section
            className="auth-modal guest-limit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-limit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="modal-close" type="button" aria-label="Close" onClick={() => setGuestGateOpen(false)}>
              <X size={18} />
            </button>
            <h2 id="guest-limit-title">Create a free account to continue</h2>
            <p>{guestGateMessage}</p>
            <p className="settings-hint">Your CV draft stays with you when you sign up — nothing to re-enter.</p>
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setGuestGateOpen(false);
                setAuthMode("signup");
                setAuthOpen(true);
              }}
            >
              Create free account
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => {
                setGuestGateOpen(false);
                setAuthMode("signin");
                setAuthOpen(true);
              }}
            >
              Already have an account? Login
            </button>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function buildHeaderCta(data: {
  planKey?: string;
  isPaid?: boolean;
  daysRemaining?: number | null;
  isExpiringSoon?: boolean;
  canDownloadPdf?: boolean;
  hasPdfReady?: boolean;
  unlockPriceUsd?: number;
}): { kind: "unlock" | "active" | "renew" | "scholar" | "none"; label: string } {
  const price = data.unlockPriceUsd && data.unlockPriceUsd > 0 ? data.unlockPriceUsd : 5;
  const days = data.daysRemaining;

  if (data.isPaid && data.canDownloadPdf) {
    if (data.isExpiringSoon && days != null) {
      return {
        kind: "renew",
        label: `Ends in ${days}d · Renew`
      };
    }
    if (data.planKey === "scholar_annual") {
      return {
        kind: "scholar",
        label: days != null ? `Scholar · ${days}d left` : "Scholar"
      };
    }
    return {
      kind: "active",
      label: days != null ? `PDF unlocked · ${days}d left` : "PDF unlocked"
    };
  }

  // Free / locked: only sell when they already have something to download.
  if (data.hasPdfReady) {
    return {
      kind: "unlock",
      label: `Unlock PDF · $${price % 1 === 0 ? price.toFixed(0) : price.toFixed(2)}`
    };
  }

  return { kind: "none", label: "" };
}

function SettingsStatusPanel() {
  const [activeSection, setActiveSection] = useState("account");

  useEffect(() => {
    function syncFromHash() {
      const section = window.location.hash.replace("#", "") || "account";
      if (SETTINGS_NAV.some(([id]) => id === section)) {
        setActiveSection(section);
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  return (
    <div className="admin-status-nav settings-status-nav">
      <div className="sidebar-header admin-status-header">
        <span className="section-label">Settings</span>
      </div>
      <nav className="nav-list" aria-label="Settings sections">
        {SETTINGS_NAV.map(([id, label, Icon]) => {
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
                window.dispatchEvent(new Event("cvscholar-settings-section"));
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          );
        })}
      </nav>
      <div className="admin-status-footer">
        <p className="muted-text" style={{ fontSize: 12, margin: "12px 8px 0" }}>
          Billing and website privacy stay on their own screens.
        </p>
        <Link href="/billing" className="secondary-action compact-action" style={{ margin: "8px", width: "calc(100% - 16px)", justifyContent: "center" }}>
          Open billing
        </Link>
      </div>
    </div>
  );
}

const SETTINGS_NAV = [
  ["account", "Account", UserRound],
  ["privacy", "Privacy", ShieldCheck],
  ["cv", "CV defaults", FileText],
  ["ai", "AI assistant", Bot],
  ["appearance", "Appearance", Settings2]
] as const;

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
        <Link href="/admin/support" className="nav-item" title="Support tickets">
          <LifeBuoy size={19} />
          <span>Support tickets</span>
        </Link>
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
