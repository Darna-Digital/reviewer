import { describe, expect, it } from "vitest";
import {
  basenameOf,
  branchIds,
  branchPathTo,
  buildUsageTree,
  categoryOf,
  createFindUsagesFunctions,
  declarationLabel,
  directoryOf,
  previewParts,
  previewedUsage,
  revealing,
  stepUsage,
  toggleCollapsed,
  usageLeaves,
  visibleRows,
} from "./find-usages.functions";
import {
  mockFindUsagesDependencies,
  usage,
} from "./find-usages.functions.mock";
import type {
  UsageGroup,
  UsageNode,
} from "../interfaces/find-usages.interfaces";

const group = (node: UsageNode): UsageGroup => {
  if (node.kind === "usage") throw new Error("expected a branch, got a usage");
  return node;
};

/** The tree read as `kind:label` per level, for compact assertions. */
const shape = (nodes: ReadonlyArray<UsageNode>): unknown =>
  nodes.map((node) =>
    node.kind === "usage"
      ? `usage:${node.reference.location.path}:${node.reference.location.range.start.line}`
      : { [`${node.kind}:${node.label}`]: shape(node.children) }
  );

describe("directoryOf / basenameOf", () => {
  it("splits a path", () => {
    expect(directoryOf("src/a/b.ts")).toBe("src/a");
    expect(basenameOf("src/a/b.ts")).toBe("b.ts");
  });

  it("treats a root-level file as having no directory", () => {
    expect(directoryOf("index.ts")).toBe("");
    expect(basenameOf("index.ts")).toBe("index.ts");
  });
});

describe("categoryOf", () => {
  it("keeps a bare reference unclassified rather than calling it a read", () => {
    expect(categoryOf("read")).toBe("unclassified");
  });

  it("names the kinds a provider can see", () => {
    expect(categoryOf("definition")).toBe("declaration");
    expect(categoryOf("import")).toBe("import");
    expect(categoryOf("export")).toBe("export");
    expect(categoryOf("write")).toBe("write");
  });
});

