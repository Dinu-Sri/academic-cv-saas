import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export function adminEmails() {
  return (process.env.CVSCHOLAR_ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(email?: string | null) {
  if (!email) return false;
  return adminEmails().includes(email.toLowerCase());
}

export async function requirePlatformAdmin() {
  const session = await auth.api.getSession({
    headers: await headers()
  });

  if (!session?.user) {
    return {
      response: NextResponse.json({ error: "Please login before opening the admin cockpit." }, { status: 401 })
    };
  }

  if (!isPlatformAdmin(session.user.email)) {
    return {
      response: NextResponse.json({ error: "This account is not allowed to view the admin cockpit." }, { status: 403 })
    };
  }

  return {
    session
  };
}
