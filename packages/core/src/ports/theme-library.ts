/**
 * ThemeLibrary — the port a theme catalog and its highlighter sit behind.
 *
 * Core reads a theme; it does not own one. Which themes the app offers, where
 * their JSON comes from and how a snippet is tokenized are the business of
 * whichever library is plugged in here (`@reviewer/themes`, over Pierre's
 * collections and Shiki), so core never names one. What crosses the port is a
 * {@link Theme} — the plain VS Code theme shape core's derivations read — and
 * the descriptors and highlighted tokens the API already speaks in.
 */
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  ColorScheme,
  HighlightedCode,
  HighlightRequest,
  ThemeDescriptor,
  ThemeNotFound,
} from "../features/themes/schema/themes.schema.ts";

/** One TextMate rule: the scopes it matches and what it paints them in. */
export interface TokenRule {
  readonly scope?: string | ReadonlyArray<string>;
  readonly settings?: { readonly foreground?: string };
}

/**
 * A VS Code theme, as far as core reads one: its scheme, its base colours, the
 * workbench `colors` map and its TextMate rules. Every field is optional
 * because themes in the wild leave any of them out.
 */
export interface Theme {
  readonly name?: string;
  readonly type?: ColorScheme;
  readonly fg?: string;
  readonly bg?: string;
  readonly colors?: Readonly<Record<string, string>>;
  readonly tokenColors?: ReadonlyArray<TokenRule>;
  /** The older TextMate spelling of `tokenColors`, which some themes keep. */
  readonly settings?: ReadonlyArray<TokenRule>;
}

/** A theme fetched by name, with the catalog entry it was listed under. */
export interface LoadedTheme {
  readonly descriptor: ThemeDescriptor;
  readonly theme: Theme;
}

export interface ThemeLibraryShape {
  /** Every theme on offer, in the order a picker lists them. */
  readonly themes: ReadonlyArray<ThemeDescriptor>;
  readonly load: (name: string) => Effect.Effect<LoadedTheme, ThemeNotFound>;
  /** A snippet tokenized with the grammar its fence names, coloured in `name`. */
  readonly highlight: (
    name: string,
    request: HighlightRequest
  ) => Effect.Effect<HighlightedCode, ThemeNotFound>;
}

export class ThemeLibrary extends Context.Service<
  ThemeLibrary,
  ThemeLibraryShape
>()("ThemeLibrary") {}
