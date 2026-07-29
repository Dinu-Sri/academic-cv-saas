"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000;
const ACTIVE_WINDOW_MS = 60_000;

export function CvActiveTimeTracker() {
  useEffect(() => {
    let lastActivityAt = 0;
    let started = false;
    let sending = false;

    const sendHeartbeat = () => {
      if (sending || document.visibilityState !== "visible" || Date.now() - lastActivityAt > ACTIVE_WINDOW_MS) return;
      sending = true;
      void fetch("/api/metrics/cv-time/heartbeat", {
        method: "POST",
        credentials: "include",
        keepalive: true
      }).finally(() => {
        sending = false;
      });
    };
    const markActivity = () => {
      lastActivityAt = Date.now();
      if (!started) {
        started = true;
        sendHeartbeat();
      }
    };

    const activityEvents: (keyof DocumentEventMap)[] = ["input", "keydown", "pointerdown", "scroll"];
    for (const eventName of activityEvents) document.addEventListener(eventName, markActivity, { passive: true, capture: true });
    const interval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      for (const eventName of activityEvents) document.removeEventListener(eventName, markActivity, true);
      sendHeartbeat();
    };
  }, []);

  return null;
}
