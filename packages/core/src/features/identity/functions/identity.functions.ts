import type { MemberRole } from "../schema/identity.schema.ts"

/** Most privileged first. `rank` compares two roles without a lookup chain. */
export const ROLE_ORDER: ReadonlyArray<MemberRole> = ["owner", "admin", "member"]

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

const RANK: Record<MemberRole, number> = { owner: 0, admin: 1, member: 2 }

/** True when `role` is at least as privileged as `required`. */
export const roleAtLeast = (role: MemberRole, required: MemberRole): boolean =>
  RANK[role] <= RANK[required]

/** Renaming the organization, changing billing, deleting it. */
export const canManageOrganization = (role: MemberRole): boolean =>
  roleAtLeast(role, "owner")

/** Inviting people, changing roles, removing members. */
export const canManageMembers = (role: MemberRole): boolean =>
  roleAtLeast(role, "admin")

/** Creating and archiving projects, and editing their labels. */
export const canManageProjects = (role: MemberRole): boolean =>
  roleAtLeast(role, "admin")

/**
 * A comment's text belongs to whoever wrote it — nobody else may rewrite it,
 * whatever their role. Deleting is looser: admins can clear one out. The same
 * two rules decide whether the edit and delete affordances render at all.
 */
export const canEditComment = (authorId: string, userId: string): boolean =>
  authorId === userId

export const canDeleteComment = (
  role: MemberRole,
  authorId: string,
  userId: string
): boolean => authorId === userId || canManageMembers(role)

/**
 * The slug an organization gets from its name: lowercase, non-alphanumerics
 * collapsed to single dashes, trimmed. Empty names fall back to "org".
 */
export const slugifyOrganization = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return slug.length > 0 ? slug : "org"
}

/** A display name for someone we only know the email address of. */
export const nameFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? ""
  const cleaned = local.replace(/[._-]+/g, " ").trim()
  return cleaned.length > 0 ? cleaned : email
}

/** Initials for an avatar fallback — "Rūtenis Jakas" → "RJ". */
export const initialsOf = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "?"
