/**
 * The face code is set in, and whether it has arrived.
 *
 * `@pierre/diffs` measures a file once and lays the whole diff out from those
 * metrics. The faces on offer are web fonts, served — as fontsource serves
 * them — with `font-display: swap`, so a diff opened before one lands is
 * measured in the platform's mono and then measured again, every line of
 * every file, the moment the real face swaps in. On a large diff that second
 * pass is the stall.
 *
 * So the surfaces that draw code wait for the face rather than race it, and
 * asking for it is also what fetches it: a browser loads a face on first use,
 * and `document.fonts.load` counts as a use. A frame of nothing beats laying
 * the whole diff out twice.
 *
 * The wait is capped. A face that is slow, missing or blocked leaves the
 * fallback standing, which is the reading the page would have had anyway.
 */
import { useEffect, useState } from "react";

/** Long enough for a face served beside the app; past it, the fallback wins. */
const LOAD_TIMEOUT_MS = 2_000;

/**
 * The cuts a diff actually draws: body text, the bold a header sets its
 * filename in, and the italic most themes give comments.
 */
const FACES = ["400", "700", "italic 400"];

const settled = new Set<string>();
const loading = new Map<string, Promise<void>>();

/**
 * The chosen family — the first name in `--font-code`, which the stylesheet
 * declares and the macOS shell overwrites on the document (see
 * `NativePalette.applyScript`). Read once per waiting view rather than per
 * render: it is a computed style, and reading one costs a style flush.
 */
function codeFontFamily(): string | null {
  if (typeof document === "undefined") return null;
  const declared = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-code")
    .split(",")[0];
  const family = declared?.trim().replace(/^["']|["']$/g, "") ?? "";
  return family === "" ? null : family;
}

function load(family: string): Promise<void> {
  const held = loading.get(family);
  if (held !== undefined) return held;
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  const faces =
    fonts === undefined
      ? Promise.resolve()
      : Promise.all(
          FACES.map((face) => fonts.load(`${face} 1em "${family}"`))
        ).then(() => undefined);
  const capped = Promise.race([
    faces,
    new Promise<void>((resolve) => setTimeout(resolve, LOAD_TIMEOUT_MS)),
  ])
    // A family the browser has no face for — the system's own mono, say —
    // resolves with nothing rather than failing, so a rejection here is a
    // genuine failure to load, and the fallback is the answer either way.
    .catch(() => undefined)
    .then(() => {
      settled.add(family);
    });
  loading.set(family, capped);
  return capped;
}

/**
 * Start the code face downloading. Called as the app boots so the face is
 * usually in hand by the time a diff is opened, rather than fetched on the
 * first file that needs measuring.
 */
export function primeCodeFont(): void {
  const family = codeFontFamily();
  if (family !== null) void load(family);
}

/**
 * Whether code can be measured in the face it will be read in — the answer a
 * view holds its first render for.
 *
 * The family is read once, when the view mounts: a face chosen mid-session
 * costs that one swap, which is a deliberate act with nothing on screen
 * waiting on it.
 */
export function useCodeFontReady(): boolean {
  const [family] = useState(codeFontFamily);
  const [ready, setReady] = useState(
    () => family === null || settled.has(family)
  );
  useEffect(() => {
    if (ready || family === null) return;
    let cancelled = false;
    void load(family).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [family, ready]);
  return ready;
}
