/**
 * Outbound mail, in the one shape both callers need.
 *
 * better-auth takes plain async callbacks, and the rest of the server speaks
 * Effect, so the transports are written as promises here and lifted into the
 * core `Mailer` port by {@link mailerLayer}. One implementation, two faces —
 * a verification email and an invitation go out the same way.
 *
 * With no SMTP host configured the console transport prints the message,
 * including the link, so a fresh clone can sign up and verify without any
 * third-party account.
 */
import { Mailer, MailError, type MailMessage } from "@byconvo/core/ports/mailer"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { createTransport } from "nodemailer"

export type SendMail = (message: MailMessage) => Promise<void>

export interface SmtpSettings {
  readonly host: string
  readonly port: number
  readonly secure: boolean
  readonly user?: string
  readonly pass?: string
  readonly from: string
}

/** SMTP settings from the environment, or null when SMTP_HOST is unset. */
export const smtpSettingsFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): SmtpSettings | null => {
  const host = env["SMTP_HOST"]
  if (host === undefined || host.length === 0) return null
  const port = Number(env["SMTP_PORT"] ?? 587)
  return {
    host,
    port,
    // Port 465 is implicit TLS; everything else upgrades with STARTTLS.
    secure: env["SMTP_SECURE"] === "true" || port === 465,
    ...(env["SMTP_USER"] === undefined ? {} : { user: env["SMTP_USER"] }),
    ...(env["SMTP_PASS"] === undefined ? {} : { pass: env["SMTP_PASS"] }),
    from: env["SMTP_FROM"] ?? "byconvo <no-reply@byconvo.local>",
  }
}

export const consoleTransport: SendMail = async (message) => {
  console.log(
    [
      "",
      "──────── email (no SMTP_HOST configured) ────────",
      `to:      ${message.to}`,
      `subject: ${message.subject}`,
      "",
      message.text.trimEnd(),
      "─────────────────────────────────────────────────",
      "",
    ].join("\n")
  )
}

export const smtpTransport = (settings: SmtpSettings): SendMail => {
  const transport = createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    ...(settings.user === undefined
      ? {}
      : { auth: { user: settings.user, pass: settings.pass ?? "" } }),
  })
  return async (message) => {
    await transport.sendMail({
      from: settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.html === undefined ? {} : { html: message.html }),
    })
  }
}

/** The transport this process will use, chosen once from the environment. */
export const sendMail: SendMail = (() => {
  const settings = smtpSettingsFromEnv()
  return settings === null ? consoleTransport : smtpTransport(settings)
})()

/** The same transport, as the core `Mailer` port. */
export const mailerLayer = Layer.succeed(Mailer)({
  send: (message) =>
    Effect.tryPromise({
      try: () => sendMail(message),
      catch: (error) =>
        new MailError({
          reason: error instanceof Error ? error.message : String(error),
        }),
    }),
})
