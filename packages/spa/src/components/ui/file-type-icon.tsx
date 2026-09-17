/**
 * The file-type icon the project tree wears, for surfaces outside the tree.
 *
 * @pierre/trees paints these inside its own shadow root, but the sprite it
 * ships is a plain `<symbol>` sheet: mounting one copy in the document lets any
 * `<use>` reach it. Its palette is declared on the tree element, so it is
 * restated here — the tokens and hues are the tree's own, kept in step with
 * `getBuiltInSpriteSheet`.
 */
import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from "@pierre/trees";
import { cn } from "@/lib/utils";

const ICON_SET = "complete";
const SPRITE_ID = "reviewer-file-icon-sprite";

const { resolveIcon } = createFileTreeIconResolver(ICON_SET);

/** Each hue in both palettes, the light one first. */
const HUE = {
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

type Hue = keyof typeof HUE;

const cssColor = ([light, dark]: readonly [string, string]) =>
  `light-dark(${light}, ${dark})`;

const HUE_TOKENS: Record<Hue, ReadonlyArray<string>> = {
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

const TOKEN_HUE = new Map<string, Hue>(
  Object.entries(HUE_TOKENS).flatMap(([hue, tokens]) =>
    tokens.map((token) => [token, hue as Hue] as const)
  )
);

function mountSprite() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPRITE_ID) !== null) return;
  const host = document.createElement("div");
  host.id = SPRITE_ID;
  host.setAttribute(
    "style",
    "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none"
  );
  host.innerHTML = getBuiltInSpriteSheet(ICON_SET);
  document.body.append(host);
}

mountSprite();

const DEFAULT_VIEW_BOX = "0 0 16 16";

const resolveFileIcon = (path: string) => {
  const icon = resolveIcon("file-tree-icon-file", path);
  return {
    name: icon.name,
    viewBox: icon.viewBox ?? DEFAULT_VIEW_BOX,
    hue: TOKEN_HUE.get(icon.token ?? "default") ?? "gray",
  };
};

export interface FileIconMarkup {
  /** A standalone `<svg>` of the icon, painting in `currentColor`. */
  readonly svg: string;
  readonly light: string;
  readonly dark: string;
}

/**
 * The same icon as a document of its own, for a surface that has no DOM to
 * `<use>` the sprite from — the native shell's tab strip. The symbol's body is
 * lifted out of the mounted sprite; the hue comes as two colours rather than
 * `light-dark()`, which only a stylesheet can read.
 */
export function fileIconMarkup(path: string): FileIconMarkup {
  const icon = resolveFileIcon(path);
  const body =
    typeof document === "undefined"
      ? ""
      : (document.getElementById(icon.name)?.innerHTML ?? "");
  const [light, dark] = HUE[icon.hue];
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}">${body}</svg>`,
    light,
    dark,
  };
}

export function FileTypeIcon({
  path,
  className,
}: {
  readonly path: string;
  readonly className?: string;
}) {
  const icon = resolveFileIcon(path);
  return (
    <svg
      aria-hidden
      viewBox={icon.viewBox}
      className={cn("size-4 shrink-0", className)}
      style={{ color: cssColor(HUE[icon.hue]) }}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}

export function TreeChevronIcon({
  className,
}: {
  readonly className?: string;
}) {
  const icon = resolveIcon("file-tree-icon-chevron");
  return (
    <svg
      aria-hidden
      viewBox={icon.viewBox ?? DEFAULT_VIEW_BOX}
      className={cn("size-4 shrink-0", className)}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
