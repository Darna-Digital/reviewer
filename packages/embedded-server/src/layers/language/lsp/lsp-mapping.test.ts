import { describe, expect, it } from "vitest";
import {
  hoverContents,
  originSelectionRange,
  pathToUri,
  severityOfLsp,
  tagsOfLsp,
  toDiagnostic,
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
