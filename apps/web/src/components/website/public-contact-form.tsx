"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function PublicContactForm({ username }: { username: string }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [visitorName, setVisitorName] = useState("");
  const [visitorEmail, setVisitorEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!siteKey || !widgetRef.current) return;

    let cancelled = false;

    function mountWidget() {
      if (cancelled || !widgetRef.current || !window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(widgetRef.current, {
        sitekey: siteKey,
        callback: (token) => setTurnstileToken(token),
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken("")
      });
    }

    if (window.turnstile) {
      mountWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-cvscholar-turnstile="1"]');
      if (existing) {
        existing.addEventListener("load", mountWidget);
      } else {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.dataset.cvscholarTurnstile = "1";
        script.addEventListener("load", mountWidget);
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [siteKey]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError("");
    try {
      if (siteKey && !turnstileToken) {
        throw new Error("Please complete the spam check.");
      }
      const response = await fetch(`/api/public-sites/${encodeURIComponent(username)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorName,
          visitorEmail,
          subject,
          message,
          turnstileToken
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not send message.");
      setStatus("sent");
      setVisitorName("");
      setVisitorEmail("");
      setSubject("");
      setMessage("");
      setTurnstileToken("");
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    } catch (submitError) {
      setStatus("error");
      setError(submitError instanceof Error ? submitError.message : "Could not send message.");
    }
  }

  return (
    <form className="contact-form" onSubmit={onSubmit}>
      <label>
        <span>Name</span>
        <input value={visitorName} onChange={(event) => setVisitorName(event.target.value)} required maxLength={120} />
      </label>
      <label>
        <span>Email</span>
        <input type="email" value={visitorEmail} onChange={(event) => setVisitorEmail(event.target.value)} required maxLength={200} />
      </label>
      <label>
        <span>Subject</span>
        <input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} />
      </label>
      <label>
        <span>Message</span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required rows={5} maxLength={4000} />
      </label>
      {siteKey ? <div ref={widgetRef} className="ms-turnstile" /> : null}
      {error ? <p>{error}</p> : null}
      {status === "sent" ? <p>Message sent. Thank you.</p> : null}
      <button type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"} <span>→</span>
      </button>
    </form>
  );
}
