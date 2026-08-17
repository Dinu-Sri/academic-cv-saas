"use client";

import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { trackBrowserViewContent } from "@/lib/meta/browser";

type MetaPixelProps = {
  pixelId: string;
  /** When false, do not inject scripts (e.g. scholar public hosts). */
  enabled?: boolean;
};

/**
 * Base Meta Pixel for the main product host only.
 * PageView on load; ViewContent on key marketing routes.
 * Scholar public sites must not mount this component.
 */
export function MetaPixel({ pixelId, enabled = true }: MetaPixelProps) {
  const pathname = usePathname();
  const lastViewContent = useRef<string>("");
  const lastPageView = useRef<string>("");
  const isFirstPageView = useRef(true);

  useEffect(() => {
    if (!enabled || !pixelId || typeof window === "undefined" || !pathname) return;
    window.__cvscholarMetaPixelReady = true;

    // Base snippet already fires PageView on first load — only re-fire on client navigations.
    if (isFirstPageView.current) {
      isFirstPageView.current = false;
      lastPageView.current = pathname;
      return;
    }
    if (lastPageView.current === pathname) return;
    lastPageView.current = pathname;

    if (typeof window.fbq === "function") {
      try {
        window.fbq("track", "PageView");
      } catch {
        // ignore
      }
    }
  }, [enabled, pixelId, pathname]);

  useEffect(() => {
    if (!enabled || !pixelId || !pathname) return;

    const key = pathname;
    if (lastViewContent.current === key) return;

    let contentName = "";
    let contentCategory = "marketing";
    let contentIds: string[] | undefined;

    if (pathname === "/") {
      contentName = "Home";
    } else if (pathname === "/pricing") {
      contentName = "Pricing";
      contentCategory = "billing";
      contentIds = ["pdf_pass", "scholar_annual"];
    } else if (pathname === "/billing") {
      contentName = "Billing";
      contentCategory = "billing";
      contentIds = ["pdf_pass", "scholar_annual"];
    } else if (pathname.startsWith("/blog/")) {
      contentName = pathname.replace(/^\/blog\//, "").slice(0, 120) || "BlogPost";
      contentCategory = "blog";
    } else if (pathname === "/blog") {
      contentName = "BlogIndex";
      contentCategory = "blog";
    } else if (pathname === "/website") {
      contentName = "WebsiteWorkspace";
      contentCategory = "website";
    } else if (pathname === "/m" || pathname.startsWith("/m/")) {
      contentName = "MobileStart";
      contentCategory = "marketing";
    } else {
      return;
    }

    lastViewContent.current = key;
    // Defer slightly so base pixel init can complete
    const t = window.setTimeout(() => {
      trackBrowserViewContent({ contentName, contentCategory, contentIds });
    }, 50);
    return () => window.clearTimeout(t);
  }, [enabled, pixelId, pathname]);

  if (!enabled || !pixelId) return null;

  const initScript = `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(pixelId)});
fbq('track', 'PageView');
window.__cvscholarMetaPixelReady = true;
`;

  return (
    <>
      <Script id="meta-pixel-base" strategy="afterInteractive">
        {initScript}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${encodeURIComponent(pixelId)}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
