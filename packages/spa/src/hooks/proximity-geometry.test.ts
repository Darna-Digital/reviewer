import { describe, expect, it } from "vitest";
import {
  itemIndexAtPointer,
  sameLayoutRects,
  toViewportRect,
  type ContainerGeometry,
  type ViewportRect,
} from "./proximity-geometry";

const row = (top: number): ViewportRect => ({
  top,
  height: 20,
  left: 0,
  width: 100,
});

const cell = (left: number, top: number): ViewportRect => ({
  top,
  height: 20,
  left,
  width: 40,
});

describe("itemIndexAtPointer", () => {
  it("picks the row under the pointer", () => {
    const rows = [row(0), row(20), row(40)];
    expect(itemIndexAtPointer({ x: 50, y: 25 }, rows, "y")).toBe(1);
  });

  it("falls back to the nearest row when the pointer is past the list", () => {
    const rows = [row(0), row(20), row(40)];
    expect(itemIndexAtPointer({ x: 50, y: 500 }, rows, "y")).toBe(2);
  });

  it("ignores the other axis on a single-axis list", () => {
    const rows = [row(0), row(20)];
    expect(itemIndexAtPointer({ x: 9000, y: 5 }, rows, "y")).toBe(0);
  });

  it("resolves across rows and columns on a grid", () => {
    const grid = [cell(0, 0), cell(50, 0), cell(0, 40), cell(50, 40)];
    expect(itemIndexAtPointer({ x: 60, y: 45 }, grid, "xy")).toBe(3);
  });

  it("prefers the covered item over a closer center elsewhere", () => {
    const wide: ViewportRect = { top: 0, height: 100, left: 0, width: 200 };
    const narrow: ViewportRect = { top: 0, height: 4, left: 190, width: 4 };
    expect(itemIndexAtPointer({ x: 5, y: 2 }, [wide, narrow], "xy")).toBe(0);
  });

  it("has no answer for an empty list", () => {
    expect(itemIndexAtPointer({ x: 0, y: 0 }, [], "y")).toBeNull();
  });
});

describe("toViewportRect", () => {
  const geometry = (
    over: Partial<ContainerGeometry> = {}
  ): ContainerGeometry => ({
    bounds: { top: 100, left: 50, width: 200, height: 400 },
    scroll: { x: 0, y: 0 },
    border: { x: 0, y: 0 },
    layoutToViewportScale: { x: 1, y: 1 },
    ...over,
  });

  it("offsets layout coordinates by the container's position", () => {
    const rect = toViewportRect(
      { top: 10, height: 20, left: 5, width: 30 },
      geometry()
    );
    expect(rect).toEqual({ top: 110, height: 20, left: 55, width: 30 });
  });

  it("subtracts the container's scroll", () => {
    const rect = toViewportRect(
      { top: 100, height: 20, left: 0, width: 30 },
      geometry({ scroll: { x: 0, y: 60 } })
    );
    expect(rect.top).toBe(140);
  });

  it("applies an ancestor transform's scale to position and size", () => {
    const rect = toViewportRect(
      { top: 10, height: 20, left: 10, width: 30 },
      geometry({ layoutToViewportScale: { x: 2, y: 0.5 } })
    );
    expect(rect).toEqual({ top: 105, height: 10, left: 70, width: 60 });
  });
});

describe("sameLayoutRects", () => {
  const rect = { top: 0, height: 10, left: 0, width: 10 };

  it("is true for equal measurements", () => {
    expect(sameLayoutRects([rect], [{ ...rect }])).toBe(true);
  });

  it("is false once an item moves", () => {
    expect(sameLayoutRects([rect], [{ ...rect, top: 1 }])).toBe(false);
  });

  it("is false when the count changes", () => {
    expect(sameLayoutRects([rect], [rect, rect])).toBe(false);
  });

  it("treats matching sparse slots as unchanged", () => {
    expect(sameLayoutRects([undefined, rect], [undefined, rect])).toBe(true);
    expect(sameLayoutRects([undefined, rect], [rect, rect])).toBe(false);
  });
});
