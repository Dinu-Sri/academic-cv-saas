"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  Palette,
  ShieldCheck,
  UserRound
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import type { SettingsPayload } from "@/lib/settings/service";
import {
  isSettingsSectionId,
  SETTINGS_SECTIONS,
  type SettingsSectionId
} from "@/lib/settings/defaults";
import { AgentMemorySettings } from "@/components/agent-memory-settings";

type Props = {
  initialData: SettingsPayload;
};

const SECTION_ICONS = {
  account: UserRound,
  privacy: ShieldCheck,
  cv: FileText,
  ai: Bot,
  appearance: Palette
} as const;

export function SettingsWorkspace({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [section, setSection] = useState<SettingsSectionId>("account");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Account form
  const [name, setName] = useState(initialData.account.name);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Privacy
  const [marketingEmails, setMarketingEmails] = useState(initialData.privacy.marketingEmails);
  const [marketingSms, setMarketingSms] = useState(initialData.privacy.marketingSms);
  const [productUpdates, setProductUpdates] = useState(initialData.privacy.productUpdates);
  const [cookieFunctional, setCookieFunctional] = useState(initialData.privacy.cookieConsent.functional);
  const [cookieAnalytics, setCookieAnalytics] = useState(initialData.privacy.cookieConsent.analytics);
  const [cookieMarketing, setCookieMarketing] = useState(initialData.privacy.cookieConsent.marketing);

  // CV defaults
  const [cv, setCv] = useState(initialData.cvDefaults);

  // Appearance + AI master toggle
  const [density, setDensity] = useState(initialData.appearance.density);
  const [defaultNavCollapsed, setDefaultNavCollapsed] = useState(initialData.appearance.defaultNavCollapsed);
  const [agentMemoryEnabled, setAgentMemoryEnabled] = useState(initialData.ai.agentMemoryEnabled);

  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.replace("#", "");
      if (isSettingsSectionId(hash)) setSection(hash);
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("cvscholar-settings-section", syncFromHash as EventListener);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("cvscholar-settings-section", syncFromHash as EventListener);
    };
  }, []);

  const applyPayload = useCallback((payload: SettingsPayload) => {
    setData(payload);
    setName(payload.account.name);
    setMarketingEmails(payload.privacy.marketingEmails);
    setMarketingSms(payload.privacy.marketingSms);
    setProductUpdates(payload.privacy.productUpdates);
    setCookieFunctional(payload.privacy.cookieConsent.functional);
    setCookieAnalytics(payload.privacy.cookieConsent.analytics);
    setCookieMarketing(payload.privacy.cookieConsent.marketing);
    setCv(payload.cvDefaults);
    setDensity(payload.appearance.density);
    setDefaultNavCollapsed(payload.appearance.defaultNavCollapsed);
    setAgentMemoryEnabled(payload.ai.agentMemoryEnabled);
  }, []);

  async function savePatch(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not save.");
      applyPayload(result as SettingsPayload);
      setMessage(successMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAccount() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (name.trim() && name.trim() !== data.account.name) {
        const response = await fetch("/api/settings", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account: { name: name.trim() } })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not update name.");
        applyPayload(result as SettingsPayload);
      }

      if (newPassword || currentPassword || confirmPassword) {
        if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
        if (newPassword !== confirmPassword) throw new Error("New password and confirmation do not match.");
        if (!currentPassword) throw new Error("Enter your current password to change it.");

        const result = await authClient.changePassword({
          currentPassword,
          newPassword,
          revokeOtherSessions: false
        });
        if (result.error) throw new Error(result.error.message || "Could not change password.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }

      setMessage("Account saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save account.");
    } finally {
      setBusy(false);
    }
  }

  const sectionMeta = SETTINGS_SECTIONS.find((s) => s.id === section)!;

  return (
    <section className="settings-workspace workspace-screen">
      <div className="screen-header">
        <div>
          <h1>Settings</h1>
          <p>{sectionMeta.description}. Use the panel on the right to switch sections.</p>
        </div>
      </div>

      {message ? (
        <div className="billing-banner is-success" role="status">
          <CheckCircle2 size={18} />
          <span>{message}</span>
        </div>
      ) : null}
      {error ? (
        <div className="billing-banner is-error" role="alert">
          <span>{error}</span>
        </div>
      ) : null}

      {section === "account" ? (
        <article className="settings-panel">
          <span className="section-label">Account</span>
          <h2>Your login details</h2>
          <p className="settings-lead">Update how your name appears in the app. Academic title and affiliation stay on Build CV.</p>

          <label className="settings-field">
            <span>Display name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="settings-field">
            <span>Email</span>
            <input value={data.account.email} disabled readOnly />
            <small className="settings-hint">Email change will be available later. Contact support if you need a new address.</small>
          </label>

          <div className="settings-divider" />
          <h3>Change password</h3>
          <label className="settings-field">
            <span>Current password</span>
            <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
          </label>
          <label className="settings-field">
            <span>New password</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="settings-field">
            <span>Confirm new password</span>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
          </label>

          <button className="primary-action" type="button" disabled={busy} onClick={() => void saveAccount()}>
            {busy ? <Loader2 className="spin" size={16} /> : null}
            Save account
          </button>
        </article>
      ) : null}

      {section === "privacy" ? (
        <article className="settings-panel">
          <span className="section-label">Privacy</span>
          <h2>Communications & consent</h2>
          <p className="settings-lead">Control marketing and how we use non-essential cookies. We never sell your data.</p>

          <label className="settings-toggle">
            <input type="checkbox" checked={marketingEmails} onChange={(e) => setMarketingEmails(e.target.checked)} />
            <span>
              <strong>Email marketing</strong>
              <small>Tips, feature news, and occasional offers.</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={productUpdates} onChange={(e) => setProductUpdates(e.target.checked)} />
            <span>
              <strong>Product & service updates</strong>
              <small>Important product notices. Billing and security emails may still be sent.</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={marketingSms} onChange={(e) => setMarketingSms(e.target.checked)} />
            <span>
              <strong>SMS marketing</strong>
              <small>Optional. Off by default until SMS is product-ready.</small>
            </span>
          </label>

          <div className="settings-divider" />
          <h3>Cookie preferences</h3>
          <label className="settings-toggle is-disabled">
            <input type="checkbox" checked disabled readOnly />
            <span>
              <strong>Essential</strong>
              <small>Required for login and security.</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={cookieFunctional} onChange={(e) => setCookieFunctional(e.target.checked)} />
            <span>
              <strong>Functional</strong>
              <small>Theme and layout preferences on this device.</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={cookieAnalytics} onChange={(e) => setCookieAnalytics(e.target.checked)} />
            <span>
              <strong>Analytics</strong>
              <small>Helps us improve CVScholar (e.g. product analytics).</small>
            </span>
          </label>
          <label className="settings-toggle">
            <input type="checkbox" checked={cookieMarketing} onChange={(e) => setCookieMarketing(e.target.checked)} />
            <span>
              <strong>Marketing cookies</strong>
              <small>Currently unused for ads; stored for future clarity.</small>
            </span>
          </label>

          <div className="settings-divider" />
          <h3>Agreements</h3>
          <p className="settings-hint">
            Terms:{" "}
            {data.privacy.termsAcceptedAt
              ? `accepted ${new Date(data.privacy.termsAcceptedAt).toLocaleDateString()}`
              : "not recorded yet"}
            {" · "}
            Privacy:{" "}
            {data.privacy.privacyAcceptedAt
              ? `accepted ${new Date(data.privacy.privacyAcceptedAt).toLocaleDateString()}`
              : "not recorded yet"}
          </p>
          <div className="settings-inline-actions">
            <button
              className="secondary-action compact-action"
              type="button"
              disabled={busy}
              onClick={() =>
                void savePatch(
                  { privacy: { acceptTerms: true, acceptPrivacy: true } },
                  "Agreements recorded."
                )
              }
            >
              Record acceptance now
            </button>
            <a className="secondary-action compact-action" href="https://cvscholar.com/privacy" target="_blank" rel="noreferrer">
              Privacy policy
            </a>
            <a className="secondary-action compact-action" href="https://cvscholar.com/terms" target="_blank" rel="noreferrer">
              Terms of use
            </a>
          </div>

          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() =>
              void savePatch(
                {
                  privacy: {
                    marketingEmails,
                    marketingSms,
                    productUpdates,
                    cookieConsent: {
                      functional: cookieFunctional,
                      analytics: cookieAnalytics,
                      marketing: cookieMarketing
                    }
                  }
                },
                "Privacy preferences saved."
              )
            }
          >
            {busy ? <Loader2 className="spin" size={16} /> : null}
            Save privacy
          </button>
        </article>
      ) : null}

      {section === "cv" ? (
        <article className="settings-panel">
          <span className="section-label">CV defaults</span>
          <h2>PDF generation defaults</h2>
          <p className="settings-lead">
            Applied when you generate CVs. Per-CV overrides (e.g. heading colour) stay on Manage CV.
          </p>

          <div className="settings-grid-2">
            <label className="settings-field">
              <span>Page size</span>
              <select value={cv.pageSize} onChange={(e) => setCv((c) => ({ ...c, pageSize: e.target.value as typeof c.pageSize }))}>
                <option value="A4">A4 (210 × 297 mm)</option>
                <option value="Letter">US Letter (8.5 × 11 in)</option>
                <option value="Legal">US Legal (8.5 × 14 in)</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Font family</span>
              <select value={cv.fontFamily} onChange={(e) => setCv((c) => ({ ...c, fontFamily: e.target.value as typeof c.fontFamily }))}>
                <option value="serif">Serif (academic standard)</option>
                <option value="sans">Sans-serif</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Base font size</span>
              <select value={cv.fontSize} onChange={(e) => setCv((c) => ({ ...c, fontSize: e.target.value as typeof c.fontSize }))}>
                <option value="10">10pt — Compact</option>
                <option value="11">11pt — Standard</option>
                <option value="12">12pt — Large</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Line spacing</span>
              <select value={cv.lineSpacing} onChange={(e) => setCv((c) => ({ ...c, lineSpacing: e.target.value as typeof c.lineSpacing }))}>
                <option value="compact">Compact</option>
                <option value="normal">Normal</option>
                <option value="relaxed">Relaxed</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Date format (footer)</span>
              <select value={cv.dateFormat} onChange={(e) => setCv((c) => ({ ...c, dateFormat: e.target.value as typeof c.dateFormat }))}>
                <option value="F Y">March 2026</option>
                <option value="M Y">Mar 2026</option>
                <option value="m/Y">03/2026</option>
                <option value="Y">2026</option>
              </select>
            </label>
          </div>

          <h3>Margins</h3>
          <p className="settings-hint">Use values like 1in, 2.54cm, or 25.4mm. Standard academic CVs use 1 inch.</p>
          <div className="settings-grid-4">
            {(
              [
                ["marginTop", "Top"],
                ["marginBottom", "Bottom"],
                ["marginLeft", "Left"],
                ["marginRight", "Right"]
              ] as const
            ).map(([key, label]) => (
              <label className="settings-field" key={key}>
                <span>{label}</span>
                <input
                  value={cv[key]}
                  onChange={(e) => setCv((c) => ({ ...c, [key]: e.target.value }))}
                  placeholder="1in"
                />
              </label>
            ))}
          </div>

          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={cv.showPageNumbers}
              onChange={(e) => setCv((c) => ({ ...c, showPageNumbers: e.target.checked }))}
            />
            <span>
              <strong>Show page numbers</strong>
            </span>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={cv.showLastUpdated}
              onChange={(e) => setCv((c) => ({ ...c, showLastUpdated: e.target.checked }))}
            />
            <span>
              <strong>Show “Last updated” in footer</strong>
            </span>
          </label>

          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() => void savePatch({ cvDefaults: cv }, "CV defaults saved. They apply on the next PDF generate.")}
          >
            {busy ? <Loader2 className="spin" size={16} /> : null}
            Save CV defaults
          </button>
        </article>
      ) : null}

      {section === "ai" ? (
        <div className="settings-ai-stack">
          <article className="settings-panel">
            <span className="section-label">AI & memory</span>
            <h2>Memory master switch</h2>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={agentMemoryEnabled}
                onChange={(e) => setAgentMemoryEnabled(e.target.checked)}
              />
              <span>
                <strong>Let CVScholar remember preferences</strong>
                <small>When off, new memory candidates are not promoted. Existing memories stay until you delete them.</small>
              </span>
            </label>
            <button
              className="primary-action"
              type="button"
              disabled={busy}
              onClick={() => void savePatch({ ai: { agentMemoryEnabled } }, "AI preference saved.")}
            >
              {busy ? <Loader2 className="spin" size={16} /> : null}
              Save AI preference
            </button>
          </article>
          <AgentMemorySettings embedded />
        </div>
      ) : null}

      {section === "appearance" ? (
        <article className="settings-panel">
          <span className="section-label">Appearance</span>
          <h2>App layout</h2>
          <p className="settings-lead">These affect the CVScholar app shell, not your public Scholar Pages site theme.</p>

          <label className="settings-field">
            <span>Density</span>
            <select value={density} onChange={(e) => setDensity(e.target.value as "comfortable" | "compact")}>
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="settings-toggle">
            <input
              type="checkbox"
              checked={defaultNavCollapsed}
              onChange={(e) => setDefaultNavCollapsed(e.target.checked)}
            />
            <span>
              <strong>Start with side menu collapsed</strong>
              <small>Applies the next time you load the app (you can still expand the menu).</small>
            </span>
          </label>

          <button
            className="primary-action"
            type="button"
            disabled={busy}
            onClick={() =>
              void savePatch(
                { appearance: { density, defaultNavCollapsed } },
                "Appearance saved."
              ).then(() => {
                try {
                  window.localStorage.setItem(
                    "cvscholar-appearance",
                    JSON.stringify({ density, defaultNavCollapsed })
                  );
                } catch {
                  /* ignore */
                }
              })
            }
          >
            {busy ? <Loader2 className="spin" size={16} /> : null}
            Save appearance
          </button>
        </article>
      ) : null}
    </section>
  );
}

export { SECTION_ICONS, SETTINGS_SECTIONS };
