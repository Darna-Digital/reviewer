import { describe, expect, it } from "vitest";
import {
  hoverMarkdown,
  outlineKind,
  outlineOfNavigationTree,
  referenceKind,
  severityOfCategory,
  spanPreview,
  spanToRange,
  toAbsolute,
  toDiagnostic,
  toRepoRelative,
} from "./ts-mapping.ts";

const TEXT = "const a = 1\nconst b = 2\n";

describe("severityOfCategory", () => {
  it("maps the compiler's categories", () => {
    expect(severityOfCategory(1)).toBe("error");
    expect(severityOfCategory(0)).toBe("warning");
    expect(severityOfCategory(2)).toBe("hint");
    expect(severityOfCategory(3)).toBe("information");
  });
  it("falls back to information for an unknown category", () => {
    expect(severityOfCategory(99)).toBe("information");
  });
});

describe("toDiagnostic", () => {
  const base = {
    text: TEXT,
    start: 6,
    length: 1,
    category: 1,
    code: 2322,
    message: "Type 'string' is not assignable to type 'number'.",
    unnecessary: false,
    deprecated: false,
    related: [],
  };

  it("converts the span to a range and stringifies the code", () => {
    const diagnostic = toDiagnostic(base);
    expect(diagnostic.range).toEqual({
      start: { line: 0, character: 6 },
      end: { line: 0, character: 7 },
    });
    expect(diagnostic.code).toBe("2322");
    expect(diagnostic.source).toBe("ts");
    expect(diagnostic.severity).toBe("error");
  });

  it("carries the unnecessary and deprecated tags", () => {
    expect(toDiagnostic({ ...base, unnecessary: true }).tags).toEqual([
      "unnecessary",
    ]);
    expect(
      toDiagnostic({ ...base, unnecessary: true, deprecated: true }).tags
    ).toEqual(["unnecessary", "deprecated"]);
    expect(toDiagnostic(base).tags).toEqual([]);
  });

  it("keeps related information", () => {
    const related = [
      {
        location: {
          path: "src/b.ts",
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 5 },
          },
        },
        message: "declared here",
      },
    ];
    expect(toDiagnostic({ ...base, related }).related).toEqual(related);
  });
});

describe("referenceKind", () => {
  it("prefers definition over write", () => {
    expect(referenceKind({ isDefinition: true, isWriteAccess: true })).toBe(
      "definition"
    );
  });
  it("reports a write", () => {
    expect(referenceKind({ isDefinition: false, isWriteAccess: true })).toBe(
      "write"
    );
  });
  it("defaults to a read", () => {
    expect(referenceKind({})).toBe("read");
    expect(referenceKind({ isDefinition: false, isWriteAccess: false })).toBe(
      "read"
    );
  });
});

describe("toRepoRelative", () => {
  const root = "/home/dev/repo";
  it("strips the root", () => {
    expect(toRepoRelative(root, "/home/dev/repo/src/a.ts")).toBe("src/a.ts");
  });
  it("tolerates a trailing slash on the root", () => {
    expect(toRepoRelative("/home/dev/repo/", "/home/dev/repo/src/a.ts")).toBe(
      "src/a.ts"
    );
  });
  it("normalizes Windows separators", () => {
    expect(toRepoRelative("C:\\dev\\repo", "C:\\dev\\repo\\src\\a.ts")).toBe(
      "src/a.ts"
    );
  });
  it("rejects a path outside the root", () => {
    expect(toRepoRelative(root, "/home/dev/other/a.ts")).toBeNull();
    expect(toRepoRelative(root, "/home/dev/repo-2/a.ts")).toBeNull();
    expect(toRepoRelative(root, "/usr/lib/typescript/lib.es5.d.ts")).toBeNull();
  });
  it("rejects the root itself, which is not a file", () => {
    expect(toRepoRelative(root, root)).toBeNull();
  });
  it("rejects an empty root rather than claiming everything", () => {
    expect(toRepoRelative("", "/anything")).toBeNull();
  });
  it("keeps node_modules, which the file API can serve", () => {
    expect(toRepoRelative(root, `${root}/node_modules/x/index.d.ts`)).toBe(
      "node_modules/x/index.d.ts"
    );
  });
});

