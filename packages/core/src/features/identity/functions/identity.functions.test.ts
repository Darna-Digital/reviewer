import { describe, expect, it } from "vitest"
import {
  canDeleteComment,
  canEditComment,
  canManageMembers,
  canManageOrganization,
  canManageProjects,
  initialsOf,
  nameFromEmail,
  roleAtLeast,
  slugifyOrganization,
} from "./identity.functions.ts"

describe("roleAtLeast", () => {
  it("ranks owner above admin above member", () => {
    expect(roleAtLeast("owner", "member")).toBe(true)
    expect(roleAtLeast("admin", "member")).toBe(true)
    expect(roleAtLeast("member", "admin")).toBe(false)
  })

  it("is satisfied by an exact match", () => {
    expect(roleAtLeast("admin", "admin")).toBe(true)
  })
})

describe("permissions", () => {
  it("reserves organization settings for the owner", () => {
    expect(canManageOrganization("owner")).toBe(true)
    expect(canManageOrganization("admin")).toBe(false)
  })

  it("lets admins manage members and projects", () => {
    expect(canManageMembers("admin")).toBe(true)
    expect(canManageProjects("admin")).toBe(true)
    expect(canManageMembers("member")).toBe(false)
    expect(canManageProjects("member")).toBe(false)
  })
})

describe("comment permissions", () => {
  it("only the author may edit, whatever the role", () => {
    expect(canEditComment("u1", "u1")).toBe(true)
    expect(canEditComment("u1", "u2")).toBe(false)
  })

  it("the author or an admin may delete", () => {
    expect(canDeleteComment("member", "u1", "u1")).toBe(true)
    expect(canDeleteComment("member", "u1", "u2")).toBe(false)
    expect(canDeleteComment("admin", "u1", "u2")).toBe(true)
  })
})

describe("slugifyOrganization", () => {
  it("lowercases and dashes", () => {
    expect(slugifyOrganization("Darna Digital Organization")).toBe(
      "darna-digital-organization"
    )
  })

  it("collapses runs of punctuation and trims the edges", () => {
    expect(slugifyOrganization("  --Hans & Natur!!  ")).toBe("hans-natur")
  })

  it("falls back for a name with nothing usable", () => {
    expect(slugifyOrganization("!!!")).toBe("org")
  })
})

describe("nameFromEmail", () => {
  it("humanizes the local part", () => {
    expect(nameFromEmail("rutenis.jakas@darnadigital.com")).toBe(
      "rutenis jakas"
    )
  })

  it("falls back to the whole address when there is no local part", () => {
    expect(nameFromEmail("@example.com")).toBe("@example.com")
  })
})

describe("initialsOf", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsOf("Rūtenis Jakas")).toBe("RJ")
    expect(initialsOf("Cher")).toBe("C")
  })

  it("falls back for an empty name", () => {
    expect(initialsOf("   ")).toBe("?")
  })
})
