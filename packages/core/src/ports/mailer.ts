import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

export class MailError extends Schema.TaggedErrorClass<MailError>()(
  "MailError",
  { reason: Schema.String },
  { httpApiStatus: 502 }
) {
  override get message(): string {
    return this.reason
  }
}

export interface MailMessage {
  readonly to: string
  readonly subject: string
  /** Plain-text body. Every message byconvo sends is readable without HTML. */
  readonly text: string
  readonly html?: string
}

/**
 * Outbound transactional mail — verification links, password resets and
 * organization invitations. A port rather than a hard dependency so the
 * development shell can print messages to stdout while production hands them
 * to SMTP, and tests can assert on what would have been sent.
 */
export interface MailerShape {
  readonly send: (message: MailMessage) => Effect.Effect<void, MailError>
}

export class Mailer extends Context.Service<Mailer, MailerShape>()("Mailer") {}
