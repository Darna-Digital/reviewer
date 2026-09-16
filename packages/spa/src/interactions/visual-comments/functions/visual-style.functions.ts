/**
 * The properties the style inspector exposes on a picked element, and the pure
 * helpers around editing them.
 *
 * The catalogue is deliberately short: a reviewer tweaking a page wants the
 * things a designer reaches for — spacing, colour, type, the box — not the whole
 * of CSS. Every property here is read as a computed value in the guest when the
 * element is picked, so the fields open showing what the element actually looks
 * like rather than blank.
 */
import type { StyleChange } from "@reviewer/core/visual-comments";

export type StyleControl =
  /** A number with a unit: `16px`, `1.5rem`, `50%` — or a keyword like `auto`. */
  | {
      readonly kind: "length";
      readonly units: ReadonlyArray<string>;
      readonly keywords: ReadonlyArray<string>;
      readonly min?: number;
    }
  | { readonly kind: "color" }
  | {
      readonly kind: "select";
      readonly options: ReadonlyArray<{ value: string; label: string }>;
    }
  /** A handful of exclusive choices, drawn as a row of icons. */
  | { readonly kind: "segment"; readonly options: ReadonlyArray<string> }
  /** A 0–1 property shown as a percentage slider. */
  | { readonly kind: "fraction" };

export interface StyleProperty {
  readonly name: string;
  readonly label: string;
  readonly control: StyleControl;
}

/**
 * A row of the inspector. Which properties sit together is a layout decision
 * — width beside height, the four margins as one control — so the catalogue
 * carries it rather than leaving the panel to guess from names.
 */
export type StyleRow =
  | { readonly kind: "field"; readonly property: StyleProperty }
  | {
      readonly kind: "pair";
      readonly properties: readonly [StyleProperty, StyleProperty];
    }
  | {
      readonly kind: "sides";
      readonly label: string;
      /** Top, right, bottom, left — the CSS order. */
      readonly properties: readonly [
        StyleProperty,
        StyleProperty,
        StyleProperty,
        StyleProperty,
      ];
    };

export interface StyleGroup {
  readonly id: string;
  readonly label: string;
  readonly rows: ReadonlyArray<StyleRow>;
}

export const LENGTH_UNITS = ["px", "rem", "em", "%", "vw", "vh"] as const;

const length = (
  name: string,
  label = name,
  keywords: ReadonlyArray<string> = [],
  extra: { min?: number; units?: ReadonlyArray<string> } = {}
): StyleProperty => ({
  name,
  label,
  control: {
    kind: "length",
    units: extra.units ?? LENGTH_UNITS,
    keywords,
    ...(extra.min !== undefined ? { min: extra.min } : {}),
  },
});
const color = (name: string, label = name): StyleProperty => ({
  name,
  label,
  control: { kind: "color" },
});
const select = (
  name: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  label = name
): StyleProperty => ({ name, label, control: { kind: "select", options } });
const segment = (
  name: string,
  options: ReadonlyArray<string>,
  label = name
): StyleProperty => ({ name, label, control: { kind: "segment", options } });

const field = (property: StyleProperty): StyleRow => ({
  kind: "field",
  property,
});
const pair = (a: StyleProperty, b: StyleProperty): StyleRow => ({
  kind: "pair",
  properties: [a, b],
});
const sides = (
  label: string,
  prefix: string,
  keywords: ReadonlyArray<string> = []
): StyleRow => ({
  kind: "sides",
  label,
  properties: [
    length(`${prefix}-top`, "top", keywords),
    length(`${prefix}-right`, "right", keywords),
    length(`${prefix}-bottom`, "bottom", keywords),
    length(`${prefix}-left`, "left", keywords),
  ],
});

export const FONT_WEIGHTS = [
  { value: "100", label: "Thin" },
  { value: "200", label: "Extra light" },
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra bold" },
  { value: "900", label: "Black" },
] as const;

