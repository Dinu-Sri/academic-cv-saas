"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Globe2,
  Link2,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Sparkles
} from "lucide-react";

type UsernameCheckResult = {
  normalized: string;
  valid: boolean;
  available: boolean;
  reason: string | null;
  suggestions: string[];
};

const HOOKS = [
  {
    icon: Sparkles,
    title: "From your CV — not a blank page",
    text: "Generate a free academic website from the profile you already built. No design tools, no week of layout work."
  },
  {
    icon: RefreshCw,
    title: "Auto-updates with your research",
    text: "When your CV grows, your public site can stay aligned — so visitors always see current work."
  },
  {
    icon: Globe2,
    title: "Free on your subdomain",
    text: "Publish on username.cvscholar.com at no cost. Focus on scholarship, not hosting setup."
  },
  {
    icon: Link2,
    title: "Your domain when you are ready",
    text: "Scholar Annual unlocks a custom domain so your site matches your professional identity."
  }
] as const;

export function WebsiteOnboardingGate({ rootDomain }: { rootDomain: string }) {
  const [username, setUsername] = useState("");
  const [result, setResult] = useState<UsernameCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  async function checkUsername() {
    const value = username.trim();
    if (!value) return;

    setChecking(true);
    setError("");
    try {
      const response = await fetch(`/api/website/username/check?value=${encodeURIComponent(value)}`);
      const payload = (await response.json()) as UsernameCheckResult & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not check this username.");
      setResult(payload);
      if (payload.normalized) setUsername(payload.normalized);
    } catch (checkError) {
      setResult(null);
      setError(checkError instanceof Error ? checkError.message : "Could not check this username.");
    } finally {
      setChecking(false);
    }
  }

  function continueToAccount() {
    if (!result?.available || !result.normalized) return;
    const query = new URLSearchParams({
      website: "1",
      username: result.normalized,
      login: "1"
    });
    window.location.assign(`/website?${query.toString()}`);
  }

  const message = !result
    ? "Pick an address visitors will remember."
    : result.available
      ? `${result.normalized}.${rootDomain} is available.`
      : result.reason === "taken"
        ? "That username is already in use."
        : result.reason === "reserved"
          ? "That username is reserved. Try a personal or research-based name."
          : "Use 3-50 letters, numbers, or single hyphens.";

  return (
    <section className="workspace-screen website-workspace website-onboarding-gate website-onboarding-sell">
      <div className="website-onboarding-copy">
        <span className="section-label">Free academic website</span>
        <h1>Your research site — without spending days designing one</h1>
        <p className="website-onboarding-lead">
          Generate a professional academic website from your CV. Free to start, automatic structure from your profile,
          and ready for a custom domain when you need it.
        </p>
        <ul className="website-onboarding-hooks">
          {HOOKS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title}>
                <span className="website-onboarding-hook-icon" aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </li>
            );
          })}
        </ul>
        <ol className="website-onboarding-steps">
          <li><span>1</span>Claim your address</li>
          <li><span>2</span>Login or create an account</li>
          <li><span>3</span>Add name, title, and summary — we generate the site</li>
        </ol>
      </div>

      <article className="website-claim-card website-onboarding-card">
        <div className="website-onboarding-icon" aria-hidden="true"><Globe2 size={24} /></div>
        <h2 className="website-claim-title">Claim your academic address</h2>
        <p className="website-claim-sub">Free subdomain on {rootDomain}. No card required.</p>
        <label className="website-field">
          <span>Website username</span>
          <div className="website-username-row">
            <input
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                setResult(null);
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void checkUsername();
              }}
              placeholder="your-name"
              autoComplete="off"
              aria-describedby="website-username-status"
            />
            <span className="website-host-hint">.{rootDomain}</span>
          </div>
        </label>

        <p
          id="website-username-status"
          className={`website-username-result ${result?.available ? "is-available" : result ? "is-unavailable" : ""}`}
          aria-live="polite"
        >
          {result?.available ? <CheckCircle2 size={16} /> : null}
          {message}
        </p>
        {error ? <p className="form-error">{error}</p> : null}

        {result && !result.available && result.suggestions.length > 0 ? (
          <div className="website-username-suggestions" aria-label="Available username ideas">
            {result.suggestions.map((suggestion) => (
              <button key={suggestion} type="button" onClick={() => { setUsername(suggestion); setResult(null); }}>
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        {result?.available ? (
          <button className="primary-action website-claim-action" type="button" onClick={continueToAccount}>
            <LockKeyhole size={16} />
            Login and continue free
          </button>
        ) : (
          <button className="primary-action website-claim-action" type="button" disabled={checking || !username.trim()} onClick={() => void checkUsername()}>
            {checking ? <Loader2 size={16} className="spin" /> : <Globe2 size={16} />}
            {checking ? "Checking..." : "Check availability"}
          </button>
        )}
      </article>
    </section>
  );
}
