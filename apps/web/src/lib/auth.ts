import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { requiredEnv } from "@/lib/env";

export const auth = betterAuth({
  appName: "CVScholar",
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  database: prismaAdapter(prisma, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false
  },
  plugins: [nextCookies()]
});
