# @reviewer/brand

The brand studio — a local Vite SPA on **:41813** that draws the reviewer mark
from its grid definition and exports every asset the app, the site and the
desktop build need.

```sh
pnpm dev:brand           # or: pnpm --filter @reviewer/brand dev
```

## What it makes

- **Layouts** — the square mark, the horizontal and stacked lockups, and the
  wordmark on its own.
- **Fills** — the plate, the tile, the mark and the wordmark each take a solid
  colour or a two-stop gradient at any angle, so the dark icon can fade its
  tile behind a flat white mark and the light icon can fade the mark itself.
- **Formats** — SVG (wordmark converted to outlines, so no font is needed),
  PNG at any size, and a multi-resolution `favicon.ico`.
- **Asset pack** — one `.zip` with every layout in every colour variant, the
  icon at each size a browser or OS asks for, plus an apple-touch-icon.
- **In-context previews** — browser tab, macOS Dock, iOS home screen, small
  sizes on light and dark, a README header, a social card and a menu bar.

## How it is put together

- `src/brand/mark.ts` — the mark itself: a blocky "R" on a 3×4 grid.
- `src/brand/geometry.ts` — turns the settings into a scene in design units
  (one grid cell is 100).
- `src/brand/svg.ts` — the scene as an SVG string. The live canvas, every
  preview and every export all come from this one function, so what you see is
  what you save. The mark's cells are emitted as a single path: as separate
  rects they antialias against the background individually and leave a hairline
  seam wherever two cells touch.
- `src/brand/font.ts` + `path-data.ts` — Space Grotesk outlines for the
  wordmark, serialised by hand (opentype.js' own writer emits `NaN` for
  coordinates small enough to print in exponential notation).
- `src/brand/raster.ts`, `pack.ts` — PNG, ICO and the zipped pack.

Space Grotesk is vendored under `public/fonts` (SIL Open Font License 1.1) so
the studio works offline and the outlines never depend on what is installed
locally.
