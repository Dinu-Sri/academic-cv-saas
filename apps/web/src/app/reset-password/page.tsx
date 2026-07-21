"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is invalid or incomplete. Request a new one from Login.");
      return;
    }
    setPending(true);
    try {
      const result = await authClient.resetPassword({
        newPassword: password,
        token
      });
      if (result.error) {
        setError(result.error.message || "Could not reset password. The link may have expired.");
        return;
      }
      setDone(true);
      window.setTimeout(() => router.push("/?login=1"), 1800);
    } catch {
      setError("Could not reset password. Try requesting a new link.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="workspace-screen reset-password-screen">
      <div className="reset-password-card">
        <span className="section-label">Account</span>
        <h1>Reset password</h1>
        {done ? (
          <p className="settings-hint">Password updated. Redirecting you to login…</p>
        ) : (
          <>
            <p className="settings-hint">Choose a new password for your CVScholar account.</p>
            <form className="auth-form" onSubmit={onSubmit}>
              <label>
                <span>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              <label>
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <button className="primary-action" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Update password"}
              </button>
            </form>
            <p className="settings-hint">
              <Link href="/">Back to home</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="workspace-screen"><p>Loading…</p></section>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
