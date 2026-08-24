import { describe, expect, it } from "vitest";
import { createFormattingFunctions } from "./formatting.functions";
import { mockFormattingDependencies } from "./formatting.functions.mock";

const FILE = "src/a.ts";

describe("formatBeforeSave", () => {
  it("formats the buffer and describes the edit that gets there", async () => {
    const { deps, calls } = mockFormattingDependencies({
      formatted: { [FILE]: "const a = 1;\n" },
    });
    const outcome = await createFormattingFunctions(deps).formatBeforeSave(
      FILE,
      "const a = 1"
    );
    expect(outcome.contents).toBe("const a = 1;\n");
    expect(outcome.edit).not.toBeNull();
    expect(calls.format).toEqual([{ path: FILE, contents: "const a = 1" }]);
  });

  it("leaves the buffer alone when the formatter changed nothing", async () => {
    const { deps } = mockFormattingDependencies({
      formatted: { [FILE]: "const a = 1;\n" },
    });
    const outcome = await createFormattingFunctions(deps).formatBeforeSave(
      FILE,
      "const a = 1;\n"
    );
    expect(outcome).toEqual({ contents: "const a = 1;\n", edit: null });
  });

  it("does not ask when the user has formatting off", async () => {
    const { deps, calls } = mockFormattingDependencies({
      enabled: false,
      formatted: { [FILE]: "const a = 1;\n" },
    });
    const outcome = await createFormattingFunctions(deps).formatBeforeSave(
      FILE,
      "const a = 1"
    );
    expect(outcome).toEqual({ contents: "const a = 1", edit: null });
    expect(calls.format).toEqual([]);
  });

  it("does not ask when the project has no formatter", async () => {
    const { deps, calls } = mockFormattingDependencies({ available: false });
    await createFormattingFunctions(deps).formatBeforeSave(FILE, "const a = 1");
    expect(calls.format).toEqual([]);
  });

  /** A save must survive a formatter with an opinion about broken syntax. */
  it("saves what the user typed when formatting fails, and says why", async () => {
    const { deps, calls } = mockFormattingDependencies({
      failure: "Unexpected token (1:9)",
    });
    const outcome = await createFormattingFunctions(deps).formatBeforeSave(
      FILE,
      "const a ="
    );
    expect(outcome).toEqual({ contents: "const a =", edit: null });
    expect(calls.failures).toEqual(["Unexpected token (1:9)"]);
  });
});
