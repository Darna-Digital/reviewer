// opentype.js ships no type definitions, and the DefinitelyTyped package still
// describes the v1 API. This declares just the slice of v2 the studio uses.
declare module "opentype.js" {
  export type BoundingBox = { x1: number; y1: number; x2: number; y2: number };

  export type PathCommand =
    | { type: "M" | "L"; x: number; y: number }
    | { type: "Q"; x1: number; y1: number; x: number; y: number }
    | {
        type: "C";
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      }
    | { type: "Z" };

  export type RenderOptions = {
    kerning?: boolean;
    letterSpacing?: number;
    tracking?: number;
    features?: Record<string, boolean>;
  };

  export class Path {
    commands: Array<PathCommand>;
    getBoundingBox(): BoundingBox;
  }

  export class Font {
    unitsPerEm: number;
    tables: { os2?: { sCapHeight?: number } };
    getPath(
      text: string,
      x: number,
      y: number,
      fontSize: number,
      options?: RenderOptions
    ): Path;
  }

  export function parse(buffer: ArrayBuffer, options?: unknown): Font;
}
