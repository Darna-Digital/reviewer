/**
 * The file-type icon the project tree wears, for surfaces outside the tree.
 *
 * @pierre/trees paints these inside its own shadow root, but the sprite it
 * ships is a plain `<symbol>` sheet: mounting one copy in the document lets any
 * `<use>` reach it. Its palette is declared on the tree element, so it is
 * restated here — the tokens and hues are the tree's own, kept in step with
 * `getBuiltInSpriteSheet` in `file-type-hues`. The icons the tree lacks (PHP,
 * Blade) come from `file-type-extra-icons` and share the sprite.
 */
import {
  createFileTreeIconResolver,
  getBuiltInSpriteSheet,
} from "@pierre/trees";
import {
  EXTRA_ICON_SYMBOLS,
  EXTRA_SYMBOL_PREFIX,
  extraIconToken,
  extraSpriteSheet,
} from "@/components/ui/file-type-extra-icons";
import { HUE, hueOf } from "@/components/ui/file-type-hues";
import { cn } from "@/lib/utils";

const ICON_SET = "complete";
const SPRITE_ID = "reviewer-file-icon-sprite";

const { resolveIcon } = createFileTreeIconResolver(ICON_SET);

const cssColor = ([light, dark]: readonly [string, string]) =>
  `light-dark(${light}, ${dark})`;

function mountSprite() {
  if (typeof document === "undefined") return;
  if (document.getElementById(SPRITE_ID) !== null) return;
  const host = document.createElement("div");
  host.id = SPRITE_ID;
  host.setAttribute(
    "style",
    "position:fixed;width:0;height:0;overflow:hidden;pointer-events:none"
  );
  host.innerHTML = getBuiltInSpriteSheet(ICON_SET) + extraSpriteSheet();
  document.body.append(host);
}

mountSprite();

const DEFAULT_VIEW_BOX = "0 0 16 16";

const resolveFileIcon = (path: string) => {
  const extra = extraIconToken(path);
  if (extra !== undefined) {
    return {
      name: `${EXTRA_SYMBOL_PREFIX}${extra}`,
      viewBox: EXTRA_ICON_SYMBOLS[extra].viewBox,
      hue: hueOf(extra),
    };
  }
  const icon = resolveIcon("file-tree-icon-file", path);
  return {
    name: icon.name,
    viewBox: icon.viewBox ?? DEFAULT_VIEW_BOX,
    hue: hueOf(icon.token ?? "default"),
  };
};

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
