import type { MailMessage } from "../../../ports/mailer.ts"

export interface EmailBrand {
  /** Shown in the greeting and the signature. */
  readonly product: string
}

const DEFAULT_BRAND: EmailBrand = { product: "Byconvo" }

const compose = (lines: ReadonlyArray<string>): string =>
  `${lines.join("\n")}\n`

/**
 * The transactional emails, as pure functions from their inputs to a message.
 * Keeping the copy here means the wording is unit-testable and identical
 * whichever transport ends up sending it.
 */
export const verificationEmail = (
  to: string,
  url: string,
  brand: EmailBrand = DEFAULT_BRAND
): MailMessage => ({
  to,
  subject: `Confirm your ${brand.product} email`,
  text: compose([
    `Welcome to ${brand.product}.`,
    "",
    "Confirm this address to finish setting up your account:",
    url,
    "",
    "If you did not create an account, you can ignore this email.",
  ]),
})

export const passwordResetEmail = (
  to: string,
  url: string,
  brand: EmailBrand = DEFAULT_BRAND
): MailMessage => ({
  to,
  subject: `Reset your ${brand.product} password`,
  text: compose([
    `Someone asked to reset the ${brand.product} password for ${to}.`,
    "",
    "Choose a new one here:",
    url,
    "",
    "The link expires in an hour. If this wasn't you, nothing has changed.",
  ]),
})

export const invitationEmail = (
  to: string,
  params: {
    readonly organization: string
    readonly inviter: string
    readonly url: string
  },
  brand: EmailBrand = DEFAULT_BRAND
): MailMessage => ({
  to,
  subject: `${params.inviter} invited you to ${params.organization}`,
  text: compose([
    `${params.inviter} has invited you to join ${params.organization} on ${brand.product}.`,
    "",
    "Accept the invitation here:",
    params.url,
    "",
    "If you weren't expecting this, you can ignore this email.",
  ]),
})
