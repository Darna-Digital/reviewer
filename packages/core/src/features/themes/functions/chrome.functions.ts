/**
 * From a theme to the window: which of a VS Code theme's workbench colours
 * paint which of the app's surfaces, settled once for every shell.
 *
 * A theme is written for an editor, not for this window, so the mapping is
 * a reading rather than a lookup. The editor's background is the sheet the
 * code rests on and the sidebar's is the frame the sheets stand on — the
 * two tones the window is made of — and everything else is either taken
 * from the theme where it names the thing (the accent, the link, the git
 * colours) or derived from those two tones where it does not (a control's
 * fill, the rules, the muted type). Where a theme does name a thing but
 * names it badly for this use — a control fill on the wrong side of the
 * sheet, a selection the same tone as the row, an accent that vanishes
 * against the page — the derived answer is preferred, so the ladder of
 * surfaces keeps its order whichever theme is on.
 */
import { colorUtils, normalizeThemeColors } from "@pierre/theming/color";
import type { ThemeLike } from "@pierre/theming";
import type { ChromeTokens, ColorScheme } from "../schema/themes.schema.ts";
import {
  BLACK,
  WHITE,
  contrast,
  luminance,
  mix,
  over,
  parseHex,
  toHex,
  withAlpha,
  type Rgba,
} from "./hex-color.functions.ts";

/** What stands in where a theme leaves a colour out entirely. */
const FALLBACK = {
  light: {
    island: "#ffffff",
    text: "#0a0a0a",
    accent: "#2563eb",
    added: "#2da160",
    modified: "#2563eb",
    deleted: "#d4453a",
  },
  dark: {
    island: "#141417",
    text: "#fafafa",
    accent: "#60a5fa",
    added: "#4cc38a",
    modified: "#60a5fa",
    deleted: "#f2645a",
  },
} as const;

/** How far the frame steps off the sheet when the theme gives it no tone. */
const FRAME_STEP = { light: 0.06, dark: 0.4 } as const;
/** How far a control steps off the sheet when the theme's own is unusable. */
const CONTROL_STEP = { light: 0.04, dark: 0.06 } as const;
/** How far a popover lifts off a control in the dark; in the light it sits on it. */
const POPOVER_STEP = 0.05;
/** A rule as a wash of the type colour over the surface. */
const SEPARATOR_ALPHA = { light: 0.1, dark: 0.12 } as const;
const HAIRLINE_ALPHA = { light: 0.05, dark: 0.07 } as const;
/** A row's hover as a wash of the type colour, where the theme has none. */
const HOVER_ALPHA = 0.08;
const SELECTION_ALPHA = 0.28;
/**
 * The least an accent may stand off the sheet and still read as a colour —
 * the accent is ink as well as fill (a lit tab's title, a link), so a focus
 * ring that only has to be seen as an edge is not enough.
 */
const MIN_ACCENT_CONTRAST = 3;
/**
 * The least the type may stand off the sheet. A theme is free to set its
 * code in a pale grey; the labels around it are not, and are inked darker
 * until they read.
 */
const MIN_TEXT_CONTRAST = 4;
/** The least two surfaces may differ and still be told apart. */
const MIN_STEP_CONTRAST = 1.04;

export function deriveChromeTokens(theme: ThemeLike): ChromeTokens {
  const { colors = {} } = normalizeThemeColors(theme);
  const read = (key: string): Rgba | undefined => parseHex(colors[key]);
  const scheme: ColorScheme =
    theme.type ??
    (colorUtils.isDarkSurface(colors["editor.background"]) ? "dark" : "light");
  const fallback = FALLBACK[scheme];
  // Shiki's normalizer mangles a `color(display-p3 …)` editor background
  // into a near-transparent hex on its way into `colors`, while the theme's
  // own `bg` keeps the original, so the sheet is read from either.
  const island =
    present([read("editor.background"), parseHex(theme.bg)]).find(
      (candidate) => candidate.a >= 1
    ) ?? hex(fallback.island);

  const frame = frameFor(island, read("sideBar.background"), scheme);
  const control = controlFor(
    island,
    [
      read("editorWidget.background"),
      read("input.background"),
      read("dropdown.background"),
    ],
    scheme
  );
  const popover =
    scheme === "dark" ? mix(control, WHITE, POPOVER_STEP) : control;

  const text = inked(
    readableOver(island, [read("editor.foreground"), parseHex(theme.fg)]) ??
      hex(fallback.text),
    island,
    scheme
  );
  const textSecondary =
    parseHex(colorUtils.deriveMutedFg(toHex(text), toHex(island))) ??
    mix(text, island, 0.4);
  const textTertiary = mix(textSecondary, island, 0.35);

  const accent =
    loudOver(island, [
      read("focusBorder"),
      read("button.background"),
      read("textLink.foreground"),
      read("gitDecoration.modifiedResourceForeground"),
    ]) ?? hex(fallback.accent);
  const link = loudOver(island, [read("textLink.foreground")]) ?? accent;

  const hover = rowTone(
    island,
    [read("list.inactiveSelectionBackground"), read("list.hoverBackground")],
    withAlpha(text, HOVER_ALPHA),
    scheme
  );
  const selection = rowTone(
    island,
    [read("list.activeSelectionBackground")],
    withAlpha(accent, SELECTION_ALPHA),
    scheme
  );

  return {
    colorScheme: scheme,
    frame: toHex(frame),
    island: toHex(island),
    control: toHex(control),
    popover: toHex(popover),
    text: toHex(text),
    textSecondary: toHex(textSecondary),
    textTertiary: toHex(textTertiary),
    separator: toHex(withAlpha(text, SEPARATOR_ALPHA[scheme])),
    hairline: toHex(withAlpha(text, HAIRLINE_ALPHA[scheme])),
    accent: toHex(accent),
    link: toHex(link),
    selection: toHex(selection),
    hover: toHex(hover),
    added: toHex(
      read("gitDecoration.addedResourceForeground") ?? hex(fallback.added)
    ),
    modified: toHex(
      read("gitDecoration.modifiedResourceForeground") ?? hex(fallback.modified)
    ),
    deleted: toHex(
      read("gitDecoration.deletedResourceForeground") ?? hex(fallback.deleted)
    ),
  };
}