const DISPLAYS = [
  "block",
  "inline",
  "inline-block",
  "flex",
  "inline-flex",
  "grid",
  "none",
].map((value) => ({ value, label: value }));

/**
 * Ordered by how often a visual note is about them: colour first, then type,
 * then the box and its layout.
 */
export const STYLE_GROUPS: ReadonlyArray<StyleGroup> = [
  {
    id: "text",
    label: "Text",
    rows: [
      field(color("color")),
      pair(
        length("font-size", "size", [], { min: 0 }),
        select("font-weight", FONT_WEIGHTS, "weight")
      ),
      pair(
        length("line-height", "line", ["normal"], {
          units: ["px", "rem", "em", "%", ""],
        }),
        length("letter-spacing", "tracking", ["normal"])
      ),
      field(
        segment("text-align", ["left", "center", "right", "justify"], "align")
      ),
    ],
  },
  {
    id: "surface",
    label: "Surface",
    rows: [
      field(color("background-color", "fill")),
      field(color("border-color", "border")),
      pair(
        length("border-width", "width", [], { min: 0 }),
        length("border-radius", "radius", [], { min: 0 })
      ),
      field({
        name: "opacity",
        label: "opacity",
        control: { kind: "fraction" },
      }),
    ],
  },
  {
    id: "size",
    label: "Size",
    rows: [
      pair(
        length("width", "W", ["auto", "fit-content", "max-content"], {
          min: 0,
        }),
        length("height", "H", ["auto", "fit-content", "max-content"], {
          min: 0,
        })
      ),
    ],
  },
  {
    id: "spacing",
    label: "Spacing",
    rows: [sides("margin", "margin", ["auto"]), sides("padding", "padding")],
  },
  {
    id: "layout",
    label: "Layout",
    rows: [
      field(select("display", DISPLAYS)),
      field(
        segment(
          "flex-direction",
          ["row", "column", "row-reverse", "column-reverse"],
          "direction"
        )
      ),
      field(
        segment(
          "justify-content",
          [
            "flex-start",
            "center",
            "flex-end",
            "space-between",
            "space-around",
            "space-evenly",
          ],
          "justify"
        )
      ),
      field(
        segment(
          "align-items",
          ["flex-start", "center", "flex-end", "stretch", "baseline"],
          "align"
        )
      ),
      field(length("gap", "gap", ["normal"], { min: 0 })),
    ],
  },
];

export const rowProperties = (row: StyleRow): ReadonlyArray<StyleProperty> =>
  row.kind === "field" ? [row.property] : row.properties;

export const STYLE_PROPERTIES: ReadonlyArray<string> = STYLE_GROUPS.flatMap(
  (group) =>
    group.rows.flatMap((row) =>
      rowProperties(row).map((property) => property.name)
    )
);

/** The picked element's computed values, one per catalogued property. */
export type ComputedStyles = Readonly<Record<string, string>>;

/** The reviewer's edits so far, keyed by property — only what differs. */
export type StyleEdits = Readonly<Record<string, string>>;

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNCTION = /^([a-z-]+)\((.*)\)$/i;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/** `12`, `12%`, `0.5`, `240deg`, `none` — the shapes a colour argument takes. */
const number = (token: string | undefined, scale = 1): number => {
  if (token === undefined || token === "none") return 0;
  if (token.endsWith("%")) return (Number.parseFloat(token) / 100) * scale;
  return Number.parseFloat(token);
};

const args = (body: string): ReadonlyArray<string> =>
  body
    .replace("/", " ")
    .split(/[\s,]+/)
    .filter((token) => token.length > 0);

const gamma = (channel: number): number =>
  channel <= 0.0031308
    ? 12.92 * channel
    : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;

/** Oklab → linear sRGB, the matrices from the Oklab reference implementation. */
const oklabToRgb = (L: number, a: number, b: number): Rgba => {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);
  return {
    r: gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a: 1,
  };
};