describe("toAbsolute", () => {
  it("joins root and relative path", () => {
    expect(toAbsolute("/repo", "src/a.ts")).toBe("/repo/src/a.ts");
  });
  it("collapses duplicated separators", () => {
    expect(toAbsolute("/repo/", "/src/a.ts")).toBe("/repo/src/a.ts");
  });
});

describe("spanToRange / spanPreview", () => {
  it("converts a span on a later line", () => {
    expect(spanToRange(TEXT, { start: 12, length: 5 })).toEqual({
      start: { line: 1, character: 0 },
      end: { line: 1, character: 5 },
    });
  });
  it("previews the line a span starts on", () => {
    expect(spanPreview(TEXT, 14)).toBe("const b = 2");
  });
});

describe("hoverMarkdown", () => {
  it("fences the signature", () => {
    expect(
      hoverMarkdown({
        signature: "const a: number",
        documentation: "",
        tags: [],
      })
    ).toBe("```ts\nconst a: number\n```");
  });
  it("appends documentation and tags", () => {
    expect(
      hoverMarkdown({
        signature: "function greet(name: string): string",
        documentation: "Greets someone.",
        tags: [{ name: "param", text: "name the person" }],
      })
    ).toBe(
      "```ts\nfunction greet(name: string): string\n```\n\nGreets someone.\n\n*@param* — name the person"
    );
  });
  it("renders a tag with no text", () => {
    expect(
      hoverMarkdown({
        signature: "",
        documentation: "",
        tags: [{ name: "deprecated", text: "" }],
      })
    ).toBe("*@deprecated*");
  });
  it("returns an empty string when there is nothing to show", () => {
    expect(
      hoverMarkdown({ signature: "  ", documentation: "", tags: [] })
    ).toBe("");
  });
});

describe("outlineKind", () => {
  it("names TypeScript's element kinds the way the outline does", () => {
    expect(outlineKind("function")).toBe("function");
    expect(outlineKind("local function")).toBe("function");
    expect(outlineKind("class")).toBe("class");
    expect(outlineKind("method")).toBe("method");
    expect(outlineKind("getter")).toBe("property");
    expect(outlineKind("setter")).toBe("property");
    expect(outlineKind("var")).toBe("variable");
    expect(outlineKind("let")).toBe("variable");
    expect(outlineKind("const")).toBe("constant");
    expect(outlineKind("type")).toBe("type");
    expect(outlineKind("enum member")).toBe("enummember");
    expect(outlineKind("alias")).toBe("alias");
    expect(outlineKind("constructor")).toBe("constructor");
  });
  it("passes an unlisted kind through as one lowercase word", () => {
    expect(outlineKind(" Some Kind ")).toBe("somekind");
  });
});

describe("outlineOfNavigationTree", () => {
  const text = "class A {}\nclass A2 {}\n(function () { const x = 1 })()\n";
  const at = (needle: string, length = needle.length) => ({
    start: text.indexOf(needle),
    length,
  });

  it("skips the file's root and hoists what a nameless node declares", () => {
    const outline = outlineOfNavigationTree(text, {
      text: '"file"',
      kind: "module",
      spans: [{ start: 0, length: text.length }],
      childItems: [
        {
          text: "A",
          kind: "class",
          spans: [at("class A {}"), at("class A2 {}")],
          nameSpan: at("A"),
        },
        {
          text: "<function>",
          kind: "function",
          spans: [at("(function () { const x = 1 })")],
          childItems: [
            {
              text: "x",
              kind: "const",
              spans: [at("x = 1")],
              nameSpan: at("x", 1),
            },
          ],
        },
      ],
    });
    expect(outline.map((node) => [node.name, node.kind])).toEqual([
      ["A", "class"],
      ["x", "constant"],
    ]);
    // A merged declaration covers every place it is declared.
    expect(outline[0].range).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 1, character: 11 },
    });
    expect(outline[0].selectionRange).toEqual({
      start: { line: 0, character: 6 },
      end: { line: 0, character: 7 },
    });
  });
});
