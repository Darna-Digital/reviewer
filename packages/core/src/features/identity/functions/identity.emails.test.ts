import { describe, expect, it } from "vitest"
import {
  invitationEmail,
  passwordResetEmail,
  verificationEmail,
} from "./identity.emails.ts"

describe("transactional emails", () => {
  it("puts the verification link in the body", () => {
    const mail = verificationEmail("a@example.com", "https://app/verify?t=1")
    expect(mail.to).toBe("a@example.com")
    expect(mail.subject).toBe("Confirm your Byconvo email")
    expect(mail.text).toContain("https://app/verify?t=1")
  })

  it("names the address a reset was asked for", () => {
    const mail = passwordResetEmail("a@example.com", "https://app/reset?t=1")
    expect(mail.text).toContain("a@example.com")
    expect(mail.text).toContain("https://app/reset?t=1")
  })

  it("names the inviter and the organization in the invitation", () => {
    const mail = invitationEmail("b@example.com", {
      organization: "Darna Digital",
      inviter: "Rūtenis",
      url: "https://app/invite/xyz",
    })
    expect(mail.subject).toBe("Rūtenis invited you to Darna Digital")
    expect(mail.text).toContain("https://app/invite/xyz")
  })

  it("takes the product name from the brand", () => {
    const mail = verificationEmail("a@example.com", "https://app/v", {
      product: "Acme",
    })
    expect(mail.subject).toBe("Confirm your Acme email")
  })

  it("ends every body with a single trailing newline", () => {
    const mail = verificationEmail("a@example.com", "https://app/v")
    expect(mail.text.endsWith("\n")).toBe(true)
    expect(mail.text.endsWith("\n\n")).toBe(false)
  })
})
