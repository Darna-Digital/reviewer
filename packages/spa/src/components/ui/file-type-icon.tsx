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

const HUE = {
  gray: "light-dark(#84848a, #adadb1)",
  red: "light-dark(#d52c36, #ff6762)",
  vermilion: "light-dark(#ff8c5b, #d5512f)",
  orange: "light-dark(#d47628, #ffa359)",
  yellow: "light-dark(#d5a910, #ffd452)",
  green: "light-dark(#199f43, #5ecc71)",
  teal: "light-dark(#17a5af, #64d1db)",
  cyan: "light-dark(#1ca1c7, #68cdf2)",
  blue: "light-dark(#1a85d4, #69b1ff)",
  indigo: "light-dark(#693acf, #9d6afb)",
  purple: "light-dark(#a631be, #d568ea)",
  pink: "light-dark(#d32a61, #ff678d)",
  mauve: "light-dark(#594c5b, #79697b)",
};

type Hue = keyof typeof HUE;

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

export function FileTypeIcon({
  path,
  className,
}: {
  readonly path: string;
  readonly className?: string;
}) {
  const icon = resolveIcon("file-tree-icon-file", path);
  const hue = TOKEN_HUE.get(icon.token ?? "default") ?? "gray";
  return (
    <svg
      aria-hidden
      viewBox={icon.viewBox ?? "0 0 16 16"}
      className={cn("size-4 shrink-0", className)}
      style={{ color: HUE[hue] }}
    >
      <use href={`#${icon.name}`} />
    </svg>
  );
}
