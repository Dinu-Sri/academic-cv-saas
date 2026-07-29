"use client";

import { useState } from "react";
import { CheckCircle2, Globe2, Loader2, LockKeyhole } from "lucide-react";

type UsernameCheckResult = {
  normalized: string;
  valid: boolean;
  available: boolean;
  reason: string | null;
  suggestions: string[];
};

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
    ? "Choose the address you want visitors to remember."
    : result.available
      ? `${result.normalized}.${rootDomain} is available.`
      : result.reason === "taken"
        ? "That username is already in use."
        : result.reason === "reserved"
          ? "That username is reserved. Try a personal or research-based name."
          : "Use 3-50 letters, numbers, or single hyphens.";

  return (
    <section className="workspace-screen website-workspace website-onboarding-gate">
      <div className="website-onboarding-copy">
        <span className="section-label">Academic Website</span>
        <h1>Claim your academic address</h1>
        <p>Check your username now. After login, add your name, academic title, and short bio. CVScholar will generate your website automatically.</p>
        <ol className="website-onboarding-steps">
          <li><span>1</span>Check your username</li>
          <li><span>2</span>Login or create an account</li>
          <li><span>3</span>Add three basic CV details</li>
        </ol>
      </div>

      <article className="website-claim-card website-onboarding-card">
        <div className="website-onboarding-icon" aria-hidden="true"><Globe2 size={24} /></div>
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
            Login and continue
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
