import { describe, expect, it } from "vitest";
import { asEditMode } from "./edit-mode.functions";

describe("asEditMode", () => {
  it("keeps a mode it recognises", () => {
    expect(asEditMode({ editMode: "comment" })).toBe("comment");
    expect(asEditMode({ editMode: "vim" })).toBe("vim");
  });

  it("falls back to normal for anything it does not", () => {
    expect(asEditMode({})).toBe("normal");
    expect(asEditMode({ editMode: "insert" })).toBe("normal");
    expect(asEditMode({ editMode: null })).toBe("normal");
  });

  it("carries the old Vim switch over, so an upgrade does not turn it off", () => {
    expect(asEditMode({ vimMode: true })).toBe("vim");
    expect(asEditMode({ vimMode: false })).toBe("normal");
  });

  it("prefers the mode over the switch once one has been written", () => {
    expect(asEditMode({ editMode: "normal", vimMode: true })).toBe("normal");
  });
});
