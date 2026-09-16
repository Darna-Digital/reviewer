import { parse, type Font } from "opentype.js";
import { commandsToPathData } from "./path-data";

export const FONT_WEIGHTS = [300, 400, 500, 600, 700] as const;
export type FontWeight = (typeof FONT_WEIGHTS)[number];

export const FONT_FAMILY = "Space Grotesk";

const fontUrl = (weight: FontWeight) => `/fonts/SpaceGrotesk-${weight}.ttf`;

export type LoadedFont = {
  weight: FontWeight;
  font: Font;
  unitsPerEm: number;
  capHeight: number;
};

const cache = new Map<FontWeight, Promise<LoadedFont>>();

// Exports have to be self-contained: an SVG that names a font renders as
// whatever the opening app has installed, and an SVG rasterised through an
// <img> never loads webfonts at all. So the wordmark is converted to outlines
// here, from the same TTFs the UI renders with.
export function loadFont(weight: FontWeight): Promise<LoadedFont> {
  const cached = cache.get(weight);
  if (cached) return cached;

  const pending = fetch(fontUrl(weight))
    .then((response) => {
      if (!response.ok)
        throw new Error(`Failed to load Space Grotesk ${weight}`);
      return response.arrayBuffer();
    })
    .then((buffer) => {
      const font = parse(buffer);
      const unitsPerEm = font.unitsPerEm;
      const capHeight = font.tables.os2?.sCapHeight || unitsPerEm * 0.7;
      return { weight, font, unitsPerEm, capHeight };
    });

  cache.set(weight, pending);
  return pending;
}

export type OutlinedText = {
  /** Path data with the baseline at y = 0 and the glyph box starting at x = 0. */
  d: string;
  width: number;
  capHeight: number;
};

export function outlineText(
  loaded: LoadedFont,
  text: string,
  capTarget: number,
  letterSpacing: number
): OutlinedText {
  const fontSize = (capTarget * loaded.unitsPerEm) / loaded.capHeight;
  const path = loaded.font.getPath(text, 0, 0, fontSize, {
    kerning: true,
    letterSpacing,
  });
  const box = path.getBoundingBox();
  const width = Number.isFinite(box.x2 - box.x1) ? box.x2 - box.x1 : 0;

  // Shift the side bearings away so the lockup gap is the gap you actually see.
  return {
    d: commandsToPathData(path.commands, -box.x1),
    width,
    capHeight: capTarget,
  };
}
