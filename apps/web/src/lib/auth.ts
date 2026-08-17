import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { requiredEnv } from "@/lib/env";

function appBaseUrl() {
  return (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

async function sendAuthEmail(args: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "CVScholar <noreply@cvscholar.com>";
  if (!apiKey || !args.to.trim()) {
    console.warn("[auth/email] skipped (RESEND_API_KEY missing or empty to)", args.subject);
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject,
        text: args.text
      })
    });
    if (!response.ok) {
      console.error("[auth/email] Resend failed", response.status, await response.text().catch(() => ""));
    }
  } catch (error) {
    console.error("[auth/email]", error);
  }
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_OAUTH_CLIENT_ID || "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_OAUTH_CLIENT_SECRET || "";

export const auth = betterAuth({
  appName: "CVScholar",
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "CVScholar · Reset your password",
        text: [
          `Hello ${user.name || "there"},`,
          "",
          "We received a request to reset your CVScholar password.",
          "Open this link to choose a new password (it expires soon):",
          "",
          url,
          "",
          "If you did not request this, you can ignore this email.",
          "",
          "— CVScholar"
        ].join("\n")
      });
    }
  },
  socialProviders: {
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            accessType: "offline" as const,
            prompt: "select_account consent" as const
          }
        }
      : {})
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Meta: CompleteRegistration + StartTrial (once per user id via stable event_id).
          // Fire-and-forget; never block account creation.
          try {
            const { trackMetaCompleteRegistration, trackMetaStartTrial } = await import("@/lib/meta/track");
            const bits = { id: user.id, email: user.email };
            await Promise.all([
              trackMetaCompleteRegistration({ user: bits }),
              trackMetaStartTrial({ user: bits })
            ]);
          } catch (error) {
            console.error("[auth/meta] registration tracking failed", error);
          }
        }
      }
    }
  },
  plugins: [nextCookies()]
});

export function isGoogleAuthConfigured() {
  return Boolean(googleClientId && googleClientSecret);
}

export function authAppBaseUrl() {
  return appBaseUrl();
}
