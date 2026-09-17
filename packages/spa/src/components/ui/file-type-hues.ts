/**
 * The hue each of @pierre/trees' file-type icons is painted in, in both
 * palettes. Kept apart from the icon component because the native shell
 * imports the same table: `packages/mac-os/scripts/import-file-icons.mjs`
 * reads it alongside the sprite, so a file is the same colour in the web tree
 * and in the native one.
 */

/** Each hue in both palettes, the light one first. */
export const HUE = {
  gray: ["#84848a", "#adadb1"],
  red: ["#d52c36", "#ff6762"],
  vermilion: ["#ff8c5b", "#d5512f"],
  orange: ["#d47628", "#ffa359"],
  yellow: ["#d5a910", "#ffd452"],
  green: ["#199f43", "#5ecc71"],
  teal: ["#17a5af", "#64d1db"],
  cyan: ["#1ca1c7", "#68cdf2"],
  blue: ["#1a85d4", "#69b1ff"],
  indigo: ["#693acf", "#9d6afb"],
  purple: ["#a631be", "#d568ea"],
  pink: ["#d32a61", "#ff678d"],
  mauve: ["#594c5b", "#79697b"],
} as const satisfies Record<string, readonly [string, string]>;

export type Hue = keyof typeof HUE;

export const HUE_TOKENS: Record<Hue, ReadonlyArray<string>> = {
  gray: ["default", "text"],
  red: ["npm", "postcss", "ruby", "svelte", "yml"],
  vermilion: ["git"],
  orange: ["claude", "html", "json", "rust", "svg", "swift", "zig", "zip"],
  yellow: ["babel", "browserslist", "javascript"],
  green: ["bash", "markdown", "svgo", "vue"],
  teal: ["mcp", "prettier", "table"],
  cyan: ["go", "oxc", "react", "tailwind"],
  blue: [
    "biome",
    "c",
    "cpp",
    "docker",
    "python",
    "typescript",
    "vscode",
    "webpack",
  ],
  indigo: ["bootstrap", "css", "eslint", "terraform", "wasm"],
  purple: ["astro", "database", "vite"],
  pink: ["graphql", "image", "sass"],
  mauve: ["bun"],
};

/** The hue a token is painted in; gray for one the table does not name. */
export const hueOf = (token: string): Hue =>
  (Object.keys(HUE_TOKENS) as ReadonlyArray<Hue>).find((hue) =>
    HUE_TOKENS[hue].includes(token)
  ) ?? "gray";
