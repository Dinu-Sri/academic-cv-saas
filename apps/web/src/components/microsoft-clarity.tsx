"use client";

import Script from "next/script";

type MicrosoftClarityProps = {
  projectId: string;
  /** product = cvscholar.com app/marketing; public_scholar = published academic sites */
  siteMode?: "product" | "public_scholar";
  enabled?: boolean;
};

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/**
 * Microsoft Clarity base tag (heatmaps + session replay).
 * Loaded on product pages and optionally on public scholar sites (env-gated).
 * Does not send CV field contents; Clarity masks password inputs by default.
 */
export function MicrosoftClarity({
  projectId,
  siteMode = "product",
  enabled = true
}: MicrosoftClarityProps) {
  if (!enabled || !projectId) return null;

  const boot = `
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", ${JSON.stringify(projectId)});
    try {
      if (typeof window.clarity === "function") {
        window.clarity("set", "site_mode", ${JSON.stringify(siteMode)});
      }
    } catch (e) {}
  `;

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: boot }}
    />
  );
}
