"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { authClient } from "@/lib/auth-client";

type InviteInfo = {
  email: string;
  planKey: string;
  planName: string;
  expiresAt: string;
  status: "open" | "used" | "expired";
  note: string;
};

export function InviteRedeemClient({ token }: { token: string }) {
  const session = authClient.useSession();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, { credentials: "include" });
        const payload = (await response.json()) as { invitation?: InviteInfo; error?: string };
        if (!response.ok) throw new Error(payload.error || "Invitation not found.");
        if (!cancelled) setInfo(payload.invitation || null);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Invitation not found.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function redeem() {
    setRedeeming(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: "POST",
        credentials: "include"
      });
      const payload = (await response.json()) as {
        error?: string;
        expectedEmail?: string;
        planName?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Could not redeem invitation.");
      setMessage(`${payload.planName || "Your plan"} is now active on this account.`);
      setInfo((current) => (current ? { ...current, status: "used" } : current));
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Could not redeem invitation.");
    } finally {
      setRedeeming(false);
    }
  }

  const userEmail = session.data?.user?.email?.toLowerCase() || "";
  const loggedIn = Boolean(session.data?.user);
  const emailMatches = Boolean(info && userEmail && userEmail === info.email.toLowerCase());

  return (
    <section className="workspace-screen invite-redeem-screen">
      <article className="invite-redeem-card">
        <span className="section-label">Plan invitation</span>
        <h1>Activate your CVScholar package</h1>
        {loading ? (
          <p className="muted-text"><Loader2 className="spin-icon" size={16} /> Loading invitation…</p>
        ) : null}
        {error ? <p className="form-error">{error}</p> : null}
        {message ? (
          <p className="form-success">
            <CheckCircle2 size={16} /> {message}
          </p>
        ) : null}

        {info ? (
          <>
            <dl className="invite-redeem-facts">
              <div>
                <dt>Package</dt>
                <dd>{info.planName}</dd>
              </div>
              <div>
                <dt>Invited email</dt>
                <dd>{info.email}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{new Date(info.expiresAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{info.status}</dd>
              </div>
            </dl>
            {info.note ? <p className="muted-text">Note: {info.note}</p> : null}

            {info.status === "open" ? (
              !loggedIn ? (
                <div className="invite-redeem-actions">
                  <p className="muted-text">
                    Sign in or create an account with <strong>{info.email}</strong> to redeem this invite.
                  </p>
                  <Link
                    className="primary-action"
                    href={`/profile?login=1&invite=${encodeURIComponent(token)}`}
                  >
                    <LockKeyhole size={16} />
                    Login to redeem
                  </Link>
                </div>
              ) : !emailMatches ? (
                <p className="form-error">
                  You are signed in as {session.data?.user?.email}. This invite is only for {info.email}.
                </p>
              ) : (
                <button className="primary-action" type="button" disabled={redeeming} onClick={() => void redeem()}>
                  {redeeming ? <Loader2 className="spin-icon" size={16} /> : <Sparkles size={16} />}
                  {redeeming ? "Activating…" : `Activate ${info.planName}`}
                </button>
              )
            ) : null}

            {info.status !== "open" || message ? (
              <Link className="secondary-action" href="/billing">
                Open billing
              </Link>
            ) : null}
          </>
        ) : null}
      </article>
    </section>
  );
}
