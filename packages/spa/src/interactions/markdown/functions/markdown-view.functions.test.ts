import { describe, expect, it } from "vitest";
import {
  asMarkdownView,
  isMarkdownPath,
  nextMarkdownView,
  showsDocument,
  showsSource,
} from "./markdown-view.functions";

describe("isMarkdownPath", () => {
  it.each(["README.md", "docs/a.markdown", "a/b/NOTES.MD", "x.mkd"])(
    "recognises %s",
    (path) => expect(isMarkdownPath(path)).toBe(true)
  );

  it.each(["index.ts", "a.mdx", "Makefile", "styles.css", "md"])(
    "leaves %s as source",
    (path) => expect(isMarkdownPath(path)).toBe(false)
  );

  it("reads the last extension of a compound name", () => {
    expect(isMarkdownPath("changelog.old.md")).toBe(true);
    expect(isMarkdownPath("a.md.ts")).toBe(false);
  });

  it("is not fooled by a directory that looks like a file", () => {
    expect(isMarkdownPath("docs.md/index.ts")).toBe(false);
  });
});

describe("asMarkdownView", () => {
  it("keeps a view it recognises", () => {
    expect(asMarkdownView("split")).toBe("split");
  });

  it("falls back to the source for anything storage may have kept", () => {
    expect(asMarkdownView("preview")).toBe("source");
    expect(asMarkdownView(undefined)).toBe("source");
  });
});

describe("what each view shows", () => {
  it("shows the source in every view but the document", () => {
    expect(showsSource("source")).toBe(true);
    expect(showsSource("split")).toBe(true);
    expect(showsSource("editor")).toBe(false);
  });

  it("shows the document in every view but the source", () => {
    expect(showsDocument("source")).toBe(false);
    expect(showsDocument("split")).toBe(true);
    expect(showsDocument("editor")).toBe(true);
  });

  it("cycles through all three and back", () => {
    expect(nextMarkdownView("source")).toBe("split");
    expect(nextMarkdownView("split")).toBe("editor");
    expect(nextMarkdownView("editor")).toBe("source");
  });
});
