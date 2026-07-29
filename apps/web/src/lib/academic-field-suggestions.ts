import { academicFieldKey, academicFieldsByGroup } from "@/lib/academic-taxonomy";
import { prisma } from "@/lib/prisma";

export function isCatalogAcademicField(group: string, field: string) {
  const normalized = field.trim().toLocaleLowerCase("en");
  return (academicFieldsByGroup[group] ?? []).some((candidate) => candidate.toLocaleLowerCase("en") === normalized);
}

export async function retainCustomAcademicField(profileId: string, group: string, field: string) {
  const key = academicFieldKey(group, field);
  if (!key || isCatalogAcademicField(group, field)) return;

  await prisma.academicFieldSuggestion.upsert({
    where: { profileId_academicFieldKey: { profileId, academicFieldKey: key } },
    update: {
      academicFieldGroup: group,
      academicField: field,
      lastSeenAt: new Date()
    },
    create: {
      profileId,
      academicFieldGroup: group,
      academicField: field,
      academicFieldKey: key
    }
  });
}