const hslToRgb = (h: number, s: number, l: number): Rgba => {
  const k = (n: number) => (n + h / 30) % 12;
  const chroma = s * Math.min(l, 1 - l);
  const channel = (n: number) =>
    l - chroma * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: channel(0), g: channel(8), b: channel(4), a: 1 };
};

/**
 * Reads a colour the way a computed style writes it. sRGB colours come back as
 * `rgb()`, but anything the stylesheet declared in a modern space — which is
 * every Tailwind v4 colour — is serialised as `oklch()` and has to be brought
 * into sRGB here; no browser API in the guest will do it. Channels are clamped,
 * so a colour outside the sRGB gamut lands on its nearest edge.
 */
export const parseCssColor = (value: string): Rgba | null => {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = HEX.exec(trimmed);
  if (hex !== null) {
    let digits = hex[1];
    if (digits.length <= 4) {
      digits = digits
        .split("")
        .map((d) => d + d)
        .join("");
    }
    if (digits.length !== 6 && digits.length !== 8) return null;
    const part = (at: number) => Number.parseInt(digits.slice(at, at + 2), 16);
    return {
      r: part(0) / 255,
      g: part(2) / 255,
      b: part(4) / 255,
      a: digits.length === 8 ? part(6) / 255 : 1,
    };
  }
  const fn = FUNCTION.exec(trimmed);
  if (fn === null) return null;
  const [, name, body] = fn;
  const tokens = args(body);
  switch (name) {
    case "rgb":
    case "rgba": {
      const [r, g, b, a] = tokens;
      return {
        r: number(r, 255) / 255,
        g: number(g, 255) / 255,
        b: number(b, 255) / 255,
        a: a === undefined ? 1 : number(a),
      };
    }
    case "hsl":
    case "hsla": {
      const [h, s, l, a] = tokens;
      return {
        ...hslToRgb(number(h), number(s), number(l)),
        a: a === undefined ? 1 : number(a),
      };
    }
    case "oklch": {
      const [L, C, H, a] = tokens;
      const hue = (number(H) * Math.PI) / 180;
      const chroma = number(C, 0.4);
      return {
        ...oklabToRgb(
          number(L),
          chroma * Math.cos(hue),
          chroma * Math.sin(hue)
        ),
        a: a === undefined ? 1 : number(a),
      };
    }
    case "oklab": {
      const [L, A, B, a] = tokens;
      return {
        ...oklabToRgb(number(L), number(A, 0.4), number(B, 0.4)),
        a: a === undefined ? 1 : number(a),
      };
    }
    case "color": {
      const [space, r, g, b, a] = tokens;
      if (space !== "srgb" && space !== "display-p3") return null;
      return {
        r: number(r),
        g: number(g),
        b: number(b),
        a: a === undefined ? 1 : number(a),
      };
    }
    default:
      return null;
  }
};

const channel = (value: number): string =>
  Math.round(clamp01(value) * 255)
    .toString(16)
    .padStart(2, "0");

/**
 * A `<input type="color">` only speaks six-digit hex. Alpha is dropped: the
 * swatch shows the hue, and the text field beside it keeps the exact value.
 */
export const toHexColor = (value: string): string | null => {
  const rgba = parseCssColor(value);
  if (rgba === null) return null;
  return `#${channel(rgba.r)}${channel(rgba.g)}${channel(rgba.b)}`;
};

/** `rgba(0, 0, 0, 0)` is what every unpainted background computes to. */
export const isTransparent = (value: string): boolean =>
  parseCssColor(value)?.a === 0;

/** A length as the field edits it: the number and the unit kept apart. */
export type Length =
  | { readonly kind: "number"; readonly value: number; readonly unit: string }
  | { readonly kind: "keyword"; readonly value: string };

const LENGTH = /^(-?\d*\.?\d+)([a-z%]*)$/i;

export const parseLength = (value: string): Length => {
  const match = LENGTH.exec(value.trim());
  if (match === null) return { kind: "keyword", value: value.trim() };
  return {
    kind: "number",
    value: Number.parseFloat(match[1]),
    unit: match[2].toLowerCase(),
  };
};