describe("buildUsageTree", () => {
  it("folds references into category, directory, file and container", () => {
    const tree = buildUsageTree([
      usage("src/a/b.ts", 4, { containerName: "Product" }),
      usage("src/a/b.ts", 9, { containerName: "Product" }),
      usage("src/a/c.ts", 2, { kind: "import" }),
    ]);

    expect(shape(tree)).toEqual([
      {
        "category:Unclassified": [
          {
            "directory:src/a": [
              {
                "file:b.ts": [
                  {
                    "container:Product": [
                      "usage:src/a/b.ts:4",
                      "usage:src/a/b.ts:9",
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        "category:Usage in import": [
          { "directory:src/a": [{ "file:c.ts": ["usage:src/a/c.ts:2"] }] },
        ],
      },
    ]);
  });

  it("leaves out the levels that would say nothing", () => {
    const tree = buildUsageTree([usage("index.ts", 0)]);
    // No directory row for a root-level file, no container row for a usage the
    // provider could not place.
    expect(shape(tree)).toEqual([
      { "category:Unclassified": [{ "file:index.ts": ["usage:index.ts:0"] }] },
    ]);
  });

  it("counts every usage beneath a branch", () => {
    const tree = buildUsageTree([
      usage("src/a/b.ts", 1),
      usage("src/a/b.ts", 2),
      usage("src/a/c.ts", 3),
    ]);
    const category = group(tree[0]);
    expect(category.count).toBe(3);
    expect(group(category.children[0]).count).toBe(3);
  });

  it("orders categories by how much they say, not by arrival", () => {
    const tree = buildUsageTree([
      usage("src/a.ts", 1, { kind: "import" }),
      usage("src/a.ts", 2, { kind: "read" }),
      usage("src/a.ts", 3, { kind: "definition" }),
    ]);
    expect(tree.map((node) => group(node).label)).toEqual([
      "Declaration",
      "Unclassified",
      "Usage in import",
    ]);
  });

  it("keeps document order within a level", () => {
    const tree = buildUsageTree([
      usage("src/a/z.ts", 1),
      usage("src/a/a.ts", 1),
    ]);
    const directory = group(group(tree[0]).children[0]);
    expect(directory.children.map((node) => group(node).label)).toEqual([
      "z.ts",
      "a.ts",
    ]);
  });

  it("puts a file's own usages after the containers inside it", () => {
    const tree = buildUsageTree([
      usage("src/a.ts", 1),
      usage("src/a.ts", 2, { containerName: "run" }),
    ]);
    const file = group(group(group(tree[0]).children[0]).children[0]);
    expect(shape(file.children)).toEqual([
      { "container:run": ["usage:src/a.ts:2"] },
      "usage:src/a.ts:1",
    ]);
  });

  it("gives a usage the same id whichever search found it", () => {
    const first = usageLeaves(buildUsageTree([usage("src/a.ts", 7)]));
    const again = usageLeaves(
      buildUsageTree([usage("src/z.ts", 1), usage("src/a.ts", 7)])
    );
    expect(again.map((leaf) => leaf.id)).toContain(first[0].id);
  });
});

describe("visibleRows", () => {
  const tree = buildUsageTree([usage("src/a/b.ts", 4), usage("src/a/b.ts", 9)]);

  it("walks the whole tree while everything is open", () => {
    expect(visibleRows(tree, new Set()).map((row) => row.depth)).toEqual([
      0, 1, 2, 3, 3,
    ]);
  });

  it("stops at a collapsed branch but still draws it", () => {
    const category = group(tree[0]);
    const rows = visibleRows(tree, new Set([category.id]));
    expect(rows).toHaveLength(1);
    expect(rows[0].expanded).toBe(false);
  });
});

describe("stepUsage", () => {
  const leaves = usageLeaves(
    buildUsageTree([
      usage("src/a.ts", 1),
      usage("src/a.ts", 2),
      usage("src/a.ts", 3),
    ])
  );

  it("starts at the top going forwards and the bottom going back", () => {
    expect(stepUsage(leaves, null, 1)).toBe(leaves[0]);
    expect(stepUsage(leaves, null, -1)).toBe(leaves[2]);
  });

  it("clamps rather than wrapping at either end", () => {
    expect(stepUsage(leaves, leaves[2].id, 1)).toBe(leaves[2]);
    expect(stepUsage(leaves, leaves[0].id, -1)).toBe(leaves[0]);
  });

  it("has nothing to step to in an empty result", () => {
    expect(stepUsage([], null, 1)).toBeNull();
  });
});

describe("toggleCollapsed", () => {
  it("shuts an open branch and opens a shut one", () => {
    const shut = toggleCollapsed(new Set(), "category:read");
    expect([...shut]).toEqual(["category:read"]);
    expect([...toggleCollapsed(shut, "category:read")]).toEqual([]);
  });

  it("leaves the set it was given alone", () => {
    const collapsed = new Set(["a"]);
    toggleCollapsed(collapsed, "b");
    expect([...collapsed]).toEqual(["a"]);
  });
});

describe("branchIds", () => {
  it("lists every branch and no usages", () => {
    const tree = buildUsageTree([usage("src/a/b.ts", 1)]);
    expect(branchIds(tree)).toHaveLength(3);
  });
});

describe("createFindUsagesFunctions", () => {
  it("reads its results and its folded branches from the injected data", () => {
    const tree = buildUsageTree([usage("src/a/b.ts", 1)]);
    const fns = createFindUsagesFunctions(
      mockFindUsagesDependencies({
        references: [usage("src/a/b.ts", 1)],
        collapsed: [group(tree[0]).id],
      })
    );
    expect(fns.rows()).toHaveLength(1);
    expect(fns.usages()).toHaveLength(1);
    expect(fns.step(null, 1)?.id).toBe(fns.usages()[0].id);
    // The one row on screen is the folded category, and it stands for the
    // usage inside it.
    expect(fns.previewed(fns.rows()[0].node.id)?.id).toBe(fns.usages()[0].id);
  });
});

describe("previewParts", () => {
  it("picks the name out of the line it sits in", () => {
    expect(previewParts("const a = greet(name)", "greet")).toEqual([
      { at: 0, text: "const a = ", match: false },
      { at: 10, text: "greet", match: true },
      { at: 15, text: "(name)", match: false },
    ]);
  });

  it("marks every occurrence, not just the first", () => {
    expect(
      previewParts("greet(greet)", "greet").filter((part) => part.match)
    ).toHaveLength(2);
  });

  it("leaves a line the name is not in alone", () => {
    expect(previewParts("const a = 1", "greet")).toEqual([
      { at: 0, text: "const a = 1", match: false },
    ]);
  });

  it("leaves the line alone when there is no name to look for", () => {
    expect(previewParts("const a = 1", "")).toEqual([
      { at: 0, text: "const a = 1", match: false },
    ]);
  });

  it("gives the parts of a line distinct keys", () => {
    const parts = previewParts("greet(greet)", "greet");
    expect(new Set(parts.map((part) => part.at)).size).toBe(parts.length);
  });
});

describe("previewedUsage", () => {
  const tree = buildUsageTree([usage("src/a.ts", 1), usage("src/a.ts", 2)]);
  const leaves = usageLeaves(tree);

  it("is the row itself when the cursor is on a usage", () => {
    expect(previewedUsage(tree, leaves[1].id)).toBe(leaves[1]);
  });

  it("is a branch's first usage when the cursor is on the branch", () => {
    expect(previewedUsage(tree, tree[0].id)).toBe(leaves[0]);
  });

  it("is nothing for no cursor, or a row that is no longer there", () => {
    expect(previewedUsage(tree, null)).toBeNull();
    expect(previewedUsage(tree, "category:gone")).toBeNull();
  });
});

describe("branchPathTo", () => {
  const tree = buildUsageTree([usage("src/a/b.ts", 1)]);
  const leaf = usageLeaves(tree)[0];

  it("lists the branches standing between the root and a usage", () => {
    expect(branchPathTo(tree, leaf.id)).toHaveLength(3);
  });

  it("survives a directory whose name holds slashes of its own", () => {
    // The ids are built by joining, so they cannot be split apart again.
    expect(branchPathTo(tree, leaf.id)[1]).toContain("dir:src/a");
  });

  it("has no path to a row that is not in the tree", () => {
    expect(branchPathTo(tree, "nowhere")).toEqual([]);
  });
});

describe("revealing", () => {
  const tree = buildUsageTree([usage("src/a/b.ts", 1)]);
  const leaf = usageLeaves(tree)[0];

  it("opens everything that was hiding the row", () => {
    const shut = new Set(branchIds(tree));
    expect([...revealing(shut, tree, leaf.id)]).toEqual([]);
  });

  it("leaves branches the row does not sit under folded", () => {
    const other = buildUsageTree([
      usage("src/a/b.ts", 1),
      usage("src/z.ts", 1, { kind: "import" }),
    ]);
    const target = usageLeaves(other)[0];
    const shut = new Set(branchIds(other));
    const opened = revealing(shut, other, target.id);
    expect(opened.has("category:import")).toBe(true);
  });

  it("leaves the set it was given alone", () => {
    const shut = new Set(branchIds(tree));
    const before = shut.size;
    revealing(shut, tree, leaf.id);
    expect(shut.size).toBe(before);
  });
});

describe("declarationLabel", () => {
  it("does not print the kind twice", () => {
    expect(
      declarationLabel({
        kind: "function",
        name: "function greet(name: string): string",
        preview: "",
      })
    ).toBe("greet(name: string): string");
  });

  it("keeps a name that does not start with its kind", () => {
    expect(declarationLabel({ kind: "class", name: "Box", preview: "" })).toBe(
      "Box"
    );
  });

  it("falls back to the source line when the provider names nothing", () => {
    expect(
      declarationLabel({ kind: "", name: "", preview: "export const a = 1" })
    ).toBe("export const a = 1");
  });
});
