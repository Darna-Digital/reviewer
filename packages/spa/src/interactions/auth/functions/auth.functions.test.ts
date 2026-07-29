import { describe, expect, it } from "vitest"
import {
  hasErrors,
  isEmail,
  passwordStrength,
  validateSignIn,
  validateSignUp,
} from "./auth.functions"

describe("isEmail", () => {
  it("accepts ordinary and tagged addresses", () => {
    expect(isEmail("rutenis@darnadigital.com")).toBe(true)
    expect(isEmail(" a+tag@example.co.uk ")).toBe(true)
  })

  it("rejects text that is not an address", () => {
    expect(isEmail("rutenis")).toBe(false)
    expect(isEmail("a@b")).toBe(false)
    expect(isEmail("a b@example.com")).toBe(false)
    expect(isEmail("")).toBe(false)
  })
})

describe("validateSignIn", () => {
  it("passes a filled-in form", () => {
    const errors = validateSignIn({
      email: "a@example.com",
      password: "anything",
    })
    expect(hasErrors(errors)).toBe(false)
  })

  it("flags a bad address and a missing password", () => {
    const errors = validateSignIn({ email: "nope", password: "" })
    expect(errors.email).toBeDefined()
    expect(errors.password).toBeDefined()
  })

  it("does not second-guess the length of an existing password", () => {
    const errors = validateSignIn({ email: "a@example.com", password: "x" })
    expect(errors.password).toBeUndefined()
  })
})

describe("validateSignUp", () => {
  const valid = {
    name: "Rūtenis",
    email: "a@example.com",
    password: "correct-horse",
    confirm: "correct-horse",
  }

  it("passes a filled-in form", () => {
    expect(hasErrors(validateSignUp(valid))).toBe(false)
  })

  it("requires a name", () => {
    expect(validateSignUp({ ...valid, name: "  " }).name).toBeDefined()
  })

  it("enforces the minimum password length", () => {
    const errors = validateSignUp({
      ...valid,
      password: "short",
      confirm: "short",
    })
    expect(errors.password).toContain("8")
  })

  it("catches a mistyped confirmation", () => {
    expect(
      validateSignUp({ ...valid, confirm: "correct-hors" }).confirm
    ).toBeDefined()
  })
})

describe("passwordStrength", () => {
  it("calls anything under the minimum weak", () => {
    expect(passwordStrength("abc")).toBe("weak")
  })

  it("rewards length over punctuation", () => {
    expect(passwordStrength("correct horse battery")).toBe("strong")
    expect(passwordStrength("Aa1!")).toBe("weak")
  })

  it("rates a mixed medium-length password fair", () => {
    expect(passwordStrength("password1")).toBe("fair")
  })

  it("rates a long mixed password strong", () => {
    expect(passwordStrength("Passw0rd-long")).toBe("strong")
  })
})
