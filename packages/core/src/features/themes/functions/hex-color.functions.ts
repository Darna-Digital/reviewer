/**
 * The little colour arithmetic chrome derivation needs, on the `#rrggbb` /
 * `#rrggbbaa` strings a VS Code theme is written in — and on the
 * `color(display-p3 …)` form Pierre's vibrant themes use, which is brought
 * back to sRGB on the way in. Everything is handed on as hex: that is the
 * one form both a browser and AppKit read without a parser between them.
 */

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** 0–1. */
  readonly a: number;
}

export function parseHex(color: string | undefined): Rgba | undefined {
  if (color === undefined) return undefined;
  const p3 =
    /^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/i.exec(
      color.trim()
    );
  if (p3 !== null)
    return fromDisplayP3(
      Number(p3[1]),
      Number(p3[2]),
      Number(p3[3]),
      p3[4] === undefined ? 1 : Number(p3[4])
    );
  const hex = color.trim().replace(/^#/, "");
  const digits =
    hex.length === 3 || hex.length === 4
      ? [...hex].map((d) => d + d).join("")
      : hex;
  if (digits.length !== 6 && digits.length !== 8) return undefined;
  if (!/^[0-9a-f]+$/i.test(digits)) return undefined;
  const channel = (at: number) => parseInt(digits.slice(at, at + 2), 16);
  return {
    r: channel(0),
    g: channel(2),
    b: channel(4),
    a: digits.length === 8 ? channel(6) / 255 : 1,
  };
}

/**
 * Display P3 to sRGB, through linear XYZ, clipped to the sRGB gamut: a
 * vibrant theme's colours are meant to be a quarter wider than sRGB, and
 * the nearest sRGB colour is what a window that cannot show that gets.
 */
function fromDisplayP3(r: number, g: number, b: number, a: number): Rgba {
  const linear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const gamma = (c: number) => {
    const clipped = Math.max(0, Math.min(1, c));
    return clipped <= 0.0031308
      ? clipped * 12.92
      : 1.055 * clipped ** (1 / 2.4) - 0.055;
  };
  const [lr, lg, lb] = [linear(r), linear(g), linear(b)];
  const x = 0.4865709 * lr + 0.2656677 * lg + 0.1982173 * lb;
  const y = 0.2289746 * lr + 0.6917385 * lg + 0.0792869 * lb;
  const z = 0.0 * lr + 0.0451134 * lg + 1.0439444 * lb;
  const sr = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const sg = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const sb = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return { r: gamma(sr) * 255, g: gamma(sg) * 255, b: gamma(sb) * 255, a };
}

export function toHex({ r, g, b, a }: Rgba): string {
  const byte = (value: number) =>
    Math.round(Math.max(0, Math.min(255, value)))
      .toString(16)
      .padStart(2, "0");
  const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
  return a >= 1 ? rgb : `${rgb}${byte(a * 255)}`;
}

/** `from` moved `amount` (0–1) of the way to `to`, opaque. */
export function mix(from: Rgba, to: Rgba, amount: number): Rgba {
  const t = Math.max(0, Math.min(1, amount));
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t,
    a: 1,
  };
}

export function withAlpha(color: Rgba, alpha: number): Rgba {
  return { ...color, a: alpha };
}

/** A translucent colour flattened onto the surface it lies over. */
export function over(color: Rgba, surface: Rgba): Rgba {
  if (color.a >= 1) return color;
  return mix(surface, { ...color, a: 1 }, color.a);
}

/** WCAG relative luminance of an opaque colour, 0 (black) to 1 (white). */
export function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrast(a: Rgba, b: Rgba): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
export const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };
