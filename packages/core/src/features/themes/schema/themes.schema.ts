/**
 * The shapes a theme is talked about in across the app: what the catalog
 * says about one before it is loaded, and the chrome — the handful of
 * colours the window around the code is painted in — derived from one once
 * it is. A theme's own JSON never crosses the API: the server derives the
 * chrome and hands back only that, which is all a shell needs to paint.
 */
import * as Schema from "effect/Schema";

export const ColorScheme = Schema.Literals(["light", "dark"]);
export type ColorScheme = typeof ColorScheme.Type;

/** A catalog entry: enough to list a theme in a picker without loading it. */
export const ThemeDescriptor = Schema.Struct({
  name: Schema.String,
  displayName: Schema.String,
  colorScheme: ColorScheme,
  /** Where the theme comes from — `reviewer`, `pierre` or `shiki`. */
  collection: Schema.String,
});
export type ThemeDescriptor = typeof ThemeDescriptor.Type;

/**
 * The window's palette as one theme colours it. Every value is a CSS colour
 * — `#rrggbb`, or `#rrggbbaa` where a tone is laid over another — so the
 * same tokens paint a web view's custom properties and an AppKit window's
 * `NSColor`s. The vocabulary is the app's own surfaces, not the theme's
 * workbench keys: which key becomes what is settled once, in
 * `deriveChromeTokens`, and every consumer reads the answer.
 */
export const ChromeTokens = Schema.Struct({
  colorScheme: ColorScheme,
  /** What the islands stand on — the window behind the sheets. */
  frame: Schema.String,
  /** The sheet every code surface rests on: the editor's own background. */
  island: Schema.String,
  /** One step off the sheet — cards, inputs, the chips on a bar. */
  control: Schema.String,
  /** What stands above the page — menus, popovers, tooltips. */
  popover: Schema.String,
  text: Schema.String,
  textSecondary: Schema.String,
  textTertiary: Schema.String,
  /** The edge of a control, and the rule between two regions. */
  separator: Schema.String,
  /** The lighter line drawn inside one surface. */
  hairline: Schema.String,
  /** The one loud colour: the filled button, the focus ring, the checked box. */
  accent: Schema.String,
  link: Schema.String,
  /** A row that is selected and has the focus. */
  selection: Schema.String,
  /** A row under the pointer, or selected without the focus. */
  hover: Schema.String,
  added: Schema.String,
  modified: Schema.String,
  deleted: Schema.String,
});
export type ChromeTokens = typeof ChromeTokens.Type;

/** A theme resolved for a shell: what it is, and what to paint with. */
export const ThemeChrome = Schema.Struct({
  theme: ThemeDescriptor,
  chrome: ChromeTokens,
});
export type ThemeChrome = typeof ThemeChrome.Type;

export const ThemeNameParam = Schema.Struct({ name: Schema.String });

export class ThemeNotFound extends Schema.TaggedErrorClass<ThemeNotFound>()(
  "ThemeNotFound",
  { name: Schema.String },
  { httpApiStatus: 404 }
) {
  override get message(): string {
    return `No theme named "${this.name}"`;
  }
}
