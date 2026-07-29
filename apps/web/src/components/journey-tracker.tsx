"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type JourneyMetadata = Record<string, string | number | boolean | null>;

export function trackJourney(eventName: string, metadata: JourneyMetadata = {}, path?: string) {
  if (typeof window === "undefined") return;
  void fetch("/api/journey/track", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, path: path ?? window.location.pathname, metadata })
  }).catch(() => undefined);
}

export function JourneyTracker() {
  const pathname = usePathname();
  const editedFields = useRef(new Set<string>());

  useEffect(() => {
    trackJourney("page_view", { queryPresent: Boolean(window.location.search) }, pathname);
  }, [pathname]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const element = (event.target as Element | null)?.closest("a,button");
      if (!(element instanceof HTMLElement)) return;
      const label = (element.getAttribute("aria-label") || element.textContent || "action").replace(/\s+/g, " ").trim().slice(0, 100);
      const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") || "" : "";
      const haystack = `${label} ${href}`.toLowerCase();
      let eventName = "ui_action";
      if (/login|sign in|create.*account|sign up/.test(haystack)) eventName = "auth_action";
      else if (/price|pricing|billing|plan|unlock/.test(haystack)) eventName = "pricing_action";
      else if (/publication|doi|orcid|scholar|add manually|approve selected|merge duplicate/.test(haystack)) eventName = /review|approve|merge/.test(haystack) ? "publication_review_action" : "publication_action";
      else if (/website|username|publish/.test(haystack)) eventName = /check.*username|availability/.test(haystack) ? "website_username_check" : /publish/.test(haystack) ? "website_publish_action" : "website_action";
      else if (/generate.*cv|compile/.test(haystack)) eventName = "cv_compile_action";
      else if (/download/.test(haystack)) eventName = "cv_download_action";
      else if (/import.*cv|old cv/.test(haystack)) eventName = "cv_import_action";
      else if (/chat|send|build with ai|ai assistant/.test(haystack)) eventName = "ai_chat_action";
      trackJourney(eventName, { label, href: href.slice(0, 180) });
    }

    function handleChange(event: Event) {
      const field = event.target;
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
      if (!field.closest(".profile-editor-shell")) return;
      const label = field.closest("label")?.querySelector("span")?.textContent?.trim() || field.name || field.type;
      const key = `${pathname}:${label}`;
      if (editedFields.current.has(key)) return;
      editedFields.current.add(key);
      trackJourney("profile_field_edited", { field: label.slice(0, 80) });
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleChange, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("change", handleChange, true);
    };
  }, [pathname]);

  return null;
}
