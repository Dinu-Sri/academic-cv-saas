import type { User } from "@/generated/prisma/client";
import { profileSections } from "@/lib/profile-sections";
import { prisma } from "@/lib/prisma";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function getOrCreateWorkspaceForUser(user: Pick<User, "id" | "name" | "email">) {
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    include: {
      workspace: {
        include: {
          profiles: {
            where: { ownerUserId: user.id },
            take: 1
          }
        }
      }
    }
  });

  if (existingMember) {
    const profile =
      existingMember.workspace.profiles[0] ??
      (await prisma.academicProfile.create({
        data: {
          workspaceId: existingMember.workspaceId,
          ownerUserId: user.id,
          displayName: user.name,
          email: user.email
        }
      }));

    await ensureProfileSections(profile.id);

    return {
      workspace: existingMember.workspace,
      profile
    };
  }

  const baseSlug = slugify(user.name || user.email.split("@")[0] || "workspace") || "workspace";
  let slug = baseSlug;
  let suffix = 1;

  while (await prisma.workspace.findUnique({ where: { slug } })) {
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const workspace = await prisma.workspace.create({
    data: {
      name: `${user.name || "Academic"} Workspace`,
      slug,
      members: {
        create: {
          userId: user.id,
          role: "owner"
        }
      },
      profiles: {
        create: {
          ownerUserId: user.id,
          displayName: user.name,
          email: user.email
        }
      }
    },
    include: {
      profiles: {
        where: { ownerUserId: user.id },
        take: 1
      }
    }
  });

  await ensureProfileSections(workspace.profiles[0].id);

  return {
    workspace,
    profile: workspace.profiles[0]
  };
}

/**
 * Ensure catalog sections exist for a profile.
 * Never overwrite user-controlled sectionOrder / isVisible on existing rows
 * (those are set by the editor reorder / visibility APIs).
 */
export async function ensureProfileSections(profileId: string) {
  await Promise.all(
    profileSections.map((section) =>
      prisma.profileSection.upsert({
        where: {
          profileId_key: {
            profileId,
            key: section.key
          }
        },
        update: {
          title: section.title
        },
        create: {
          profileId,
          key: section.key,
          title: section.title,
          sectionOrder: section.sectionOrder,
          isVisible: section.defaultVisible
        }
      })
    )
  );
}
