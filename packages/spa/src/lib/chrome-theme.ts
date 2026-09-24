/**
 * The window's palette, in the browser: the theme chosen for the scheme on
 * screen is loaded, read for its chrome (see `deriveChromeTokens` in core)
 * and set on the document as `--chrome-*`, which the stylesheet's `.themed`
 * block points every surface token at.
 *
 * The app's own pair — Reviewer Light and Reviewer Dark, the defaults — is
 * not derived at all: on them the document is left to the stylesheet's own
 * palette, exactly as it stands, and whatever a theme had set is taken off.
 *
 * Inside the macOS shell this does nothing: there the window is the shell's,
 * the choice is made in its settings, and it sets the same properties on each
 * island itself (see `NativePalette`), from the same derivation run on the
 * server — one answer for the panels and the pages between them.
 *
 * Loading a theme is a fetch, and the first paint cannot wait for one, so the
 * chrome last derived for each scheme is kept in storage under the theme's
 * name and put back by the pre-paint script in `__root` — a reload comes up
 * in the theme it was in, and only a theme never seen before paints a frame
 * of the app's own palette first.
 */
import {
  deriveChromeTokens,
  loadTheme,
  reviewerThemes,
  type ChromeTokens,
  type ColorScheme,
} from "@reviewer/core/themes";
import { island } from "@/lib/shell";
import {
  readUiPrefs,
  subscribeUiPrefs,
  themeNameOf,
  type UiPrefs,
} from "@/lib/ui-prefs";

export const CHROME_KEY = "reviewer-chrome";

/** What storage holds: per scheme, the chrome of the theme it was derived from. */
type StoredChrome = Partial<
  Record<ColorScheme, { name: string; tokens: ChromeTokens }>
>;

const derived = new Map<string, ChromeTokens>();

export function startChromeTheme(): () => void {
  if (island !== undefined) return () => {};
  let current: string | undefined;
  const sync = (prefs: UiPrefs) => {
    const name = themeNameOf(prefs);
    if (name === current) return;
    current = name;
    if (reviewerThemes.hasTheme(name)) {
      clear();
      return;
    }
    const known = derived.get(name);
    if (known !== undefined) {
      apply(known);
      return;
    }
    const loading = loadTheme(name);
    if (loading === undefined) return;
    void loading.then((theme) => {
      const tokens = deriveChromeTokens(theme);
      derived.set(name, tokens);
      remember(prefs.resolvedTheme, name, tokens);
      if (current === name) apply(tokens);
    });
  };
  sync(readUiPrefs());
  return subscribeUiPrefs(() => sync(readUiPrefs()));
}

/** Each token as `--chrome-<kebab-name>`, the way the stylesheet reads it. */
export function chromeProperties(
  tokens: ChromeTokens
): ReadonlyArray<readonly [string, string]> {
  return Object.entries(tokens)
    .filter(([key]) => key !== "colorScheme")
    .map(([key, value]) => [
      `--chrome-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
      value,
    ]);
}

function apply(tokens: ChromeTokens) {
  const root = document.documentElement;
  for (const [name, value] of chromeProperties(tokens))
    root.style.setProperty(name, value);
  root.classList.add("themed");
}

function clear() {
  const root = document.documentElement;
  for (const name of Array.from(root.style))
    if (name.startsWith("--chrome-")) root.style.removeProperty(name);
  root.classList.remove("themed");
}

function remember(scheme: ColorScheme, name: string, tokens: ChromeTokens) {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(CHROME_KEY) ?? "{}"
    ) as StoredChrome;
    stored[scheme] = { name, tokens };
    window.localStorage.setItem(CHROME_KEY, JSON.stringify(stored));
  } catch {
    // Storage that is full or closed only costs the next load its first frame.
  }
}
