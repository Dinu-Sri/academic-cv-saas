"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

export type ScholarTheme = "light" | "dark";

const THEME_KEY = "cvscholar-sp-theme";
const COOKIE_KEY = "cvscholar-sp-cookie-ok";

type NavItem = { key: string; label: string; href: string };

type Props = {
  brandName: string;
  brandHref: string;
  brandSub?: string;
  pages: NavItem[];
  activePage: string;
  mode: "preview" | "public";
  /** When preview, nav uses hash anchors. */
  useHashNav?: boolean;
  cvHref?: string;
  /** Free / PDF Pass: thin “Built with CVScholar” bar. Scholar Annual: hidden. */
  showPlatformBranding?: boolean;
};

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function readTheme(): ScholarTheme {
  if (typeof window === "undefined") return "light";
  const stored = safeStorageGet(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeCookie(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_KEY || event.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

function readCookieAccepted() {
  if (typeof window === "undefined") return true;
  return safeStorageGet(COOKIE_KEY) === "1";
}

export function ScholarPagesChrome({
  brandName,
  brandHref,
  brandSub,
  pages,
  activePage,
  mode,
  useHashNav = false,
  cvHref,
  showPlatformBranding = true
}: Props) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light" as ScholarTheme);
  const cookieAccepted = useSyncExternalStore(subscribeCookie, readCookieAccepted, () => true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cookieDismissed, setCookieDismissed] = useState(false);
  const menuId = useId();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const cookieVisible = !cookieAccepted && !cookieDismissed;

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: ScholarTheme = theme === "light" ? "dark" : "light";
    safeStorageSet(THEME_KEY, next);
    applyThemeToDom(next);
    // Notify same-tab subscribers (storage event does not fire in same document).
    window.dispatchEvent(new StorageEvent("storage", { key: THEME_KEY, newValue: next }));
  }, [theme]);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
    };
    document.addEventListener("keydown", onKey);
    const first = panelRef.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen, closeMenu]);

  function acceptCookies() {
    safeStorageSet(COOKIE_KEY, "1");
    setCookieDismissed(true);
    window.dispatchEvent(new StorageEvent("storage", { key: COOKIE_KEY, newValue: "1" }));
  }

  function navHref(entry: NavItem) {
    if (useHashNav || mode === "preview") {
      return entry.key === "home" ? "#sp-home" : `#sp-${entry.key}`;
    }
    return entry.href;
  }

  return (
    <>
      <a className="sp-skip-link" href="#sp-main">
        Skip to main content
      </a>

      {showPlatformBranding ? (
        <div className="sp-platform-bar" role="note">
          <span>Academic website built with</span>{" "}
          <a href="https://cvscholar.com" rel="noopener noreferrer">
            CVScholar
          </a>
          {mode === "preview" ? <span className="sp-platform-bar-hint"> · Free plan badge</span> : null}
        </div>
      ) : null}

      <header className="sp-header" role="banner">
        <div className="sp-header-inner">
          <a className="sp-brand" href={useHashNav || mode === "preview" ? "#sp-home" : brandHref}>
            <span className="sp-brand-name">{brandName || "Academic Scholar"}</span>
            {brandSub ? <span className="sp-brand-sub">{brandSub}</span> : null}
          </a>

          <nav className="sp-nav-desktop" aria-label="Primary">
            <ul className="sp-nav-list">
              {pages.map((entry) => {
                const active = activePage === entry.key;
                return (
                  <li key={entry.key}>
                    <a
                      href={navHref(entry)}
                      className={`${active ? "is-active" : ""} ${entry.key === "contact" ? "sp-nav-utility" : ""}`.trim() || undefined}
                      aria-current={active ? "page" : undefined}
                    >
                      {entry.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="sp-header-actions">
            {cvHref ? (
              <a className="sp-header-cv" href={cvHref}>
                CV
              </a>
            ) : null}
            <button
              type="button"
              className="sp-theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              title={theme === "light" ? "Dark mode" : "Light mode"}
            >
              {theme === "light" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )}
            </button>

            <button
              ref={menuButtonRef}
              type="button"
              className="sp-menu-btn"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              onClick={() => setMenuOpen((open) => !open)}
            >
              Menu
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="sp-menu-backdrop" role="presentation" onClick={closeMenu} />
        ) : null}

        <div
          id={menuId}
          ref={panelRef}
          className={`sp-menu-panel ${menuOpen ? "is-open" : ""}`}
          hidden={!menuOpen}
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <div className="sp-menu-panel-head">
            <strong>Menu</strong>
            <button type="button" className="sp-icon-btn" onClick={closeMenu} aria-label="Close menu">
              Close
            </button>
          </div>
          <nav aria-label="Mobile">
            <ul className="sp-menu-list">
              {pages.map((entry) => {
                const active = activePage === entry.key;
                return (
                  <li key={entry.key}>
                    <a
                      href={navHref(entry)}
                      className={active ? "is-active" : undefined}
                      aria-current={active ? "page" : undefined}
                      onClick={closeMenu}
                    >
                      {entry.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          {cvHref ? <a className="sp-menu-cv" href={cvHref} onClick={closeMenu}>Download CV</a> : null}
        </div>
      </header>

      {cookieVisible ? (
        <div className="sp-cookie" role="region" aria-label="Cookie notice">
          <p>
            This site uses essential cookies and privacy-safe page view counts. No advertising trackers.{" "}
            <a href={mode === "preview" ? "#sp-legal-cookies" : "/cookies"}>Cookie details</a>
          </p>
          <button type="button" className="sp-cookie-accept" onClick={acceptCookies}>
            Accept
          </button>
        </div>
      ) : null}
    </>
  );
}

export function ScholarPagesFooter({
  displayName,
  affiliation,
  publicUrl,
  mode,
  orcidUrl,
  scholarUrl,
  linkedinUrl,
  showPlatformBranding = true
}: {
  displayName: string;
  affiliation?: string;
  publicUrl: string;
  mode: "preview" | "public";
  orcidUrl?: string;
  scholarUrl?: string;
  linkedinUrl?: string;
  showPlatformBranding?: boolean;
}) {
  const year = new Date().getFullYear();
  const privacyHref = mode === "preview" ? "#sp-legal-privacy" : "/privacy";
  const termsHref = mode === "preview" ? "#sp-legal-terms" : "/terms";
  const cookiesHref = mode === "preview" ? "#sp-legal-cookies" : "/cookies";

  return (
    <footer className="sp-footer" role="contentinfo">
      <div className="sp-footer-inner">
        <div className="sp-footer-identity">
          <strong>{displayName || "Academic Scholar"}</strong>
          {affiliation ? <span>{affiliation}</span> : null}
          {publicUrl ? (
            <a className="sp-footer-url" href={publicUrl}>
              {publicUrl.replace(/^https?:\/\//, "")}
            </a>
          ) : null}
        </div>

        <ul className="sp-footer-links" aria-label="Scholarly profiles">
          {orcidUrl ? (
            <li>
              <a href={orcidUrl} rel="noopener noreferrer">
                ORCID
              </a>
            </li>
          ) : null}
          {scholarUrl ? (
            <li>
              <a href={scholarUrl} rel="noopener noreferrer">
                Google Scholar
              </a>
            </li>
          ) : null}
          {linkedinUrl ? (
            <li>
              <a href={linkedinUrl} rel="noopener noreferrer">
                LinkedIn
              </a>
            </li>
          ) : null}
        </ul>

        <nav className="sp-footer-legal" aria-label="Legal">
          <a href={privacyHref}>Privacy</a>
          <a href={termsHref}>Terms</a>
          <a href={cookiesHref}>Cookies</a>
        </nav>

        <p className="sp-footer-meta">
          © {year} {displayName || "Author"}
          {showPlatformBranding ? (
            <>
              {" · "}
              <a href="https://cvscholar.com" rel="noopener noreferrer">
                CVScholar
              </a>
            </>
          ) : null}
          {mode === "preview" ? " · Draft" : ""}
        </p>
      </div>
    </footer>
  );
}

function applyThemeToDom(next: ScholarTheme) {
  // Scope to Scholar Pages surfaces only — do not retheme the CVScholar app shell.
  document.documentElement.dataset.spTheme = next;
  document.querySelectorAll<HTMLElement>(".scholar-pages, .website-public-standalone, .website-preview-standalone").forEach((node) => {
    node.dataset.theme = next;
  });
}

function safeStorageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage — UI still works for the session.
  }
}
