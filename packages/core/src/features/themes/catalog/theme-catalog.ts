/**
 * Every theme the app offers, in the order a picker lists them: the app's
 * own pair first, then Pierre's, then the ones Shiki bundles — Tokyo Night,
 * Catppuccin, Dracula, Nord, Solarized and the rest. The catalog is the one
 * list both the web app and the server read, so a name chosen in either
 * shell resolves to the same theme wherever code is drawn.
 *
 * The app's own themes are GitHub's token colours on the window's own
 * surfaces: the white sheet in the grey surround, the near-black sheet on
 * the true-black frame, and the app's grey type and blue accent — so the
 * window comes up as it always has, and choosing another theme is a change
 * from that rather than from GitHub's bluish grey. Listing a theme never
 * loads it; each descriptor carries a lazy `load`, and only the one on
 * screen is ever fetched.
 */
import {
  createThemeCatalog,
  createThemeCollection,
  type ThemeDescriptor as CatalogEntry,
  type ThemeLike,
} from "@pierre/theming";
import { createTheme, pierreThemes, shikiThemes } from "@pierre/theming/themes";
import type { ColorScheme, ThemeDescriptor } from "../schema/themes.schema.ts";

export const DEFAULT_LIGHT_THEME = "reviewer-light";
export const DEFAULT_DARK_THEME = "reviewer-dark";

const REVIEWER_COLLECTION = "reviewer";

/**
 * The window's surfaces, as the SPA's stylesheet paints them, in the
 * workbench keys `deriveChromeTokens` reads.
 */
const REVIEWER_LIGHT_COLORS = {
  "editor.background": "#ffffff",
  "editor.foreground": "#0a0a0a",
  "sideBar.background": "#f0f0f3",
  "editorWidget.background": "#fcfcfc",
  "input.background": "#fcfcfc",
  descriptionForeground: "#737373",
  focusBorder: "#00a6f4",
  "button.background": "#00a6f4",
  "textLink.foreground": "#006faa",
  "list.hoverBackground": "#f5f5f5",
  "list.inactiveSelectionBackground": "#f5f5f5",
  "list.activeSelectionBackground": "#dbeefc",
  "gitDecoration.addedResourceForeground": "#249057",
  "gitDecoration.modifiedResourceForeground": "#00a6f4",
  "gitDecoration.deletedResourceForeground": "#dd2d34",
};

const REVIEWER_DARK_COLORS = {
  "editor.background": "#141417",
  "editor.foreground": "#fafafa",
  "sideBar.background": "#000000",
  "editorWidget.background": "#1e1e1e",
  "input.background": "#1e1e1e",
  descriptionForeground: "#a1a1a1",
  focusBorder: "#5abeff",
  "button.background": "#5abeff",
  "textLink.foreground": "#94d5ff",
  "list.hoverBackground": "#262626",
  "list.inactiveSelectionBackground": "#262626",
  "list.activeSelectionBackground": "#1d3247",
  "gitDecoration.addedResourceForeground": "#45bf82",
  "gitDecoration.modifiedResourceForeground": "#5abeff",
  "gitDecoration.deletedResourceForeground": "#f86a6b",
};

/** A Shiki theme's tokens on the window's own surfaces. */
function reviewerTheme(
  name: string,
  displayName: string,
  colorScheme: ColorScheme,
  base: string,
  colors: Record<string, string>
): CatalogEntry {
  const source = shikiThemes.getTheme(base);
  if (source === undefined)
    throw new Error(`Base theme ${base} is not bundled`);
  return createTheme({
    name,
    displayName,
    colorScheme,
    collection: REVIEWER_COLLECTION,
    load: async () => {
      const theme = unwrap(await source.load());
      return {
        ...theme,
        name,
        displayName,
        bg: colors["editor.background"],
        fg: colors["editor.foreground"],
        colors: { ...theme.colors, ...colors },
      };
    },
  });
}

export const reviewerThemes = createThemeCollection({
  themes: [
    reviewerTheme(
      DEFAULT_LIGHT_THEME,
      "Reviewer Light",
      "light",
      "github-light",
      REVIEWER_LIGHT_COLORS
    ),
    reviewerTheme(
      DEFAULT_DARK_THEME,
      "Reviewer Dark",
      "dark",
      "github-dark",
      REVIEWER_DARK_COLORS
    ),
  ],
});

export const themeCatalog = createThemeCatalog({
  themes: [reviewerThemes, pierreThemes, shikiThemes],
  defaultLightThemeName: DEFAULT_LIGHT_THEME,
  defaultDarkThemeName: DEFAULT_DARK_THEME,
});

/** The catalog as the API says it: names, labels and where each is from. */
export function describeThemes(): ThemeDescriptor[] {
  return themeCatalog.getThemes().map(describeTheme);
}

export function describeTheme(entry: CatalogEntry): ThemeDescriptor {
  return {
    name: entry.name,
    displayName: entry.displayName ?? titleCase(entry.name),
    colorScheme: entry.colorScheme ?? "dark",
    collection: entry.collection ?? "shiki",
  };
}

/** The catalog's entry for a name, or nothing for a name it does not know. */
export function findTheme(name: string): CatalogEntry | undefined {
  return themeCatalog.getTheme(name);
}

/** A name the catalog knows, or the scheme's default when it does not. */
export function themeNameOrDefault(
  name: string | undefined,
  scheme: ColorScheme
): string {
  const wanted = findTheme(name ?? "");
  if (wanted !== undefined && (wanted.colorScheme ?? "dark") === scheme)
    return wanted.name;
  return scheme === "dark" ? DEFAULT_DARK_THEME : DEFAULT_LIGHT_THEME;
}

const loaded = new Map<string, Promise<ThemeLike>>();

/**
 * The theme itself, normalized, loaded once per name and served from memory
 * after — a picker that is walked with the arrow keys resolves each theme
 * as it lands on it, and the second visit should cost nothing.
 */
export function loadTheme(name: string): Promise<ThemeLike> | undefined {
  const entry = findTheme(name);
  if (entry === undefined) return undefined;
  const pending = loaded.get(name);
  if (pending !== undefined) return pending;
  const loading = entry
    .load()
    .then(unwrap)
    .catch((error: unknown) => {
      loaded.delete(name);
      throw error;
    });
  loaded.set(name, loading);
  return loading;
}

/** A loader may answer with the module it imported rather than the theme. */
function unwrap(answer: ThemeLike | { default: ThemeLike }): ThemeLike {
  return "default" in answer ? answer.default : answer;
}

/** `tokyo-night` → `Tokyo Night`, for the Shiki themes that carry no label. */
function titleCase(name: string): string {
  return name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
