import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createTicket } from "@/lib/support/service";

export const PDF_FEEDBACK_REQUIRED_CODE = "PDF_FEEDBACK_REQUIRED";

export type PeerFeedbackSource = "pdf_download" | "voluntary";

const SUBJECTS: Record<PeerFeedbackSource, string> = {
  pdf_download: "PDF download peer review",
  voluntary: "Peer feedback to improve CVScholar"
};

export function isPeerFeedbackSource(value: string): value is PeerFeedbackSource {
  return value === "pdf_download" || value === "voluntary";
}

export async function userNeedsPdfDownloadFeedback(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { pdfDownloadFeedbackAt: true, isGuest: true }
  });
  if (!user || user.isGuest) return false;
  return user.pdfDownloadFeedbackAt == null;
}

export async function submitPeerFeedback(input: {
  user: Pick<User, "id" | "name" | "email">;
  source: PeerFeedbackSource;
  message: string;
  files: File[];
}) {
  const message = input.message.trim();
  if (message.length < 10) {
    throw new Error("Please write at least a short note (10 characters) so we can act on it.");
  }

  const sourceLine =
    input.source === "pdf_download"
      ? "Source: first PDF download"
      : "Source: Give feedback to improve";

  const ticket = await createTicket({
    user: input.user,
    type: "feedback",
    subject: SUBJECTS[input.source],
    message: `${sourceLine}\n\n${message}`,
    files: input.files
  });

  if (input.source === "pdf_download") {
    await prisma.user.update({
      where: { id: input.user.id },
      data: { pdfDownloadFeedbackAt: new Date() }
    });
  }

  return {
    ticketNumber: ticket?.ticketNumber ?? "",
    downloadUnlocked: input.source === "pdf_download"
  };
}
