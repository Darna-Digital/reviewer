import { describe, expect, it } from "vitest";
import {
  NO_ROWS,
  anchorRow,
  extendToRow,
  selectRow,
  selectedRows,
  type RowSelection,
} from "./row-selection";

const ORDER = ["a", "b", "c", "d", "e"];

const rows = (selection: RowSelection): ReadonlyArray<string> =>
  selectedRows(ORDER, selection);

describe("selectRow", () => {
  it("selects the one row and anchors on it", () => {
    expect(rows(selectRow("c"))).toEqual(["c"]);
    expect(selectRow("c").anchor).toBe("c");
  });
});

describe("anchorRow", () => {
  it("selects nothing, but is where the next sweep starts", () => {
    expect(rows(anchorRow("b"))).toEqual([]);
    expect(rows(extendToRow(ORDER, anchorRow("b"), "d"))).toEqual([
      "b",
      "c",
      "d",
    ]);
  });
});

describe("extendToRow", () => {
  it("sweeps from the anchor down", () => {
    expect(rows(extendToRow(ORDER, selectRow("b"), "d"))).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("sweeps from the anchor up", () => {
    expect(rows(extendToRow(ORDER, selectRow("d"), "b"))).toEqual([
      "b",
      "c",
      "d",
    ]);
  });

  it("keeps the anchor, so a second sweep re-measures rather than grows", () => {
    const wide = extendToRow(ORDER, selectRow("b"), "e");
    expect(rows(extendToRow(ORDER, wide, "c"))).toEqual(["b", "c"]);
  });

  it("is a plain click when there is no anchor to measure from", () => {
    expect(rows(extendToRow(ORDER, NO_ROWS, "c"))).toEqual(["c"]);
  });

  it("is a plain click when the anchor has left the list", () => {
    const stale = { ids: new Set(["z"]), anchor: "z" };
    expect(rows(extendToRow(ORDER, stale, "c"))).toEqual(["c"]);
    expect(extendToRow(ORDER, stale, "c").anchor).toBe("c");
  });
});

describe("selectedRows", () => {
  it("answers in list order, whatever order rows were picked in", () => {
    expect(rows({ ids: new Set(["d", "a"]), anchor: "d" })).toEqual(["a", "d"]);
  });

  it("drops rows the list no longer holds", () => {
    expect(rows({ ids: new Set(["a", "gone"]), anchor: "a" })).toEqual(["a"]);
  });
});
