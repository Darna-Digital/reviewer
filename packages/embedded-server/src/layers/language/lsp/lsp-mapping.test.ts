import { describe, expect, it } from "vitest";
import {
  hoverContents,
  localiseHoverLinks,
  originSelectionRange,
  pathToUri,
  severityOfLsp,
  symbolKindOfLsp,
  tagsOfLsp,
  toDiagnostic,
  toDocumentSymbols,
  toLocations,
  toPosition,
  toRange,
  uriToPath,
} from "./lsp-mapping.ts";

const RANGE = {
  start: { line: 3, character: 4 },
  end: { line: 3, character: 9 },
};

describe("toPosition / toRange", () => {
  it("passes through a well-formed position", () => {
    expect(toPosition({ line: 2, character: 7 })).toEqual({
      line: 2,
      character: 7,
    });
  });
  it("clamps negatives and non-numbers to zero", () => {
    expect(toPosition({ line: -4, character: "x" })).toEqual({
      line: 0,
      character: 0,
    });
    expect(toPosition(undefined)).toEqual({ line: 0, character: 0 });
  });
  it("truncates a fractional position", () => {
    expect(toPosition({ line: 2.9, character: 1.5 })).toEqual({
      line: 2,
      character: 1,
    });
  });
  it("falls back to an empty range", () => {
    expect(toRange("nope")).toEqual({
      start: { line: 0, character: 0 },
      end: { line: 0, character: 0 },
    });
  });
});

describe("severityOfLsp", () => {
  it("maps the four LSP levels", () => {
    expect(severityOfLsp(1)).toBe("error");
    expect(severityOfLsp(2)).toBe("warning");
    expect(severityOfLsp(3)).toBe("information");
    expect(severityOfLsp(4)).toBe("hint");
  });
  it("treats an omitted severity as an error, like every editor does", () => {
    expect(severityOfLsp(undefined)).toBe("error");
    expect(severityOfLsp("high")).toBe("error");
  });
});

describe("tagsOfLsp", () => {
  it("maps the tag numbers", () => {
    expect(tagsOfLsp([1])).toEqual(["unnecessary"]);
    expect(tagsOfLsp([2])).toEqual(["deprecated"]);
    expect(tagsOfLsp([2, 1])).toEqual(["unnecessary", "deprecated"]);
  });
  it("ignores unknown tags and non-arrays", () => {
    expect(tagsOfLsp([9])).toEqual([]);
    expect(tagsOfLsp(undefined)).toEqual([]);
  });
});

describe("uriToPath / pathToUri", () => {
  it("round-trips an absolute path", () => {
    expect(uriToPath(pathToUri("/home/dev/repo/src/a.ts"))).toBe(
      "/home/dev/repo/src/a.ts"
    );
  });
  it("decodes percent-escapes", () => {
    expect(uriToPath("file:///home/dev/my%20repo/a.ts")).toBe(
      "/home/dev/my repo/a.ts"
    );
  });
  it("escapes characters that need it", () => {
    expect(pathToUri("/home/dev/my repo/a.ts")).toBe(
      "file:///home/dev/my%20repo/a.ts"
    );
  });
  it("rejects a non-file scheme", () => {
    expect(uriToPath("untitled:Untitled-1")).toBeNull();
    expect(uriToPath("https://example.com/a.ts")).toBeNull();
    expect(uriToPath(42)).toBeNull();
  });
});

