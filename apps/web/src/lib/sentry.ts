type SentryLevel = "error" | "warning" | "info";

/** Lightweight Sentry capture via envelope HTTP API (no SDK dependency required). */
export async function captureWebsiteException(
  error: unknown,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    level?: SentryLevel;
  }
) {
  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  try {
    const parsed = new URL(dsn);
    const publicKey = parsed.username;
    const projectId = parsed.pathname.replace("/", "");
    if (!publicKey || !projectId) return;

    const eventId = cryptoRandomId();
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const payload = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "node",
      level: context?.level || "error",
      logger: "cvscholar-website",
      message,
      exception: stack
        ? {
            values: [
              {
                type: error instanceof Error ? error.name : "Error",
                value: message,
                stacktrace: {
                  frames: String(stack)
                    .split("\n")
                    .slice(0, 30)
                    .map((line) => ({ filename: line.trim() }))
                }
              }
            ]
          }
        : undefined,
      tags: {
        feature: "website",
        ...(context?.tags || {})
      },
      extra: context?.extra || {}
    };

    const ingest = `${parsed.protocol}//${parsed.host}/api/${projectId}/store/?sentry_key=${publicKey}&sentry_version=7`;
    await fetch(ingest, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => undefined);
  } catch {
    // Never throw from telemetry.
  }
}

function cryptoRandomId() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}
