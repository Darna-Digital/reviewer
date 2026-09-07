import { describe, expect, it } from "vitest";
import {
  lineOfFragment,
  mapMarkdownLinks,
  splitLinkTarget,
} from "./language.links.ts";

describe("mapMarkdownLinks", () => {
  it("rewrites the targets it is given and nothing else", () => {
    expect(
      mapMarkdownLinks("see [a](one.rb) and [b](two.rb)", (t) => `x/${t}`)
    ).toBe("see [a](x/one.rb) and [b](x/two.rb)");
  });

  it("leaves URLs and anchors alone", () => {
    const markdown = "[docs](https://example.com) [here](#section)";
    expect(mapMarkdownLinks(markdown, () => "changed")).toBe(markdown);
  });

  it("rewrites a scheme only when asked — `file://` is the caller's business", () => {
    const markdown = "[a](file:///work/a.rb)";
    expect(mapMarkdownLinks(markdown, () => "a.rb")).toBe(markdown);
    expect(
      mapMarkdownLinks(markdown, () => "a.rb", { includeSchemes: true })
    ).toBe("[a](a.rb)");
  });

  it("leaves prose that only looks like a link", () => {
    const markdown = "an array index] (not a link) and `](x)` in code";
    expect(mapMarkdownLinks(markdown, () => "changed")).toBe(
      "an array index] (not a link) and `](changed)` in code"
    );
  });
});

describe("splitLinkTarget", () => {
  it("separates the file from its fragment", () => {
    expect(splitLinkTarget("app/models/a.rb#L1,1-7,4")).toEqual({
      path: "app/models/a.rb",
      fragment: "#L1,1-7,4",
    });
    expect(splitLinkTarget("app/models/a.rb")).toEqual({
      path: "app/models/a.rb",
      fragment: "",
    });
  });
});

describe("lineOfFragment", () => {
  it("reads the line a fragment names, in either form", () => {
    expect(lineOfFragment("#L12")).toBe(12);
    expect(lineOfFragment("#L1,1-7,4")).toBe(1);
  });

  it("answers null when there is no line in it", () => {
    expect(lineOfFragment("")).toBeNull();
    expect(lineOfFragment("#section")).toBeNull();
    expect(lineOfFragment("#L0")).toBeNull();
  });
});