describe("toLocations", () => {
  it("accepts a single Location", () => {
    expect(toLocations({ uri: "file:///a.ts", range: RANGE })).toEqual([
      { uri: "file:///a.ts", range: RANGE },
    ]);
  });
  it("accepts an array of Locations", () => {
    expect(
      toLocations([
        { uri: "file:///a.ts", range: RANGE },
        { uri: "file:///b.ts", range: RANGE },
      ])
    ).toHaveLength(2);
  });
  it("prefers a LocationLink's selection range over its full range", () => {
    expect(
      toLocations([
        {
          targetUri: "file:///a.ts",
          targetRange: {
            start: { line: 0, character: 0 },
            end: { line: 9, character: 0 },
          },
          targetSelectionRange: RANGE,
        },
      ])
    ).toEqual([{ uri: "file:///a.ts", range: RANGE }]);
  });
  it("falls back to a LocationLink's full range", () => {
    expect(
      toLocations([{ targetUri: "file:///a.ts", targetRange: RANGE }])
    ).toEqual([{ uri: "file:///a.ts", range: RANGE }]);
  });
  it("returns nothing for null, undefined or junk", () => {
    expect(toLocations(null)).toEqual([]);
    expect(toLocations(undefined)).toEqual([]);
    expect(toLocations([{ noUri: true }, "string"])).toEqual([]);
  });
});

describe("originSelectionRange", () => {
  it("finds the origin of a LocationLink response", () => {
    expect(
      originSelectionRange([
        { targetUri: "file:///a.ts", originSelectionRange: RANGE },
      ])
    ).toEqual(RANGE);
  });
  it("returns null for a plain Location response", () => {
    expect(
      originSelectionRange([{ uri: "file:///a.ts", range: RANGE }])
    ).toBeNull();
    expect(originSelectionRange(null)).toBeNull();
  });
});

describe("toDiagnostic", () => {
  it("maps a full diagnostic", () => {
    expect(
      toDiagnostic(
        {
          range: RANGE,
          severity: 2,
          code: 4001,
          source: "rustc",
          message: "unused variable",
          tags: [1],
        },
        "rust-analyzer"
      )
    ).toEqual({
      range: RANGE,
      severity: "warning",
      code: "4001",
      source: "rustc",
      message: "unused variable",
      tags: ["unnecessary"],
      related: [],
    });
  });
  it("falls back to the server id when the diagnostic names no source", () => {
    expect(
      toDiagnostic({ range: RANGE, message: "boom" }, "rust-analyzer")?.source
    ).toBe("rust-analyzer");
  });
  it("keeps a string code", () => {
    expect(
      toDiagnostic({ range: RANGE, message: "x", code: "E0425" }, "s")?.code
    ).toBe("E0425");
  });
  it("rejects an entry with no message", () => {
    expect(toDiagnostic({ range: RANGE }, "s")).toBeNull();
    expect(toDiagnostic("nope", "s")).toBeNull();
  });
});

describe("hoverContents", () => {
  it("passes markdown through", () => {
    expect(hoverContents({ kind: "markdown", value: "**bold**" })).toBe(
      "**bold**"
    );
  });
  it("fences a language-tagged MarkedString", () => {
    expect(hoverContents({ language: "rust", value: "fn main()" })).toBe(
      "```rust\nfn main()\n```"
    );
  });
  it("accepts a bare string", () => {
    expect(hoverContents("plain")).toBe("plain");
  });
  it("joins an array, skipping empty parts", () => {
    expect(
      hoverContents([{ language: "rust", value: "fn main()" }, "", "Docs."])
    ).toBe("```rust\nfn main()\n```\n\nDocs.");
  });
  it("returns an empty string for nothing usable", () => {
    expect(hoverContents(null)).toBe("");
    expect(hoverContents({})).toBe("");
  });
});

describe("localiseHoverLinks", () => {
  const root = "/work/blog";

  it("names a link inside the repository the way the app addresses files", () => {
    // ruby-lsp answers a hover for a constant with where it is defined.
    expect(
      localiseHoverLinks(
        "**Definitions**: [article.rb](file:///work/blog/app/models/article.rb#L1,1-7,4)",
        root
      )
    ).toBe("**Definitions**: [article.rb](app/models/article.rb#L1,1-7,4)");
  });

  it("leaves a definition outside the repository as it came", () => {
    // A gem, or the standard library: nothing in the app can open it, and a
    // link that still says `file://` is at least honest about that.
    const gem =
      "[base.rb](file:///home/me/.gem/activerecord-7.1.3/lib/base.rb#L12)";
    expect(localiseHoverLinks(gem, root)).toBe(gem);
  });

  it("leaves documentation links alone", () => {
    const docs = "See [the guide](https://guides.rubyonrails.org/#models).";
    expect(localiseHoverLinks(docs, root)).toBe(docs);
  });

  it("passes documentation with no links through untouched", () => {
    const markdown = "```ruby\nArticle\n```\n\nAn article (a model).";
    expect(localiseHoverLinks(markdown, root)).toBe(markdown);
  });
});

