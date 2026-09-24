/**
 * The colours code is set in outside a diff: the theme chosen for the scheme
 * on screen is loaded, read for its token colours (see `deriveSyntaxTokens`
 * in core) and set on the document as `--hljs-*`, which the stylesheet points
 * every fenced code block in markdown at.
 *
 * What this is really for is the card an LSP hover opens over a diff. Its
 * signature and documentation are markdown, coloured by highlight.js against
 * a stylesheet, while the code a millimetre behind it is coloured by Shiki
 * against the chosen theme — so on any theme but the app's own the two
 * disagreed, and the card kept showing GitHub's red keywords over a Dracula
 * or Nord diff.
 *
 * Unlike `--chrome-*` this runs inside the macOS shell as well as the
 * browser. The shell derives the window's palette on the server and hands it
 * to each island (see `NativePalette`), but a theme's token colours never
 * cross the API: only the page highlights code, so only the page needs them.
 *
 * The stylesheet's own palette stands until the first theme is read — loading
 * one is a fetch, and a card opened in the first moments of a session shows
 * GitHub's colours rather than none.
 */
import { deriveSyntaxTokens, loadTheme } from "@reviewer/core/themes";
import type { SyntaxTokens } from "@reviewer/core/themes";
import {
  readUiPrefs,
  subscribeUiPrefs,
  themeNameOf,
  type UiPrefs,
} from "@/lib/ui-prefs";

const derived = new Map<string, SyntaxTokens>();

export function startSyntaxTheme(): () => void {
  let current: string | undefined;
  const sync = (prefs: UiPrefs) => {
    const name = themeNameOf(prefs);
    if (name === current) return;
    current = name;
    const known = derived.get(name);
    if (known !== undefined) {
      apply(known);
      return;
    }
    const loading = loadTheme(name);
    if (loading === undefined) return;
    void loading.then((theme) => {
      const tokens = deriveSyntaxTokens(theme);
      derived.set(name, tokens);
      if (current === name) apply(tokens);
    });
  };
  sync(readUiPrefs());
  return subscribeUiPrefs(() => sync(readUiPrefs()));
}

function apply(tokens: SyntaxTokens) {
  const root = document.documentElement;
  for (const [role, color] of Object.entries(tokens))
    root.style.setProperty(`--hljs-${role}`, color);
}
