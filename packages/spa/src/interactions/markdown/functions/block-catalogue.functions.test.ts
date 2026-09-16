import { describe, expect, it } from "vitest";
import {
  BLOCK_COMMANDS,
  convertibleBlockCommands,
  groupedBlockCommands,
  matchingBlockCommands,
} from "./block-catalogue.functions";
import type { BlockChain } from "../interfaces/markdown.interfaces";

/**
 * A chain that writes down what was asked of it instead of doing it.
 *
 * The catalogue only ever speaks to this interface, so what each entry does to
 * a document can be checked without a live editor, a DOM, or a schema.
 */
function recordingChain(): BlockChain & { calls: string[] } {
  const calls: string[] = [];
  const chain = new Proxy(
    { calls },
    {
      get: (_target, key: string) => {
        if (key === "calls") return calls;
        return (...args: unknown[]) => {
          calls.push(
            args.length === 0 ? key : `${key}(${JSON.stringify(args[0])})`
          );
          return key === "run" ? true : chain;
        };
      },
    }
  ) as BlockChain & { calls: string[] };
  return chain;
}

describe("matchingBlockCommands", () => {
  it("offers everything before anything is typed", () => {
    expect(matchingBlockCommands("")).toHaveLength(BLOCK_COMMANDS.length);
    expect(matchingBlockCommands("   ")).toHaveLength(BLOCK_COMMANDS.length);
  });

  it("matches a keyword by its start, not anywhere inside it", () => {
    expect(matchingBlockCommands("head").map((entry) => entry.id)).toEqual([
      "heading-1",
      "heading-2",
      "heading-3",
    ]);
    // "code" appears inside no keyword's middle, so a mid-word query finds it
    // only if matching were substring-based.
    expect(matchingBlockCommands("ode")).toEqual([]);
  });

  it("ignores case and surrounding space", () => {
    expect(matchingBlockCommands("  TODO ").map((entry) => entry.id)).toEqual([
      "todo-list",
    ]);
  });

  it("matches the markdown a writer would reach for", () => {
    // `##` is a prefix of `###` too, so both headings stand — which is the
    // point of prefix matching: the list narrows as you keep typing.
    expect(matchingBlockCommands("##").map((entry) => entry.id)).toEqual([
      "heading-2",
      "heading-3",
    ]);
    expect(matchingBlockCommands("###").map((entry) => entry.id)).toEqual([
      "heading-3",
    ]);
  });

  it("answers an unknown query with nothing rather than everything", () => {
    expect(matchingBlockCommands("kanban")).toEqual([]);
  });
});

describe("convertibleBlockCommands", () => {
  it("offers the blocks an existing one can become", () => {
    const ids = convertibleBlockCommands().map((entry) => entry.id);
    expect(ids).toContain("quote");
    expect(ids).not.toContain("divider");
    expect(ids).not.toContain("table");
  });
});

describe("groupedBlockCommands", () => {
  it("keeps the catalogue's own order of sections", () => {
    expect(groupedBlockCommands(BLOCK_COMMANDS).map((s) => s.group)).toEqual([
      "Basic blocks",
      "Advanced blocks",
    ]);
  });

  it("drops a section the query has emptied", () => {
    const groups = groupedBlockCommands(matchingBlockCommands("head"));
    expect(groups.map((section) => section.group)).toEqual(["Basic blocks"]);
  });
});

describe("what each entry does to a block", () => {
  const apply = (id: string) => {
    const chain = recordingChain();
    BLOCK_COMMANDS.find((entry) => entry.id === id)!.apply(chain);
    return chain.calls;
  };

  it("clears the block it is converting before setting the new one", () => {
    // Turning a quoted bullet into a heading has to undo both wrappers first,
    // or the heading lands inside them.
    expect(apply("heading-1")).toEqual([
      "clearNodes",
      'setHeading({"level":1})',
    ]);
  });

  it("inserts a divider without clearing the block it was called from", () => {
    expect(apply("divider")).toEqual(["setHorizontalRule"]);
  });

  it("gives a new table a header row, which is the only row GFM requires", () => {
    expect(apply("table")).toEqual([
      'insertTable({"rows":3,"cols":3,"withHeaderRow":true})',
    ]);
  });

  it("has a distinct id for every entry", () => {
    const ids = BLOCK_COMMANDS.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
