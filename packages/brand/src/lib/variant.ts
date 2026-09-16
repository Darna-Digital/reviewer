import type { BrandConfig } from "@/brand/config";
import type { OutlinedText } from "@/brand/font";
import { buildScene } from "@/brand/geometry";
import { renderSvg, svgDataUrl } from "@/brand/svg";

/** The current design re-rendered for a context that needs a different shape. */
export function variantUrl(
  config: BrandConfig,
  text: OutlinedText | null,
  overrides: Partial<BrandConfig> = {}
) {
  const merged = { ...config, ...overrides };
  return svgDataUrl(renderSvg(buildScene(merged, text), merged));
}