export const formatLength = (length: Length): string =>
  length.kind === "keyword"
    ? length.value
    : `${Number(length.value.toFixed(2))}${length.unit}`;

/** What a colour field writes back: hex while opaque, `rgba()` once it isn't. */
export const formatColor = (rgba: Rgba): string => {
  const alpha = clamp01(rgba.a);
  if (alpha >= 1) {
    return `#${channel(rgba.r)}${channel(rgba.g)}${channel(rgba.b)}`;
  }
  const byte = (value: number) => Math.round(clamp01(value) * 255);
  return `rgba(${byte(rgba.r)}, ${byte(rgba.g)}, ${byte(rgba.b)}, ${Number(
    alpha.toFixed(3)
  )})`;
};

export interface Hsva {
  /** Degrees, 0–360. */
  readonly h: number;
  readonly s: number;
  readonly v: number;
  readonly a: number;
}

/** The picker's own space: a hue strip and a saturation/value square. */
export const rgbaToHsva = (rgba: Rgba): Hsva => {
  const r = clamp01(rgba.r);
  const g = clamp01(rgba.g);
  const b = clamp01(rgba.b);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : delta / max, v: max, a: rgba.a };
};

export const hsvaToRgba = (hsva: Hsva): Rgba => {
  const c = hsva.v * hsva.s;
  const x = c * (1 - Math.abs(((hsva.h / 60) % 2) - 1));
  const m = hsva.v - c;
  const sector = Math.floor(hsva.h / 60) % 6;
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][sector];
  return { r: r + m, g: g + m, b: b + m, a: hsva.a };
};

const LEADING_NUMBER = /^(-?\d*\.?\d+)(.*)$/;

/**
 * Arrow keys on a length field nudge the leading number and keep the unit —
 * `16px` → `17px`, `1.5` → `1.6` for a unitless line-height — which is how
 * every inspector behaves and what makes eyeballing a margin bearable. Values
 * without a number (`auto`, `normal`) are left alone.
 */
export const stepLength = (value: string, delta: number): string | null => {
  const match = LEADING_NUMBER.exec(value.trim());
  if (match === null) return null;
  const current = Number.parseFloat(match[1]);
  const decimals = (match[1].split(".")[1] ?? "").length;
  const next = current + delta;
  return `${Number(next.toFixed(Math.max(decimals, 0)))}${match[2]}`;
};

/**
 * Whether a saved comment belongs on the page the pane is showing. A hash or
 * a trailing slash is the same page; a different path is not.
 */
export const samePage = (a: string, b: string): boolean => {
  const strip = (url: string) =>
    url.replace(/#.*$/, "").replace(/\/+$/, "").toLowerCase();
  return strip(a) === strip(b);
};

/** The edits as the stored record: what each property was, and what it became. */
export const toStyleChanges = (
  computed: ComputedStyles,
  edits: StyleEdits
): ReadonlyArray<StyleChange> =>
  Object.entries(edits)
    .filter(([property, to]) => to !== (computed[property] ?? ""))
    .map(([property, to]) => ({
      property,
      from: computed[property] ?? "",
      to,
    }));

/** One line per change, for prompts and lists: `color: rgb(0, 0, 0) → #fff`. */
export const formatStyleChanges = (
  changes: ReadonlyArray<StyleChange>
): ReadonlyArray<string> =>
  changes.map((change) => `${change.property}: ${change.from} → ${change.to}`);

/**
 * What a list shows for the comment: its words when it has any, otherwise the
 * changes themselves, so a comment that is only a tweak still reads as one.
 */
export const visualCommentSummary = (comment: {
  readonly body: string;
  readonly styleChanges?: ReadonlyArray<StyleChange>;
}): string => {
  if (comment.body.trim().length > 0) return comment.body;
  return formatStyleChanges(comment.styleChanges ?? []).join(", ");
};
