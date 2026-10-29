/**
 * A theme's workbench colours with the gaps a theme leaves filled in, before
 * the chrome is read from them.
 *
 * A VS Code theme names only what it cares about and lets the editor fall
 * back for the rest: no sidebar tone means the editor's, no git colours means
 * the terminal's ANSI slots or the gutter's. These are those same fallback
 * chains, limited to the keys `deriveChromeTokens` reads, so a theme that
 * leans on them is read the way an editor would draw it rather than as if
 * it named nothing at all. The one repair is a hover that would vanish: a
 * row hover that is the sidebar's own tone, or nearer the row's text than its
 * surface, is dropped so the derived tone stands in.
 */
import type { Theme } from "../../../ports/theme-library.ts";
import { luminance, parseHex } from "./hex-color.functions.ts";

export function resolveWorkbenchColors(
  theme: Theme
): Readonly<Record<string, string>> {
  const named = theme.colors ?? {};
  const colors: Record<string, string> = { ...named };
  const editorBackground = named["editor.background"] ?? theme.bg;
  const editorForeground = named["editor.foreground"] ?? theme.fg;
  const sidebarBackground = named["sideBar.background"] ?? editorBackground;
  const sidebarForeground = named["sideBar.foreground"] ?? editorForeground;

  fill(colors, "editor.background", editorBackground);
  fill(colors, "editor.foreground", editorForeground);
  fill(colors, "sideBar.background", sidebarBackground);
  fill(
    colors,
    "input.background",
    named["input.background"] ?? sidebarBackground
  );
  fill(
    colors,
    "gitDecoration.addedResourceForeground",
    firstNamed(
      named["gitDecoration.addedResourceForeground"],
      named["terminal.ansiGreen"],
      named["editorGutter.addedBackground"]
    )
  );
  fill(
    colors,
    "gitDecoration.modifiedResourceForeground",
    firstNamed(
      named["gitDecoration.modifiedResourceForeground"],
      named["terminal.ansiBlue"],
      named["editorGutter.modifiedBackground"]
    )
  );
  fill(
    colors,
    "gitDecoration.deletedResourceForeground",
    firstNamed(
      named["gitDecoration.deletedResourceForeground"],
      named["terminal.ansiRed"],
      named["editorGutter.deletedBackground"]
    )
  );

  const hover = named["list.hoverBackground"];
  if (
    hover !== undefined &&
    (sameColor(hover, sidebarBackground) ||
      erasesText(hover, sidebarBackground, sidebarForeground))
  )
    delete colors["list.hoverBackground"];
  return colors;
}

function fill(
  colors: Record<string, string>,
  key: string,
  value: string | undefined
): void {
  if (value !== undefined && value !== "") colors[key] = value;
}

function firstNamed(
  ...candidates: ReadonlyArray<string | undefined>
): string | undefined {
  return candidates.find(
    (candidate) => candidate !== undefined && candidate !== ""
  );
}

function sameColor(a: string, b: string | undefined): boolean {
  return b !== undefined && a.toLowerCase() === b.toLowerCase();
}

/** Whether a hover lands nearer the row's text than the row it lies on. */
function erasesText(
  hover: string,
  surface: string | undefined,
  text: string | undefined
): boolean {
  const lit = parseHex(hover);
  const under = parseHex(surface);
  const ink = parseHex(text);
  if (lit === undefined || under === undefined || ink === undefined)
    return false;
  const hoverLuminance = luminance(lit);
  return (
    Math.abs(hoverLuminance - luminance(ink)) <
    Math.abs(hoverLuminance - luminance(under))
  );
}