describe("symbolKindOfLsp", () => {
  it("names every SymbolKind from 1 to 26", () => {
    expect(
      Array.from({ length: 26 }, (_, index) => symbolKindOfLsp(index + 1))
    ).toEqual([
      "file",
      "module",
      "namespace",
      "package",
      "class",
      "method",
      "property",
      "field",
      "constructor",
      "enum",
      "interface",
      "function",
      "variable",
      "constant",
      "string",
      "number",
      "boolean",
      "array",
      "object",
      "key",
      "null",
      "enummember",
      "struct",
      "event",
      "operator",
      "typeparameter",
    ]);
  });
  it("reads an unknown or missing kind as a variable", () => {
    expect(symbolKindOfLsp(0)).toBe("variable");
    expect(symbolKindOfLsp(99)).toBe("variable");
    expect(symbolKindOfLsp(undefined)).toBe("variable");
  });
});

describe("toDocumentSymbols", () => {
  const lines = (from: number, to: number) => ({
    start: { line: from, character: 0 },
    end: { line: to, character: 3 },
  });
  const name = (line: number) => ({
    start: { line, character: 6 },
    end: { line, character: 10 },
  });

  it("flattens a DocumentSymbol tree parents first", () => {
    const symbols = toDocumentSymbols([
      {
        name: "Blog",
        kind: 2,
        range: lines(0, 20),
        selectionRange: name(0),
        children: [
          {
            name: "Post",
            kind: 5,
            range: lines(1, 10),
            selectionRange: name(1),
            children: [
              {
                name: "title",
                kind: 6,
                range: lines(5, 7),
                selectionRange: name(5),
              },
              {
                name: "initialize",
                kind: 9,
                range: lines(2, 4),
                selectionRange: name(2),
              },
            ],
          },
        ],
      },
      {
        name: "VERSION",
        kind: 14,
        range: lines(21, 21),
        selectionRange: name(21),
      },
      { kind: 12, range: lines(22, 22) },
    ]);
    expect(
      symbols.map((s) => [s.depth, s.kind, s.name, s.containerName])
    ).toEqual([
      [0, "module", "Blog", ""],
      [1, "class", "Post", "Blog"],
      [2, "constructor", "initialize", "Post"],
      [2, "method", "title", "Post"],
      [0, "constant", "VERSION", ""],
    ]);
    expect(symbols[1].range).toEqual(lines(1, 10));
    expect(symbols[1].selectionRange).toEqual(name(1));
  });

  it("nests a flat SymbolInformation list by its ranges", () => {
    const uri = "file:///work/blog/app.rb";
    const symbols = toDocumentSymbols([
      {
        name: "title",
        kind: 6,
        containerName: "Post",
        location: { uri, range: lines(2, 4) },
      },
      { name: "Post", kind: 5, location: { uri, range: lines(1, 10) } },
      { name: "helper", kind: 12, location: { uri, range: lines(11, 12) } },
    ]);
    expect(
      symbols.map((s) => [s.depth, s.kind, s.name, s.containerName])
    ).toEqual([
      [0, "class", "Post", ""],
      [1, "method", "title", "Post"],
      [0, "function", "helper", ""],
    ]);
    // A flat answer has one range; it serves as both.
    expect(symbols[1].selectionRange).toEqual(lines(2, 4));
  });

  it("answers nothing for an empty or malformed response", () => {
    expect(toDocumentSymbols(null)).toEqual([]);
    expect(toDocumentSymbols({})).toEqual([]);
    expect(toDocumentSymbols([])).toEqual([]);
  });
});
