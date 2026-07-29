/**
 * `auth` feature — what the sign-in and sign-up forms will accept before they
 * bother the server.
 *
 * These are deliberately the same rules better-auth enforces server-side, kept
 * here so the form can say what is wrong while it is being typed rather than
 * after a round trip. The server remains the authority: nothing here is a
 * security check, only a courtesy.
 */

/** better-auth's own default minimum. */
export const MIN_PASSWORD_LENGTH = 8

/**
 * Deliberately loose. Anything stricter rejects addresses that are perfectly
 * valid (plus tags, new TLDs, unicode locals), and the verification email is
 * what actually proves an address works.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (value: string): boolean => EMAIL.test(value.trim())

export interface FieldErrors {
  readonly name?: string
  readonly email?: string
  readonly password?: string
  readonly confirm?: string
}

export const validateSignIn = (input: {
  email: string
  password: string
}): FieldErrors => ({
  ...(isEmail(input.email) ? {} : { email: "Enter a valid email address" }),
  ...(input.password.length === 0 ? { password: "Enter your password" } : {}),
})

export const validateSignUp = (input: {
  name: string
  email: string
  password: string
  confirm: string
}): FieldErrors => ({
  ...(input.name.trim().length === 0 ? { name: "Enter your name" } : {}),
  ...(isEmail(input.email) ? {} : { email: "Enter a valid email address" }),
  ...(input.password.length < MIN_PASSWORD_LENGTH
    ? {
        password: `Use at least ${MIN_PASSWORD_LENGTH} characters`,
      }
    : {}),
  ...(input.confirm !== input.password
    ? { confirm: "The passwords do not match" }
    : {}),
})

export const hasErrors = (errors: FieldErrors): boolean =>
  Object.keys(errors).length > 0

/**
 * A rough sense of how much work a password is, for the meter next to the
 * field. Not an entropy estimate and not presented as one — it rewards length
 * first, then variety, because that is the advice worth giving.
 */
export type PasswordStrength = "weak" | "fair" | "strong"

export const passwordStrength = (password: string): PasswordStrength => {
  if (password.length < MIN_PASSWORD_LENGTH) return "weak"
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z0-9]/].filter((pattern) =>
    pattern.test(password)
  ).length
  if (password.length >= 16 || (password.length >= 12 && variety >= 3)) {
    return "strong"
  }
  return variety >= 2 ? "fair" : "weak"
}
