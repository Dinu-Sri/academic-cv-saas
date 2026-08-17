"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { trackJourney } from "@/components/journey-tracker";
import { handleGuestLimitResponse } from "@/lib/guest-client";
import { runMobileCompileClassic } from "@/lib/mobile/flow";

export function MobileManualScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [field, setField] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = fullName.trim();
    if (!name) {
      setError("Please enter your full name to continue.");
      return;
    }

    setBusy(true);
    setError("");
    setStatusMessage("Saving your details…");
    trackJourney("mobile_manual_submitted");

    try {
      const bioBits = [field.trim() && `Field: ${field.trim()}`, goal.trim() && `Goal: ${goal.trim()}`, phone.trim() && `Phone: ${phone.trim()}`]
        .filter(Boolean)
        .join("\n");

      const saveRes = await fetch("/api/profile/personal", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: name,
          headline: title.trim(),
          affiliation: affiliation.trim(),
          email: email.trim(),
          bio: bioBits.slice(0, 3000)
        })
      });
      if (await handleGuestLimitResponse(saveRes)) {
        setBusy(false);
        return;
      }
      const saveBody = (await saveRes.json()) as { error?: string };
      if (!saveRes.ok) {
        throw new Error(saveBody.error || "Could not save your details.");
      }

      setStatusMessage("Building your academic PDF…");
      const { documentId } = await runMobileCompileClassic((msg) => setStatusMessage(msg));
      router.push(`/m/ready?documentId=${encodeURIComponent(documentId)}`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mobile-flow-card-stack">
      <Link href="/m" className="mobile-flow-back">
        <ArrowLeft size={16} /> Back
      </Link>

      <div className="mobile-flow-hero">
        <h1>A few quick questions</h1>
        <p>We create your academic draft from these answers. Add education, experience, and publications on a laptop.</p>
      </div>

      {error ? <p className="mobile-flow-error">{error}</p> : null}

      <form className="mobile-flow-form" onSubmit={(e) => void onSubmit(e)}>
        <label>
          <span>Full name *</span>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={busy} placeholder="e.g. Dr. Jane Doe" />
        </label>
        <label>
          <span>Current title or role</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} placeholder="e.g. PhD Candidate" />
        </label>
        <label>
          <span>Institution or affiliation</span>
          <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} disabled={busy} placeholder="e.g. University of Oxford" />
        </label>
        <label>
          <span>Field or area of study</span>
          <input value={field} onChange={(e) => setField(e.target.value)} disabled={busy} placeholder="e.g. Molecular Biology" />
        </label>
        <label>
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={busy} placeholder="you@example.com" />
        </label>
        <label>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={busy} placeholder="Optional" />
        </label>
        <label>
          <span>What is this CV for?</span>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} disabled={busy} placeholder="e.g. PhD applications" />
        </label>

        <button type="submit" className="mobile-flow-primary" disabled={busy}>
          {busy ? <Loader2 className="spin-icon" size={18} /> : null}
          {busy ? statusMessage || "Building…" : "Build my CV"}
        </button>
        <p className="mobile-flow-hint">This can take up to a minute while we build your CV.</p>
      </form>
    </div>
  );
}
