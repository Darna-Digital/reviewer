import { describe, expect, it } from "vitest";
import {
  formatColor,
  formatLength,
  formatStyleChanges,
  hsvaToRgba,
  isTransparent,
  parseLength,
  rgbaToHsva,
  rowProperties,
  samePage,
  STYLE_GROUPS,
  STYLE_PROPERTIES,
  stepLength,
  toHexColor,
  toStyleChanges,
  visualCommentSummary,
} from "./visual-style.functions";

describe("the catalogue", () => {
  it("lists every grouped property once", () => {
    const names = STYLE_GROUPS.flatMap((g) =>
      g.rows.flatMap(rowProperties).map((p) => p.name)
    );
    expect(STYLE_PROPERTIES).toEqual(names);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("lengths", () => {
  it("splits a number from its unit and puts it back", () => {
    expect(parseLength("16px")).toEqual({
      kind: "number",
      value: 16,
      unit: "px",
    });
    expect(parseLength("1.5")).toEqual({
      kind: "number",
      value: 1.5,
      unit: "",
    });
    expect(parseLength("-0.02em")).toEqual({
      kind: "number",
      value: -0.02,
      unit: "em",
    });
    expect(parseLength("auto")).toEqual({ kind: "keyword", value: "auto" });
    expect(formatLength({ kind: "number", value: 17.333, unit: "px" })).toBe(
      "17.33px"
    );
    expect(formatLength({ kind: "keyword", value: "auto" })).toBe("auto");
  });
});

describe("colour round trips", () => {
  it("writes hex while opaque and rgba() once translucent", () => {
    expect(formatColor({ r: 1, g: 0, b: 0, a: 1 })).toBe("#ff0000");
    expect(formatColor({ r: 1, g: 0, b: 0, a: 0.5 })).toBe(
      "rgba(255, 0, 0, 0.5)"
    );
  });

  it("keeps a colour through HSV and back", () => {
    const red = { r: 0.9, g: 0.1, b: 0.2, a: 0.7 };
    const back = hsvaToRgba(rgbaToHsva(red));
    expect(back.r).toBeCloseTo(red.r);
    expect(back.g).toBeCloseTo(red.g);
    expect(back.b).toBeCloseTo(red.b);
    expect(back.a).toBe(0.7);
    expect(rgbaToHsva({ r: 0, g: 0, b: 1, a: 1 }).h).toBe(240);
  });
});

describe("toHexColor", () => {
  it("turns a computed rgb() into the hex a colour input wants", () => {
    expect(toHexColor("rgb(255, 255, 255)")).toBe("#ffffff");
    expect(toHexColor("rgba(30, 30, 30, 0.5)")).toBe("#1e1e1e");
    expect(toHexColor("rgb(56 189 248 / 0.16)")).toBe("#38bdf8");
  });

  it("normalises hex the user typed", () => {
    expect(toHexColor("#FFF")).toBe("#ffffff");
    expect(toHexColor("#abcd")).toBe("#aabbcc");
    expect(toHexColor("#12345678")).toBe("#123456");
  });

  it("brings a modern-syntax computed colour into sRGB", () => {
    // Tailwind v4's neutral-900, sky-400 and red-600, as Chromium computes them.
    expect(toHexColor("oklch(0.205 0 none)")).toBe("#171717");
    expect(toHexColor("oklch(0.746 0.16 232.661)")).toBe("#00bcff");
    expect(toHexColor("oklch(0.577 0.245 27.325 / 0.5)")).toBe("#e7000b");
    expect(toHexColor("oklch(1 0 0)")).toBe("#ffffff");
    expect(toHexColor("oklab(0.5 0 0)")).toBe("#636363");
    expect(toHexColor("hsl(120, 100%, 50%)")).toBe("#00ff00");
    expect(toHexColor("color(srgb 1 0 0)")).toBe("#ff0000");
  });

  it("gives up on anything it cannot read", () => {
    expect(toHexColor("var(--x)")).toBeNull();
    expect(toHexColor("#12")).toBeNull();
  });
});

describe("isTransparent", () => {
  it("recognises the computed value of an unpainted background", () => {
    expect(isTransparent("rgba(0, 0, 0, 0)")).toBe(true);
    expect(isTransparent("transparent")).toBe(true);
    expect(isTransparent("rgb(0, 0, 0)")).toBe(false);
    expect(isTransparent("rgba(0, 0, 0, 0.2)")).toBe(false);
  });
});

describe("stepLength", () => {
  it("nudges the number and keeps the unit", () => {
    expect(stepLength("16px", 1)).toBe("17px");
    expect(stepLength("16px", -10)).toBe("6px");
    expect(stepLength("0.5", 0.1)).toBe("0.6");
    expect(stepLength("1.25rem", -0.1)).toBe("1.15rem");
    expect(stepLength("-4px", 1)).toBe("-3px");
  });

  it("leaves keywords alone", () => {
    expect(stepLength("auto", 1)).toBeNull();
    expect(stepLength("normal", 1)).toBeNull();
  });
});

describe("toStyleChanges", () => {
  it("records only what differs from the computed value", () => {
    expect(
      toStyleChanges(
        { color: "rgb(0, 0, 0)", "font-size": "16px" },
        { color: "#fff", "font-size": "16px" }
      )
    ).toEqual([{ property: "color", from: "rgb(0, 0, 0)", to: "#fff" }]);
  });
});

describe("summaries", () => {
  const changes = [
    { property: "color", from: "rgb(0, 0, 0)", to: "#fff" },
    { property: "gap", from: "8px", to: "12px" },
  ];

  it("formats a change as before → after", () => {
    expect(formatStyleChanges(changes)).toEqual([
      "color: rgb(0, 0, 0) → #fff",
      "gap: 8px → 12px",
    ]);
  });

  it("shows a tweak-only comment as its tweaks", () => {
    expect(visualCommentSummary({ body: "", styleChanges: changes })).toBe(
      "color: rgb(0, 0, 0) → #fff, gap: 8px → 12px"
    );
    expect(
      visualCommentSummary({ body: "Too loud", styleChanges: changes })
    ).toBe("Too loud");
    expect(visualCommentSummary({ body: "" })).toBe("");
  });
});

describe("samePage", () => {
  it("ignores a hash and a trailing slash, not a path", () => {
    expect(samePage("http://localhost:3000/", "http://localhost:3000")).toBe(
      true
    );
    expect(
      samePage("http://localhost:3000/a#top", "http://localhost:3000/a")
    ).toBe(true);
    expect(samePage("http://localhost:3000/a", "http://localhost:3000/b")).toBe(
      false
    );
  });
});
