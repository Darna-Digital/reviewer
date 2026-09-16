import { describe, expect, it } from "vitest";
import { docToMarkdown, markdownToDoc } from "./markdown-conversion.functions";
import type { DocNode } from "../interfaces/markdown.interfaces";

/** The blocks of a parsed document, which is what most of these are about. */
const blocks = (text: string): DocNode[] => markdownToDoc(text).content ?? [];

/**
 * Writing a document back out and reading it again. Everything here has already
 * been through one round trip, so a second one changing anything would mean the
 * file grows a new diff every time it is saved.
 */
const settled = (text: string): string => docToMarkdown(markdownToDoc(text));

describe("markdownToDoc", () => {
  it("reads a heading as a heading of its level", () => {
    expect(blocks("## Release notes")).toEqual([
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Release notes" }],
      },
    ]);
  });

  it("carries nested emphasis down to the text as marks", () => {
    const [paragraph] = blocks("a [**b**](https://x.test) c");
    expect(paragraph?.content).toEqual([
      { type: "text", text: "a " },
      {
        type: "text",
        text: "b",
        marks: [
          { type: "link", attrs: { href: "https://x.test", title: null } },
          { type: "bold" },
        ],
      },
      { type: "text", text: " c" },
    ]);
  });

  it("reads a checkbox list as a task list, not a bullet list", () => {
    const [list] = blocks("- [x] done\n- [ ] todo");
    expect(list?.type).toBe("taskList");
    expect(list?.content?.map((item) => item.attrs?.checked)).toEqual([
      true,
      false,
    ]);
  });

  it("reads a plain list as a bullet list", () => {
    expect(blocks("- one\n- two")[0]?.type).toBe("bulletList");
  });

  it("keeps an ordered list's starting number", () => {
    const [list] = blocks("3. three\n4. four");
    expect(list?.type).toBe("orderedList");
    expect(list?.attrs).toEqual({ start: 3 });
  });

  it("keeps a fence's language and the rest of its info string", () => {
    const [code] = blocks("```ts twoslash\nconst a = 1\n```");
    expect(code?.attrs).toEqual({ language: "ts", meta: "twoslash" });
    expect(code?.content).toEqual([{ type: "text", text: "const a = 1" }]);
  });

  it("keeps a table's column alignment on its cells", () => {
    const [table] = blocks("| a | b |\n| :- | --: |\n| 1 | 2 |");
    const header = table?.content?.[0];
    expect(header?.content?.map((cell) => cell.type)).toEqual([
      "tableHeader",
      "tableHeader",
    ]);
    expect(header?.content?.map((cell) => cell.attrs?.align)).toEqual([
      "left",
      "right",
    ]);
    expect(table?.content?.[1]?.content?.[0]?.type).toBe("tableCell");
  });

  it("holds frontmatter as itself rather than as a rule and a heading", () => {
    const [front] = blocks("---\ntitle: Notes\n---\n\n# Notes");
    expect(front).toEqual({
      type: "markdownBlock",
      attrs: { source: "---\ntitle: Notes\n---", kind: "frontmatter" },
    });
  });

  it("holds embedded html verbatim", () => {
    const [raw] = blocks('<div class="note">hi</div>');
    expect(raw).toEqual({
      type: "markdownBlock",
      attrs: { source: '<div class="note">hi</div>', kind: "raw" },
    });
  });

  it("gives an empty file somewhere to start typing", () => {
    expect(markdownToDoc("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("docToMarkdown", () => {
  it("writes the marks back out nested", () => {
    expect(
      docToMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "b",
                marks: [
                  { type: "link", attrs: { href: "https://x.test" } },
                  { type: "bold" },
                ],
              },
            ],
          },
        ],
      })
    ).toBe("[**b**](https://x.test)\n");
  });

  it("joins neighbouring runs wearing the same marks", () => {
    // Two `**`-wrapped runs written side by side would read back as one
    // literal `****` rather than as emphasis.
    expect(
      docToMarkdown({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "a", marks: [{ type: "bold" }] },
              { type: "text", text: "b", marks: [{ type: "bold" }] },
            ],
          },
        ],
      })
    ).toBe("**ab**\n");
  });

  it("writes a raw block back byte for byte", () => {
    expect(
      docToMarkdown({
        type: "doc",
        content: [
          {
            type: "markdownBlock",
            attrs: { source: "<!-- keep -->", kind: "raw" },
          },
        ],
      })
    ).toBe("<!-- keep -->\n");
  });
});

describe("round trip", () => {
  const cases: ReadonlyArray<[string, string]> = [
    ["headings", "# One\n\n## Two\n"],
    ["emphasis", "_soft_ and *hard* and ~~gone~~ and `code`\n"],
    ["links and images", "[text](https://x.test) ![alt](./a.png)\n"],
    ["bullet list", "- one\n- two\n"],
    ["ordered list", "1. one\n2. two\n"],
    ["task list", "- [x] done\n- [ ] todo\n"],
    ["nested list", "- one\n  - inner\n- two\n"],
    ["quote", "> quoted\n"],
    ["fence", "```ts\nconst a = 1;\n```\n"],
    ["rule", "one\n\n---\n\ntwo\n"],
    ["table", "| a  |  b |\n| :- | -: |\n| 1  |  2 |\n"],
    ["frontmatter", "---\ntitle: Notes\n---\n\n# Notes\n"],
    ["html", '<div class="note">hi</div>\n'],
    ["link definition", "[a]: https://x.test\n"],
    ["hard wrapped paragraph", "one line\nand its wrap\n"],
  ];

  it.each(cases)("is stable for %s", (_name, text) => {
    expect(settled(text)).toBe(settled(settled(text)));
  });

  it("does not lose what it cannot draw", () => {
    const text = "---\ntitle: Notes\n---\n\nSee[^1].\n\n[^1]: A footnote.\n";
    const written = settled(text);
    expect(written).toContain("title: Notes");
    expect(written).toContain("[^1]: A footnote.");
  });

  it("leaves a document it has not been typed into alone", () => {
    const text = "# Title\n\nA paragraph.\n\n- one\n- two\n";
    expect(settled(text)).toBe(text);
  });
});
