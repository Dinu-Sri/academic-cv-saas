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
  /** Optional profile photo — when missing, no initials black box is shown. */
  brandPhotoUrl?: string;
  pages: NavItem[];
  activePage: string;
  mode: "preview" | "public";
  useHashNav?: boolean;
  cvHref?: string;
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

async function shareSite(brandName: string) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const title = brandName || "Academic website";
  const text = `View ${title}'s academic website`;
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      trackShareEvent("share_native");
      return;
    }
  } catch {
    // User cancelled or share failed — fall through to copy.
  }
  try {
    await navigator.clipboard.writeText(url);
    trackShareEvent("share_copy");
    window.alert("Link copied to clipboard.");
  } catch {
    window.prompt("Copy this link:", url);
    trackShareEvent("share_copy_fallback");
  }
}

function trackShareEvent(eventName: string) {
  try {
    const body = JSON.stringify({
      eventName,
      path: typeof window !== "undefined" ? window.location.pathname : "/",
      at: new Date().toISOString()
    });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/public/share-event", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/public/share-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true
    });
  } catch {
    // Analytics must never block sharing.
  }
}

export function ScholarPagesChrome({
  brandName,
  brandPhotoUrl,
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
  const navRef = useRef<HTMLElement>(null);
  const cookieVisible = !cookieAccepted && !cookieDismissed;

  useEffect(() => {
    applyThemeToDom(theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const next: ScholarTheme = theme === "light" ? "dark" : "light";
    safeStorageSet(THEME_KEY, next);
    applyThemeToDom(next);
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

  const homeHref = useHashNav || mode === "preview" ? "#sp-home" : brandHref;

  return (
    <>
      <a className="skip-link" href="#sp-main">
        Skip to content
      </a>

      {showPlatformBranding ? (
        <div className="sp-platform-bar" role="note">
          Built with <a href="https://cvscholar.com" rel="noopener noreferrer">CVScholar</a>
          {mode === "preview" ? " · Draft" : null}
        </div>
      ) : null}

      <header className="site-header">
        <a className="identity" href={homeHref} aria-label={`${brandName}, home`}>
          {brandPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Authenticated/public site assets are not Next Image optimized routes.
            <img className="identity-photo" src={brandPhotoUrl} alt="" width={40} height={40} />
          ) : null}
          <span>
            <strong>{brandName || "Academic Scholar"}</strong>
            {brandSub ? <small>{brandSub}</small> : null}
          </span>
        </a>

        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>

        <nav
          id={menuId}
          ref={navRef}
          className={`site-navigation${menuOpen ? " open" : ""}`}
          aria-label="Primary"
        >
          {pages.map((entry) => {
            const active = activePage === entry.key;
            return (
              <a
                key={entry.key}
                href={navHref(entry)}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {entry.label}
              </a>
            );
          })}
          {cvHref ? (
            <a href={cvHref} onClick={() => setMenuOpen(false)}>
              Download CV
            </a>
          ) : null}
        </nav>

        {mode === "public" ? (
          <button
            type="button"
            className="theme-button share-button"
            onClick={() => void shareSite(brandName)}
            aria-label="Share this academic website"
            title="Share"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
            </svg>
          </button>
        ) : null}

        <button
          type="button"
          className="theme-button"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title={theme === "light" ? "Dark mode" : "Light mode"}
        >
          <svg className="theme-icon theme-icon-moon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3a7 7 0 1 0 11.5 11.5z" />
          </svg>
          <svg className="theme-icon theme-icon-sun" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
          </svg>
        </button>
      </header>

      {menuOpen ? <div className="sp-menu-backdrop" role="presentation" onClick={closeMenu} /> : null}

      {cookieVisible ? (
        <div className="sp-cookie" role="region" aria-label="Cookie notice">
          <p>
            Essential cookies and privacy-safe page views only.{" "}
            <a href={mode === "preview" ? "#sp-legal-cookies" : "/cookies"}>Details</a>
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
  showPlatformBranding = true,
  pages = [],
  cvHref
}: {
  displayName: string;
  affiliation?: string;
  publicUrl: string;
  mode: "preview" | "public";
  orcidUrl?: string;
  scholarUrl?: string;
  linkedinUrl?: string;
  showPlatformBranding?: boolean;
  pages?: NavItem[];
  cvHref?: string;
}) {
  const year = new Date().getFullYear();
  const contentLinks = pages.filter((page) => page.key !== "home");

  return (
    <footer className="site-footer">
      <div className="footer-identity">
        <strong>{displayName || "Academic Scholar"}</strong>
        {affiliation ? <span>{affiliation}</span> : null}
      </div>
      <div className="footer-links">
        {contentLinks.map((page) => (
          <a key={page.key} href={mode === "preview" ? (page.key === "home" ? "#sp-home" : `#sp-${page.key}`) : page.href}>
            {page.label}
          </a>
        ))}
        {cvHref ? <a href={cvHref}>Download CV</a> : null}
        {orcidUrl ? (
          <a href={orcidUrl} target="_blank" rel="noopener noreferrer">
            ORCID
          </a>
        ) : null}
        {scholarUrl ? (
          <a href={scholarUrl} target="_blank" rel="noopener noreferrer">
            Scholar
          </a>
        ) : null}
        {linkedinUrl ? (
          <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
            LinkedIn
          </a>
        ) : null}
      </div>
      <p className="footer-copy">
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
        {publicUrl && mode === "public" ? ` · ${publicUrl.replace(/^https?:\/\//, "")}` : ""}
      </p>
    </footer>
  );
}

function applyThemeToDom(next: ScholarTheme) {
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
    /* ignore */
  }
}