const hex = (color: string): Rgba => parseHex(color)!;

const present = (candidates: ReadonlyArray<Rgba | undefined>): Rgba[] =>
  candidates.filter((candidate): candidate is Rgba => candidate !== undefined);

/**
 * The sidebar's tone where the theme has one of its own; otherwise a step
 * away from the sheet, towards black in both schemes — the frame is what the
 * sheets are held off, and in the light theme that is a grey surround, in
 * the dark the near-black behind the panels.
 */
function frameFor(
  island: Rgba,
  sidebar: Rgba | undefined,
  scheme: ColorScheme
): Rgba {
  if (
    sidebar !== undefined &&
    sidebar.a >= 1 &&
    contrast(sidebar, island) >= MIN_STEP_CONTRAST
  )
    return sidebar;
  return mix(island, BLACK, FRAME_STEP[scheme]);
}

/**
 * The first of the theme's control fills that stands on the right side of
 * the sheet — above it in the dark, below it in the light — so the ladder
 * the app stacks its surfaces on keeps its order. A theme whose widgets sink
 * below its editor gets a fill mixed a step the right way instead.
 */
function controlFor(
  island: Rgba,
  candidates: ReadonlyArray<Rgba | undefined>,
  scheme: ColorScheme
): Rgba {
  const dark = scheme === "dark";
  const lifted = present(candidates)
    .map((candidate) => over(candidate, island))
    .find((candidate) => {
      const step = luminance(candidate) - luminance(island);
      return (
        contrast(candidate, island) >= MIN_STEP_CONTRAST &&
        (dark ? step > 0 : step < 0)
      );
    });
  return lifted ?? mix(island, dark ? WHITE : BLACK, CONTROL_STEP[scheme]);
}

/** The first candidate that reads as type over the surface. */
function readableOver(
  surface: Rgba,
  candidates: ReadonlyArray<Rgba | undefined>
): Rgba | undefined {
  const legible = colorUtils.pickReadableForeground(
    toHex(surface),
    present(candidates).map((candidate) => toHex(over(candidate, surface)))
  );
  return parseHex(legible);
}

/** The type moved towards its pole, a step at a time, until it reads. */
function inked(text: Rgba, surface: Rgba, scheme: ColorScheme): Rgba {
  const pole = scheme === "dark" ? WHITE : BLACK;
  let candidate = text;
  for (
    let step = 0.1;
    contrast(candidate, surface) < MIN_TEXT_CONTRAST && step <= 1;
    step += 0.1
  )
    candidate = mix(text, pole, step);
  return candidate;
}

/** The first candidate that still reads as a colour against the surface. */
function loudOver(
  surface: Rgba,
  candidates: ReadonlyArray<Rgba | undefined>
): Rgba | undefined {
  return present(candidates)
    .map((candidate) => over(candidate, surface))
    .find((candidate) => contrast(candidate, surface) >= MIN_ACCENT_CONTRAST);
}

/**
 * A row's fill, flattened onto the sheet: the theme's own where it can be
 * told from the row it is on and lifts the same way a control does, else
 * the given wash laid over the sheet. A theme whose hover sinks below its
 * editor is right in its own editor and wrong here, where every fill on
 * the sheet lifts off it.
 */
function rowTone(
  island: Rgba,
  candidates: ReadonlyArray<Rgba | undefined>,
  wash: Rgba,
  scheme: ColorScheme
): Rgba {
  const dark = scheme === "dark";
  const own = present(candidates)
    .map((candidate) => over(candidate, island))
    .find((candidate) => {
      const step = luminance(candidate) - luminance(island);
      return (
        contrast(candidate, island) >= MIN_STEP_CONTRAST &&
        (dark ? step > 0 : step < 0)
      );
    });
  return own ?? over(wash, island);
}
