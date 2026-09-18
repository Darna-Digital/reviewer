/**
 * Formatter — the plugin port every code formatter implements.
 *
 * A formatter is discovered rather than configured: the project already says
 * how it wants its code to look, and the job here is to find that setup and run
 * it. `probe` answers what was found (so settings can show it), `format` runs
 * it over one document.
 *
 * As with {@link ../ports/language-provider.ts}, only repository-relative POSIX
 * paths cross this port; the absolute `root` travels beside them so an
 * implementation can resolve files, configuration and its own module on disk
 * without leaking machine paths into the HTTP API or the UI.
 */
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { NoRepoSelected } from "../shared.ts";

export class FormatError extends Schema.TaggedError<FormatError>()(
  "FormatError",
  { formatterId: Schema.String, reason: Schema.String },
  { httpApiStatus: 500 }
) {
  override get message(): string {
    return `${this.formatterId}: ${this.reason}`;
  }
}

export type FormattingFailure = FormatError | NoRepoSelected;

/** What a probe found in a repository. */
export interface FormatterSetup {
  readonly available: boolean;
  /** Version of the resolved module, null when it could not be resolved. */
  readonly version: string | null;
  /** Repository-relative POSIX path of the configuration file, if any. */
  readonly configPath: string | null;
  /** Why it is unavailable, or what was found — shown in settings. */
  readonly detail: string;
}

export interface FormatRequest {
  /** Absolute repository root. */
  readonly root: string;
  /** Repository-relative POSIX path of the document. */
  readonly path: string;
  /** The buffer to format — what the user is looking at, not what is on disk. */
  readonly contents: string;
}

export interface FormattedDocument {
  /**
   * The formatted text, or null when the formatter declined the file — an
   * unknown extension, or one its ignore file excludes. Declining is not a
   * failure: most repositories format some of their files and not others.
   */
  readonly contents: string | null;
}

export interface Formatter {
  /** Stable id, e.g. `prettier`. */
  readonly id: string;
  readonly name: string;
  readonly probe: (root: string) => Effect.Effect<FormatterSetup>;
  readonly format: (
    request: FormatRequest
  ) => Effect.Effect<FormattedDocument, FormatError>;
}
