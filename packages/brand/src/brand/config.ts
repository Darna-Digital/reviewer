export type LayoutKind = "mark" | "horizontal" | "stacked" | "wordmark";
export type FillKind = "transparent" | "solid" | "gradient";

export type Fill = {
  kind: FillKind;
  color: string;
  colorTo: string;
  angle: number;
};

export type BrandConfig = {
  layout: LayoutKind;
  wordmark: string;

  plate: Fill;
  /** Draw the mark on its own tile instead of straight onto the plate. */
  markTile: boolean;
  tile: Fill;
  blocks: Fill;
  wordmarkFill: Fill;
  /** Keep the wordmark painted the same way as the blocks. */
  linkWordmarkColor: boolean;

  /** Tile corner radius, as a fraction of the tile's side. */
  tileRadius: number;
  /** Plate corner radius, as a fraction of the plate's shorter side. */
  plateRadius: number;
  /** Individual block corner radius, as a fraction of a cell. */
  blockRadius: number;
  /** Space between blocks, as a fraction of a cell. */
  blockGap: number;
  /** Space between the mark and the tile edge, as a fraction of the tile. */
  markPadding: number;

  fontWeight: 300 | 400 | 500 | 600 | 700;
  /** Wordmark cap height, as a fraction of the mark's height. */
  wordmarkScale: number;
  /** Letter spacing, as a fraction of the font size. */
  letterSpacing: number;
  /** Gap between mark and wordmark, as a fraction of the mark's height. */
  lockupGap: number;
  uppercase: boolean;

  /** Padding around the whole lockup, as a fraction of the mark's height. */
  canvasPadding: number;
};

/**
 * Top-to-bottom, in the CSS convention `gradientVector` reads (0° points up).
 * The square mark reads as a lit surface rather than a tilted one, and it is the
 * angle the macOS icon's `automatic-gradient` fills use, so the packaged app
 * icon and the exported assets match.
 */
export const VERTICAL = 180;

export const BLACK = "#000000";
export const WHITE = "#ffffff";

const SOLID = (color: string): Fill => ({
  kind: "solid",
  color,
  colorTo: BLACK,
  angle: VERTICAL,
});

const GRADIENT = (color: string, colorTo: string): Fill => ({
  kind: "gradient",
  color,
  colorTo,
  angle: VERTICAL,
});

/** Graphite fading to black — for a tile the mark sits on. */
export const DARK_GRADIENT = GRADIENT("#3f3f46", BLACK);
/** Black fading to graphite — for the mark itself on a light tile. */
export const LIGHT_GRADIENT = GRADIENT(BLACK, "#52525b");

export const TRANSPARENT: Fill = {
  kind: "transparent",
  color: BLACK,
  colorTo: BLACK,
  angle: VERTICAL,
};

export const DEFAULT_CONFIG: BrandConfig = {
  layout: "mark",
  wordmark: "Reviewer",

  plate: SOLID(BLACK),
  markTile: false,
  tile: SOLID(BLACK),
  blocks: SOLID(WHITE),
  wordmarkFill: SOLID(WHITE),
  linkWordmarkColor: true,

  tileRadius: 0,
  plateRadius: 0,
  blockRadius: 0,
  blockGap: 0,
  // 68 / 355 — the vertical padding of the original artwork.
  markPadding: 0.1915,

  fontWeight: 700,
  wordmarkScale: 0.55,
  letterSpacing: -0.01,
  lockupGap: 0.3,
  uppercase: false,

  canvasPadding: 0,
};

export type Preset = {
  id: string;
  label: string;
  hint: string;
  config: Partial<BrandConfig>;
};

export const PRESETS: Array<Preset> = [
  {
    id: "dark",
    label: "Dark",
    hint: "White mark on black",
    config: {
      plate: SOLID(BLACK),
      tile: SOLID(BLACK),
      markTile: false,
      blocks: SOLID(WHITE),
      wordmarkFill: SOLID(WHITE),
      linkWordmarkColor: true,
    },
  },
  {
    id: "light",
    label: "Light",
    hint: "Black mark on white",
    config: {
      plate: SOLID(WHITE),
      tile: SOLID(WHITE),
      markTile: false,
      blocks: SOLID(BLACK),
      wordmarkFill: SOLID(BLACK),
      linkWordmarkColor: true,
    },
  },
  {
    id: "dark-gradient",
    label: "Dark gradient",
    hint: "White mark, graphite tile",
    config: {
      plate: DARK_GRADIENT,
      tile: DARK_GRADIENT,
      markTile: false,
      blocks: SOLID(WHITE),
      wordmarkFill: SOLID(WHITE),
      linkWordmarkColor: true,
    },
  },
  {
    id: "light-gradient",
    label: "Light gradient",
    hint: "Graphite mark, white tile",
    config: {
      plate: SOLID(WHITE),
      tile: SOLID(WHITE),
      markTile: false,
      blocks: LIGHT_GRADIENT,
      wordmarkFill: LIGHT_GRADIENT,
      linkWordmarkColor: true,
    },
  },
  {
    id: "tile",
    label: "Tile",
    hint: "Black tile, clear plate",
    config: {
      plate: TRANSPARENT,
      tile: SOLID(BLACK),
      markTile: true,
      tileRadius: 0.22,
      blocks: SOLID(WHITE),
      wordmarkFill: SOLID(BLACK),
      linkWordmarkColor: false,
    },
  },
  {
    id: "mono",
    label: "Mono",
    hint: "Black mark, clear plate",
    config: {
      plate: TRANSPARENT,
      tile: TRANSPARENT,
      markTile: false,
      blocks: SOLID(BLACK),
      wordmarkFill: SOLID(BLACK),
      linkWordmarkColor: true,
    },
  },
  {
    id: "mono-inverse",
    label: "Mono inverse",
    hint: "White mark, clear plate",
    config: {
      plate: TRANSPARENT,
      tile: TRANSPARENT,
      markTile: false,
      blocks: SOLID(WHITE),
      wordmarkFill: SOLID(WHITE),
      linkWordmarkColor: true,
    },
  },
];
