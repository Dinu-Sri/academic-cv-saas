import { z } from "zod";
import { personalFields, profileSections } from "@/lib/profile-sections";

const sectionKeys: Set<string> = new Set(profileSections.map((section) => section.key));
const personalKeys: Set<string> = new Set(personalFields.map((field) => field.name));

const textRecordSchema = z.record(z.string(), z.string().trim().max(3000));

const patchBaseSchema = z.object({
  id: z.string().trim().max(80).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
  requiresConfirmation: z.boolean().default(false),
  reason: z.string().trim().max(500).optional()
});

export const updatePersonalPatchSchema = patchBaseSchema.extend({
  type: z.literal("update_personal"),
  data: textRecordSchema
});

export const addEntryPatchSchema = patchBaseSchema.extend({
  type: z.literal("add_entry"),
  sectionKey: z.string().refine((key) => sectionKeys.has(key), "Unknown CV section."),
  data: textRecordSchema
});

export const updateEntryPatchSchema = patchBaseSchema.extend({
  type: z.literal("update_entry"),
  sectionKey: z.string().refine((key) => sectionKeys.has(key), "Unknown CV section."),
  entryId: z.string().trim().min(1),
  data: textRecordSchema,
  requiresConfirmation: z.boolean().default(true)
});

export const deleteEntryPatchSchema = patchBaseSchema.extend({
  type: z.literal("delete_entry"),
  sectionKey: z.string().refine((key) => sectionKeys.has(key), "Unknown CV section."),
  entryId: z.string().trim().min(1),
  requiresConfirmation: z.boolean().default(true)
});

export const askConfirmationPatchSchema = patchBaseSchema.extend({
  type: z.literal("ask_confirmation"),
  question: z.string().trim().min(1).max(700),
  options: z.array(z.string().trim().min(1).max(160)).max(5).default([])
});

export const cvAgentPatchSchema = z.discriminatedUnion("type", [
  updatePersonalPatchSchema,
  addEntryPatchSchema,
  updateEntryPatchSchema,
  deleteEntryPatchSchema,
  askConfirmationPatchSchema
]);

export const cvAgentResponseSchema = z.object({
  assistantMessage: z.string().trim().min(1).max(2200),
  patches: z.array(cvAgentPatchSchema).max(12).default([]),
  questions: z.array(z.string().trim().max(500)).max(5).default([]),
  warnings: z.array(z.string().trim().max(500)).max(8).default([]),
  memoryUpdate: z
    .object({
      summaryJson: z.record(z.string(), z.unknown()).optional(),
      confirmedFacts: z.array(z.string().trim().max(500)).max(30).optional(),
      uncertainFacts: z.array(z.string().trim().max(500)).max(30).optional(),
      pendingQuestions: z.array(z.string().trim().max(500)).max(10).optional(),
      completedSections: z.array(z.string().trim().max(80)).max(30).optional(),
      nextBestSection: z.string().trim().max(80).optional(),
      preferredTone: z.string().trim().max(80).optional(),
      targetCvType: z.string().trim().max(80).optional()
    })
    .default({})
});

export type CvAgentPatch = z.infer<typeof cvAgentPatchSchema>;
export type CvAgentResponse = z.infer<typeof cvAgentResponseSchema>;

export function cleanPersonalPatchData(data: Record<string, string>) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (personalKeys.has(key) && value.trim()) {
      cleaned[key] = value.trim();
    }
  }
  return cleaned;
}

export function cleanSectionPatchData(sectionKey: string, data: Record<string, string>) {
  const definition = profileSections.find((section) => section.key === sectionKey);
  const cleaned: Record<string, string> = {};

  for (const field of definition?.fields ?? []) {
    const value = data[field.name];
    if (typeof value === "string" && value.trim()) {
      cleaned[field.name] = value.trim();
    }
  }

  return cleaned;
}

export function cvAgentStructuredOutputInstruction() {
  const personal = personalFields.map((field) => field.name).join(", ");
  const sections = profileSections
    .map((section) => `${section.key}: ${section.fields.map((field) => field.name).join(", ")}`)
    .join("\n");

  return [
    "Return JSON only with this shape:",
    "{ assistantMessage: string, patches: CvAgentPatch[], questions: string[], warnings: string[], memoryUpdate: object }",
    "Allowed patch types:",
    "- update_personal: { type, data, confidence, requiresConfirmation, reason }",
    "- add_entry: { type, sectionKey, data, confidence, requiresConfirmation, reason }",
    "- update_entry: { type, sectionKey, entryId, data, confidence, requiresConfirmation, reason }",
    "- delete_entry: { type, sectionKey, entryId, confidence, requiresConfirmation, reason }",
    "- ask_confirmation: { type, question, options, confidence, requiresConfirmation, reason }",
    `Allowed personal fields: ${personal}`,
    "Allowed sections and fields:",
    sections
  ].join("\n");
}
